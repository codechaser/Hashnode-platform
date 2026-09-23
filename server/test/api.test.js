process.env.NODE_ENV = "test";
process.env.MONGO_URI = process.env.MONGO_TEST_URI || "mongodb://127.0.0.1:27017/hashnode_test";
process.env.JWT_SECRET = `test-secret-${process.pid}`;

const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { before, after, beforeEach, describe, test } = require("node:test");
const { app } = require("../server");
const User = require("../models/User");
const Bookmark = require("../models/Bookmark");
const Follow = require("../models/Follow");
const Subscription = require("../models/Subscription");
const { isValidProSubscription } = require("../services/subscriptionService");
const requirePro = require("../middleware/requirePro");
const Post = require("../models/Post");
const {
  request,
  registerUser,
  loginUser,
  createAuthenticatedUser,
  createPost,
  createComment,
  createTag,
  clearCollections,
} = require("./helpers");

let server;
let baseUrl;

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await clearCollections();
  server = await new Promise((resolve) => {
    const httpServer = app.listen(0, "127.0.0.1", () => resolve(httpServer));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await clearCollections();
});

after(async () => {
  await clearCollections();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("health", () => {
  test("returns a safe API health response", async () => {
    const response = await request(baseUrl, "/api/health");

    assert.equal(response.status, 200);
    assert.deepEqual(response.data, {
      status: "ok",
      service: "hashnode-api",
    });
  });
});

describe("billing and PRO access", () => {
  test("requires authentication and returns safe FREE details by default", async () => {
    const unauthenticated = await request(baseUrl, "/api/billing/me");
    const user = await createAuthenticatedUser(baseUrl, "Free Billing User");
    const free = await request(baseUrl, "/api/billing/me", { token: user.token });

    assert.equal(unauthenticated.status, 401);
    assert.equal(free.status, 200);
    assert.deepEqual(free.data, { plan: "free", status: "inactive", currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });
    assert.equal("provider" in free.data, false);
    assert.equal("providerSubscriptionId" in free.data, false);
  });

  test("returns PRO details and treats inactive or expired subscriptions as non-PRO", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Pro Billing User");
    await Subscription.create({ user: user.id, plan: "pro", status: "active", provider: "future-provider", providerSubscriptionId: "secret-id", currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 2592000000) });

    const pro = await request(baseUrl, "/api/billing/me", { token: user.token });
    assert.equal(pro.status, 200);
    assert.equal(pro.data.plan, "pro");
    assert.equal(pro.data.status, "active");
    assert.equal("provider" in pro.data, false);
    assert.equal("providerSubscriptionId" in pro.data, false);
    assert.equal(isValidProSubscription(await Subscription.findOne({ user: user.id }).lean()), true);

    await Subscription.updateOne({ user: user.id }, { status: "expired" });
    assert.equal(isValidProSubscription(await Subscription.findOne({ user: user.id }).lean()), false);
    await Subscription.updateOne({ user: user.id }, { status: "active", currentPeriodEnd: new Date(Date.now() - 1000) });
    assert.equal(isValidProSubscription(await Subscription.findOne({ user: user.id }).lean()), false);
  });

  test("requirePro policy blocks free users and allows valid PRO users", async () => {
    const freeUser = await createAuthenticatedUser(baseUrl, "Free Access User");
    const proUser = await createAuthenticatedUser(baseUrl, "Pro Access User");
    await Subscription.create({ user: proUser.id, plan: "pro", status: "active", currentPeriodEnd: new Date(Date.now() + 86400000) });

    assert.equal(isValidProSubscription(await Subscription.findOne({ user: freeUser.id }).lean()), false);
    assert.equal(isValidProSubscription(await Subscription.findOne({ user: proUser.id }).lean()), true);
    assert.equal((await runRequirePro(freeUser.token)).status, 403);
    assert.equal((await runRequirePro(proUser.token)).next, true);
  });
});

function runRequirePro(token) {
  return new Promise((resolve) => {
    const result = {};
    const req = { get: (header) => header === "Authorization" ? `Bearer ${token}` : undefined };
    const res = { status: (status) => { result.status = status; return res; }, json: (body) => { result.body = body; resolve(result); } };
    requirePro(req, res, () => { result.next = true; resolve(result); });
  });
}

