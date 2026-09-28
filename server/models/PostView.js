const mongoose = require("mongoose");

const postViewSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
  visitorDayKey: { type: String, required: true },
  viewedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

postViewSchema.index({ post: 1, visitorDayKey: 1 }, { unique: true });
postViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 40 * 24 * 60 * 60 });
module.exports = mongoose.model("PostView", postViewSchema);
