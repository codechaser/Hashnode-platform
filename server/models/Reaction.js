const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  { timestamps: true }
);

reactionSchema.index({ user: 1, post: 1 }, { unique: true });
reactionSchema.index({ post: 1 });

module.exports = mongoose.model("Reaction", reactionSchema);