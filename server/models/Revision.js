const mongoose = require("mongoose");

const revisionSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true },
  excerpt: { type: String, default: "" },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
}, { timestamps: { createdAt: true, updatedAt: false } });

revisionSchema.index({ postId:  1, createdAt: -1 });
module.exports = mongoose.model("Revision", revisionSchema);
