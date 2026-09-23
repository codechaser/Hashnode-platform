const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    plan: { type: String, enum: ["free", "pro"], default: "free", required: true },
    status: { type: String, enum: ["inactive", "active", "past_due", "cancelled", "expired"], default: "inactive", required: true },
    provider: { type: String, default: "" },
    providerSubscriptionId: { type: String, default: "" },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscription", subscriptionSchema);