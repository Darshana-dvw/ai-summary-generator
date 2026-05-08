const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");
const Meeting = require("../models/Meeting");
const Employee = require("../models/Employee");
const Notification = require("../models/Notification");
const summarize = require("./summarizerService");
const sendMail = require("./emailService");
const { notifyEmployee } = require("../config/socket");

const AGENT_POLL_INTERVAL_MS = 15000;
const AGENT_LOOKBACK_WINDOW_MS = 10 * 60 * 1000;
const AGENT_LOG_LIMIT = 40;
const AGENT_CAPTURE_INTERVAL_MS = 4000;
const AGENT_PRE_JOIN_TIMEOUT_MS = 180000;
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const AGENT_DATA_ROOT = path.join(PROJECT_ROOT, ".meeting-agent");
const AGENT_BROWSER_PROFILE_DIR = process.env.MEETING_AGENT_PROFILE_DIR
  || path.join(AGENT_DATA_ROOT, "browser-profile");
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function resolvePlaywrightPackagePath() {
  const bundledPath = path.join(
    os.homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node",
    "node_modules",
    "playwright",
    "package.json"
  );

  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  return null;
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (localError) {
    const fallbackPackagePath = resolvePlaywrightPackagePath();
    if (fallbackPackagePath) {
      const fallbackRequire = createRequire(fallbackPackagePath);
      return fallbackRequire("playwright");
    }

    throw new Error("Playwright is not available. Install it in backend or run this project inside Codex.");
  }
}

function detectBrowserChannel() {
  if (fs.existsSync(CHROME_PATH)) return "chrome";
  if (fs.existsSync(EDGE_PATH)) return "msedge";
  return null;
}

function meetingDataPath(meetingId) {
  return path.join(AGENT_DATA_ROOT, String(meetingId));
}

function snapshotPath(meetingId, name) {
  return path.join(meetingDataPath(meetingId), `${name}.png`);
}

function isDirectGoogleMeetUrl(url) {
  return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/i.test(String(url || ""));
}

function normalizeLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function dedupeLines(lines) {
  const seen = new Set();
  const ordered = [];

  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

function getMeetingEndTime(meeting, fallbackStart = new Date()) {
  const durationMinutes = Number(meeting.durationMinutes);
  const durationMs = (Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 30) * 60000;
  const scheduledAt = meeting.scheduledAt ? new Date(meeting.scheduledAt) : fallbackStart;
  return new Date(scheduledAt.getTime() + durationMs);
}

async function appendAgentLog(meetingId, message, level = "info", extraFields = {}) {
  await Meeting.findByIdAndUpdate(meetingId, {
    ...extraFields,
    agentLastHeartbeatAt: new Date(),
    $push: {
      agentLogs: {
        $each: [{ at: new Date(), level, message }],
        $slice: -AGENT_LOG_LIMIT
      }
    }
  });
}

async function setAgentState(meetingId, fields, logMessage, level = "info") {
  const update = {
    ...fields,
    agentLastHeartbeatAt: new Date()
  };

  if (logMessage) {
    update.$push = {
      agentLogs: {
        $each: [{ at: new Date(), level, message: logMessage }],
        $slice: -AGENT_LOG_LIMIT
      }
    };
  }

  await Meeting.findByIdAndUpdate(meetingId, update);
}

async function mergeTranscript(meetingId, newLines) {
  if (!newLines || newLines.length === 0) return;

  const meeting = await Meeting.findById(meetingId).select("transcript status");
  if (!meeting) return;

  const existingLines = String(meeting.transcript || "")
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);

  const merged = dedupeLines([...existingLines, ...newLines]);

  meeting.transcript = merged.join("\n");
  meeting.status = meeting.transcript ? "transcribed" : meeting.status;
  meeting.agentTranscriptUpdatedAt = new Date();
  meeting.agentLastHeartbeatAt = new Date();
  await meeting.save();
}

async function deliverSummaryFromMeeting(meetingId) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting || !meeting.summary || !meeting.selectedEmployees?.length) {
    return [];
  }

  const employees = await Employee.find({ _id: { $in: meeting.selectedEmployees } });
  const results = [];
  let deliveredCount = 0;

  for (const employee of employees) {
    try {
      await sendMail(
        employee.email,
        `Meeting Summary: ${meeting.title}`,
        meeting.summary
      );

      if (!meeting.sentTo.some((employeeId) => String(employeeId) === String(employee._id))) {
        meeting.sentTo.push(employee._id);
      }

      const notif = await Notification.create({
        employee: employee._id,
        type: "summary_received",
        title: "Meeting Summary Available",
        message: `Summary for "${meeting.title}" has been sent to your email`,
        meeting: meeting._id
      });

      notifyEmployee(String(employee._id), {
        _id: notif._id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        meetingId: meeting._id,
        isRead: false,
        createdAt: notif.createdAt
      });

      deliveredCount += 1;
      results.push({ email: employee.email, status: "sent" });
    } catch (error) {
      results.push({ email: employee.email, status: "failed", error: error.message });
    }
  }

  if (deliveredCount > 0) {
    meeting.status = "sent";
    await meeting.save();
  }

  return results;
}

