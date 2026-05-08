import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api/api";

const TEAM_COLORS = {
  Engineering: "#00d2ff",
  Design: "#ff7a59",
  Marketing: "#ffd166",
  Sales: "#7ae582",
  HR: "#c77dff"
};

const PLATFORM_OPTIONS = [
  { value: "google-meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "other", label: "Other" }
];

const emptyEmployeeForm = { name: "", email: "", company: "", team: "" };
const MAX_RECORDING_SIZE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_RECORDING_TYPES = ".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm";

const createEmptyMeetingForm = () => {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);

  return {
    title: "",
    description: "",
    platform: "google-meet",
    meetingLink: "",
    scheduledAt: toDateTimeLocalValue(nextHour),
    durationMinutes: 30,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Calcutta",
    agentName: "MeetMind Agent",
    notes: "",
    transcript: "",
    selectedEmployees: [],
    autoJoinEnabled: false,
    autoSendEnabled: false
  };
};

function inferPlatformFromLink(meetingLink = "") {
  const normalizedLink = String(meetingLink || "").toLowerCase();

  if (normalizedLink.includes("meet.google.com")) return "google-meet";
  if (normalizedLink.includes("zoom.us")) return "zoom";
  if (normalizedLink.includes("teams.microsoft.com")) return "teams";

  return "other";
}

