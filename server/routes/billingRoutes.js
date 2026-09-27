const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
	getBillingDetails,
	createBillingSubscription,
	createBillingSubscriptionLink,
	verifyBillingCheckout,
	cancelBillingSubscription,
	handleBillingWebhook,
} = require("../controllers/billingController");

const router = express.Router();
router.get("/me", authMiddleware, getBillingDetails);
router.post("/subscriptions", authMiddleware, createBillingSubscription);
router.post("/subscription-link", authMiddleware, createBillingSubscriptionLink);
router.post("/subscriptions/verify", authMiddleware, verifyBillingCheckout);
router.post("/subscriptions/cancel", authMiddleware, cancelBillingSubscription);
router.post("/webhook", handleBillingWebhook);

module.exports = router;