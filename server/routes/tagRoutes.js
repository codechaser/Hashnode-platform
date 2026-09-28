const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getTags, getTrendingTags, createTag } = require("../controllers/tagController");

const router = express.Router();

router.get("/", getTags);
router.get("/trending", getTrendingTags);
router.post("/", authMiddleware, createTag);

module.exports = router;
