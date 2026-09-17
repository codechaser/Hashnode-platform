const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getTags, createTag } = require("../controllers/tagController");

const router = express.Router();

router.get("/", getTags);
router.post("/", authMiddleware, createTag);

module.exports = router;