describe("authentication", () => {
  test("registers valid users and rejects invalid registration data", async () => {
    const valid = await registerUser(baseUrl, "Valid User");
    assert.equal(valid.status, 201);
    assert.ok(valid.data.user.id);
    assert.equal("password" in valid.data.user, false);
    assert.equal("hash" in valid.data.user, false);

    const duplicate = await request(baseUrl, "/api/auth/register", { method: "POST", body: valid.credentials });
    const invalidEmail = await request(baseUrl, "/api/auth/register", { method: "POST", body: { ...valid.credentials, email: "invalid" } });
    const missing = await request(baseUrl, "/api/auth/register", { method: "POST", body: { name: "Missing" } });
    const shortPassword = await request(baseUrl, "/api/auth/register", { method: "POST", body: { ...valid.credentials, email: "short@example.com", password: "123" } });

    assert.equal(duplicate.status, 409);
    assert.equal(invalidEmail.status, 400);
    assert.equal(missing.status, 400);
    assert.equal(shortPassword.status, 400);
  });

  test("logs in valid users and returns safe authentication responses", async () => {
    const user = await registerUser(baseUrl, "Login User");
    const valid = await loginUser(baseUrl, user.credentials);
    const wrongPassword = await loginUser(baseUrl, { ...user.credentials, password: "wrong-password" });
    const unknownEmail = await loginUser(baseUrl, { ...user.credentials, email: "unknown@example.com" });
    const missing = await request(baseUrl, "/api/auth/login", { method: "POST", body: { email: user.credentials.email } });

    assert.equal(valid.status, 200);
    assert.ok(valid.token);
    assert.equal("password" in valid.data.user, false);
    assert.equal("hash" in valid.data.user, false);
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(missing.status, 400);
  });

  test("protects current-user lookup against missing, malformed, expired, and deleted sessions", async () => {
    const user = await createAuthenticatedUser(baseUrl, "Session User");
    const valid = await request(baseUrl, "/api/auth/me", { token: user.token });
    const missing = await request(baseUrl, "/api/auth/me");
    const malformed = await request(baseUrl, "/api/auth/me", { token: "not-a-token" });
    const expiredToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
    const expired = await request(baseUrl, "/api/auth/me", { token: expiredToken });
    await User.deleteOne({ _id: user.id });
    const deletedUser = await request(baseUrl, "/api/auth/me", { token: user.token });

    assert.equal(valid.status, 200);
    assert.equal(valid.data.user.name, "Session User");
    assert.equal("password" in valid.data.user, false);
    assert.equal(missing.status, 401);
    assert.equal(malformed.status, 401);
    assert.equal(expired.status, 401);
    assert.equal(deletedUser.status, 401);
  });
});

describe("posts and ownership", () => {
  test("creates posts only for authenticated JWT users and ignores forged authors", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Owner");
    const other = await createAuthenticatedUser(baseUrl, "Other");
    const created = await createPost(baseUrl, owner, { author: other.id });
    const unauthenticated = await request(baseUrl, "/api/posts", { method: "POST", body: created.payload });
    const invalid = await request(baseUrl, "/api/posts", { method: "POST", token: owner.token, body: { title: "Missing fields" } });

    assert.equal(created.status, 201);
    assert.equal(created.data.post.author, owner.id);
    assert.equal(unauthenticated.status, 401);
    assert.equal(invalid.status, 400);
  });

  test("lists an owner's posts newest first and validates post IDs", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Post Owner");
    const first = await createPost(baseUrl, owner, { title: "First" });
    const second = await createPost(baseUrl, owner, { title: "Second" });
    const posts = await request(baseUrl, "/api/posts", { token: owner.token });
    const invalid = await request(baseUrl, "/api/posts/not-an-id", { token: owner.token });
    const missing = await request(baseUrl, "/api/posts/000000000000000000000000", { token: owner.token });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(posts.status, 200);
    assert.equal(posts.data.posts[0].title, "Second");
    assert.equal(posts.data.posts[1].title, "First");
    assert.equal(invalid.status, 404);
    assert.equal(missing.status, 404);
  });

  test("allows only the owner to update and delete posts", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Owner");
    const other = await createAuthenticatedUser(baseUrl, "Other");
    const post = await createPost(baseUrl, owner, { title: "Editable" });
    const update = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "PUT", token: owner.token, body: { title: "Updated", slug: post.payload.slug, status: "published" } });
    const forbiddenUpdate = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "PUT", token: other.token, body: { title: "Nope", slug: post.payload.slug, status: "published" } });
    const invalidStatus = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "PUT", token: owner.token, body: { title: "Invalid", slug: post.payload.slug, status: "private" } });
    const unauthenticated = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "DELETE" });
    const forbiddenDelete = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "DELETE", token: other.token });
    const deleted = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "DELETE", token: owner.token });
    const missing = await request(baseUrl, `/api/posts/${post.data.post._id}`, { method: "DELETE", token: owner.token });

    assert.equal(update.status, 200);
    assert.equal(forbiddenUpdate.status, 403);
    assert.equal(invalidStatus.status, 400);
    assert.equal(unauthenticated.status, 401);
    assert.equal(forbiddenDelete.status, 403);
    assert.equal(deleted.status, 200);
    assert.equal(missing.status, 404);
  });

  test("rejects duplicate slugs during update", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Slug Owner");
    const first = await createPost(baseUrl, owner);
    const second = await createPost(baseUrl, owner);
    const response = await request(baseUrl, `/api/posts/${second.data.post._id}`, { method: "PUT", token: owner.token, body: { title: "Duplicate", slug: first.payload.slug, status: "published" } });

    assert.equal(response.status, 409);
  });
});

