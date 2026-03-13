require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./src/models/Admin"); // adjust if your model path differs

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const hashedPassword = await bcrypt.hash("password123", 10);

    await Admin.create({
      email: "admin@example.com",
      password: hashedPassword,
    });

    console.log("✅ Admin user created");
    mongoose.disconnect();
  } catch (err) {
    console.error("❌ Error seeding admin:", err);
  }
}

seed();
