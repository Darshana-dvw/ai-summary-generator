const OpenAI = require("openai");

const openai = process.env.OPENAI_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_KEY })
  : null;

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function pickActionItems(sentences) {
  const actionPatterns = [
    /\baction\b/i,
    /\bnext step\b/i,
    /\bfollow up\b/i,
    /\bowner\b/i,
    /\bwill\b/i,
    /\bneed to\b/i,
    /\bshould\b/i,
    /\bassign\b/i
  ];

  const matches = sentences.filter((sentence) => actionPatterns.some((pattern) => pattern.test(sentence)));
  return matches.slice(0, 3);
}

function pickDecisions(sentences) {
  const decisionPatterns = [
    /\bdecided\b/i,
    /\bagreed\b/i,
    /\bapproved\b/i,
    /\bconfirmed\b/i,
    /\bfinal\b/i
  ];

  const matches = sentences.filter((sentence) => decisionPatterns.some((pattern) => pattern.test(sentence)));
  return matches.slice(0, 3);
}

function truncateLine(text, limit = 220) {
  const normalized = String(text || "").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3).trim()}...`;
}

function createFallbackSummary(text) {
  const sentences = splitSentences(text);
  const overview = sentences.slice(0, 3);
  const actionItems = pickActionItems(sentences);
  const decisions = pickDecisions(sentences);

  const lines = [
    "Overview",
    overview.length > 0
      ? overview.map((sentence) => `- ${truncateLine(sentence)}`).join("\n")
      : "- A meeting transcript was provided, but there was not enough detail to produce a fuller overview.",
    "",
    "Key Points",
    sentences.length > 3
      ? sentences.slice(3, 6).map((sentence) => `- ${truncateLine(sentence)}`).join("\n")
      : "- No additional key points were detected beyond the overview.",
    "",
    "Action Items",
    actionItems.length > 0
      ? actionItems.map((sentence) => `- ${truncateLine(sentence)}`).join("\n")
      : "- No explicit action items were detected in the transcript.",
    "",
    "Decisions",
    decisions.length > 0
      ? decisions.map((sentence) => `- ${truncateLine(sentence)}`).join("\n")
      : "- No explicit decisions were detected in the transcript."
  ];

  return lines.join("\n");
}

async function summarizeWithOpenAI(text) {
  if (!openai) {
    throw new Error("OpenAI client is not configured.");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a meeting summary assistant. Create clear, concise, and well-structured meeting summaries with key points, action items, and decisions made."
      },
      {
        role: "user",
        content: `Please summarize the following meeting transcript:\n\n${text}`
      }
    ]
  });

  return response.choices?.[0]?.message?.content?.trim();
}

async function summarize(text) {
  const normalizedText = String(text || "").trim();

  if (!normalizedText) {
    throw new Error("No transcript content was provided.");
  }

  try {
    const result = await summarizeWithOpenAI(normalizedText);
    if (result) {
      return result;
    }
  } catch (error) {
    console.warn("OpenAI summarization failed, using fallback summary:", error.message);
  }

  return createFallbackSummary(normalizedText);
}

module.exports = summarize;
