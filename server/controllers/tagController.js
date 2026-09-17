const Tag = require("../models/Tag");

const slugify = (value) => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const isDuplicateTagError = (error) => error.code === 11000;

const getTags = async (req, res) => {
  try {
    const tags = await Tag.find()
      .select("name slug createdAt updatedAt")
      .sort({ name: 1 });

    return res.status(200).json({ tags });
  } catch (error) {
    console.error(`Tag listing error: ${error.message}`);
    return res.status(500).json({ message: "Unable to fetch tags" });
  }
};

const createTag = async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    return res.status(400).json({ message: "Tag name is required" });
  }

  const slug = slugify(name);

  if (!slug) {
    return res.status(400).json({ message: "Tag name must contain letters or numbers" });
  }

  try {
    const existingTag = await Tag.findOne({
      $or: [
        { name },
        { slug },
      ],
    });

    if (existingTag) {
      return res.status(409).json({ message: "Tag name or slug already exists" });
    }

    const tag = await Tag.create({ name, slug });
    return res.status(201).json({ tag });
  } catch (error) {
    if (isDuplicateTagError(error)) {
      return res.status(409).json({ message: "Tag name or slug already exists" });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Invalid tag data" });
    }

    console.error(`Tag creation error: ${error.message}`);
    return res.status(500).json({ message: "Unable to create tag" });
  }
};

module.exports = {
  getTags,
  createTag,
};