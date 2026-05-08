const Meeting = require("../models/Meeting");
const Employee = require("../models/Employee");
const Notification = require("../models/Notification");
const summarize = require("../services/summarizerService");
const sendMail = require("../services/emailService");
const { notifyEmployee } = require("../config/socket");
const mongoose = require("mongoose");
const { meetingAgentService } = require("../services/meetingAgentService");
const { saveRecordingFile, transcribeRecording } = require("../services/recordingService");

const PLATFORM_BY_LINK = [
  { match: "meet.google.com", value: "google-meet" },
  { match: "zoom.us", value: "zoom" },
  { match: "teams.microsoft.com", value: "teams" }
];

function inferPlatform(meetingLink = "") {
  const normalizedLink = String(meetingLink || "").toLowerCase();
  const match = PLATFORM_BY_LINK.find((item) => normalizedLink.includes(item.match));
  return match?.value || "other";
}

function getScheduledAt(meeting) {
  return meeting.scheduledAt || meeting.date || meeting.createdAt || new Date();
}

function ensureValidMeetingId(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid meeting id." });
    return false;
  }

  return true;
}

function normalizeMeeting(meetingLike) {
  const meeting = meetingLike?.toObject ? meetingLike.toObject() : meetingLike;
  const durationMinutes = Number(meeting.durationMinutes);

  return {
    ...meeting,
    description: meeting.description || "",
    platform: meeting.platform || inferPlatform(meeting.meetingLink),
    scheduledAt: getScheduledAt(meeting),
    durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30,
    timezone: meeting.timezone || "Local",
    notes: meeting.notes || "",
    speakerSegments: meeting.speakerSegments || [],
    recordingFileName: meeting.recordingFileName || "",
    recordingMimeType: meeting.recordingMimeType || "",
    recordingUploadedAt: meeting.recordingUploadedAt || null,
    transcriptionSource: meeting.transcriptionSource || "",
    autoJoinEnabled: Boolean(meeting.autoJoinEnabled),
    autoSendEnabled: Boolean(meeting.autoSendEnabled),
    agentName: meeting.agentName || "MeetMind Agent",
    agentStatus: meeting.agentStatus || (meeting.autoJoinEnabled ? "scheduled" : "disabled"),
    agentMode: meeting.agentMode || "manual",
    agentStartedAt: meeting.agentStartedAt || null,
    agentJoinedAt: meeting.agentJoinedAt || null,
    agentStoppedAt: meeting.agentStoppedAt || null,
    agentTranscriptUpdatedAt: meeting.agentTranscriptUpdatedAt || null,
    agentLastHeartbeatAt: meeting.agentLastHeartbeatAt || null,
    lastError: meeting.lastError || "",
    agentLogs: meeting.agentLogs || []
  };
}

function sortByScheduledAtAscending(left, right) {
  return new Date(getScheduledAt(left)).getTime() - new Date(getScheduledAt(right)).getTime();
}

function sortByScheduledAtDescending(left, right) {
  return new Date(getScheduledAt(right)).getTime() - new Date(getScheduledAt(left)).getTime();
}

async function populateMeeting(meetingId) {
  return Meeting.findById(meetingId)
    .populate("selectedEmployees", "name email")
    .populate("sentTo", "name email");
}

async function createAssignmentNotifications(meetingId, title, employeeIds = []) {
  for (const empId of employeeIds) {
    const notif = await Notification.create({
      employee: empId,
      type: "added_to_list",
      title: "Added to Meeting Summary",
      message: `Your admin added you to receive the summary for "${title}"`,
      meeting: meetingId
    });

    notifyEmployee(String(empId), {
      _id: notif._id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      meetingId,
      isRead: false,
      createdAt: notif.createdAt
    });
  }
}

