const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const PostView = require("../models/PostView");
const Reaction = require("../models/Reaction");
const Comment = require("../models/Comment");
const Bookmark = require("../models/Bookmark");
const Revision = require("../models/Revision");
const User = require("../models/User");

async function getAnalytics(req, res) {
  try {
    const author = req.user.id;
    const posts = await Post.find({ author }).select("_id title slug status viewCount updatedAt scheduledAt").sort({ viewCount: -1 }).lean();
    const ids = posts.map((post) => post._id);
    const published = posts.filter((post) => post.status === "published");
    const publishedIds = published.map((post) => post._id);
    const windowStart = new Date();
    windowStart.setUTCDate(windowStart.getUTCDate() - 29);
    windowStart.setUTCHours(0, 0, 0, 0);
    const [reactions, comments, bookmarks, recentViews, dailyViews] = await Promise.all([
      Reaction.countDocuments({ post: { $in: ids } }),
      Comment.countDocuments({ post: { $in: ids } }),
      Bookmark.countDocuments({ post: { $in: ids } }),
      PostView.countDocuments({ post: { $in: publishedIds }, viewedAt: { $gte: windowStart } }),
      PostView.aggregate([
        { $match: { post: { $in: publishedIds }, viewedAt: { $gte: windowStart } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$viewedAt" } }, views: { $sum: 1 } } },
      ]),
    ]);
    const dailyCounts = new Map(dailyViews.map((item) => [item._id, item.views]));
    const viewsByDay = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(windowStart);
      day.setUTCDate(day.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      return { date, views: dailyCounts.get(date) || 0 };
    });
    return res.json({ totals: { views: published.reduce((sum, post) => sum + (post.viewCount || 0), 0), articles: published.length, drafts: posts.filter((post) => post.status === "draft").length, reactions, comments, bookmarks, recentViews }, viewsByDay, topArticles: published.slice(0, 5), schedule: posts.filter((post) => post.status === "scheduled").sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)) });
  } catch (error) { console.error(`Analytics error: ${error.message}`); return res.status(500).json({ message: "Unable to fetch creator analytics" }); }
}

async function trackPostView(req, post) {
  if (!post || post.status !== "published") return;
  if (req.user?.id && req.user.id === post.author.toString()) return;
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").toString().split(",")[0].trim();
  const ua = req.headers["user-agent"] || "";
  const visitorDayKey = crypto.createHash("sha256").update(`${ip}|${ua}|${day}`).digest("hex");
  const increment = await Post.updateOne({ _id: post._id, status: "published" }, { $inc: { viewCount: 1 } });
  if (increment.matchedCount === 0) return;
  try {
    await PostView.create({ post: post._id, visitorDayKey, viewedAt: now });
  } catch (error) {
    try {
      await Post.updateOne({ _id: post._id }, { $inc: { viewCount: -1 } });
    } catch (rollbackError) {
      console.error(`Post view rollback failed for ${post._id}: ${rollbackError.message}`);
    }
    if (error.code !== 11000) throw error;
  }
}

function hasSameRevisionContent(post, revision) {
  const sameTags = JSON.stringify([...(post.tags || [])]) === JSON.stringify([...(revision.tags || [])]);
  return post.title === revision.title
    && (post.excerpt || "") === (revision.excerpt || "")
    && post.content === revision.content
    && sameTags;
}

async function listRevisions(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
  const post = await Post.findOne({ _id: req.params.id, author: req.user.id }).select("_id").lean();
  if (!post) return res.status(404).json({ message: "Post not found" });
  const revisions = await Revision.find({ postId: post._id, author: req.user.id }).sort({ createdAt: -1 }).lean();
  return res.json({ revisions });
}

async function restoreRevision(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id) || !mongoose.Types.ObjectId.isValid(req.params.revisionId)) return res.status(400).json({ message: "Invalid revision ID" });
  const post = await Post.findOne({ _id: req.params.id, author: req.user.id });
  if (!post) return res.status(404).json({ message: "Post not found" });
  const revision = await Revision.findOne({ _id: req.params.revisionId, postId: post._id, author: req.user.id });
  if (!revision) return res.status(404).json({ message: "Revision not found" });
  if (hasSameRevisionContent(post, revision)) return res.json({ post, restored: false });
  await Revision.create({ postId: post._id, author: req.user.id, title: post.title, excerpt: post.excerpt, content: post.content, tags: post.tags });
  post.title = revision.title; post.excerpt = revision.excerpt; post.content = revision.content; post.tags = revision.tags;
  await post.save();
  return res.json({ post, restored: true });
}

async function setFeaturedPost(req, res) {
  const { postId } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(postId)) return res.status(400).json({ message: "A valid post ID is required" });
  const post = await Post.findOne({ _id: postId, author: req.user.id, status: "published" }).select("_id").lean();
  if (!post) return res.status(404).json({ message: "Published article not found" });
  await User.updateOne({ _id: req.user.id }, { featuredPost: post._id });
  return res.json({ featuredPost: post._id });
}

async function setCoverImage(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: "Invalid post ID" });
  const { coverImage } = req.body || {};
  if (typeof coverImage !== "string" || !/^https:\/\//i.test(coverImage) || coverImage.length > 2048) return res.status(400).json({ message: "Cover image must be an HTTPS URL under 2048 characters" });
  const post = await Post.findOne({ _id: req.params.id, author: req.user.id });
  if (!post) return res.status(404).json({ message: "Post not found" });
  post.coverImage = coverImage;
  await post.save();
  return res.json({ post });
}

async function publishDuePosts() {
  await Post.updateMany({ status: "scheduled", scheduledAt: { $lte: new Date() } }, { $set: { status: "published", scheduledAt: null } });
}

module.exports = { getAnalytics, trackPostView, listRevisions, restoreRevision, setFeaturedPost, setCoverImage, publishDuePosts };
