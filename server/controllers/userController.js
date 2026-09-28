const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const { hasValidProSubscription } = require("../services/subscriptionService");

const usernamePattern = /^[a-z0-9_][a-z0-9_-]{2,29}$/i;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeProfile = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  bio: user.bio,
  avatarUrl: user.avatarUrl,
});

const getPublicProfile = async (req, res) => {
  try {
    const username = typeof req.params.username === "string"
      ? req.params.username.trim().toLowerCase()
      : "";

    if (!username) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = await User.findOne({ username }).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [posts, followers, following, isPro] = await Promise.all([Post.find({
      author: user._id,
      status: "published",
    })
      .select("title slug excerpt tags coverImage viewCount createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean(), Follow.countDocuments({ following: user._id }), Follow.countDocuments({ follower: user._id }), hasValidProSubscription(user._id)]);
    let featuredArticle = null;
    let totalViews;
    if (isPro) {
      totalViews = posts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
      const featured = user.featuredPost && posts.find((post) => post._id.toString() === user.featuredPost.toString());
      featuredArticle = featured || null;
    }
    posts.forEach((post) => { delete post.viewCount; });

    return res.status(200).json({
      user: { ...safeProfile(user), followers, following, isPro, ...(isPro ? { totalViews, featuredArticle } : {}) },
      posts,
    });
  } catch (error) {
    console.error(`Public profile error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch public profile" });
  }
};

const getCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("_id name username bio avatarUrl").lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user: safeProfile(user) });
  } catch (error) {
    console.error(`Current user profile error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch current user profile" });
  }
};

const getSuggestedWriters = async (req, res) => {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const viewerId = req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : null;
    const excludedIds = viewerId ? [viewerId] : [];
    if (viewerId) {
      const followed = await Follow.find({ follower: viewerId }).select("following").lean();
      excludedIds.push(...followed.map((item) => item.following));
    }

    const writers = await Post.aggregate([
      { $match: { status: "published", createdAt: { $gte: since }, author: { $nin: excludedIds } } },
      { $group: { _id: "$author", articleCount: { $sum: 1 }, lastPublishedAt: { $max: "$createdAt" } } },
      { $sort: { articleCount: -1, lastPublishedAt: -1, _id: 1 } },
      { $limit: 4 },
    ]);
    const users = await User.find({ _id: { $in: writers.map((writer) => writer._id) } })
      .select("_id name username bio avatarUrl")
      .lean();
    const byId = new Map(users.map((user) => [user._id.toString(), user]));
    const suggestions = writers.flatMap((writer) => {
      const user = byId.get(writer._id.toString());
      if (!user) return [];
      return [{ ...safeProfile(user), articleCount: writer.articleCount }];
    });

    return res.status(200).json({ writers: suggestions });
  } catch (error) {
    console.error(`Suggested writers error: ${error.message}`);
    return res.status(500).json({ message: "Unable to find writers" });
  }
};

const listPublicUsers = async (req, res) => {
  try {
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 20;
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
    const viewerId = req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)
      ? new mongoose.Types.ObjectId(req.user.id)
      : null;
    const query = {};
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      query.$or = [{ name: pattern }, { username: pattern }];
    }
    if (viewerId) query._id = { $ne: viewerId };

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query).select("_id name username bio avatarUrl").sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    const userIds = users.map((user) => user._id);
    const [followerCounts, followingIds, followsYouIds] = await Promise.all([
      userIds.length ? Follow.aggregate([
        { $match: { following: { $in: userIds } } },
        { $group: { _id: "$following", count: { $sum: 1 } } },
      ]) : [],
      viewerId && userIds.length ? Follow.find({ follower: viewerId, following: { $in: userIds } }).distinct("following") : [],
      viewerId && userIds.length ? Follow.find({ follower: { $in: userIds }, following: viewerId }).distinct("follower") : [],
    ]);
    const followerCountById = new Map(followerCounts.map((item) => [item._id.toString(), item.count]));
    const followingSet = new Set(followingIds.map(String));
    const followsYouSet = new Set(followsYouIds.map(String));
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      users: users.map((user) => ({
        ...safeProfile(user),
        followers: followerCountById.get(user._id.toString()) || 0,
        following: followingSet.has(user._id.toString()),
        followsYou: followsYouSet.has(user._id.toString()),
      })),
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (error) {
    console.error(`Public user listing error: ${error.message}`);
    return res.status(500).json({ message: "Unable to find community members" });
  }
};

const updateCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const allowedFields = ["name", "username", "bio", "avatarUrl"];
    const payload = {};

    for (const field of allowedFields) {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, field)) {
        payload[field] = req.body[field];
      }
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "No profile fields supplied" });
    }

    if (payload.name !== undefined) {
      if (typeof payload.name !== "string" || !payload.name.trim()) {
        return res.status(400).json({ message: "Name is required" });
      }

      user.name = payload.name.trim();
    }

    if (payload.username !== undefined) {
      if (typeof payload.username !== "string") {
        return res.status(400).json({ message: "Username must be a string" });
      }

      const nextUsername = payload.username.trim().toLowerCase();

      if (!nextUsername) {
        return res.status(400).json({ message: "Username is required" });
      }

      if (!usernamePattern.test(nextUsername)) {
        return res.status(400).json({ message: "Username contains invalid characters" });
      }

      if (nextUsername.length < 3 || nextUsername.length > 30) {
        return res.status(400).json({ message: "Username must be between 3 and 30 characters" });
      }

      user.username = nextUsername;
    }

    if (payload.bio !== undefined) {
      if (typeof payload.bio !== "string") {
        return res.status(400).json({ message: "Bio must be a string" });
      }

      user.bio = payload.bio.trim();
    }

    if (payload.avatarUrl !== undefined) {
      if (typeof payload.avatarUrl !== "string") {
        return res.status(400).json({ message: "Avatar URL must be a string" });
      }

      user.avatarUrl = payload.avatarUrl.trim();
    }

    await user.save();

    return res.status(200).json({
      user: safeProfile(user),
      message: "Profile updated successfully",
    });
  } catch (error) {
    if (error && error.code === 11000 && error.keyPattern && error.keyPattern.username) {
      return res.status(409).json({ message: "Username is already in use" });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: "Invalid profile data" });
    }

    console.error(`Current user update error: ${error.message}`);
    return res.status(500).json({ message: "Unable to update profile" });
  }
};

module.exports = {
  getPublicProfile,
  getSuggestedWriters,
  listPublicUsers,
  getCurrentUserProfile,
  updateCurrentUserProfile,
};
