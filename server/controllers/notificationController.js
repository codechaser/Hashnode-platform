const mongoose = require("mongoose");
const Notification = require("../models/Notification");

const parsePagination = (query) => {
  const requestedPage = Number.parseInt(query.page, 10);
  const requestedLimit = Number.parseInt(query.limit, 10);
  return {
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    limit: Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 50) : 20,
  };
};

const listNotifications = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const recipient = req.user.id;
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient })
        .populate("actor", "name username avatarUrl")
        .populate("post", "title slug")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipient }),
      Notification.countDocuments({ recipient, readAt: null }),
    ]);
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      notifications: notifications.map((item) => ({
        id: item._id,
        type: item.type,
        readAt: item.readAt,
        createdAt: item.createdAt,
        actor: item.actor ? { id: item.actor._id, name: item.actor.name, username: item.actor.username, avatarUrl: item.actor.avatarUrl || "" } : null,
        post: item.post ? { title: item.post.title, slug: item.post.slug } : null,
      })),
      unreadCount,
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
    });
  } catch (error) {
    console.error(`Notification listing error: ${error.message}`);
    return res.status(500).json({ message: "Unable to load notifications" });
  }
};

const markNotificationRead = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const filter = { _id: req.params.id, recipient: req.user.id };
    const updated = await Notification.updateOne({ ...filter, readAt: null }, { $set: { readAt: new Date() } });
    if (!updated.matchedCount && !(await Notification.exists(filter))) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.status(200).json({ read: true });
  } catch (error) {
    console.error(`Notification read update error: ${error.message}`);
    return res.status(500).json({ message: "Unable to update notification" });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    return res.status(200).json({ read: true });
  } catch (error) {
    console.error(`Notification read-all error: ${error.message}`);
    return res.status(500).json({ message: "Unable to update notifications" });
  }
};

module.exports = { listNotifications, markNotificationRead, markAllNotificationsRead };
