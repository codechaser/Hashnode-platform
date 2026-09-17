const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { updateComment, deleteComment } = require("../controllers/commentController");

const router = express.Router();

router.put("/:commentId", authMiddleware, updateComment);
router.delete("/:commentId", authMiddleware, deleteComment);

module.exports = router;
