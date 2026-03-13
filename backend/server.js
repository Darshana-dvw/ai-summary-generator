require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

const authRoutes = require("./src/routes/authRoutes");
const employeeRoutes = require("./src/routes/employeeRoutes");
const meetRoutes = require("./src/routes/meetingRoutes");
const emailRoutes = require("./src/routes/emailRoutes");

app.use("/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/meeting", meetRoutes);
app.use("/api/email", emailRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