function normalizeMeeting(meeting) {
  const parsedDuration = Number(meeting.durationMinutes);

  return {
    ...meeting,
    description: meeting.description || "",
    platform: meeting.platform || inferPlatformFromLink(meeting.meetingLink),
    scheduledAt: meeting.scheduledAt || meeting.date || meeting.createdAt || null,
    durationMinutes: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30,
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

function AdminDashboard() {
  const navigate = useNavigate();
  const recordingInputRef = useRef(null);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);

  const [empForm, setEmpForm] = useState(emptyEmployeeForm);
  const [meetingForm, setMeetingForm] = useState(createEmptyMeetingForm);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [uploadTargetMeetingId, setUploadTargetMeetingId] = useState("");
  const [sendEmployeeIds, setSendEmployeeIds] = useState([]);
  const [empSearch, setEmpSearch] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");

  const [loading, setLoading] = useState({});
  const [toast, setToast] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("meetmind_user");
    if (!stored) {
      navigate("/");
      return;
    }

    const parsed = JSON.parse(stored);
    if (parsed.role !== "admin") {
      navigate("/");
      return;
    }

    setUser(parsed);
  }, [navigate]);

  const filteredEmployees = useMemo(() => (
    employees.filter((employee) => {
      const haystack = `${employee.name} ${employee.email} ${employee.company || ""} ${employee.team || ""}`.toLowerCase();
      return haystack.includes(empSearch.toLowerCase());
    })
  ), [employees, empSearch]);

  const filteredMeetings = useMemo(() => (
    meetings.filter((meeting) => {
      const recipients = meeting.selectedEmployees?.map((employee) => employee.email).join(" ") || "";
      const haystack = `${meeting.title} ${meeting.description || ""} ${meeting.platform || ""} ${recipients}`.toLowerCase();
      return haystack.includes(meetingSearch.toLowerCase());
    })
  ), [meetings, meetingSearch]);

  const upcomingMeetings = useMemo(() => (
    [...meetings]
      .filter((meeting) => {
        const scheduledAt = new Date(meeting.scheduledAt);
        return !Number.isNaN(scheduledAt.getTime()) && scheduledAt >= new Date();
      })
      .sort((left, right) => new Date(left.scheduledAt) - new Date(right.scheduledAt))
  ), [meetings]);

  const summaryReadyCount = meetings.filter((meeting) => Boolean(meeting.summary)).length;
  const sentCount = meetings.filter((meeting) => meeting.status === "sent").length;

  const calendarCells = useMemo(() => buildCalendarCells(calendarDate), [calendarDate]);
  const calendarMeetings = meetings;

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await api.get("/api/employees");
      setEmployees(response.data);
    } catch (error) {
      showToast(error.response?.data?.error || "Could not load employees", "error");
    }
  }, [showToast]);

  const fetchMeetings = useCallback(async () => {
    try {
      const response = await api.get("/meeting/all");
      setMeetings((response.data || []).map(normalizeMeeting));
    } catch (error) {
      showToast(error.response?.data?.error || "Could not load meetings", "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (user) {
      fetchEmployees();
      fetchMeetings();
    }
  }, [user, fetchEmployees, fetchMeetings]);

  async function handleAddEmployee(event) {
    event.preventDefault();

    try {
      const response = await api.post("/api/employees", empForm);
      setTempPassword(response.data.tempPassword);
      setEmpForm(emptyEmployeeForm);
      showToast("Employee added successfully.");
      fetchEmployees();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not add employee", "error");
    }
  }

  async function handleDeleteEmployee(employeeId) {
    if (!window.confirm("Remove this employee from the directory?")) {
      return;
    }

    try {
      await api.delete(`/api/employees/${employeeId}`);
      showToast("Employee removed.");
      fetchEmployees();
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not remove employee", "error");
    }
  }

  async function handleCreateMeeting(event) {
    event.preventDefault();
    const parsedScheduledAt = new Date(meetingForm.scheduledAt);

    if (Number.isNaN(parsedScheduledAt.getTime())) {
      showToast("Please choose a valid date and time.", "error");
      return;
    }

    try {
      await api.post("/meeting/create", {
        ...meetingForm,
        scheduledAt: parsedScheduledAt.toISOString(),
        durationMinutes: Number(meetingForm.durationMinutes)
      });

      setMeetingForm(createEmptyMeetingForm());
      setShowMeetingModal(false);
      showToast("Meeting scheduled and recipients added.");
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not create meeting", "error");
    }
  }

  async function handleDeleteMeeting(meetingId) {
    if (!window.confirm("Delete this meeting? This will also remove its notifications.")) {
      return;
    }

    setLoading((previous) => ({ ...previous, [`delete-${meetingId}`]: true }));

    try {
      await api.delete(`/meeting/${meetingId}`);
      showToast("Meeting deleted.");
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not delete the meeting", "error");
    } finally {
      setLoading((previous) => ({ ...previous, [`delete-${meetingId}`]: false }));
    }
  }

  async function handleSaveTranscript() {
    if (!activeMeeting) return;

    setLoading((previous) => ({ ...previous, transcript: true }));

    try {
      await api.put(`/meeting/${activeMeeting._id}/transcript`, { transcript: transcriptDraft });
      setShowTranscriptModal(false);
      setActiveMeeting(null);
      setTranscriptDraft("");
      showToast("Transcript saved.");
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not save transcript", "error");
    } finally {
      setLoading((previous) => ({ ...previous, transcript: false }));
    }
  }

  async function handleGenerateSummary(meetingId) {
    setLoading((previous) => ({ ...previous, [meetingId]: true }));

    try {
      await api.post(`/meeting/${meetingId}/summarize`);
      showToast("Summary generated.");
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not generate summary", "error");
    } finally {
      setLoading((previous) => ({ ...previous, [meetingId]: false }));
    }
  }

  async function handleSendSummary() {
    if (!activeMeeting || sendEmployeeIds.length === 0) return;

    setLoading((previous) => ({ ...previous, sending: true }));

    try {
      await api.post(`/meeting/${activeMeeting._id}/send`, { employeeIds: sendEmployeeIds });
      setShowSendModal(false);
      setSendEmployeeIds([]);
      setActiveMeeting(null);
      showToast("Summary emailed to selected employees.");
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not send summary", "error");
    } finally {
      setLoading((previous) => ({ ...previous, sending: false }));
    }
  }

  function openRecordingPicker(meetingId) {
    setUploadTargetMeetingId(meetingId);
    recordingInputRef.current?.click();
  }

  async function handleRecordingSelected(event) {
    const file = event.target.files?.[0];
    const meetingId = uploadTargetMeetingId;
    event.target.value = "";

    if (!file || !meetingId) return;

    if (file.size > MAX_RECORDING_SIZE_BYTES) {
      showToast("Recording files must be 25 MB or smaller.", "error");
      setUploadTargetMeetingId("");
      return;
    }

    setLoading((previous) => ({ ...previous, [`recording-${meetingId}`]: true }));

    try {
      const response = await api.post(`/meeting/${meetingId}/recording`, file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-file-name": encodeURIComponent(file.name)
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const deliveredCount = (response.data?.emailResults || []).filter((result) => result.status === "sent").length;
      showToast(
        deliveredCount > 0
          ? `Recording processed and summary emailed to ${deliveredCount} recipient(s).`
          : "Recording processed. Transcript and summary are ready."
      );
      fetchMeetings();
    } catch (error) {
      showToast(error.response?.data?.error || "Could not process the recording", "error");
      fetchMeetings();
    } finally {
      setLoading((previous) => ({ ...previous, [`recording-${meetingId}`]: false }));
      setUploadTargetMeetingId("");
    }
  }

  function openTranscriptModal(meeting) {
    setActiveMeeting(meeting);
    setTranscriptDraft(meeting.transcript || "");
    setShowTranscriptModal(true);
  }

  function openSendModal(meeting) {
    setActiveMeeting(meeting);
    setSendEmployeeIds(meeting.selectedEmployees?.map((employee) => employee._id) || []);
    setShowSendModal(true);
  }

  function toggleMeetingEmployee(employeeId) {
    setMeetingForm((previous) => ({
      ...previous,
      selectedEmployees: previous.selectedEmployees.includes(employeeId)
        ? previous.selectedEmployees.filter((id) => id !== employeeId)
        : [...previous.selectedEmployees, employeeId]
    }));
  }

  function toggleSendEmployee(employeeId) {
    setSendEmployeeIds((previous) => (
      previous.includes(employeeId)
        ? previous.filter((id) => id !== employeeId)
        : [...previous, employeeId]
    ));
  }

  function handleLogout() {
    localStorage.removeItem("meetmind_token");
    localStorage.removeItem("meetmind_user");
    navigate("/");
  }

  if (!user) return null;

  return (
    <div style={styles.page}>
      <input
        ref={recordingInputRef}
        type="file"
        accept={ACCEPTED_RECORDING_TYPES}
        onChange={handleRecordingSelected}
        style={{ display: "none" }}
      />

      <aside style={styles.sidebar}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>M</div>
          <div>
            <div style={styles.logoTitle}>MeetMind</div>
            <div style={styles.logoSub}>Meeting command center</div>
          </div>
        </div>

        <div style={styles.nav}>
          {[
            ["overview", "Overview"],
            ["employees", "Employees"],
            ["meetings", "Meetings"],
            ["calendar", "Calendar"]
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              style={{
                ...styles.navButton,
                ...(activeTab === value ? styles.navButtonActive : {})
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={styles.sidebarFooter}>
          <div style={styles.userBadge}>
            <div style={styles.userAvatar}>{(user.name || "A").slice(0, 1).toUpperCase()}</div>
            <div>
              <div style={styles.userName}>{user.name || "Admin"}</div>
              <div style={styles.userEmail}>{user.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
      </aside>

      <main style={styles.main}>
        {toast && (
          <div
            style={{
              ...styles.toast,
              ...(toast.type === "error" ? styles.toastError : styles.toastSuccess)
            }}
          >
            {toast.message}
          </div>
        )}

        {activeTab === "overview" && (
          <section>
            <div style={styles.pageHeader}>
              <div>
                <h1 style={styles.pageTitle}>Meeting operations</h1>
                <p style={styles.pageSub}>
                  Schedule calls, manage recipients, collect transcripts, and send AI summaries.
                </p>
              </div>
              <button onClick={() => setShowMeetingModal(true)} style={styles.primaryButton}>
                Schedule Meeting
              </button>
            </div>

            <div style={styles.statsGrid}>
              <StatCard label="Employees" value={employees.length} accent="#00d2ff" />
              <StatCard label="Scheduled meetings" value={upcomingMeetings.length} accent="#ff7a59" />
              <StatCard label="Summaries ready" value={summaryReadyCount} accent="#ffd166" />
              <StatCard label="Emails sent" value={sentCount} accent="#7ae582" />
            </div>

            <div style={styles.overviewGrid}>
              <div style={styles.panel}>
                <div style={styles.panelHeader}>
                  <h2 style={styles.panelTitle}>Next meetings</h2>
                  <button onClick={() => setActiveTab("calendar")} style={styles.linkButton}>Open calendar</button>
                </div>

                {upcomingMeetings.slice(0, 5).map((meeting) => (
                  <div key={meeting._id} style={styles.timelineItem}>
                    <div style={styles.timelineDate}>{formatShortDate(meeting.scheduledAt)}</div>
                    <div style={styles.timelineContent}>
                      <div style={styles.timelineTitle}>{meeting.title}</div>
                      <div style={styles.timelineMeta}>
                        {formatTimeRange(meeting.scheduledAt, meeting.durationMinutes)} · {platformLabel(meeting.platform)}
                      </div>
                    </div>
                    <div style={{ ...styles.statusPill, ...getStatusColors(meeting.status) }}>{meeting.status}</div>
                  </div>
                ))}

                {upcomingMeetings.length === 0 && (
                  <div style={styles.emptyState}>No upcoming meetings scheduled yet.</div>
                )}
              </div>

              <div style={styles.panel}>
                <div style={styles.panelHeader}>
                  <h2 style={styles.panelTitle}>Recipients snapshot</h2>
                  <button onClick={() => setActiveTab("employees")} style={styles.linkButton}>Manage employees</button>
                </div>

                {employees.slice(0, 6).map((employee) => (
                  <div key={employee._id} style={styles.employeeListItem}>
                    <div
                      style={{
                        ...styles.employeeAvatar,
                        background: TEAM_COLORS[employee.team] || "#00d2ff"
                      }}
                    >
                      {employee.name?.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.employeeName}>{employee.name}</div>
                      <div style={styles.employeeMeta}>{employee.email}</div>
                    </div>
                    <div style={styles.employeeTeamBadge}>
                      {employee.team || "General"}
                    </div>
                  </div>
                ))}

                {employees.length === 0 && (
                  <div style={styles.emptyState}>Add employees so the app can send summaries to them.</div>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === "employees" && (
          <section>
            <div style={styles.pageHeader}>
              <div>
                <h1 style={styles.pageTitle}>Employee delivery list</h1>
                <p style={styles.pageSub}>Keep the recipient directory current before you send meeting summaries.</p>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(true);
                  setTempPassword(null);
                }}
                style={styles.primaryButton}
              >
                Add Employee
              </button>
            </div>

            <input
              value={empSearch}
              onChange={(event) => setEmpSearch(event.target.value)}
              placeholder="Search by name, email, company, or team"
              style={styles.searchInput}
            />

            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span style={{ flex: 1.6 }}>Employee</span>
                <span style={{ flex: 1.7 }}>Email</span>
                <span style={{ flex: 1 }}>Company</span>
                <span style={{ flex: 0.8 }}>Team</span>
                <span style={{ flex: 0.7, textAlign: "right" }}>Action</span>
              </div>

              {filteredEmployees.map((employee) => (
                <div key={employee._id} style={styles.tableRow}>
                  <div style={{ flex: 1.6, display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        ...styles.employeeAvatar,
                        background: TEAM_COLORS[employee.team] || "#00d2ff"
                      }}
                    >
                      {employee.name?.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={styles.employeeName}>{employee.name}</div>
                      <div style={styles.employeeMeta}>{employee.team || "General team"}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1.7, color: "#bcd4ea" }}>{employee.email}</div>
                  <div style={{ flex: 1, color: "#bcd4ea" }}>{employee.company || "-"}</div>
                  <div style={{ flex: 0.8 }}>
                    <span style={styles.employeeTeamBadge}>{employee.team || "-"}</span>
                  </div>
                  <div style={{ flex: 0.7, textAlign: "right" }}>
                    <button onClick={() => handleDeleteEmployee(employee._id)} style={styles.dangerButton}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {filteredEmployees.length === 0 && (
                <div style={styles.emptyTable}>No employees match this search.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === "meetings" && (
          <section>
            <div style={styles.pageHeader}>
              <div>
                <h1 style={styles.pageTitle}>Meeting queue</h1>
                <p style={styles.pageSub}>
                  Every meeting keeps its recipients, schedule, transcript, AI status, and sent summary history together.
                </p>
              </div>
              <button onClick={() => setShowMeetingModal(true)} style={styles.primaryButton}>
                Schedule Meeting
              </button>
            </div>

            <input
              value={meetingSearch}
              onChange={(event) => setMeetingSearch(event.target.value)}
              placeholder="Search meetings by title, platform, or recipient email"
              style={styles.searchInput}
            />

            <div style={styles.cardColumn}>
              {filteredMeetings.map((meeting) => (
                <div key={meeting._id} style={styles.meetingCard}>
                  <div style={styles.meetingHeader}>
                    <div>
                      <h2 style={styles.meetingTitle}>{meeting.title}</h2>
                      <div style={styles.meetingMeta}>
                        {formatFullDateTime(meeting.scheduledAt)} · {meeting.durationMinutes} min · {platformLabel(meeting.platform)}
                      </div>
                    </div>
                    <div style={styles.badgeRow}>
                      <span style={{ ...styles.statusPill, ...getStatusColors(meeting.status) }}>{meeting.status}</span>
                    </div>
                  </div>

                  {meeting.description && <p style={styles.meetingDescription}>{meeting.description}</p>}

                  <div style={styles.infoGrid}>
                    <InfoBlock label="Meeting link" value={meeting.meetingLink || "Not provided"} mono />
                    <InfoBlock label="Timezone" value={meeting.timezone || "Local"} />
                    <InfoBlock label="Auto-send summary" value={meeting.autoSendEnabled ? "Enabled" : "Disabled"} />
                    <InfoBlock label="Recording" value={meeting.recordingFileName || "Not uploaded yet"} mono />
                    <InfoBlock label="Uploaded" value={formatFullDateTime(meeting.recordingUploadedAt)} />
                    <InfoBlock label="Transcript source" value={meeting.transcriptionSource ? "Local recording upload" : "Manual or pending"} />
                  </div>

                  {meeting.notes && (
                    <div style={styles.inlinePanel}>
                      <div style={styles.inlineTitle}>Admin notes</div>
                      <div style={styles.inlineText}>{meeting.notes}</div>
                    </div>
                  )}

                  <div style={styles.inlinePanel}>
                    <div style={styles.inlineTitle}>
                      Summary recipients ({meeting.selectedEmployees?.length || 0})
                    </div>
                    <div style={styles.chipRow}>
                      {meeting.selectedEmployees?.map((employee) => (
                        <span key={employee._id} style={styles.emailChip}>
                          {employee.name} · {employee.email}
                        </span>
                      ))}
                      {(!meeting.selectedEmployees || meeting.selectedEmployees.length === 0) && (
                        <span style={styles.inlineHint}>No employees selected yet.</span>
                      )}
                    </div>
                  </div>

                  {meeting.speakerSegments?.length > 0 && (
                    <div style={styles.inlinePanel}>
                      <div style={styles.inlineTitle}>Who said what</div>
                      <div style={styles.logList}>
                        {meeting.speakerSegments.slice(0, 8).map((segment, index) => (
                          <div key={`${meeting._id}-speaker-${index}`} style={styles.logRow}>
                            <span style={styles.logTime}>{formatSegmentRange(segment.start, segment.end)}</span>
                            <span style={styles.logText}>
                              <strong>{segment.speaker}:</strong> {segment.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {meeting.transcript && (
                    <div style={styles.inlinePanel}>
                      <div style={styles.inlineTitle}>Transcript</div>
                      <div style={styles.inlineText}>{trimLong(meeting.transcript, 420)}</div>
                    </div>
                  )}

                  {meeting.summary && (
                    <div style={{ ...styles.inlinePanel, background: "rgba(122, 229, 130, 0.08)", borderColor: "rgba(122, 229, 130, 0.22)" }}>
                      <div style={styles.inlineTitle}>AI summary</div>
                      <div style={styles.inlineText}>{trimLong(meeting.summary, 600)}</div>
                    </div>
                  )}

                  {meeting.sentTo?.length > 0 && (
                    <div style={styles.sentLine}>
                      Sent to: {meeting.sentTo.map((employee) => employee.email).join(", ")}
                    </div>
                  )}

                  {meeting.lastError && (
                    <div style={styles.errorBanner}>{meeting.lastError}</div>
                  )}

                  <div style={styles.actionRow}>
                    <button onClick={() => openTranscriptModal(meeting)} style={styles.secondaryButton}>
                      {meeting.transcript ? "Edit transcript" : "Add transcript"}
                    </button>

                    <button
                      onClick={() => openRecordingPicker(meeting._id)}
                      disabled={loading[`recording-${meeting._id}`]}
                      style={styles.secondaryButton}
                    >
                      {loading[`recording-${meeting._id}`] ? "Uploading..." : "Upload recording"}
                    </button>

                    <button
                      onClick={() => handleGenerateSummary(meeting._id)}
                      disabled={loading[meeting._id] || !meeting.transcript}
                      style={styles.secondaryButton}
                    >
                      {loading[meeting._id] ? "Generating..." : "Generate summary"}
                    </button>

                    <button
                      onClick={() => openSendModal(meeting)}
                      disabled={!meeting.summary}
                      style={styles.primaryButton}
                    >
                      Send summary
                    </button>

                    <button
                      onClick={() => handleDeleteMeeting(meeting._id)}
                      disabled={loading[`delete-${meeting._id}`]}
                      style={styles.dangerButton}
                    >
                      {loading[`delete-${meeting._id}`] ? "Deleting..." : "Delete meeting"}
                    </button>
                  </div>
                </div>
              ))}

              {filteredMeetings.length === 0 && (
                <div style={styles.emptyState}>No meetings match this search.</div>
              )}
            </div>
          </section>
        )}

        {activeTab === "calendar" && (
          <section>
            <div style={styles.pageHeader}>
              <div>
                <h1 style={styles.pageTitle}>Meeting calendar</h1>
                <p style={styles.pageSub}>See when meetings are scheduled and which ones are ready for summaries.</p>
              </div>
              <button onClick={() => setShowMeetingModal(true)} style={styles.primaryButton}>
                Schedule Meeting
              </button>
            </div>

            <div style={styles.calendarToolbar}>
              <button onClick={() => setCalendarDate(addMonths(calendarDate, -1))} style={styles.secondaryButton}>
                Previous
              </button>
              <div style={styles.calendarMonthLabel}>
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </div>
              <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} style={styles.secondaryButton}>
                Next
              </button>
            </div>

            <div style={styles.calendarBoard}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                <div key={label} style={styles.calendarDayHeader}>{label}</div>
              ))}

              {calendarCells.map((cellDate) => {
                const items = calendarMeetings.filter((meeting) => isSameDay(meeting.scheduledAt, cellDate));
                const isCurrentMonth = cellDate.getMonth() === calendarDate.getMonth();

                return (
                  <div key={cellDate.toISOString()} style={{ ...styles.calendarCell, opacity: isCurrentMonth ? 1 : 0.45 }}>
                    <div style={styles.calendarCellDate}>{cellDate.getDate()}</div>
                    <div style={styles.calendarCellItems}>
                      {items.slice(0, 3).map((meeting) => (
                        <div key={meeting._id} style={{ ...styles.calendarMeetingChip, ...getStatusColors(meeting.status) }}>
                          <div style={styles.calendarMeetingTitle}>{meeting.title}</div>
                          <div style={styles.calendarMeetingTime}>{formatShortTime(meeting.scheduledAt)}</div>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div style={styles.calendarOverflow}>+{items.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <h2 style={styles.panelTitle}>Upcoming schedule</h2>
              </div>

              {upcomingMeetings.map((meeting) => (
                <div key={meeting._id} style={styles.timelineItem}>
                  <div style={styles.timelineDate}>{formatShortDate(meeting.scheduledAt)}</div>
                  <div style={styles.timelineContent}>
                    <div style={styles.timelineTitle}>{meeting.title}</div>
                    <div style={styles.timelineMeta}>
                      {formatTimeRange(meeting.scheduledAt, meeting.durationMinutes)} · {meeting.selectedEmployees?.length || 0} recipients
                    </div>
                  </div>
                  <span style={{ ...styles.statusPill, ...getStatusColors(meeting.status) }}>
                    {meeting.status}
                  </span>
                </div>
              ))}

              {upcomingMeetings.length === 0 && (
                <div style={styles.emptyState}>Your calendar is open. Schedule the first meeting to populate it.</div>
              )}
            </div>
          </section>
        )}
      </main>

      {showAddModal && (
        <ModalShell title="Add employee" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddEmployee} style={styles.formColumn}>
            <input
              required
              value={empForm.name}
              onChange={(event) => setEmpForm((previous) => ({ ...previous, name: event.target.value }))}
              placeholder="Full name"
              style={styles.modalInput}
            />
            <input
              required
              type="email"
              value={empForm.email}
              onChange={(event) => setEmpForm((previous) => ({ ...previous, email: event.target.value }))}
              placeholder="Email address"
              style={styles.modalInput}
            />
            <input
              value={empForm.company}
              onChange={(event) => setEmpForm((previous) => ({ ...previous, company: event.target.value }))}
              placeholder="Company"
              style={styles.modalInput}
            />
            <select
              value={empForm.team}
              onChange={(event) => setEmpForm((previous) => ({ ...previous, team: event.target.value }))}
              style={styles.modalInput}
            >
              <option value="">Select team</option>
              <option>Engineering</option>
              <option>Design</option>
              <option>Marketing</option>
              <option>Sales</option>
              <option>HR</option>
            </select>

            {tempPassword && (
              <div style={styles.passwordCard}>
                Temporary password: <strong>{tempPassword}</strong>
              </div>
            )}

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setShowAddModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="submit" style={styles.primaryButton}>Add employee</button>
            </div>
          </form>
        </ModalShell>
      )}

      {showMeetingModal && (
        <ModalShell title="Schedule meeting" onClose={() => setShowMeetingModal(false)} wide>
          <form onSubmit={handleCreateMeeting} style={styles.formColumn}>
            <input
              required
              value={meetingForm.title}
              onChange={(event) => setMeetingForm((previous) => ({ ...previous, title: event.target.value }))}
              placeholder="Meeting title"
              style={styles.modalInput}
            />
            <textarea
              value={meetingForm.description}
              onChange={(event) => setMeetingForm((previous) => ({ ...previous, description: event.target.value }))}
              placeholder="Short description or objective"
              style={{ ...styles.modalInput, minHeight: 84, resize: "vertical" }}
            />

            <div style={styles.formGrid}>
              <select
                value={meetingForm.platform}
                onChange={(event) => setMeetingForm((previous) => ({ ...previous, platform: event.target.value }))}
                style={styles.modalInput}
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <input
                required
                type="datetime-local"
                value={meetingForm.scheduledAt}
                onChange={(event) => setMeetingForm((previous) => ({ ...previous, scheduledAt: event.target.value }))}
                style={styles.modalInput}
              />

              <input
                type="number"
                min="15"
                max="480"
                value={meetingForm.durationMinutes}
                onChange={(event) => setMeetingForm((previous) => ({ ...previous, durationMinutes: event.target.value }))}
                placeholder="Duration in minutes"
                style={styles.modalInput}
              />

              <input
                value={meetingForm.timezone}
                onChange={(event) => setMeetingForm((previous) => ({ ...previous, timezone: event.target.value }))}
                placeholder="Timezone"
                style={styles.modalInput}
              />
            </div>

            <input
              value={meetingForm.meetingLink}
              onChange={(event) => setMeetingForm((previous) => ({ ...previous, meetingLink: event.target.value }))}
              placeholder="Meeting link (optional)"
              style={styles.modalInput}
            />

            <textarea
              value={meetingForm.notes}
              onChange={(event) => setMeetingForm((previous) => ({ ...previous, notes: event.target.value }))}
              placeholder="Optional meeting context or notes for the summary"
              style={{ ...styles.modalInput, minHeight: 88, resize: "vertical" }}
            />

            <textarea
              value={meetingForm.transcript}
              onChange={(event) => setMeetingForm((previous) => ({ ...previous, transcript: event.target.value }))}
              placeholder="Optional transcript if you already have the meeting notes"
              style={{ ...styles.modalInput, minHeight: 120, resize: "vertical" }}
            />

            <div style={styles.inlinePanel}>
              <div style={styles.inlineTitle}>Recording upload</div>
              <div style={styles.inlineHint}>
                After the meeting, upload a local MP3, MP4, MPEG, MPGA, M4A, WAV, or WEBM recording.
                Files up to 25 MB are supported for automatic transcript, speaker labels, and summary generation.
              </div>
            </div>

            <div style={styles.toggleGrid}>
              <label style={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={meetingForm.autoSendEnabled}
                  onChange={(event) => setMeetingForm((previous) => ({ ...previous, autoSendEnabled: event.target.checked }))}
                />
                <span>Auto-send summary after generation</span>
              </label>
            </div>

            <div style={styles.inlinePanel}>
              <div style={styles.inlineTitle}>Select employees who should receive the summary</div>
              <div style={styles.checkboxList}>
                {employees.map((employee) => (
                  <label key={employee._id} style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={meetingForm.selectedEmployees.includes(employee._id)}
                      onChange={() => toggleMeetingEmployee(employee._id)}
                    />
                    <span>{employee.name}</span>
                    <span style={styles.checkboxMeta}>{employee.email}</span>
                  </label>
                ))}
                {employees.length === 0 && (
                  <div style={styles.inlineHint}>Add employees first so you can select recipients here.</div>
                )}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setShowMeetingModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button type="submit" style={styles.primaryButton}>Create meeting</button>
            </div>
          </form>
        </ModalShell>
      )}

      {showTranscriptModal && activeMeeting && (
        <ModalShell title={`Transcript · ${activeMeeting.title}`} onClose={() => setShowTranscriptModal(false)} wide>
          <div style={styles.formColumn}>
            <textarea
              value={transcriptDraft}
              onChange={(event) => setTranscriptDraft(event.target.value)}
              placeholder="Paste or edit the meeting transcript here"
              style={{ ...styles.modalInput, minHeight: 260, resize: "vertical" }}
            />

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setShowTranscriptModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button onClick={handleSaveTranscript} disabled={loading.transcript} style={styles.primaryButton}>
                {loading.transcript ? "Saving..." : "Save transcript"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showSendModal && activeMeeting && (
        <ModalShell title={`Send summary · ${activeMeeting.title}`} onClose={() => setShowSendModal(false)}>
          <div style={styles.formColumn}>
            <div style={styles.checkboxList}>
              {employees.map((employee) => (
                <label key={employee._id} style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={sendEmployeeIds.includes(employee._id)}
                    onChange={() => toggleSendEmployee(employee._id)}
                  />
                  <span>{employee.name}</span>
                  <span style={styles.checkboxMeta}>{employee.email}</span>
                </label>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button type="button" onClick={() => setShowSendModal(false)} style={styles.secondaryButton}>
                Cancel
              </button>
              <button
                onClick={handleSendSummary}
                disabled={loading.sending || sendEmployeeIds.length === 0}
                style={styles.primaryButton}
              >
                {loading.sending ? "Sending..." : `Send to ${sendEmployeeIds.length} employee(s)`}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children, wide = false }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={{
          ...styles.modal,
          maxWidth: wide ? 780 : 520
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{title}</h2>
          <button onClick={onClose} style={styles.closeButton}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.statCard, borderColor: `${accent}55` }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent }}>{value}</div>
    </div>
  );
}

function InfoBlock({ label, value, mono = false }) {
  return (
    <div style={styles.infoBlock}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={{ ...styles.infoValue, ...(mono ? styles.monoText : {}) }}>{value}</div>
    </div>
  );
}

function trimLong(value, limit) {
  if (!value) return "";
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function toDateTimeLocalValue(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatFullDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function formatShortTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatTimeRange(startValue, durationMinutes = 30) {
  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) return "Time TBD";

  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${formatShortTime(start)} - ${formatShortTime(end)}`;
}

function formatSegmentRange(startSeconds, endSeconds) {
  return `${formatClock(startSeconds)}-${formatClock(endSeconds)}`;
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function platformLabel(value) {
  return PLATFORM_OPTIONS.find((option) => option.value === value)?.label || "Other";
}

function getStatusColors(status) {
  switch (status) {
    case "scheduled":
      return { background: "rgba(188, 212, 234, 0.16)", color: "#bcd4ea" };
    case "awaiting_transcript":
      return { background: "rgba(255, 209, 102, 0.15)", color: "#ffd166" };
    case "transcribed":
    case "ready_to_summarize":
      return { background: "rgba(199, 125, 255, 0.15)", color: "#c77dff" };
    case "summarized":
    case "completed":
      return { background: "rgba(122, 229, 130, 0.15)", color: "#7ae582" };
    case "sent":
      return { background: "rgba(255, 122, 89, 0.15)", color: "#ff7a59" };
    case "failed":
      return { background: "rgba(255, 92, 92, 0.16)", color: "#ff5c5c" };
    case "idle":
      return { background: "rgba(188, 212, 234, 0.15)", color: "#bcd4ea" };
    case "launching":
      return { background: "rgba(0, 210, 255, 0.12)", color: "#00d2ff" };
    case "joining":
      return { background: "rgba(0, 210, 255, 0.12)", color: "#00d2ff" };
    case "waiting_room":
      return { background: "rgba(255, 209, 102, 0.15)", color: "#ffd166" };
    case "joined":
      return { background: "rgba(122, 229, 130, 0.15)", color: "#7ae582" };
    case "stopped":
      return { background: "rgba(255,255,255,0.08)", color: "#90adc8" };
    case "running":
      return { background: "rgba(0, 210, 255, 0.12)", color: "#00d2ff" };
    case "disabled":
      return { background: "rgba(255,255,255,0.08)", color: "#90adc8" };
    default:
      return { background: "rgba(188, 212, 234, 0.15)", color: "#bcd4ea" };
  }
}

function addMonths(date, amount) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function buildCalendarCells(date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(lastDay);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const cells = [];
  const current = new Date(start);

  while (current <= end) {
    cells.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return cells;
}

function isSameDay(leftValue, rightDate) {
  const left = new Date(leftValue);
  return (
    left.getFullYear() === rightDate.getFullYear() &&
    left.getMonth() === rightDate.getMonth() &&
    left.getDate() === rightDate.getDate()
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background: "linear-gradient(180deg, #08111b 0%, #0f1d2c 100%)",
    color: "#f5fbff",
    fontFamily: "'Segoe UI', sans-serif"
  },
  sidebar: {
    width: 260,
    padding: "28px 18px",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(7,16,26,0.82)",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    position: "sticky",
    top: 0,
    height: "100vh"
  },
  logoWrap: { display: "flex", alignItems: "center", gap: 14 },
  logoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "linear-gradient(135deg, #00d2ff, #ff7a59)",
    color: "#08111b",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  logoTitle: { fontSize: 20, fontWeight: 700 },
  logoSub: { fontSize: 12, color: "#90adc8" },
  nav: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10 },
  navButton: {
    border: "1px solid transparent",
    background: "transparent",
    color: "#bcd4ea",
    borderRadius: 12,
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: 14
  },
  navButtonActive: {
    background: "rgba(0,210,255,0.12)",
    color: "#f5fbff",
    borderColor: "rgba(0,210,255,0.32)"
  },
  sidebarFooter: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 },
  userBadge: { display: "flex", alignItems: "center", gap: 12, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "#00d2ff",
    color: "#08111b",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  userName: { fontSize: 14, fontWeight: 600 },
  userEmail: { fontSize: 12, color: "#90adc8" },
  logoutButton: {
    borderRadius: 12,
    border: "1px solid rgba(255,122,89,0.35)",
    background: "transparent",
    color: "#ff9b7a",
    padding: "10px 14px",
    cursor: "pointer"
  },
  main: {
    flex: 1,
    padding: "32px 40px 40px",
    position: "relative"
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 24
  },
  pageTitle: { margin: 0, fontSize: 30, fontWeight: 700 },
  pageSub: { margin: "8px 0 0", color: "#90adc8", maxWidth: 760, lineHeight: 1.5 },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 24
  },
  statCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: "20px 22px"
  },
  statLabel: { fontSize: 13, color: "#90adc8" },
  statValue: { fontSize: 34, fontWeight: 700, marginTop: 10 },
  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(320px, 1.3fr) minmax(320px, 1fr)",
    gap: 20
  },
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 20
  },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 },
  panelTitle: { margin: 0, fontSize: 18, fontWeight: 600 },
  linkButton: {
    background: "transparent",
    border: "none",
    color: "#00d2ff",
    cursor: "pointer",
    padding: 0
  },
  timelineItem: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    padding: "12px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)"
  },
  timelineDate: {
    width: 70,
    color: "#ffcf8b",
    fontWeight: 600,
    flexShrink: 0
  },
  timelineContent: { flex: 1 },
  timelineTitle: { fontWeight: 600 },
  timelineMeta: { color: "#90adc8", fontSize: 13, marginTop: 4 },
  statusPill: {
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase"
  },
  employeeListItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)"
  },
  employeeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    color: "#08111b",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  employeeName: { fontWeight: 600 },
  employeeMeta: { color: "#90adc8", fontSize: 12, marginTop: 4 },
  employeeTeamBadge: {
    borderRadius: 999,
    padding: "5px 10px",
    background: "rgba(255,255,255,0.06)",
    color: "#bcd4ea",
    fontSize: 11
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "#f5fbff",
    padding: "14px 16px",
    marginBottom: 18,
    outline: "none"
  },
  table: {
    borderRadius: 18,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)"
  },
  tableHeader: {
    display: "flex",
    padding: "14px 18px",
    color: "#90adc8",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "16px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.06)"
  },
  emptyTable: { padding: 32, textAlign: "center", color: "#90adc8" },
  cardColumn: { display: "flex", flexDirection: "column", gap: 16 },
  meetingCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18,
    padding: 22
  },
  meetingHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  meetingTitle: { margin: 0, fontSize: 21 },
  meetingMeta: { color: "#90adc8", marginTop: 6, fontSize: 13 },
  badgeRow: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  meetingDescription: { color: "#d8e9f8", lineHeight: 1.6, margin: "16px 0 0" },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginTop: 16
  },
  infoBlock: {
    background: "rgba(7,16,26,0.55)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: "12px 14px"
  },
  infoLabel: { fontSize: 11, textTransform: "uppercase", color: "#90adc8", letterSpacing: 0.4 },
  infoValue: { marginTop: 6, fontSize: 13, color: "#f5fbff", lineHeight: 1.5 },
  monoText: { fontFamily: "Consolas, monospace", wordBreak: "break-word" },
  inlinePanel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    background: "rgba(7,16,26,0.5)",
    border: "1px solid rgba(255,255,255,0.06)"
  },
  inlineTitle: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, color: "#90adc8", marginBottom: 10 },
  inlineText: { color: "#d8e9f8", lineHeight: 1.6, whiteSpace: "pre-wrap" },
  inlineHint: { color: "#90adc8", fontSize: 13 },
  logList: { display: "flex", flexDirection: "column", gap: 8 },
  logRow: {
    display: "grid",
    gridTemplateColumns: "72px 1fr",
    gap: 10,
    alignItems: "start",
    padding: "8px 10px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.03)"
  },
  logTime: { color: "#90adc8", fontSize: 12, fontFamily: "Consolas, monospace" },
  logText: { color: "#d8e9f8", fontSize: 13, lineHeight: 1.5 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  emailChip: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(0,210,255,0.11)",
    color: "#8ee8ff",
    fontSize: 12
  },
  sentLine: { marginTop: 14, fontSize: 13, color: "#7ae582" },
  errorBanner: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(255,92,92,0.12)",
    border: "1px solid rgba(255,92,92,0.25)",
    color: "#ffb8b8"
  },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 },
  primaryButton: {
    border: "none",
    borderRadius: 12,
    background: "linear-gradient(135deg, #00d2ff, #7ae582)",
    color: "#08111b",
    padding: "11px 16px",
    fontWeight: 700,
    cursor: "pointer"
  },
  secondaryButton: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#f5fbff",
    padding: "11px 16px",
    cursor: "pointer"
  },
  dangerButton: {
    borderRadius: 10,
    border: "1px solid rgba(255,92,92,0.35)",
    background: "rgba(255,92,92,0.08)",
    color: "#ffb8b8",
    padding: "8px 12px",
    cursor: "pointer"
  },
  emptyState: {
    padding: 28,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.12)",
    color: "#90adc8",
    textAlign: "center"
  },
  toast: {
    position: "fixed",
    top: 24,
    right: 24,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid",
    zIndex: 1000
  },
  toastSuccess: {
    background: "rgba(122,229,130,0.12)",
    borderColor: "rgba(122,229,130,0.35)",
    color: "#d8ffdf"
  },
  toastError: {
    background: "rgba(255,92,92,0.12)",
    borderColor: "rgba(255,92,92,0.35)",
    color: "#ffd0d0"
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(3, 8, 14, 0.74)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 200
  },
  modal: {
    width: "100%",
    background: "#102131",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    maxHeight: "92vh",
    overflow: "auto"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 22px",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  modalTitle: { margin: 0, fontSize: 20 },
  closeButton: {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "8px 12px",
    background: "transparent",
    color: "#f5fbff",
    cursor: "pointer"
  },
  formColumn: { display: "flex", flexDirection: "column", gap: 14, padding: 22 },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12
  },
  modalInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    color: "#f5fbff",
    padding: "12px 14px",
    outline: "none"
  },
  checkboxList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 240,
    overflow: "auto"
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)"
  },
  checkboxMeta: { marginLeft: "auto", color: "#90adc8", fontSize: 12 },
  toggleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12
  },
  toggleCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)"
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  passwordCard: {
    padding: "12px 14px",
    borderRadius: 12,
    background: "rgba(122,229,130,0.12)",
    border: "1px solid rgba(122,229,130,0.26)",
    color: "#d8ffdf"
  },
  calendarToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16
  },
  calendarMonthLabel: { fontSize: 20, fontWeight: 600 },
  calendarBoard: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 22
  },
  calendarDayHeader: {
    padding: "10px 12px",
    color: "#90adc8",
    fontSize: 12,
    textTransform: "uppercase"
  },
  calendarCell: {
    minHeight: 140,
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  calendarCellDate: { fontSize: 14, color: "#f5fbff", fontWeight: 600 },
  calendarCellItems: { display: "flex", flexDirection: "column", gap: 8 },
  calendarMeetingChip: {
    padding: "8px 10px",
    borderRadius: 12
  },
  calendarMeetingTitle: { fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  calendarMeetingTime: { fontSize: 11, marginTop: 4, opacity: 0.9 },
  calendarOverflow: { fontSize: 12, color: "#90adc8" }
};

export default AdminDashboard;
