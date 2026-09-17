const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");

const usernamePattern = /^[a-z0-9_][a-z0-9_-]{2,29}$/i;

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

    const [posts, followers, following] = await Promise.all([Post.find({
      author: user._id,
      status: "published",
    })
      .select("title slug excerpt tags createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean(), Follow.countDocuments({ following: user._id }), Follow.countDocuments({ follower: user._id })]);

    return res.status(200).json({
      user: { ...safeProfile(user), followers, following },
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
  getCurrentUserProfile,
  updateCurrentUserProfile,
};
