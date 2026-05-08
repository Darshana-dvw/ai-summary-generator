const router = require("express").Router();
const express = require("express");
const meet = require("../controllers/meetingController");
const authMiddleware = require("../config/authMiddleware");

// Employee routes (must be before /:id to avoid path conflict)
router.get("/employee/my-meetings", authMiddleware(["employee"]), meet.getMyMeetings);

// Admin routes
router.post("/create", authMiddleware(["admin"]), meet.createMeeting);
router.get("/all", authMiddleware(["admin"]), meet.getMeetings);
router.get("/calendar", authMiddleware(["admin"]), meet.getCalendarMeetings);
router.get("/:id", authMiddleware(["admin", "employee"]), meet.getMeeting);
router.put("/:id/transcript", authMiddleware(["admin"]), meet.updateTranscript);
router.post("/:id/recording", authMiddleware(["admin"]), express.raw({ type: () => true, limit: "26mb" }), meet.uploadRecording);
router.post("/:id/run-agent", authMiddleware(["admin"]), meet.runAgent);
router.post("/:id/stop-agent", authMiddleware(["admin"]), meet.stopAgent);
router.post("/:id/summarize", authMiddleware(["admin"]), meet.generateSummary);
router.post("/:id/send", authMiddleware(["admin"]), meet.sendSummary);
router.put("/:id/employees", authMiddleware(["admin"]), meet.updateSelectedEmployees);
router.delete("/:id", authMiddleware(["admin"]), meet.deleteMeeting);

module.exports = router;
