const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const MAX_RECORDING_SIZE_BYTES = 25 * 1024 * 1024;
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RECORDINGS_ROOT = path.join(PROJECT_ROOT, "uploads", "recordings");

const ALLOWED_EXTENSIONS = new Set([
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".wav",
  ".webm"
]);

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/mpga",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/mpeg",
  "video/webm",
  "application/octet-stream"
]);

const openai = process.env.OPENAI_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_KEY })
  : null;

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function sanitizeFilename(filename) {
  return String(filename || "recording")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isAllowedRecording(filename, mimeType) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) && ALLOWED_MIME_TYPES.has(String(mimeType || "").toLowerCase());
}

function formatSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatSpeakerTranscript(segments = [], fallbackText = "") {
  if (!Array.isArray(segments) || segments.length === 0) {
    return String(fallbackText || "").trim();
  }

  return segments
    .map((segment) => {
      const start = formatSeconds(segment.start);
      const end = formatSeconds(segment.end);
      const speaker = segment.speaker || "Speaker";
      const text = String(segment.text || "").trim();
      return `[${start} - ${end}] ${speaker}: ${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

async function saveRecordingFile(meetingId, buffer, originalName, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Choose a local recording file before uploading.");
  }

  if (buffer.length > MAX_RECORDING_SIZE_BYTES) {
    throw new Error("Recording files must be 25 MB or smaller.");
  }

  const normalizedName = sanitizeFilename(originalName || "recording.webm");
  const normalizedMimeType = String(mimeType || "application/octet-stream").toLowerCase();

  if (!isAllowedRecording(normalizedName, normalizedMimeType)) {
    throw new Error("Upload an mp3, mp4, mpeg, mpga, m4a, wav, or webm recording.");
  }

  const meetingDirectory = path.join(RECORDINGS_ROOT, String(meetingId));
  ensureDirectory(meetingDirectory);

  const savedName = `${Date.now()}-${normalizedName}`;
  const filePath = path.join(meetingDirectory, savedName);
  fs.writeFileSync(filePath, buffer);

  return {
    filePath,
    fileName: savedName,
    mimeType: normalizedMimeType,
    sizeBytes: buffer.length
  };
}

async function transcribeRecording(filePath, options = {}) {
  if (!openai) {
    throw new Error("OpenAI transcription is not configured on the backend.");
  }

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "gpt-4o-transcribe-diarize",
    response_format: "diarized_json",
    chunking_strategy: "auto",
    ...(options.language ? { language: options.language } : {})
  });

  const segments = Array.isArray(transcription.segments)
    ? transcription.segments.map((segment) => ({
      speaker: segment.speaker || "Speaker",
      start: Number(segment.start) || 0,
      end: Number(segment.end) || 0,
      text: String(segment.text || "").trim()
    }))
    : [];

  return {
    text: String(transcription.text || "").trim(),
    segments,
    speakerTranscript: formatSpeakerTranscript(segments, transcription.text),
    durationSeconds: Number(transcription.duration) || 0
  };
}

module.exports = {
  MAX_RECORDING_SIZE_BYTES,
  formatSeconds,
  formatSpeakerTranscript,
  saveRecordingFile,
  transcribeRecording
};
