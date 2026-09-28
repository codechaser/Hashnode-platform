const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      trim: true,
      default: "",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "scheduled", "published"],
      default: "draft",
    },
    scheduledAt: { type: Date, default: null },
    coverImage: { type: String, default: "" },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ status: 1, scheduledAt: 1 });
postSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
