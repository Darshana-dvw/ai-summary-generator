const express = require("express");
const router = express.Router();
const notif = require("../controllers/notificationController");
const authMiddleware = require("../config/authMiddleware");

router.get("/", authMiddleware(["employee"]), notif.getMyNotifications);
router.get("/unread-count", authMiddleware(["employee"]), notif.getUnreadCount);
router.put("/:id/read", authMiddleware(["employee"]), notif.markAsRead);
router.put("/read-all", authMiddleware(["employee"]), notif.markAllAsRead);

module.exports = router;
