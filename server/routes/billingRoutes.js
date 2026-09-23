const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { getBillingDetails } = require("../controllers/billingController");

const router = express.Router();
router.get("/me", authMiddleware, getBillingDetails);

module.exports = router;