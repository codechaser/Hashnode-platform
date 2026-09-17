const Follow = require("../models/Follow");
const User = require("../models/User");

const safeUserFields = "name username bio avatarUrl";
const usernamePattern = /^[a-z0-9_][a-z0-9_-]{2,29}$/i;

const parsePagination = (query) => {
  const pageValue = Number.parseInt(query.page, 10);
  const limitValue = Number.parseInt(query.limit, 10);

  return {
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    limit: Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 50) : 20,
  };
};

const findTarget = async (username) => {
  if (typeof username !== "string" || !usernamePattern.test(username.trim())) {
    return null;
  }

  return User.findOne({ username: username.trim().toLowerCase() }).select("_id").lean();
};

const getFollowSummary = async (targetId, viewerId) => {
  const [followers, following, relationship] = await Promise.all([
    Follow.countDocuments({ following: targetId }),
    Follow.countDocuments({ follower: targetId }),
    viewerId ? Follow.exists({ follower: viewerId, following: targetId }) : null,
  ]);

  return { following: Boolean(relationship), followers, followingCount: following };
};

const getFollowStatus = async (req, res) => {
  try {
    const target = await findTarget(req.params.username);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(await getFollowSummary(target._id, req.user?.id));
  } catch (error) {
    console.error(`Follow status error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch follow status" });
  }
};

const addFollow = async (req, res) => {
  try {
    const target = await findTarget(req.params.username);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    if (target._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    try {
      await Follow.create({ follower: req.user.id, following: target._id });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }

    return res.status(201).json({
      following: true,
      ...(await getFollowSummary(target._id, req.user.id)),
    });
  } catch (error) {
    console.error(`Follow creation error: ${error.message}`);
    return res.status(500).json({ message: "Unable to follow user" });
  }
};

const removeFollow = async (req, res) => {
  try {
    const target = await findTarget(req.params.username);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    await Follow.deleteOne({ follower: req.user.id, following: target._id });
    return res.status(200).json({
      following: false,
      ...(await getFollowSummary(target._id, req.user.id)),
    });
  } catch (error) {
    console.error(`Follow removal error: ${error.message}`);
    return res.status(500).json({ message: "Unable to unfollow user" });
  }
};

const listConnections = (direction) => async (req, res) => {
  try {
    const target = await findTarget(req.params.username);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    const { page, limit } = parsePagination(req.query);
    const query = direction === "followers"
      ? { following: target._id }
      : { follower: target._id };
    const userPath = direction === "followers" ? "follower" : "following";
    const total = await Follow.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const items = await Follow.find(query)
      .populate(userPath, safeUserFields)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      items: items.map((item) => item[userPath]).filter(Boolean),
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (error) {
    console.error(`Follow list error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch connections" });
  }
};

module.exports = {
  getFollowStatus,
  addFollow,
  removeFollow,
  listFollowers: listConnections("followers"),
  listFollowing: listConnections("following"),
};
