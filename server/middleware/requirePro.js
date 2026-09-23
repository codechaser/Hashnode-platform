const authMiddleware = require("./authMiddleware");
const { hasValidProSubscription } = require("../services/subscriptionService");

async function requirePro(req, res, next) {
  authMiddleware(req, res, async () => {
    try {
      if (!(await hasValidProSubscription(req.user.id))) {
        return res.status(403).json({ message: "An active PRO subscription is required" });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: "Unable to verify subscription" });
    }
  });
}

module.exports = requirePro;