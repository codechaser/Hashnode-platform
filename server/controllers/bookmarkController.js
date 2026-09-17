const mongoose = require("mongoose");
const Bookmark = require("../models/Bookmark");
const Post = require("../models/Post");

const publicPostFields = "title slug content excerpt author tags status createdAt updatedAt";
const parsePagination = (query) => {
  const pageValue = Number.parseInt(query.page, 10);
  const limitValue = Number.parseInt(query.limit, 10);

  return {
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    limit: Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 50) : 10,
  };
};

const findPublishedPost = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { invalid: true };
  }

  const post = await Post.findOne({ _id: id, status: "published" }).select("_id").lean();
  return { post };
};

const getBookmark = async (req, res) => {
  try {
    const result = await findPublishedPost(req.params.id);

    if (result.invalid) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!result.post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const bookmark = req.user
      ? await Bookmark.exists({ user: req.user.id, post: req.params.id })
      : null;

    return res.status(200).json({ bookmarked: Boolean(bookmark) });
  } catch (error) {
    console.error(`Bookmark lookup error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch bookmark state" });
  }
};

const addBookmark = async (req, res) => {
  try {
    const result = await findPublishedPost(req.params.id);

    if (result.invalid) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!result.post) {
      return res.status(404).json({ message: "Post not found" });
    }

    try {
      await Bookmark.create({ user: req.user.id, post: req.params.id });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }

    return res.status(201).json({ bookmarked: true });
  } catch (error) {
    console.error(`Bookmark creation error: ${error.message}`);
    return res.status(500).json({ message: "Unable to add bookmark" });
  }
};

const removeBookmark = async (req, res) => {
  try {
    const result = await findPublishedPost(req.params.id);

    if (result.invalid) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!result.post) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Bookmark.deleteOne({ user: req.user.id, post: req.params.id });
    return res.status(200).json({ bookmarked: false });
  } catch (error) {
    console.error(`Bookmark deletion error: ${error.message}`);
    return res.status(500).json({ message: "Unable to remove bookmark" });
  }
};

const getMyBookmarks = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const publishedPosts = await Post.find({ status: "published" }).select("_id").lean();
    const baseQuery = {
      user: req.user.id,
      post: { $in: publishedPosts.map((post) => post._id) },
    };
    const total = await Bookmark.countDocuments(baseQuery);
    const totalPages = Math.ceil(total / limit);
    const bookmarks = await Bookmark.find(baseQuery)
      .populate({
        path: "post",
        select: publicPostFields,
        populate: { path: "author", select: "name username avatarUrl" },
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      bookmarks: bookmarks.filter((bookmark) => bookmark.post),
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (error) {
    console.error(`Bookmark listing error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch bookmarks" });
  }
};

module.exports = { getBookmark, addBookmark, removeBookmark, getMyBookmarks };
