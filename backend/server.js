require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db"); // import your db.js

// Nodemailer setup
const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendMail(to, summary) {
  await transporter.sendMail({
    from: "Meeting Bot",
    to,
    subject: "Meeting Summary",
    text: summary,
  });
}
module.exports = sendMail;

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes (auth, employee, meeting)
const authRoutes = require("./src/routes/authRoutes");
const empRoutes = require("./src/routes/employeeRoutes");
const meetRoutes = require("./src/routes/meetingRoutes");
const employeeRoutes = require("./src/routes/employeeRoutes");
app.use("/api/employees", employeeRoutes);


app.use("/auth", authRoutes);
app.use("/employee", empRoutes);
app.use("/meeting", meetRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
