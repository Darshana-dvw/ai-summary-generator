const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: "Admin" },
  role: { type: String, default: "admin" }
}, { timestamps: true });

module.exports = mongoose.model("Admin", AdminSchema);