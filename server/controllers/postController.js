const mongoose = require("mongoose");
const Post = require("../models/Post");
const Reaction = require("../models/Reaction");

const allowedStatuses = ["draft", "published"];

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
    return "Status must be draft or published";
  }

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

const publicPostFields = "title slug content excerpt author tags status createdAt updatedAt";

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

const getPublicPostBySlug = async (req, res) => {
  const slug = typeof req.params.slug === "string" ? req.params.slug.trim() : "";

  if (!slug) {
    return res.status(404).json({ message: "Post not found" });
  }

  try {
    const post = await Post.findOne({ slug, status: "published" })
      .select(publicPostFields)
      .populate("author", "name username avatarUrl")
      .lean();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

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
    const { title, slug, content, excerpt, tags, status } = req.body;
    const post = await Post.create({
      title: title.trim(),
      slug: slug.trim(),
      content,
      excerpt,
      tags,
      status,
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

    const allowedFields = ["title", "slug", "content", "excerpt", "tags", "status"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        post[field] = field === "title" || field === "slug" ? req.body[field].trim() : req.body[field];
      }
    });

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
  getPublicPostBySlug,
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
};