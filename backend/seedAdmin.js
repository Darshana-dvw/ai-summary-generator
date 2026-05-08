require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./src/models/Admin");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existing = await Admin.findOne({ email: "admin@example.com" });
    if (existing) {
      console.log("⚠️ Admin already exists, skipping...");
      return mongoose.disconnect();
    }

    const hashedPassword = await bcrypt.hash("password123", 10);

    await Admin.create({
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin",
      role: "admin"
    });

    console.log("✅ Admin user created (admin@example.com / password123)");
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
    mongoose.disconnect();
  }
}

seed();