describe("public feed and articles", () => {
  test("filters published posts, searches titles, filters tags, and returns safe pagination", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Public Author");
    await createPost(baseUrl, owner, { title: "JavaScript Testing", tags: ["JavaScript"], status: "published" });
    await createPost(baseUrl, owner, { title: "Python Testing", tags: ["Python"], status: "published" });
    const draft = await createPost(baseUrl, owner, { title: "Hidden Draft", tags: ["JavaScript"], status: "draft" });
    const pageOne = await request(baseUrl, "/api/posts/feed?page=1&limit=1");
    const pageTwo = await request(baseUrl, "/api/posts/feed?page=2&limit=1");
    const search = await request(baseUrl, "/api/posts/feed?search=javascript");
    const tag = await request(baseUrl, "/api/posts/feed?tag=JAVASCRIPT");
    const combined = await request(baseUrl, "/api/posts/feed?search=javascript&tag=javascript");
    const invalid = await request(baseUrl, "/api/posts/feed?page=-1&limit=999");
    const draftPublic = await request(baseUrl, `/api/posts/${draft.payload.slug}`);

    assert.equal(pageOne.status, 200);
    assert.equal(pageTwo.status, 200);
    assert.equal(pageOne.data.posts.length, 1);
    assert.equal(pageTwo.data.posts.length, 1);
    assert.equal(pageOne.data.total, 2);
    assert.equal(pageOne.data.totalPages, 2);
    assert.equal(pageOne.data.hasNextPage, true);
    assert.equal(pageTwo.data.hasNextPage, false);
    assert.equal(search.data.posts.length, 1);
    assert.equal(tag.data.posts.length, 1);
    assert.equal(combined.data.posts.length, 1);
    assert.equal(invalid.data.page, 1);
    assert.equal(invalid.data.limit, 50);
    assert.equal(draftPublic.status, 404);

    for (const post of pageOne.data.posts) {
      assert.equal("password" in post.author, false);
      assert.equal("email" in post.author, false);
    }
  });

  test("returns published article by slug with safe author fields", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Article Author");
    const post = await createPost(baseUrl, owner, { title: "Public Article" });
    const response = await request(baseUrl, `/api/posts/${post.payload.slug}`);
    const unknown = await request(baseUrl, "/api/posts/no-such-slug");

    assert.equal(response.status, 200);
    assert.equal(response.data.post.slug, post.payload.slug);
    assert.equal(response.data.post.author.name, "Article Author");
    assert.equal("password" in response.data.post.author, false);
    assert.equal("email" in response.data.post.author, false);
    assert.equal("password" in response.data.post, false);
    assert.equal(unknown.status, 404);
  });
});

