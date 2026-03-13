const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  company: { type: String, default: "Acme Corp" },
  team: { type: String, default: "Engineering" },
  joinDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Employee", employeeSchema);
