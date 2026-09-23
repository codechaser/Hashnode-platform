const User = require("../models/User");
const Post = require("../models/Post");
const Tag = require("../models/Tag");
const Reaction = require("../models/Reaction");
const Comment = require("../models/Comment");
const Bookmark = require("../models/Bookmark");
const Follow = require("../models/Follow");
const Subscription = require("../models/Subscription");

const json = (value) => JSON.stringify(value);

async function request(baseUrl, path, { method = "GET", token, body } = {}) {
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : json(body),
  });
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

async function registerUser(baseUrl, name = "Test User") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const credentials = {
    name,
    email: `test-${suffix}@example.com`,
    password: "TestPassword123!",
  };
  const response = await request(baseUrl, "/api/auth/register", {
    method: "POST",
    body: credentials,
  });

  return { ...response, credentials };
}

async function loginUser(baseUrl, credentials) {
  const response = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    body: credentials,
  });

  return { ...response, token: response.data?.token };
}

async function createAuthenticatedUser(baseUrl, name) {
  const registration = await registerUser(baseUrl, name);
  const login = await loginUser(baseUrl, registration.credentials);
  return {
    id: registration.data.user.id,
    user: registration.data.user,
    credentials: registration.credentials,
    token: login.token,
    headers: { Authorization: `Bearer ${login.token}` },
  };
}

async function createPost(baseUrl, user, overrides = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = {
    title: `Test Post ${suffix}`,
    slug: `test-post-${suffix}`,
    content: "Test content for an article.",
    excerpt: "Test excerpt",
    tags: ["testing"],
    status: "published",
    ...overrides,
  };
  const response = await request(baseUrl, "/api/posts", {
    method: "POST",
    token: user.token,
    body: payload,
  });

  return { ...response, payload };
}

async function createComment(baseUrl, post, user, content = `Comment ${Date.now()}`) {
  const postId = post?.data?.post?._id || post?._id || post;
  return request(baseUrl, `/api/posts/${postId}/comments`, {
    method: "POST",
    token: user.token,
    body: { content },
  });
}

async function createTag(baseUrl, user, name = `tag-${Date.now()}`) {
  return request(baseUrl, "/api/tags", {
    method: "POST",
    token: user?.token,
    body: { name },
  });
}

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Tag.deleteMany({}),
    Reaction.deleteMany({}),
    Comment.deleteMany({}),
    Bookmark.deleteMany({}),
    Follow.deleteMany({}),
    Subscription.deleteMany({}),
  ]);
}

module.exports = {
  request,
  registerUser,
  loginUser,
  createAuthenticatedUser,
  createPost,
  createComment,
  createTag,
  clearCollections,
};