describe("tags and profiles", () => {
  test("lists and securely creates normalized unique tags", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Tag Owner");
    const created = await createTag(baseUrl, owner, "JavaScript Testing");
    const duplicate = await createTag(baseUrl, owner, "javascript testing");
    const invalid = await createTag(baseUrl, owner, "###");
    const unauthenticated = await createTag(baseUrl, null, "private-tag");
    const listing = await request(baseUrl, "/api/tags");

    assert.equal(created.status, 201);
    assert.equal(created.data.tag.slug, "javascript-testing");
    assert.equal(duplicate.status, 409);
    assert.equal(invalid.status, 400);
    assert.equal(unauthenticated.status, 401);
    assert.equal(listing.status, 200);
    assert.ok(listing.data.tags.some((tag) => tag.slug === "javascript-testing"));
  });

  test("returns only safe profile fields and published profile posts", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Profile Owner");
    const published = await createPost(baseUrl, owner, { title: "Profile Published" });
    await createPost(baseUrl, owner, { title: "Profile Draft", status: "draft" });
    const profile = await request(baseUrl, "/api/users/profile-owner");
    const current = await request(baseUrl, "/api/users/me", { token: owner.token });
    const unknown = await request(baseUrl, "/api/users/no-such-user");

    assert.equal(profile.status, 200);
    assert.equal(profile.data.user.username, "profile-owner");
    assert.equal(profile.data.posts.length, 1);
    assert.equal(profile.data.posts[0].slug, published.payload.slug);
    assert.equal("password" in profile.data.user, false);
    assert.equal("email" in profile.data.user, false);
    assert.equal("password" in current.data.user, false);
    assert.equal(current.data.user.username, "profile-owner");
    assert.equal(unknown.status, 404);
  });
});

