const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
const { getReaction, addReaction, removeReaction } = require("../controllers/reactionController");
const {
  getPublicFeed,
  getPublicPostBySlug,
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
} = require("../controllers/postController");
const { getComments, createComment } = require("../controllers/commentController");
const {
  getBookmark,
  addBookmark,
  removeBookmark,
} = require("../controllers/bookmarkController");

const router = express.Router();

router.get("/feed", getPublicFeed);
router.get("/:id/comments", getComments);
router.post("/:id/comments", authMiddleware, createComment);
router.get("/:id/reaction", optionalAuthMiddleware, getReaction);
router.post("/:id/reaction", authMiddleware, addReaction);
router.delete("/:id/reaction", authMiddleware, removeReaction);
router.get("/:id/bookmark", optionalAuthMiddleware, getBookmark);
router.post("/:id/bookmark", authMiddleware, addBookmark);
router.delete("/:id/bookmark", authMiddleware, removeBookmark);
router.get("/:slug", (req, res, next) => {
  if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
    req.params.id = req.params.slug;
    return authMiddleware(req, res, () => getPost(req, res));
  }

  return getPublicPostBySlug(req, res, next);
});
router.use(authMiddleware);
router.post("/", createPost);
router.get("/", getPosts);
router.get("/:id", getPost);
router.put("/:id", updatePost);
router.delete("/:id", deletePost);

module.exports = router;