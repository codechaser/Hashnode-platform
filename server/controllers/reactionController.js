const mongoose = require("mongoose");
const Post = require("../models/Post");
const Reaction = require("../models/Reaction");

const isValidPostId = (id) => mongoose.Types.ObjectId.isValid(id);

const findPublishedPost = async (id) => {
  if (!isValidPostId(id)) {
    return { invalid: true };
  }

  const post = await Post.findOne({ _id: id, status: "published" }).select("_id").lean();
  return { post };
};

const getReactionState = async (postId, userId) => {
  const [count, reaction] = await Promise.all([
    Reaction.countDocuments({ post: postId }),
    userId ? Reaction.exists({ post: postId, user: userId }) : null,
  ]);

  return { reacted: Boolean(reaction), count };
};

const getReaction = async (req, res) => {
  try {
    const result = await findPublishedPost(req.params.id);

    if (result.invalid) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!result.post) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json(await getReactionState(req.params.id, req.user?.id));
  } catch (error) {
    console.error(`Reaction lookup error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch reaction state" });
  }
};

const addReaction = async (req, res) => {
  try {
    const result = await findPublishedPost(req.params.id);

    if (result.invalid) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!result.post) {
      return res.status(404).json({ message: "Post not found" });
    }

    try {
      await Reaction.create({ user: req.user.id, post: req.params.id });
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }

    return res.status(200).json(await getReactionState(req.params.id, req.user.id));
  } catch (error) {
    console.error(`Reaction creation error: ${error.message}`);
    return res.status(500).json({ message: "Unable to add reaction" });
  }
};

const removeReaction = async (req, res) => {
  try {
    const result = await findPublishedPost(req.params.id);

    if (result.invalid) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    if (!result.post) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Reaction.deleteOne({ post: req.params.id, user: req.user.id });
    return res.status(200).json(await getReactionState(req.params.id, req.user.id));
  } catch (error) {
    console.error(`Reaction deletion error: ${error.message}`);
    return res.status(500).json({ message: "Unable to remove reaction" });
  }
};

module.exports = { getReaction, addReaction, removeReaction, getReactionState };