describe("reactions", () => {
  test("supports the complete two-user reaction lifecycle", async () => {
    const userA = await createAuthenticatedUser(baseUrl, "Reaction A");
    const userB = await createAuthenticatedUser(baseUrl, "Reaction B");
    const post = await createPost(baseUrl, userA, { title: "Reaction Article" });
    const postId = post.data.post._id;
    const initial = await request(baseUrl, `/api/posts/${postId}/reaction`);
    const aFirst = await request(baseUrl, `/api/posts/${postId}/reaction`, { method: "POST", token: userA.token });
    const aDuplicate = await request(baseUrl, `/api/posts/${postId}/reaction`, { method: "POST", token: userA.token });
    const bFirst = await request(baseUrl, `/api/posts/${postId}/reaction`, { method: "POST", token: userB.token });
    const aDelete = await request(baseUrl, `/api/posts/${postId}/reaction`, { method: "DELETE", token: userA.token });
    const aState = await request(baseUrl, `/api/posts/${postId}/reaction`, { token: userA.token });
    const bState = await request(baseUrl, `/api/posts/${postId}/reaction`, { token: userB.token });

    assert.deepEqual(initial.data, { reacted: false, count: 0 });
    assert.deepEqual(aFirst.data, { reacted: true, count: 1 });
    assert.deepEqual(aDuplicate.data, { reacted: true, count: 1 });
    assert.deepEqual(bFirst.data, { reacted: true, count: 2 });
    assert.deepEqual(aDelete.data, { reacted: false, count: 1 });
    assert.equal(aState.data.reacted, false);
    assert.equal(bState.data.reacted, true);
  });

  test("protects reaction mutations and rejects invalid, missing, and draft posts", async () => {
    const owner = await createAuthenticatedUser(baseUrl, "Reaction Owner");
    const published = await createPost(baseUrl, owner, { title: "Reaction Published" });
    const draft = await createPost(baseUrl, owner, { title: "Reaction Draft", status: "draft" });
    const unauthenticated = await request(baseUrl, `/api/posts/${published.data.post._id}/reaction`, { method: "POST" });
    const invalid = await request(baseUrl, "/api/posts/not-an-id/reaction");
    const missing = await request(baseUrl, "/api/posts/000000000000000000000000/reaction");
    const draftGet = await request(baseUrl, `/api/posts/${draft.data.post._id}/reaction`);
    const draftPost = await request(baseUrl, `/api/posts/${draft.data.post._id}/reaction`, { method: "POST", token: owner.token });

    assert.equal(unauthenticated.status, 401);
    assert.equal(invalid.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(draftGet.status, 404);
    assert.equal(draftPost.status, 404);
  });
});

describe("comments", () => {
  test("supports create, read, update, delete and ownership checks for comments", async () => {
    const author = await createAuthenticatedUser(baseUrl, "Comment Author");
    const other = await createAuthenticatedUser(baseUrl, "Comment Other");
    const post = await createPost(baseUrl, author, { title: "Comment Post" });

    const create = await createComment(baseUrl, post, author, "This is a test comment");
    assert.equal(create.status, 201);
    assert.equal(create.data.comment.author.name, "Comment Author");
    assert.equal("password" in create.data.comment.author, false);

    const list = await request(baseUrl, `/api/posts/${post.data.post._id}/comments`);
    assert.equal(list.status, 200);
    assert.equal(list.data.comments.length, 1);
    assert.equal(list.data.total, 1);

    const draftPost = await createPost(baseUrl, author, { title: "Draft Comment Post", status: "draft" });
    const draftList = await request(baseUrl, `/api/posts/${draftPost.data.post._id}/comments`);
    assert.equal(draftList.status, 404);

    const invalidPost = await request(baseUrl, "/api/posts/not-an-id/comments");
    assert.equal(invalidPost.status, 400);

    const missingPost = await request(baseUrl, "/api/posts/000000000000000000000000/comments");
    assert.equal(missingPost.status, 404);

    const update = await request(baseUrl, `/api/comments/${create.data.comment._id}`, {
      method: "PUT",
      token: author.token,
      body: { content: "Updated comment" },
    });

    assert.equal(update.status, 200);
    assert.equal(update.data.comment.content, "Updated comment");

    const forbiddenUpdate = await request(baseUrl, `/api/comments/${create.data.comment._id}`, {
      method: "PUT",
      token: other.token,
      body: { content: "Not mine" },
    });
    assert.equal(forbiddenUpdate.status, 403);

    const unauthorizedDelete = await request(baseUrl, `/api/comments/${create.data.comment._id}`, { method: "DELETE" });
    assert.equal(unauthorizedDelete.status, 401);

    const deleteResponse = await request(baseUrl, `/api/comments/${create.data.comment._id}`, { method: "DELETE", token: author.token });
    assert.equal(deleteResponse.status, 200);

    const missingComment = await request(baseUrl, `/api/comments/${create.data.comment._id}`, { method: "DELETE", token: author.token });
    assert.equal(missingComment.status, 404);
  });

  test("covers critical comment security and pagination cases", async () => {
    const author = await createAuthenticatedUser(baseUrl, "Security Author");
    const other = await createAuthenticatedUser(baseUrl, "Other Author");
    const post = await createPost(baseUrl, author, { title: "Security Post" });
    const draft = await createPost(baseUrl, author, { title: "Draft Security Post", status: "draft" });

    const unauthenticated = await request(baseUrl, `/api/posts/${post.data.post._id}/comments`, {
      method: "POST",
      body: { content: "No auth" },
    });
    assert.equal(unauthenticated.status, 401);

    const draftPost = await request(baseUrl, `/api/posts/${draft.data.post._id}/comments`, {
      method: "POST",
      token: author.token,
      body: { content: "Draft comment" },
    });
    assert.equal(draftPost.status, 404);

    const invalidId = await request(baseUrl, "/api/posts/not-an-id/comments", { method: "POST", token: author.token, body: { content: "bad" } });
    assert.equal(invalidId.status, 400);

    const forged = await request(baseUrl, `/api/posts/${post.data.post._id}/comments`, {
      method: "POST",
      token: author.token,
      body: { author: other.id, content: "Forged author" },
    });
    assert.equal(forged.status, 201);
    assert.equal(forged.data.comment.author.id, author.id);

    const secondComment = await request(baseUrl, `/api/posts/${post.data.post._id}/comments`, {
      method: "POST",
      token: other.token,
      body: { content: "Second comment" },
    });
    assert.equal(secondComment.status, 201);

    const pageOne = await request(baseUrl, `/api/posts/${post.data.post._id}/comments?page=1&limit=1`);
    const pageTwo = await request(baseUrl, `/api/posts/${post.data.post._id}/comments?page=2&limit=1`);
    assert.equal(pageOne.status, 200);
    assert.equal(pageOne.data.page, 1);
    assert.equal(pageOne.data.limit, 1);
    assert.equal(pageOne.data.total, 2);
    assert.equal(pageOne.data.totalPages, 2);
    assert.equal(pageOne.data.hasNextPage, true);
    assert.equal(pageTwo.status, 200);
    assert.equal(pageTwo.data.page, 2);
    assert.equal(pageTwo.data.hasNextPage, false);

    const nonOwnerEdit = await request(baseUrl, `/api/comments/${forged.data.comment._id}`, {
      method: "PUT",
      token: other.token,
      body: { content: "A different author edits this" },
    });
    const nonOwnerDelete = await request(baseUrl, `/api/comments/${forged.data.comment._id}`, {
      method: "DELETE",
      token: other.token,
    });
    assert.equal(nonOwnerEdit.status, 403);
    assert.equal(nonOwnerDelete.status, 403);
  });
});

describe("bookmarks", () => {
  test("protects bookmark creation, state, deletion, and user identity", async () => {
    const author = await createAuthenticatedUser(baseUrl, "Bookmark Author");
    const other = await createAuthenticatedUser(baseUrl, "Bookmark Other");
    const post = await createPost(baseUrl, author, { title: "Bookmarkable Post" });
    const draft = await createPost(baseUrl, author, { title: "Draft Bookmark", status: "draft" });
    const postId = post.data.post._id;

    const unauthenticated = await request(baseUrl, `/api/posts/${postId}/bookmark`, { method: "POST" });
    const invalidId = await request(baseUrl, "/api/posts/not-an-id/bookmark", { method: "POST", token: author.token });
    const draftBookmark = await request(baseUrl, `/api/posts/${draft.data.post._id}/bookmark`, { method: "POST", token: author.token });
    const missingPost = await request(baseUrl, "/api/posts/000000000000000000000000/bookmark", { method: "POST", token: author.token });

    assert.equal(unauthenticated.status, 401);
    assert.equal(invalidId.status, 400);
    assert.equal(draftBookmark.status, 404);
    assert.equal(missingPost.status, 404);

    const added = await request(baseUrl, `/api/posts/${postId}/bookmark`, {
      method: "POST",
      token: author.token,
      body: { userId: other.id },
    });

    const duplicate = await request(baseUrl, `/api/posts/${postId}/bookmark`, { method: "POST", token: author.token });
    const authorState = await request(baseUrl, `/api/posts/${postId}/bookmark`, { token: author.token });
    const otherState = await request(baseUrl, `/api/posts/${postId}/bookmark`, { token: other.token });
    const count = await Bookmark.countDocuments({ post: postId });

    assert.equal(added.status, 201);
    assert.equal(duplicate.status, 201);
    assert.equal(authorState.data.bookmarked, true);
    assert.equal(otherState.data.bookmarked, false);
    assert.equal(count, 1);

    const otherDelete = await request(baseUrl, `/api/posts/${postId}/bookmark`, { method: "DELETE", token: other.token });
    const authorDelete = await request(baseUrl, `/api/posts/${postId}/bookmark`, { method: "DELETE", token: author.token });
    const safeRepeatDelete = await request(baseUrl, `/api/posts/${postId}/bookmark`, { method: "DELETE", token: author.token });

    assert.equal(otherDelete.status, 200);
    assert.equal(authorDelete.status, 200);
    assert.equal(safeRepeatDelete.status, 200);
    assert.equal((await Bookmark.countDocuments({ post: postId })), 0);
  });

  test("lists only the current user's published bookmarks with pagination", async () => {
    const firstUser = await createAuthenticatedUser(baseUrl, "Bookmark First");
    const secondUser = await createAuthenticatedUser(baseUrl, "Bookmark Second");
    const firstPost = await createPost(baseUrl, firstUser, { title: "First Saved Post" });
    const secondPost = await createPost(baseUrl, firstUser, { title: "Second Saved Post" });
    const draft = await createPost(baseUrl, firstUser, { title: "Hidden Saved Draft", status: "draft" });

    await request(baseUrl, `/api/posts/${firstPost.data.post._id}/bookmark`, { method: "POST", token: firstUser.token });
    await request(baseUrl, `/api/posts/${secondPost.data.post._id}/bookmark`, { method: "POST", token: firstUser.token });
    await request(baseUrl, `/api/posts/${firstPost.data.post._id}/bookmark`, { method: "POST", token: secondUser.token });
    await Bookmark.create({ user: firstUser.id, post: draft.data.post._id });

    const missingAuth = await request(baseUrl, "/api/users/me/bookmarks");
    const pageOne = await request(baseUrl, "/api/users/me/bookmarks?page=1&limit=1", { token: firstUser.token });
    const pageTwo = await request(baseUrl, "/api/users/me/bookmarks?page=2&limit=1", { token: firstUser.token });

    assert.equal(missingAuth.status, 401);
    assert.equal(pageOne.status, 200);
    assert.equal(pageOne.data.total, 2);
    assert.equal(pageOne.data.totalPages, 2);
    assert.equal(pageOne.data.hasNextPage, true);
    assert.equal(pageOne.data.bookmarks.length, 1);
    assert.equal(pageOne.data.bookmarks[0].post.title, "Second Saved Post");
    assert.equal(pageTwo.data.bookmarks.length, 1);
    assert.equal(pageTwo.data.hasNextPage, false);
    assert.equal(pageTwo.data.bookmarks[0].post.title, "First Saved Post");
    assert.equal("password" in pageOne.data.bookmarks[0].post.author, false);
  });
});

describe("follows", () => {
  test("supports secure follow lifecycle and independent multi-user relationships", async () => {
    const userA = await createAuthenticatedUser(baseUrl, "Follow A");
    const userB = await createAuthenticatedUser(baseUrl, "Follow B");
    const userC = await createAuthenticatedUser(baseUrl, "Follow C");

    const unauthenticated = await request(baseUrl, `/api/users/${userB.user.username}/follow`, { method: "POST" });
    const selfFollow = await request(baseUrl, `/api/users/${userA.user.username}/follow`, { method: "POST", token: userA.token });
    const missing = await request(baseUrl, "/api/users/missing-user/follow", { method: "POST", token: userA.token });
    const added = await request(baseUrl, `/api/users/${userB.user.username}/follow`, { method: "POST", token: userA.token, body: { follower: userC.id } });
    const duplicate = await request(baseUrl, `/api/users/${userB.user.username}/follow`, { method: "POST", token: userA.token });
    const userCFollow = await request(baseUrl, `/api/users/${userB.user.username}/follow`, { method: "POST", token: userC.token });

    assert.equal(unauthenticated.status, 401);
    assert.equal(selfFollow.status, 400);
    assert.equal(missing.status, 404);
    assert.equal(added.status, 201);
    assert.equal(duplicate.status, 201);
    assert.equal(userCFollow.status, 201);
    assert.equal(await Follow.countDocuments({ follower: userA.id, following: userB.id }), 1);

    const statusA = await request(baseUrl, `/api/users/${userB.user.username}/follow-status`, { token: userA.token });
    const statusB = await request(baseUrl, `/api/users/${userA.user.username}/follow-status`, { token: userB.token });
    assert.equal(statusA.data.following, true);
    assert.equal(statusA.data.followers, 2);
    assert.equal(statusB.data.following, false);

    const unfollow = await request(baseUrl, `/api/users/${userB.user.username}/follow`, { method: "DELETE", token: userA.token });
    const safeRepeat = await request(baseUrl, `/api/users/${userB.user.username}/follow`, { method: "DELETE", token: userA.token });
    const statusC = await request(baseUrl, `/api/users/${userB.user.username}/follow-status`, { token: userC.token });
    assert.equal(unfollow.status, 200);
    assert.equal(safeRepeat.status, 200);
    assert.equal(statusC.data.following, true);
    assert.equal(statusC.data.followers, 1);
  });

  test("lists safe paginated followers and following users", async () => {
    const target = await createAuthenticatedUser(baseUrl, "Follow Target");
    const first = await createAuthenticatedUser(baseUrl, "Follow First");
    const second = await createAuthenticatedUser(baseUrl, "Follow Second");
    await request(baseUrl, `/api/users/${target.user.username}/follow`, { method: "POST", token: first.token });
    await request(baseUrl, `/api/users/${target.user.username}/follow`, { method: "POST", token: second.token });

    const followers = await request(baseUrl, `/api/users/${target.user.username}/followers?page=1&limit=1`);
    const following = await request(baseUrl, `/api/users/${first.user.username}/following?page=1&limit=1`);
    const invalid = await request(baseUrl, "/api/users/no/followers");

    assert.equal(followers.status, 200);
    assert.equal(followers.data.items.length, 1);
    assert.equal(followers.data.total, 2);
    assert.equal(followers.data.totalPages, 2);
    assert.equal(followers.data.hasNextPage, true);
    assert.equal(following.status, 200);
    assert.equal(following.data.total, 1);
    assert.equal(following.data.items[0].username, target.user.username);
    assert.equal("password" in followers.data.items[0], false);
    assert.equal("hash" in followers.data.items[0], false);
    assert.equal(invalid.status, 404);
  });
});
