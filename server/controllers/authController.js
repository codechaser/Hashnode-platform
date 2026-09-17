const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const makeUsernameBase = (name) => {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  if (base.length >= 3) {
    return base;
  }

  return "user";
};

const generateUsername = async (name) => {
  const base = makeUsernameBase(name);
  let username = base;
  let counter = 1;

  while (await User.findOne({ username })) {
    username = `${base}-${counter}`;
    counter += 1;
  }

  return username;
};

const register = async (req, res) => {
  const { name, email, password } = req.body || {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ message: "Please provide a valid email address" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  try {
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const username = await generateUsername(name);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      username,
      email: normalizedEmail,
      password: hashedPassword,
    });

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    console.error(`Registration error: ${error.message}`);
    return res.status(500).json({ message: "Unable to register user" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!emailPattern.test(normalizedEmail)) {
    return res.status(400).json({ message: "Please provide a valid email address" });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail });
    const passwordMatches = user && (await bcrypt.compare(password, user.password));

    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
      console.error("Login configuration error: JWT_SECRET is not set or empty");
      return res.status(500).json({ message: "Authentication is not configured" });
    }

    const token = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error(`Login error: ${error.message}`);
    return res.status(500).json({ message: "Unable to login" });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name email bio avatarUrl");

    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(401).json({ message: "Authentication required" });
    }

    console.error(`Current user lookup error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch user" });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
};