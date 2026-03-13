import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const COMPANY = "Acme Corp";
const TEAMS = ["Engineering", "Product", "Design", "Marketing", "Sales"];

function Dashboard() {
  const navigate = useNavigate();
  const adminEmail = localStorage.getItem("adminEmail") || "admin@company.com";

  const [employees, setEmployees] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: COMPANY, team: TEAMS[0] });
  const [reportForm, setReportForm] = useState({ title: "", summary: "", recipientId: "" });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("adminLoggedIn")) navigate("/");
    fetchEmployees();
    // Load mock reports from localStorage
    const saved = JSON.parse(localStorage.getItem("meetmind_reports") || "[]");
    setReports(saved);
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/employees");
      const withExtras = res.data.map((e) => ({
        ...e,
        company: e.company || COMPANY,
        team: e.team || TEAMS[Math.floor(Math.random() * TEAMS.length)],
        joinDate: e.joinDate || new Date(Date.now() - Math.random() * 1e10).toISOString(),
      }));
      setEmployees(withExtras);
    } catch {
      showToast("Could not connect to backend", "error");
    }
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddEmployee = async () => {
    if (!form.name || !form.email) return showToast("Name and email required", "error");
    try {
      const res = await axios.post("http://localhost:5000/api/employees", form);
      setEmployees([...employees, { ...res.data, company: form.company, team: form.team, joinDate: new Date().toISOString() }]);
      setForm({ name: "", email: "", company: COMPANY, team: TEAMS[0] });
      setShowAddModal(false);
      showToast("Employee added successfully");
    } catch {
      showToast("Failed to add employee", "error");
    }
  };

  const handleSendReport = async () => {
    if (!reportForm.title || !reportForm.summary || !reportForm.recipientId) return showToast("Fill all fields", "error");
    setSending(true);
    const emp = employees.find((e) => e._id === reportForm.recipientId);
    try {
      await axios.post("http://localhost:5000/api/email/send", {
        to: emp.email,
        subject: reportForm.title,
        text: reportForm.summary,
      });
    } catch {}
    const newReport = {
      id: Date.now(),
      title: reportForm.title,
      summary: reportForm.summary,
      recipient: emp,
      date: new Date().toISOString(),
      status: "sent",
    };
    const updated = [newReport, ...reports];
    setReports(updated);
    localStorage.setItem("meetmind_reports", JSON.stringify(updated));
    setReportForm({ title: "", summary: "", recipientId: "" });
    setShowReportModal(false);
    setSending(false);
    showToast(`Report sent to ${emp.name}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminLoggedIn");
    navigate("/");
  };

  const filteredEmployees = employees.filter((e) =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase()) ||
    e.team?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: "Total Employees", value: employees.length, icon: "👥", color: "#00E5FF" },
    { label: "Reports Sent", value: reports.length, icon: "📋", color: "#7C3AED" },
    { label: "Active Teams", value: [...new Set(employees.map((e) => e.team))].length, icon: "🏢", color: "#10B981" },
    { label: "This Month", value: reports.filter((r) => new Date(r.date).getMonth() === new Date().getMonth()).length, icon: "📅", color: "#F59E0B" },
  ];

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet" />
      <div style={s.grid}></div>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.sidebarLogo}>
          <div style={s.logoIcon}>
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#00E5FF" strokeWidth="2"/>
              <path d="M8 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="17" r="3" fill="#00E5FF"/>
            </svg>
          </div>
          <span style={s.logoText}>MeetMind</span>
        </div>

        <nav style={s.nav}>
          {[
            { id: "overview", label: "Overview", icon: "⬡" },
            { id: "employees", label: "Employees", icon: "◎" },
            { id: "reports", label: "Reports", icon: "◈" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{ ...s.navItem, ...(activeTab === item.id ? s.navActive : {}) }}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.adminBadge}>
            <div style={s.adminAvatar}>{adminEmail[0].toUpperCase()}</div>
            <div>
              <div style={s.adminLabel}>Admin</div>
              <div style={s.adminEmail}>{adminEmail}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>Sign Out</button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={s.main}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.pageTitle}>
              {activeTab === "overview" && "Dashboard Overview"}
              {activeTab === "employees" && "Employee Directory"}
              {activeTab === "reports" && "Reports & Summaries"}
            </h1>
            <p style={s.pageSub}>{COMPANY} · Admin View</p>
          </div>
          <div style={s.headerActions}>
            {activeTab === "employees" && (
              <button onClick={() => setShowAddModal(true)} style={s.primaryBtn}>+ Add Employee</button>
            )}
            {(activeTab === "reports" || activeTab === "overview") && (
              <button onClick={() => setShowReportModal(true)} style={s.primaryBtn}>+ Send Report</button>
            )}
          </div>
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <div style={s.statsGrid}>
              {stats.map((stat, i) => (
                <div key={i} style={s.statCard}>
                  <div style={{ ...s.statIcon, color: stat.color }}>{stat.icon}</div>
                  <div style={{ ...s.statValue, color: stat.color }}>{stat.value}</div>
                  <div style={s.statLabel}>{stat.label}</div>
                  <div style={{ ...s.statBar, background: `linear-gradient(90deg, ${stat.color}30, transparent)` }}></div>
                </div>
              ))}
            </div>

            <div style={s.twoCol}>
              <div style={s.panel}>
                <div style={s.panelHeader}>
                  <span style={s.panelTitle}>Recent Employees</span>
                  <button onClick={() => setActiveTab("employees")} style={s.viewAll}>View All</button>
                </div>
                {employees.slice(0, 5).map((emp, i) => (
                  <div key={i} style={s.empRow}>
                    <div style={{ ...s.empAvatar, background: avatarColor(emp.name) }}>{emp.name?.[0]}</div>
                    <div style={s.empInfo}>
                      <div style={s.empName}>{emp.name}</div>
                      <div style={s.empMeta}>{emp.email}</div>
                    </div>
                    <div style={{ ...s.teamBadge, ...teamColor(emp.team) }}>{emp.team}</div>
                  </div>
                ))}
                {employees.length === 0 && <div style={s.empty}>No employees yet</div>}
              </div>

              <div style={s.panel}>
                <div style={s.panelHeader}>
                  <span style={s.panelTitle}>Recent Reports</span>
                  <button onClick={() => setActiveTab("reports")} style={s.viewAll}>View All</button>
                </div>
                {reports.slice(0, 5).map((r, i) => (
                  <div key={i} style={s.reportRow}>
                    <div style={s.reportIcon}>📋</div>
                    <div style={s.empInfo}>
                      <div style={s.empName}>{r.title}</div>
                      <div style={s.empMeta}>Sent to {r.recipient?.name} · {fmtDate(r.date)}</div>
                    </div>
                    <div style={s.sentBadge}>Sent</div>
                  </div>
                ))}
                {reports.length === 0 && <div style={s.empty}>No reports sent yet</div>}
              </div>
            </div>
          </div>
        )}

        {/* EMPLOYEES TAB */}
        {activeTab === "employees" && (
          <div>
            <div style={s.searchBar}>
              <input
                type="text"
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={s.searchInput}
              />
            </div>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Employee", "Email", "Company", "Team", "Joined"].map((h) => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((emp, i) => (
                    <tr key={i} style={s.tr}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={s.td}>
                        <div style={s.empCell}>
                          <div style={{ ...s.empAvatar, background: avatarColor(emp.name) }}>{emp.name?.[0]}</div>
                          <span style={{ color: "#fff", fontWeight: "500" }}>{emp.name}</span>
                        </div>
                      </td>
                      <td style={s.td}><span style={s.emailChip}>{emp.email}</span></td>
                      <td style={s.td}><span style={s.muted}>{emp.company || COMPANY}</span></td>
                      <td style={s.td}><div style={{ ...s.teamBadge, ...teamColor(emp.team) }}>{emp.team || "—"}</div></td>
                      <td style={s.td}><span style={s.muted}>{fmtDate(emp.joinDate)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEmployees.length === 0 && (
                <div style={s.emptyTable}>No employees found. Add your first employee!</div>
              )}
            </div>
          </div>
        )}

        {/* REPORTS TAB */}
        {activeTab === "reports" && (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Report Title", "Sent To", "Email", "Date", "Status"].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r, i) => (
                  <tr key={i} style={s.tr}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={s.td}>
                      <div style={{ color: "#fff", fontWeight: "500" }}>{r.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", marginTop: "2px" }}>{r.summary?.slice(0, 60)}...</div>
                    </td>
                    <td style={s.td}>
                      <div style={s.empCell}>
                        <div style={{ ...s.empAvatar, background: avatarColor(r.recipient?.name), width: "28px", height: "28px", fontSize: "12px" }}>{r.recipient?.name?.[0]}</div>
                        <span style={{ color: "rgba(255,255,255,0.8)" }}>{r.recipient?.name}</span>
                      </div>
                    </td>
                    <td style={s.td}><span style={s.emailChip}>{r.recipient?.email}</span></td>
                    <td style={s.td}><span style={s.muted}>{fmtDate(r.date)}</span></td>
                    <td style={s.td}><div style={s.sentBadge}>✓ Sent</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reports.length === 0 && (
              <div style={s.emptyTable}>No reports sent yet. Create your first meeting summary!</div>
            )}
          </div>
        )}
      </main>

      {/* ADD EMPLOYEE MODAL */}
      {showAddModal && (
        <div style={s.overlay} onClick={() => setShowAddModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Add Employee</h2>
              <button onClick={() => setShowAddModal(false)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              {[
                { label: "Full Name", key: "name", type: "text", placeholder: "John Doe" },
                { label: "Email Address", key: "email", type: "email", placeholder: "john@company.com" },
                { label: "Company", key: "company", type: "text", placeholder: COMPANY },
              ].map((f) => (
                <div key={f.key} style={s.field}>
                  <label style={s.fieldLabel}>{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    style={s.modalInput}
                    onFocus={(e) => e.target.style.borderColor = "#00E5FF"}
                    onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                  />
                </div>
              ))}
              <div style={s.field}>
                <label style={s.fieldLabel}>Team</label>
                <select
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                  style={{ ...s.modalInput, cursor: "pointer" }}
                >
                  {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <button onClick={handleAddEmployee} style={s.modalBtn}>Add Employee</button>
            </div>
          </div>
        </div>
      )}

      {/* SEND REPORT MODAL */}
      {showReportModal && (
        <div style={s.overlay} onClick={() => setShowReportModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Send Meeting Report</h2>
              <button onClick={() => setShowReportModal(false)} style={s.closeBtn}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.field}>
                <label style={s.fieldLabel}>Report Title</label>
                <input
                  type="text"
                  placeholder="Q2 Sprint Planning - Summary"
                  value={reportForm.title}
                  onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })}
                  style={s.modalInput}
                  onFocus={(e) => e.target.style.borderColor = "#00E5FF"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Send To</label>
                <select
                  value={reportForm.recipientId}
                  onChange={(e) => setReportForm({ ...reportForm, recipientId: e.target.value })}
                  style={{ ...s.modalInput, cursor: "pointer" }}
                >
                  <option value="">Select employee...</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>{e.name} ({e.email})</option>
                  ))}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.fieldLabel}>Meeting Summary</label>
                <textarea
                  placeholder="Paste AI-generated meeting summary here..."
                  value={reportForm.summary}
                  onChange={(e) => setReportForm({ ...reportForm, summary: e.target.value })}
                  style={{ ...s.modalInput, height: "120px", resize: "vertical" }}
                  onFocus={(e) => e.target.style.borderColor = "#00E5FF"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                />
              </div>
              <button onClick={handleSendReport} disabled={sending} style={s.modalBtn}>
                {sending ? "Sending..." : "Send Report →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ ...s.toast, background: toast.type === "error" ? "rgba(255,80,80,0.15)" : "rgba(0,229,255,0.15)", borderColor: toast.type === "error" ? "#ff6b6b" : "#00E5FF", color: toast.type === "error" ? "#ff6b6b" : "#00E5FF" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// Helpers
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const avatarColor = (name = "") => {
  const colors = ["#7C3AED", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6"];
  return colors[name.charCodeAt(0) % colors.length];
};

const teamColor = (team = "") => {
  const map = {
    Engineering: { background: "rgba(0,229,255,0.1)", color: "#00E5FF" },
    Product: { background: "rgba(124,58,237,0.15)", color: "#A78BFA" },
    Design: { background: "rgba(236,72,153,0.1)", color: "#F472B6" },
    Marketing: { background: "rgba(245,158,11,0.1)", color: "#FCD34D" },
    Sales: { background: "rgba(16,185,129,0.1)", color: "#6EE7B7" },
  };
  return map[team] || { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" };
};

const s = {
  page: {
    display: "flex",
    minHeight: "100vh",
    background: "#080C14",
    fontFamily: "'DM Sans', sans-serif",
    color: "#fff",
    position: "relative",
  },
  grid: {
    position: "fixed",
    inset: 0,
    backgroundImage: "linear-gradient(rgba(0,229,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.02) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    pointerEvents: "none",
    zIndex: 0,
  },
  sidebar: {
    width: "240px",
    minHeight: "100vh",
    background: "rgba(255,255,255,0.02)",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    padding: "28px 16px",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 8px",
    marginBottom: "36px",
  },
  logoIcon: { display: "flex" },
  logoText: { fontSize: "18px", fontWeight: "700", color: "#fff", letterSpacing: "-0.3px", fontFamily: "'Space Grotesk', sans-serif" },
  nav: { display: "flex", flexDirection: "column", gap: "4px", flex: 1 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  },
  navActive: {
    background: "rgba(0,229,255,0.08)",
    color: "#00E5FF",
    borderLeft: "2px solid #00E5FF",
  },
  navIcon: { fontSize: "16px" },
  sidebarFooter: { borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "20px", marginTop: "20px" },
  adminBadge: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  adminAvatar: {
    width: "34px", height: "34px", borderRadius: "50%",
    background: "linear-gradient(135deg, #00E5FF, #7C3AED)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "14px", fontWeight: "700", color: "#fff", flexShrink: 0,
  },
  adminLabel: { fontSize: "12px", fontWeight: "600", color: "#fff" },
  adminEmail: { fontSize: "11px", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" },
  logoutBtn: {
    width: "100%", padding: "9px", borderRadius: "8px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.4)", fontSize: "13px", cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
  },
  main: { flex: 1, padding: "32px 40px", position: "relative", zIndex: 1 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" },
  pageTitle: { margin: 0, fontSize: "26px", fontWeight: "700", color: "#fff", letterSpacing: "-0.5px", fontFamily: "'Space Grotesk', sans-serif" },
  pageSub: { margin: "4px 0 0", color: "rgba(255,255,255,0.3)", fontSize: "14px" },
  headerActions: { display: "flex", gap: "12px" },
  primaryBtn: {
    background: "#00E5FF", color: "#080C14", border: "none",
    padding: "10px 20px", borderRadius: "10px", fontSize: "14px",
    fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px", marginBottom: "28px",
  },
  statCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px", padding: "20px 20px 16px",
    position: "relative", overflow: "hidden",
  },
  statIcon: { fontSize: "22px", marginBottom: "12px" },
  statValue: { fontSize: "32px", fontWeight: "700", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" },
  statLabel: { fontSize: "13px", color: "rgba(255,255,255,0.4)", marginTop: "4px" },
  statBar: { position: "absolute", bottom: 0, left: 0, right: 0, height: "3px" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" },
  panel: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px", padding: "20px",
  },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  panelTitle: { fontSize: "15px", fontWeight: "600", color: "#fff" },
  viewAll: { background: "none", border: "none", color: "#00E5FF", fontSize: "13px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" },
  empRow: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  reportRow: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" },
  reportIcon: { fontSize: "18px", flexShrink: 0 },
  empAvatar: {
    width: "34px", height: "34px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "14px", fontWeight: "600", color: "#fff", flexShrink: 0,
  },
  empInfo: { flex: 1, minWidth: 0 },
  empName: { fontSize: "14px", fontWeight: "500", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  empMeta: { fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  teamBadge: { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap" },
  sentBadge: { padding: "3px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500", background: "rgba(16,185,129,0.1)", color: "#6EE7B7", whiteSpace: "nowrap" },
  empty: { color: "rgba(255,255,255,0.2)", fontSize: "13px", padding: "20px 0", textAlign: "center" },
  searchBar: { marginBottom: "20px" },
  searchInput: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", padding: "10px 16px", color: "#fff", fontSize: "14px",
    outline: "none", width: "300px", fontFamily: "'DM Sans', sans-serif",
  },
  tableWrap: {
    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "14px", overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "14px 20px", textAlign: "left", fontSize: "12px",
    fontWeight: "600", color: "rgba(255,255,255,0.3)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    textTransform: "uppercase", letterSpacing: "0.5px",
    background: "rgba(255,255,255,0.02)",
  },
  tr: { transition: "background 0.15s", cursor: "default" },
  td: { padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: "14px" },
  empCell: { display: "flex", alignItems: "center", gap: "10px" },
  emailChip: { color: "rgba(255,255,255,0.5)", fontSize: "13px", fontFamily: "monospace" },
  muted: { color: "rgba(255,255,255,0.4)", fontSize: "13px" },
  emptyTable: { padding: "48px", textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: "14px" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, backdropFilter: "blur(4px)",
  },
  modal: {
    background: "#0F1520", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "18px", width: "100%", maxWidth: "460px",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  modalTitle: { margin: 0, fontSize: "18px", fontWeight: "700", color: "#fff", fontFamily: "'Space Grotesk', sans-serif" },
  closeBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "18px", cursor: "pointer", lineHeight: 1 },
  modalBody: { padding: "24px", display: "flex", flexDirection: "column", gap: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "7px" },
  fieldLabel: { fontSize: "13px", fontWeight: "500", color: "rgba(255,255,255,0.5)" },
  modalInput: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px", padding: "11px 14px", color: "#fff", fontSize: "14px",
    outline: "none", transition: "border-color 0.2s", fontFamily: "'DM Sans', sans-serif",
    width: "100%", boxSizing: "border-box",
  },
  modalBtn: {
    background: "#00E5FF", color: "#080C14", border: "none",
    padding: "13px", borderRadius: "10px", fontSize: "15px",
    fontWeight: "700", cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
    marginTop: "4px",
  },
  toast: {
    position: "fixed", bottom: "28px", right: "28px",
    padding: "12px 20px", borderRadius: "10px",
    border: "1px solid", fontSize: "14px", fontWeight: "500",
    backdropFilter: "blur(10px)", zIndex: 200,
    animation: "fadeIn 0.2s ease",
  },
};

export default Dashboard;