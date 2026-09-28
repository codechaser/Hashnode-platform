const mongoose = require("mongoose");
const Post = require("../models/Post");
const Reaction = require("../models/Reaction");
const Revision = require("../models/Revision");
const Follow = require("../models/Follow");
const { hasValidProSubscription } = require("../services/subscriptionService");
const { trackPostView, publishDuePosts } = require("./creatorController");

const allowedStatuses = ["draft", "scheduled", "published"];

const isValidPostId = (id) => mongoose.Types.ObjectId.isValid(id);

const validatePostInput = (body, { requireContent = true } = {}) => {
  const { title, slug, content, tags, status } = body;

  if (typeof title !== "string" || !title.trim()) {
    return "Title is required";
  }

  if (typeof slug !== "string" || !slug.trim()) {
    return "Slug is required";
  }

  if (requireContent && (typeof content !== "string" || !content.trim())) {
    return "Content is required";
  }

  if (content !== undefined && typeof content !== "string") {
    return "Content must be a string";
  }

  if (tags !== undefined && (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string"))) {
    return "Tags must be an array of strings";
  }

  if (status !== undefined && !allowedStatuses.includes(status)) {
    return "Status must be draft, scheduled, or published";
  }
  if (status === "scheduled" && (!body.scheduledAt || !Number.isFinite(Date.parse(body.scheduledAt)) || Date.parse(body.scheduledAt) <= Date.now())) return "Choose a future scheduled date and time";
  if (body.coverImage !== undefined && body.coverImage !== "" && (typeof body.coverImage !== "string" || !/^https:\/\//i.test(body.coverImage) || body.coverImage.length > 2048)) return "Cover image must be an HTTPS URL under 2048 characters";

  return null;
};

const isDuplicateSlugError = (error) => error.code === 11000 && error.keyPattern?.slug;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (query) => {
  const parsedPage = Number.parseInt(query.page, 10);
  const parsedLimit = Number.parseInt(query.limit, 10);

  return {
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 10,
  };
};

const publicPostFields = "title slug content excerpt author tags status coverImage createdAt updatedAt";

const withReactionCounts = async (posts) => {
  if (!posts.length) {
    return [];
  }

  const counts = await Reaction.aggregate([
    { $match: { post: { $in: posts.map((post) => post._id) } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));

  return posts.map((post) => ({
    ...post.toObject(),
    reactionCount: countMap.get(post._id.toString()) || 0,
  }));
};

const getPublicFeed = async (req, res) => {
  try {
    await publishDuePosts();
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const { page, limit } = parsePagination(req.query);
    const query = { status: "published" };

    if (search) {
      query.title = { $regex: escapeRegex(search), $options: "i" };
    }

    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";

    if (tag) {
      query.tags = { $regex: `^${escapeRegex(tag)}$`, $options: "i" };
    }

    const total = await Post.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const posts = await Post.find(query)
      .select(publicPostFields)
      .populate("author", "name username avatarUrl")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const postsWithCounts = await withReactionCounts(posts);
    return res.status(200).json({ posts: postsWithCounts, page, limit, total, totalPages, hasNextPage: page < totalPages });
  } catch (error) {
    console.error(`Public feed error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch public feed" });
  }
};

const getFollowingFeed = async (req, res) => {
  try {
    await publishDuePosts();
    const { page, limit } = parsePagination(req.query);
    const followedAuthors = await Follow.distinct("following", { follower: req.user.id });
    if (!followedAuthors.length) {
      return res.status(200).json({ posts: [], page, limit, total: 0, totalPages: 0, hasNextPage: false });
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const query = { status: "published", author: { $in: followedAuthors } };
    if (search) query.title = { $regex: escapeRegex(search), $options: "i" };
    const tag = typeof req.query.tag === "string" ? req.query.tag.trim() : "";
    if (tag) query.tags = { $regex: `^${escapeRegex(tag)}$`, $options: "i" };

    const total = await Post.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const posts = await Post.find(query)
      .select(publicPostFields)
      .populate("author", "name username avatarUrl")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const postsWithCounts = await withReactionCounts(posts);
    return res.status(200).json({ posts: postsWithCounts, page, limit, total, totalPages, hasNextPage: page < totalPages });
  } catch (error) {
    console.error(`Following feed error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch your following feed" });
  }
};

const getPublicPostBySlug = async (req, res) => {
  const slug = typeof req.params.slug === "string" ? req.params.slug.trim() : "";

  if (!slug) {
    return res.status(404).json({ message: "Post not found" });
  }

  try {
    await publishDuePosts();
    const post = await Post.findOne({ slug, status: "published" })
      .select(publicPostFields)
      .populate("author", "name username avatarUrl")
      .lean();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    await trackPostView(req, post);

    const reactionCount = await Reaction.countDocuments({ post: post._id });
    return res.status(200).json({ post: { ...post, reactionCount } });
  } catch (error) {
    console.error(`Public post lookup error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch public post" });
  }
};

const createPost = async (req, res) => {
  const validationError = validatePostInput(req.body || {});

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const { title, slug, content, excerpt, tags, status, scheduledAt, coverImage } = req.body;
    if ((status === "scheduled" || scheduledAt || coverImage) && !(await hasValidProSubscription(req.user.id))) return res.status(403).json({ message: "An active PRO subscription is required for scheduled publishing and cover images" });
    if (status === "scheduled" && (!scheduledAt || !Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= Date.now())) return res.status(400).json({ message: "Choose a future scheduled date and time" });
    const post = await Post.create({
      title: title.trim(),
      slug: slug.trim(),
      content,
      excerpt,
      tags,
      status,
      scheduledAt: status === "scheduled" ? new Date(scheduledAt) : null,
      coverImage: coverImage || "",
      author: req.user.id,
    });

    return res.status(201).json({ post });
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      return res.status(409).json({ message: "Slug is already in use" });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: "Invalid post data" });
    }

    console.error(`Post creation error: ${error.message}`);
    return res.status(500).json({ message: "Unable to create post" });
  }
};

const getPosts = async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json({ posts });
  } catch (error) {
    console.error(`Post listing error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch posts" });
  }
};

const getPost = async (req, res) => {
  if (!isValidPostId(req.params.id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You do not have access to this post" });
    }

    return res.status(200).json({ post });
  } catch (error) {
    console.error(`Post lookup error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch post" });
  }
};

const updatePost = async (req, res) => {
  if (!isValidPostId(req.params.id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  const validationError = validatePostInput(req.body || {}, { requireContent: false });

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You do not have access to this post" });
    }

    const allowedFields = ["title", "slug", "content", "excerpt", "tags", "status", "scheduledAt", "coverImage"];
    const scheduleChanged = req.body.status === "scheduled" && post.status !== "scheduled" || req.body.scheduledAt !== undefined && new Date(req.body.scheduledAt).getTime() !== new Date(post.scheduledAt || 0).getTime();
    const coverChanged = req.body.coverImage !== undefined && req.body.coverImage !== post.coverImage;
    if ((scheduleChanged || coverChanged) && !(await hasValidProSubscription(req.user.id))) return res.status(403).json({ message: "An active PRO subscription is required for scheduled publishing and cover images" });
    if (req.body.scheduledAt && req.body.status !== "scheduled") return res.status(400).json({ message: "Scheduled date requires scheduled status" });
    if (req.body.status === "scheduled" && (!req.body.scheduledAt || !Number.isFinite(Date.parse(req.body.scheduledAt)) || Date.parse(req.body.scheduledAt) <= Date.now())) return res.status(400).json({ message: "Choose a future scheduled date and time" });
    const changed = ["title", "excerpt", "content", "tags"].some((field) => req.body[field] !== undefined && JSON.stringify(req.body[field]) !== JSON.stringify(post[field]));
    if (changed && await hasValidProSubscription(req.user.id)) await Revision.create({ postId: post._id, author: req.user.id, title: post.title, excerpt: post.excerpt, content: post.content, tags: post.tags });
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        post[field] = field === "title" || field === "slug" ? req.body[field].trim() : req.body[field];
      }
    });
    if (req.body.status !== undefined && req.body.status !== "scheduled") post.scheduledAt = null;
    if (req.body.status === "scheduled") post.scheduledAt = new Date(req.body.scheduledAt);

    await post.save();
    return res.status(200).json({ post });
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      return res.status(409).json({ message: "Slug is already in use" });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: "Invalid post data" });
    }

    console.error(`Post update error: ${error.message}`);
    return res.status(500).json({ message: "Unable to update post" });
  }
};

const deletePost = async (req, res) => {
  if (!isValidPostId(req.params.id)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You do not have access to this post" });
    }

    await post.deleteOne();
    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error(`Post deletion error: ${error.message}`);
    return res.status(500).json({ message: "Unable to delete post" });
  }
};

module.exports = {
  getPublicFeed,
  getFollowingFeed,
  getPublicPostBySlug,
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
};
