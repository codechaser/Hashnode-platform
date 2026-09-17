const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authorization = req.get("Authorization");
  const bearerMatch = authorization && authorization.match(/^Bearer\s+(\S+)$/i);

  if (!bearerMatch || !process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(bearerMatch[1], process.env.JWT_SECRET);

    if (!payload || typeof payload !== "object" || !payload.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    req.user = {
      id: payload.id,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication required" });
  }
};

module.exports = authMiddleware;