const mongoose = require("mongoose");

const AgentLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  level: { type: String, default: "info" },
  message: { type: String, required: true }
}, { _id: false });

const SpeakerSegmentSchema = new mongoose.Schema({
  speaker: { type: String, default: "Speaker" },
  start: { type: Number, default: 0 },
  end: { type: Number, default: 0 },
  text: { type: String, default: "" }
}, { _id: false });

const MeetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  platform: { type: String, default: "other" },
  meetingLink: { type: String, default: "" },
  scheduledAt: { type: Date, default: Date.now },
  durationMinutes: { type: Number, default: 30 },
  timezone: { type: String, default: "Local" },
  notes: { type: String, default: "" },
  transcript: { type: String, default: "" },
  summary: { type: String, default: "" },
  speakerSegments: { type: [SpeakerSegmentSchema], default: [] },
  recordingFileName: { type: String, default: "" },
  recordingMimeType: { type: String, default: "" },
  recordingUploadedAt: { type: Date, default: null },
  transcriptionSource: { type: String, default: "" },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "transcribed", "summarized", "sent"], default: "pending" },
  autoJoinEnabled: { type: Boolean, default: false },
  autoSendEnabled: { type: Boolean, default: false },
  agentName: { type: String, default: "MeetMind Agent" },
  agentStatus: { type: String, default: "disabled" },
  agentMode: { type: String, default: "manual" },
  agentStartedAt: { type: Date, default: null },
  agentJoinedAt: { type: Date, default: null },
  agentStoppedAt: { type: Date, default: null },
  agentTranscriptUpdatedAt: { type: Date, default: null },
  agentLastHeartbeatAt: { type: Date, default: null },
  lastError: { type: String, default: "" },
  agentLogs: { type: [AgentLogSchema], default: [] },
  selectedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
  sentTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
}, { timestamps: true });

module.exports = mongoose.model("Meeting", MeetingSchema);
