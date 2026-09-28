const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getPublicProfile,
  getSuggestedWriters,
  listPublicUsers,
  getCurrentUserProfile,
  updateCurrentUserProfile,
} = require("../controllers/userController");
const { getMyBookmarks } = require("../controllers/bookmarkController");
const optionalAuthMiddleware = require("../middleware/optionalAuthMiddleware");
const {
  getFollowStatus,
  addFollow,
  removeFollow,
  listFollowers,
  listFollowing,
} = require("../controllers/followController");

const router = express.Router();

router.get("/", optionalAuthMiddleware, listPublicUsers);
router.get("/discover", optionalAuthMiddleware, getSuggestedWriters);
router.post("/me/featured", authMiddleware, require("../middleware/requirePro"), require("../controllers/creatorController").setFeaturedPost);
router.get("/me", authMiddleware, getCurrentUserProfile);
router.put("/me", authMiddleware, updateCurrentUserProfile);
router.get("/me/bookmarks", authMiddleware, getMyBookmarks);
router.get("/:username/follow-status", optionalAuthMiddleware, getFollowStatus);
router.post("/:username/follow", authMiddleware, addFollow);
router.delete("/:username/follow", authMiddleware, removeFollow);
router.get("/:username/followers", listFollowers);
router.get("/:username/following", listFollowing);
router.get("/:username", getPublicProfile);

module.exports = router;
