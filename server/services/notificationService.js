const Notification = require("../models/Notification");

const createNotification = async ({ recipient, actor, type, post = null }) => {
  if (!recipient || !actor || recipient.toString() === actor.toString()) return;

  try {
    await Notification.create({ recipient, actor, type, post });
  } catch (error) {
    // An alert failure must not roll back or make the primary user action fail.
    console.error(`Notification creation error: ${error.message}`);
  }
};

module.exports = { createNotification };
