require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const connectDB = require("./src/config/db");
const { initSocket } = require("./src/config/socket");
const { meetingAgentService } = require("./src/services/meetingAgentService");

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json({ limit: "10mb" }));

const authRoutes = require("./src/routes/authRoutes");
const employeeRoutes = require("./src/routes/employeeRoutes");
const meetRoutes = require("./src/routes/meetingRoutes");
const emailRoutes = require("./src/routes/emailRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");

app.use("/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/meeting", meetRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/notifications", notificationRoutes);

async function startServer() {
  await connectDB();
  initSocket(server);

  server.listen(5000, () => {
    console.log("Server running on port 5000");
    meetingAgentService.startScheduler();
  });
}

startServer().catch((error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});
