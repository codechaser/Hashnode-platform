const jwt = require("jsonwebtoken");

const optionalAuthMiddleware = (req, res, next) => {
  const authorization = req.get("Authorization");
  const bearerMatch = authorization && authorization.match(/^Bearer\s+(\S+)$/i);

  if (!bearerMatch || !process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
    return next();
  }

  try {
    const payload = jwt.verify(bearerMatch[1], process.env.JWT_SECRET);

    if (payload && typeof payload === "object" && payload.id) {
      req.user = { id: payload.id };
    }
  } catch {
    // Public reaction counts remain available when an optional session is invalid.
  }

  return next();
};

module.exports = optionalAuthMiddleware;