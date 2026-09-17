const mongoose = require("mongoose");
const Comment = require("../models/Comment");
const Post = require("../models/Post");

const MAX_COMMENT_LENGTH = 2000;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const parsePagination = (query = {}) => {
  const page = Number.parseInt(query.page, 10);
  const limit = Number.parseInt(query.limit, 10);

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 20) : 10,
  };
};

const serializeComment = (comment) => {
  if (!comment) return null;

  const author = comment.author && typeof comment.author === "object"
    ? {
        id: comment.author._id || comment.author.id,
        name: comment.author.name,
        username: comment.author.username,
        avatarUrl: comment.author.avatarUrl || "",
      }
    : null;

  return {
    _id: comment._id,
    content: comment.content,
    author,
    post: comment.post,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
};

const getComments = async (req, res) => {
  const postId = req.params.id;

  if (!isValidObjectId(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  try {
    const post = await Post.findOne({ _id: postId, status: "published" }).select("_id").lean();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const { page, limit } = parsePagination(req.query);
    const [comments, total] = await Promise.all([
      Comment.find({ post: postId })
        .populate("author", "name username avatarUrl")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Comment.countDocuments({ post: postId }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      comments: comments.map(serializeComment),
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (error) {
    console.error(`Comment listing error: ${error.message}`);
    return res.status(500).json({ message: "Unable to load comments" });
  }
};

const createComment = async (req, res) => {
  const postId = req.params.id;

  if (!isValidObjectId(postId)) {
    return res.status(400).json({ message: "Invalid post ID" });
  }

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!content) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` });
  }

  try {
    const post = await Post.findOne({ _id: postId, status: "published" }).select("_id").lean();

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = await Comment.create({
      post: postId,
      author: req.user.id,
      content,
    });

    const populated = await Comment.findById(comment._id)
      .populate("author", "name username avatarUrl")
      .lean();

    return res.status(201).json({ comment: serializeComment(populated) });
  } catch (error) {
    console.error(`Comment creation error: ${error.message}`);
    return res.status(500).json({ message: "Unable to add comment" });
  }
};

const updateComment = async (req, res) => {
  const commentId = req.params.commentId;

  if (!isValidObjectId(commentId)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";

  if (!content) {
    return res.status(400).json({ message: "Comment content is required" });
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({ message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` });
  }

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You cannot edit this comment" });
    }

    comment.content = content;
    await comment.save();

    const updated = await Comment.findById(comment._id)
      .populate("author", "name username avatarUrl")
      .lean();

    return res.status(200).json({ comment: serializeComment(updated) });
  } catch (error) {
    console.error(`Comment update error: ${error.message}`);
    return res.status(500).json({ message: "Unable to update comment" });
  }
};

const deleteComment = async (req, res) => {
  const commentId = req.params.commentId;

  if (!isValidObjectId(commentId)) {
    return res.status(400).json({ message: "Invalid comment ID" });
  }

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (comment.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You cannot delete this comment" });
    }

    await comment.deleteOne();
    return res.status(200).json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error(`Comment deletion error: ${error.message}`);
    return res.status(500).json({ message: "Unable to delete comment" });
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
};
