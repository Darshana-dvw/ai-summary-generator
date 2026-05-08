const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  type: {
    type: String,
    enum: ["added_to_list", "summary_received", "removed_from_list", "general"],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  meeting: { type: mongoose.Schema.Types.ObjectId, ref: "Meeting" },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Notification", NotificationSchema);
