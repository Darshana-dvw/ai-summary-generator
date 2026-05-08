let io = null;

// Map of employee ID -> socket ID for real-time notifications
const connectedEmployees = new Map();

const initSocket = (server) => {
  const { Server } = require("socket.io");

  io = new Server(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    // Employee registers their socket with their user ID
    socket.on("register", (userId) => {
      connectedEmployees.set(userId, socket.id);
      console.log(`Employee ${userId} registered with socket ${socket.id}`);
    });

    socket.on("disconnect", () => {
      // Remove from connected map
      for (const [userId, socketId] of connectedEmployees.entries()) {
        if (socketId === socket.id) {
          connectedEmployees.delete(userId);
          break;
        }
      }
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => io;

const notifyEmployee = (employeeId, notification) => {
  const socketId = connectedEmployees.get(employeeId.toString());
  if (socketId && io) {
    io.to(socketId).emit("notification", notification);
  }
};

module.exports = { initSocket, getIO, notifyEmployee };