async function deliverSummary(meeting, employeeIds = []) {
  const normalizedIds = [...new Set((employeeIds || []).map((id) => String(id)))];
  const employees = await Employee.find({ _id: { $in: normalizedIds } });
  const results = [];
  let deliveredCount = 0;

  for (const emp of employees) {
    try {
      await sendMail(
        emp.email,
        `Meeting Summary: ${meeting.title}`,
        meeting.summary
      );

      if (!meeting.sentTo.some((employeeId) => String(employeeId) === String(emp._id))) {
        meeting.sentTo.push(emp._id);
      }

      const notif = await Notification.create({
        employee: emp._id,
        type: "summary_received",
        title: "Meeting Summary Available",
        message: `Summary for "${meeting.title}" has been sent to your email`,
        meeting: meeting._id
      });

      notifyEmployee(String(emp._id), {
        _id: notif._id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        meetingId: meeting._id,
        isRead: false,
        createdAt: notif.createdAt
      });

      deliveredCount += 1;
      results.push({ email: emp.email, status: "sent" });
    } catch (emailErr) {
      results.push({ email: emp.email, status: "failed", error: emailErr.message });
    }
  }

  if (deliveredCount > 0) {
    meeting.status = "sent";
  }

  return results;
}

exports.createMeeting = async (req, res) => {
  try {
    const {
      title,
      description,
      platform,
      meetingLink,
      scheduledAt,
      durationMinutes,
      timezone,
      notes,
      transcript,
      selectedEmployees,
      autoJoinEnabled,
      autoSendEnabled,
      agentName
    } = req.body;

    const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : new Date();
    if (Number.isNaN(parsedScheduledAt.getTime())) {
      return res.status(400).json({ error: "Please provide a valid scheduled date and time." });
    }

    const parsedDuration = Number(durationMinutes);

    const meeting = new Meeting({
      title,
      description: description || "",
      platform: platform || inferPlatform(meetingLink),
      meetingLink: meetingLink || "",
      scheduledAt: parsedScheduledAt,
      durationMinutes: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30,
      timezone: timezone || "Local",
      notes: notes || "",
      transcript: transcript || "",
      date: parsedScheduledAt,
      autoJoinEnabled: Boolean(autoJoinEnabled),
      autoSendEnabled: Boolean(autoSendEnabled),
      agentName: agentName || "MeetMind Agent",
      agentStatus: autoJoinEnabled ? "scheduled" : "disabled",
      agentMode: "manual",
      lastError: "",
      selectedEmployees: selectedEmployees || [],
      status: transcript ? "transcribed" : "pending",
      createdBy: req.user.id
    });
    await meeting.save();

    if (selectedEmployees && selectedEmployees.length > 0) {
      await createAssignmentNotifications(meeting._id, title, selectedEmployees);
    }

    const populated = await populateMeeting(meeting._id);

    res.json(normalizeMeeting(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate("selectedEmployees", "name email")
      .populate("sentTo", "name email");
    res.json(meetings.map(normalizeMeeting).sort(sortByScheduledAtDescending));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCalendarMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .populate("selectedEmployees", "name email")
      .populate("sentTo", "name email");
    res.json(meetings.map(normalizeMeeting).sort(sortByScheduledAtAscending));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMeeting = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const meeting = await populateMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(normalizeMeeting(meeting));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTranscript = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const { transcript } = req.body;
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { transcript, status: "transcribed", lastError: "" },
      { new: true }
    )
      .populate("selectedEmployees", "name email")
      .populate("sentTo", "name email");

    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(normalizeMeeting(meeting));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.generateSummary = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (!meeting.transcript) return res.status(400).json({ error: "No transcript available" });

    const summary = await summarize(meeting.transcript);
    meeting.summary = summary;
    meeting.status = "summarized";
    meeting.lastError = "";
    await meeting.save();

    const populated = await populateMeeting(meeting._id);

    res.json(normalizeMeeting(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.sendSummary = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const { employeeIds } = req.body;
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (!meeting.summary) return res.status(400).json({ error: "No summary generated yet" });

    const recipientIds = employeeIds?.length ? employeeIds : meeting.selectedEmployees;
    if (!recipientIds || recipientIds.length === 0) {
      return res.status(400).json({ error: "Select at least one employee before sending the summary." });
    }

    const results = await deliverSummary(meeting, recipientIds);
    meeting.lastError = "";
    await meeting.save();

    res.json({ message: "Summary sent", results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadRecording = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const rawNameHeader = req.headers["x-file-name"];
    const originalName = Array.isArray(rawNameHeader) ? rawNameHeader[0] : rawNameHeader;
    let decodedName = originalName || "recording.webm";

    try {
      decodedName = decodeURIComponent(decodedName);
    } catch (decodeError) {
      decodedName = originalName || "recording.webm";
    }

    const mimeTypeHeader = req.headers["content-type"];
    const mimeType = Array.isArray(mimeTypeHeader) ? mimeTypeHeader[0] : mimeTypeHeader;
    const savedRecording = await saveRecordingFile(req.params.id, req.body, decodedName, mimeType);
    const diarizedTranscript = await transcribeRecording(savedRecording.filePath);

    meeting.recordingFileName = savedRecording.fileName;
    meeting.recordingMimeType = savedRecording.mimeType;
    meeting.recordingUploadedAt = new Date();
    meeting.transcriptionSource = "recording_upload";
    meeting.transcript = diarizedTranscript.speakerTranscript || diarizedTranscript.text;
    meeting.speakerSegments = diarizedTranscript.segments;
    meeting.status = meeting.transcript ? "transcribed" : meeting.status;
    meeting.summary = await summarize(meeting.transcript);
    meeting.status = "summarized";
    meeting.autoJoinEnabled = false;
    meeting.agentStatus = "disabled";
    meeting.agentLogs = [];
    meeting.lastError = "";

    const emailResults = meeting.autoSendEnabled && meeting.selectedEmployees.length > 0
      ? await deliverSummary(meeting, meeting.selectedEmployees)
      : [];

    await meeting.save();

    const populated = await populateMeeting(meeting._id);

    res.json({
      meeting: normalizeMeeting(populated),
      emailResults,
      upload: {
        fileName: savedRecording.fileName,
        sizeBytes: savedRecording.sizeBytes,
        durationSeconds: diarizedTranscript.durationSeconds
      }
    });
  } catch (err) {
    try {
      const meeting = await Meeting.findById(req.params.id);
      if (meeting) {
        meeting.lastError = err.message;
        await meeting.save();
      }
    } catch (updateError) {
      // Ignore follow-up persistence errors and return the original failure.
    }

    res.status(500).json({ error: err.message });
  }
};

exports.runAgent = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const result = await meetingAgentService.startAgent(req.params.id, { trigger: "manual", force: true });

    const populated = await populateMeeting(req.params.id);
    res.json({
      meeting: normalizeMeeting(populated),
      result
    });
  } catch (err) {
    try {
      const meeting = await Meeting.findById(req.params.id);
      if (meeting) {
        meeting.agentStatus = "failed";
        meeting.lastError = err.message;
        await meeting.save();
      }
    } catch (updateError) {
      // Ignore follow-up persistence errors and return the original failure.
    }
    res.status(500).json({ error: err.message });
  }
};

exports.stopAgent = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const result = await meetingAgentService.stopAgent(req.params.id);
    const populated = await populateMeeting(req.params.id);

    if (!populated) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.json({
      meeting: normalizeMeeting(populated),
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSelectedEmployees = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    const { selectedEmployees } = req.body;
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });

    const previouslySelected = meeting.selectedEmployees.map(id => id.toString());
    const newlySelected = selectedEmployees.filter(id => !previouslySelected.includes(id));

    meeting.selectedEmployees = selectedEmployees;
    await meeting.save();

    if (newlySelected.length > 0) {
      await createAssignmentNotifications(meeting._id, meeting.title, newlySelected);
    }

    const populated = await populateMeeting(meeting._id);

    res.json(normalizeMeeting(populated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMeeting = async (req, res) => {
  try {
    if (!ensureValidMeetingId(req.params.id, res)) return;

    await meetingAgentService.stopAgent(req.params.id).catch(() => {});
    const meeting = await Meeting.findByIdAndDelete(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    await Notification.deleteMany({ meeting: req.params.id });
    res.json({ message: "Meeting deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Employee-facing: get meetings where this employee is in selectedEmployees
exports.getMyMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      selectedEmployees: req.user.id,
      summary: { $ne: "" }
    })
      .select("title summary date scheduledAt durationMinutes platform meetingLink status createdAt")
      .sort({ createdAt: -1 });

    res.json(meetings.map(normalizeMeeting));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