async function finalizeMeetingOutput(meetingId, options = {}) {
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return { delivered: [] };

  const transcript = String(meeting.transcript || "").trim();
  const delivered = [];

  if (transcript) {
    meeting.summary = await summarize(transcript);
    meeting.status = "summarized";
  }

  meeting.agentStatus = options.agentStatus || "completed";
  meeting.agentStoppedAt = new Date();
  meeting.lastError = options.lastError || "";
  await meeting.save();

  if (meeting.summary && meeting.autoSendEnabled) {
    const sendResults = await deliverSummaryFromMeeting(meetingId);
    delivered.push(...sendResults);
  }

  return { delivered };
}

async function collectCaptionLines(page) {
  return page.evaluate(() => {
    const selectors = [
      "[aria-live='assertive']",
      "[aria-live='polite']",
      "[class*='caption']",
      "[data-self-name]",
      "[jsname]"
    ];

    const noisePatterns = [
      /join now/i,
      /ask to join/i,
      /leave call/i,
      /turn on captions/i,
      /turn off captions/i,
      /meeting details/i,
      /present now/i,
      /chat with everyone/i,
      /people/i
    ];

    const results = [];
    const visited = new Set();

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        const raw = element.innerText || element.textContent || "";
        const normalized = raw.replace(/\s+/g, " ").trim();

        if (!normalized || normalized.length < 8 || normalized.length > 280) continue;
        if (noisePatterns.some((pattern) => pattern.test(normalized))) continue;
        if (visited.has(normalized)) continue;

        visited.add(normalized);
        results.push(normalized);
      }
    }

    return results.slice(-8);
  });
}

class MeetingAgentService {
  constructor() {
    this.runningAgents = new Map();
    this.schedulerHandle = null;
    this.playwright = null;
  }

  ensurePlaywright() {
    if (!this.playwright) {
      this.playwright = loadPlaywright();
    }

    return this.playwright;
  }

  startScheduler() {
    if (this.schedulerHandle) return;

    ensureDirectory(AGENT_DATA_ROOT);

    this.schedulerHandle = setInterval(() => {
      this.checkScheduledMeetings().catch((error) => {
        console.error("Meeting agent scheduler failed:", error.message);
      });
    }, AGENT_POLL_INTERVAL_MS);

    if (typeof this.schedulerHandle.unref === "function") {
      this.schedulerHandle.unref();
    }

    this.checkScheduledMeetings().catch((error) => {
      console.error("Initial meeting agent scan failed:", error.message);
    });
  }

