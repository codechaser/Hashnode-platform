const mongoose = require("mongoose");

const connectDB = async () => {
  if (!process.env.MONGO_URI || process.env.MONGO_URI.trim() === "") {
    throw new Error("MONGO_URI is not set or empty in server/.env");
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;