  async checkScheduledMeetings() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - AGENT_LOOKBACK_WINDOW_MS);

    const meetings = await Meeting.find({
      autoJoinEnabled: true,
      meetingLink: { $ne: "" },
      scheduledAt: { $lte: now, $gte: windowStart },
      agentStatus: { $in: ["scheduled", "idle", "failed"] }
    }).select("_id");

    for (const meeting of meetings) {
      const meetingId = String(meeting._id);
      if (this.runningAgents.has(meetingId)) continue;

      try {
        await this.startAgent(meetingId, { trigger: "scheduled", force: false });
      } catch (error) {
        await setAgentState(
          meetingId,
          { agentStatus: "failed", lastError: error.message, agentStoppedAt: new Date() },
          `Scheduled agent failed to start: ${error.message}`,
          "error"
        );
      }
    }
  }

  async startAgent(meetingId, { trigger = "manual", force = true } = {}) {
    const normalizedMeetingId = String(meetingId);
    if (this.runningAgents.has(normalizedMeetingId)) {
      return { started: false, reason: "already-running" };
    }

    const meeting = await Meeting.findById(normalizedMeetingId);
    if (!meeting) {
      throw new Error("Meeting not found.");
    }

    if (!meeting.meetingLink) {
      throw new Error("Add a meeting link before starting the agent.");
    }

    if (meeting.platform !== "google-meet" && !meeting.meetingLink.includes("meet.google.com")) {
      throw new Error("Live auto-join currently supports Google Meet links only.");
    }

    if (!force && new Date(meeting.scheduledAt) > new Date()) {
      return { started: false, reason: "scheduled-for-future" };
    }

    await Meeting.findByIdAndUpdate(normalizedMeetingId, {
      agentMode: trigger,
      agentStatus: "launching",
      agentStartedAt: new Date(),
      agentStoppedAt: null,
      agentJoinedAt: null,
      agentTranscriptUpdatedAt: null,
      agentLastHeartbeatAt: new Date(),
      lastError: "",
      agentLogs: []
    });

    await appendAgentLog(
      normalizedMeetingId,
      trigger === "scheduled" ? "Auto-join agent is starting." : "Manual agent run started."
    );

    const session = {
      meetingId: normalizedMeetingId,
      trigger,
      stopRequested: false,
      context: null,
      page: null,
      capturedLines: new Set()
    };

    this.runningAgents.set(normalizedMeetingId, session);

    void this.runSession(session).catch(async (error) => {
      console.error("Meeting agent session failed:", error.message);
      if (session.stopRequested) {
        await finalizeMeetingOutput(normalizedMeetingId, { agentStatus: "stopped" });
        await appendAgentLog(normalizedMeetingId, "Meeting agent stopped.");
        await this.cleanupSession(normalizedMeetingId);
        return;
      }

      await setAgentState(
        normalizedMeetingId,
        {
          agentStatus: "failed",
          agentStoppedAt: new Date(),
          lastError: error.message
        },
        `Agent failed: ${error.message}`,
        "error"
      );
      await this.cleanupSession(normalizedMeetingId);
    });

    return { started: true };
  }

  async stopAgent(meetingId) {
    const normalizedMeetingId = String(meetingId);
    const session = this.runningAgents.get(normalizedMeetingId);

    if (!session) {
      const meeting = await Meeting.findById(normalizedMeetingId);
      if (meeting) {
        meeting.agentStatus = meeting.autoJoinEnabled ? "scheduled" : "stopped";
        meeting.agentStoppedAt = new Date();
        meeting.lastError = "";
        meeting.agentLogs = [
          ...(meeting.agentLogs || []),
          { at: new Date(), level: "info", message: "Stop requested, but no active browser session was running." }
        ].slice(-AGENT_LOG_LIMIT);
        await meeting.save();
      }

      return { stopped: false, reason: "not-running" };
    }

    session.stopRequested = true;
    await appendAgentLog(normalizedMeetingId, "Stop requested for active meeting agent.");

    if (session.context) {
      await session.context.close().catch(() => {});
    }

    return { stopped: true };
  }

  async runSession(session) {
    const meeting = await Meeting.findById(session.meetingId);
    if (!meeting) {
      throw new Error("Meeting not found.");
    }

    const { chromium } = this.ensurePlaywright();
    const browserChannel = detectBrowserChannel();
    if (!browserChannel) {
      throw new Error("Chrome or Edge is required on this machine for live meeting join.");
    }

    ensureDirectory(AGENT_BROWSER_PROFILE_DIR);
    ensureDirectory(meetingDataPath(session.meetingId));

    const context = await chromium.launchPersistentContext(AGENT_BROWSER_PROFILE_DIR, {
      headless: false,
      channel: browserChannel,
      viewport: { width: 1366, height: 900 },
      args: [
        "--disable-notifications",
        "--use-fake-ui-for-media-stream",
        "--start-maximized"
      ]
    });

    session.context = context;
    session.page = context.pages()[0] || await context.newPage();
    this.attachContextDiagnostics(session);

    await setAgentState(
      session.meetingId,
      { agentStatus: "joining" },
      `Browser launched with ${browserChannel}. Opening meeting link.`
    );

    await this.joinGoogleMeet(session, meeting);

    if (session.stopRequested) {
      await finalizeMeetingOutput(session.meetingId, { agentStatus: "stopped" });
      await this.cleanupSession(session.meetingId);
      return;
    }

    await this.monitorMeeting(session, meeting);
    await finalizeMeetingOutput(session.meetingId, { agentStatus: "completed" });
    await appendAgentLog(session.meetingId, "Meeting agent session completed.");
    await this.cleanupSession(session.meetingId);
  }

  async joinGoogleMeet(session, meeting) {
    let page = session.page;
    const targetUrl = meeting.meetingLink;

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await appendAgentLog(session.meetingId, `Meeting page loaded at ${page.url()}.`);

    if (!isDirectGoogleMeetUrl(targetUrl)) {
      await appendAgentLog(
        session.meetingId,
        "Saved meeting link does not match the normal Google Meet room pattern. Double-check that the full meeting URL was pasted.",
        "error"
      );
    }

    await page.waitForTimeout(3000);
    const joinButton = await this.waitForJoinReadyState(session, meeting);
    page = this.getActivePage(session);
    const joinLabel = (await joinButton.innerText().catch(() => "")) || "Join";

    await joinButton.click();
    await setAgentState(
      session.meetingId,
      { agentStatus: /ask to join/i.test(joinLabel) ? "waiting_room" : "joining" },
      `Join action sent: ${joinLabel}.`
    );

    await this.waitForInCallState(this.getActivePage(session), session.meetingId);
    await this.enableCaptions(page, session.meetingId);

    await setAgentState(
      session.meetingId,
      {
        agentStatus: "joined",
        agentJoinedAt: new Date(),
        lastError: ""
      },
      "Agent joined the Google Meet call."
    );
  }

  async fillGuestNameIfNeeded(page, agentName, meetingId) {
    const candidateSelectors = [
      "input[aria-label='Your name']",
      "input[placeholder='Your name']",
      "input[type='text']"
    ];

    for (const selector of candidateSelectors) {
      const input = page.locator(selector).first();
      if (await input.isVisible().catch(() => false)) {
        await input.fill(agentName).catch(() => {});
        await appendAgentLog(meetingId, `Filled guest name as ${agentName}.`).catch(() => {});
        return;
      }
    }
  }

  async turnMicAndCameraOff(page) {
    const toggleSpecs = [
      /turn off microphone/i,
      /turn off camera/i
    ];

    for (const label of toggleSpecs) {
      const button = page.getByRole("button", { name: label }).first();
      if (await button.isVisible().catch(() => false)) {
        await button.click().catch(() => {});
      }
    }
  }

  async waitForJoinReadyState(session, meeting) {
    const startTime = Date.now();
    let lastLoggedState = "";

    while (Date.now() - startTime < AGENT_PRE_JOIN_TIMEOUT_MS) {
      const page = this.getActivePage(session);
      const currentUrl = page.url();
      const currentTitle = await page.title().catch(() => "");
      const stateKey = `${currentTitle} :: ${currentUrl}`;

      if (stateKey !== lastLoggedState) {
        lastLoggedState = stateKey;
        await appendAgentLog(session.meetingId, `Agent page state: ${currentTitle || "Untitled"} @ ${currentUrl}`);
      }

      const continueButton = page.getByRole("button", { name: /continue in this browser/i }).first();
      if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click().catch(() => {});
        await appendAgentLog(session.meetingId, "Clicked 'Continue in this browser'.");
        await page.waitForTimeout(2500);
        continue;
      }

      const gotItButton = page.getByRole("button", { name: /^got it$/i }).first();
      if (await gotItButton.isVisible().catch(() => false)) {
        await gotItButton.click().catch(() => {});
        await appendAgentLog(session.meetingId, "Dismissed a Google Meet helper prompt.");
      }

      const loginRequiredMessage = await this.detectLoginRequired(page);
      if (loginRequiredMessage) {
        await this.captureSnapshot(session, "login-required");
        throw new Error(loginRequiredMessage);
      }

      await this.fillGuestNameIfNeeded(page, meeting.agentName || "MeetMind Agent", session.meetingId);
      await this.turnMicAndCameraOff(page);

      const failureMessage = await this.detectHardJoinFailure(page);
      if (failureMessage) {
        await this.captureSnapshot(session, "join-failed");
        throw new Error(failureMessage);
      }

      const joinButton = page.getByRole("button", { name: /join now|ask to join/i }).first();
      if (await joinButton.isVisible().catch(() => false)) {
        return joinButton;
      }

      await page.waitForTimeout(2000);
    }

    await this.captureSnapshot(session, "join-timeout");
    throw new Error("Google Meet never showed a join button. Check the last agent snapshot and logs.");
  }

  async detectHardJoinFailure(page) {
    const currentUrl = page.url();
    if (/workspace\.google\.com\/products\/meet/i.test(currentUrl)) {
      return "Google Meet redirected the agent to the Workspace Meet home page. This usually means the meeting link is invalid, expired, or the signed-in Google account does not have access to that call.";
    }

    if (/^https:\/\/meet\.google\.com\/?$/i.test(currentUrl)) {
      return "Google Meet redirected the agent to the Meet home page instead of a meeting room. Check that the saved meeting link is the full room URL and that the signed-in account can access it.";
    }

    const failureTexts = [
      /can't join this video call/i,
      /you can't join this call/i,
      /someone in the call denied your request/i,
      /meeting code no longer works/i,
      /you need permission/i
    ];

    const pageText = await page.locator("body").innerText().catch(() => "");
    const match = failureTexts.find((pattern) => pattern.test(pageText));
    if (match) {
      return pageText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 6).join(" ");
    }

    return "";
  }

  async detectLoginRequired(page) {
    const currentUrl = page.url();
    if (/accounts\.google\.com/i.test(currentUrl)) {
      return "Google sign-in is required. Sign the meeting agent into Google in the opened browser profile, then try again.";
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (/sign in/i.test(bodyText) && /google/i.test(bodyText)) {
      return "Google sign-in is required. Sign the meeting agent into Google in the opened browser profile, then try again.";
    }

    return "";
  }

  async waitForInCallState(page, meetingId) {
    await page.waitForFunction(() => {
      const candidates = Array.from(document.querySelectorAll("button, [role='button']"));
      return candidates.some((element) => {
        const label = `${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`;
        return /leave call|hang up/i.test(label);
      });
    }, { timeout: AGENT_PRE_JOIN_TIMEOUT_MS });
    await appendAgentLog(meetingId, "Detected in-call controls.");
  }

  async enableCaptions(page, meetingId) {
    const captionButton = page.getByRole("button", { name: /turn on captions|captions/i }).first();
    if (await captionButton.isVisible().catch(() => false)) {
      await captionButton.click().catch(() => {});
      await appendAgentLog(meetingId, "Requested live captions.").catch(() => {});
    }
  }

  async monitorMeeting(session, meeting) {
    const endTime = getMeetingEndTime(meeting, new Date());
    await appendAgentLog(session.meetingId, `Meeting monitoring started until ${endTime.toLocaleString()}.`);

    while (!session.stopRequested && new Date() < endTime) {
      const lines = await collectCaptionLines(session.page).catch(() => []);
      const newLines = lines.filter((line) => !session.capturedLines.has(line));

      if (newLines.length > 0) {
        for (const line of newLines) {
          session.capturedLines.add(line);
        }

        await mergeTranscript(session.meetingId, newLines);
        await appendAgentLog(session.meetingId, `Captured ${newLines.length} transcript line(s).`);
      } else {
        await Meeting.findByIdAndUpdate(session.meetingId, { agentLastHeartbeatAt: new Date() });
      }

      await session.page.waitForTimeout(AGENT_CAPTURE_INTERVAL_MS);
    }

    if (!session.stopRequested) {
      await appendAgentLog(session.meetingId, "Scheduled meeting duration ended. Leaving call.");
    }
  }

  async cleanupSession(meetingId) {
    const session = this.runningAgents.get(String(meetingId));
    if (session?.context) {
      await session.context.close().catch(() => {});
    }

    this.runningAgents.delete(String(meetingId));
  }

  attachContextDiagnostics(session) {
    for (const page of session.context.pages()) {
      this.attachPageDiagnostics(session, page);
    }

    session.context.on("page", async (page) => {
      session.page = page;
      this.attachPageDiagnostics(session, page);
      await appendAgentLog(session.meetingId, `A new browser page opened: ${page.url() || "about:blank"}`);
    });
  }

  attachPageDiagnostics(session, page) {
    page.on("close", () => {
      appendAgentLog(session.meetingId, "Agent browser page closed.", "error").catch(() => {});
    });

    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        appendAgentLog(session.meetingId, `Navigated to ${frame.url()}`).catch(() => {});
      }
    });
  }

  getActivePage(session) {
    const openPages = session.context?.pages().filter((page) => !page.isClosed()) || [];
    const meetPage = openPages.find((page) => /meet\.google\.com|accounts\.google\.com/i.test(page.url()));
    const activePage = meetPage || openPages[openPages.length - 1] || session.page;

    if (!activePage || activePage.isClosed()) {
      throw new Error("The meeting browser page closed before the join flow finished.");
    }

    session.page = activePage;
    return activePage;
  }

  async captureSnapshot(session, name) {
    const page = this.getActivePage(session);
    const targetPath = snapshotPath(session.meetingId, name);
    await page.screenshot({ path: targetPath, fullPage: true }).catch(() => {});
    await appendAgentLog(session.meetingId, `Saved agent snapshot: ${targetPath}`);
  }
}

const meetingAgentService = new MeetingAgentService();

module.exports = {
  meetingAgentService
};
