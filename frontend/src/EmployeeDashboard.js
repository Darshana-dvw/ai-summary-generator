import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api/api";

function EmployeeDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("summaries");
  const [meetings, setMeetings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("meetmind_user");

    if (!stored) {
      navigate("/");
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (parsed.role !== "employee") {
        navigate("/");
        return;
      }
      setUser(parsed);
    } catch {
      localStorage.removeItem("meetmind_user");
      localStorage.removeItem("meetmind_token");
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [meetingsResponse, notificationsResponse, unreadResponse] = await Promise.all([
          api.get("/meeting/employee/my-meetings"),
          api.get("/api/notifications"),
          api.get("/api/notifications/unread-count")
        ]);

        if (!isMounted) return;

        setMeetings(meetingsResponse.data || []);
        setNotifications(notificationsResponse.data || []);
        setUnreadCount(unreadResponse.data?.count || 0);
      } catch (requestError) {
        if (!isMounted) return;
        setError(requestError.response?.data?.error || "Could not load your dashboard right now.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [user]);

  async function markAsRead(notificationId) {
    try {
      await api.put(`/api/notifications/${notificationId}/read`);
      setNotifications((current) => current.map((notification) => (
        notification._id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not update that notification.");
    }
  }

  async function markAllAsRead() {
    try {
      await api.put("/api/notifications/read-all");
      setNotifications((current) => current.map((notification) => ({
        ...notification,
        isRead: true
      })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Could not mark notifications as read.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("meetmind_token");
    localStorage.removeItem("meetmind_user");
    navigate("/");
  }

  if (!user) return null;

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.logo}>MeetMind</div>
          <p style={styles.sidebarCopy}>Your summaries, delivery updates, and meeting notifications in one place.</p>
        </div>

        <div style={styles.nav}>
          <button
            onClick={() => setActiveTab("summaries")}
            style={{
              ...styles.navButton,
              ...(activeTab === "summaries" ? styles.navButtonActive : {})
            }}
          >
            Summaries
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            style={{
              ...styles.navButton,
              ...(activeTab === "notifications" ? styles.navButtonActive : {})
            }}
          >
            Notifications
            {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
          </button>
        </div>

        <div style={styles.profileCard}>
          <div style={styles.avatar}>{(user.name || "E").slice(0, 1).toUpperCase()}</div>
          <div>
            <div style={styles.profileName}>{user.name}</div>
            <div style={styles.profileMeta}>{user.email}</div>
            <div style={styles.profileMeta}>{user.team || "Employee"}</div>
          </div>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
      </aside>

      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              {activeTab === "summaries" ? "Meeting summaries" : "Notifications"}
            </h1>
            <p style={styles.subtitle}>
              {activeTab === "summaries"
                ? "Review the summaries shared with you by your admin."
                : "Stay on top of new meeting summary updates."}
            </p>
          </div>

          {activeTab === "notifications" && notifications.length > 0 && unreadCount > 0 && (
            <button onClick={markAllAsRead} style={styles.secondaryButton}>Mark all as read</button>
          )}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.emptyState}>Loading your dashboard...</div>
        ) : activeTab === "summaries" ? (
          <section style={styles.contentColumn}>
            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Summaries available</div>
                <div style={styles.statValue}>{meetings.length}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Unread notifications</div>
                <div style={styles.statValue}>{unreadCount}</div>
              </div>
            </div>

            {meetings.length === 0 ? (
              <div style={styles.emptyState}>No meeting summaries are available for you yet.</div>
            ) : (
              meetings.map((meeting) => (
                <article key={meeting._id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>{meeting.title}</h2>
                      <div style={styles.cardMeta}>
                        Shared {formatDate(meeting.createdAt || meeting.date)}
                      </div>
                    </div>
                    <span style={styles.statusPill}>{meeting.status || "summarized"}</span>
                  </div>
                  <p style={styles.summaryText}>{meeting.summary}</p>
                </article>
              ))
            )}
          </section>
        ) : (
          <section style={styles.contentColumn}>
            {notifications.length === 0 ? (
              <div style={styles.emptyState}>You do not have any notifications yet.</div>
            ) : (
              notifications.map((notification) => (
                <article
                  key={notification._id}
                  style={{
                    ...styles.card,
                    ...(notification.isRead ? {} : styles.unreadCard)
                  }}
                >
                  <div style={styles.cardHeader}>
                    <div>
                      <h2 style={styles.cardTitle}>{notification.title}</h2>
                      <div style={styles.cardMeta}>{formatRelativeTime(notification.createdAt)}</div>
                    </div>
                    {!notification.isRead && (
                      <button
                        onClick={() => markAsRead(notification._id)}
                        style={styles.inlineButton}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                  <p style={styles.summaryText}>{notification.message}</p>
                </article>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "recently";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatRelativeTime(value) {
  if (!value) return "Just now";

  const deltaMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(deltaMs / 60000));

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    background: "linear-gradient(180deg, #0a1020 0%, #121c33 100%)",
    color: "#eef4ff",
    fontFamily: "'Segoe UI', sans-serif"
  },
  sidebar: {
    width: 280,
    padding: "28px 20px",
    background: "rgba(7, 14, 28, 0.88)",
    borderRight: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 24
  },
  logo: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: -0.4
  },
  sidebarCopy: {
    margin: "10px 0 0",
    color: "#95a7c4",
    lineHeight: 1.6,
    fontSize: 13
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  navButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 14,
    border: "1px solid transparent",
    background: "transparent",
    color: "#c4d1e5",
    padding: "12px 14px",
    cursor: "pointer",
    fontSize: 14,
    textAlign: "left"
  },
  navButtonActive: {
    background: "rgba(124, 58, 237, 0.16)",
    borderColor: "rgba(124, 58, 237, 0.3)",
    color: "#ffffff"
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    background: "#7c3aed",
    color: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    padding: "0 7px",
    boxSizing: "border-box"
  },
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)"
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    background: "linear-gradient(135deg, #7c3aed, #38bdf8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700
  },
  profileName: {
    fontWeight: 600
  },
  profileMeta: {
    color: "#95a7c4",
    fontSize: 12,
    marginTop: 3
  },
  logoutButton: {
    marginTop: "auto",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent",
    color: "#eef4ff",
    padding: "12px 14px",
    cursor: "pointer"
  },
  main: {
    flex: 1,
    padding: "32px 40px"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 24
  },
  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 700
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#95a7c4",
    lineHeight: 1.5
  },
  secondaryButton: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#eef4ff",
    padding: "10px 14px",
    cursor: "pointer"
  },
  inlineButton: {
    borderRadius: 10,
    border: "1px solid rgba(124, 58, 237, 0.28)",
    background: "rgba(124, 58, 237, 0.12)",
    color: "#e9ddff",
    padding: "8px 12px",
    cursor: "pointer"
  },
  error: {
    marginBottom: 18,
    padding: "12px 14px",
    borderRadius: 14,
    background: "rgba(255, 92, 92, 0.12)",
    border: "1px solid rgba(255, 92, 92, 0.3)",
    color: "#ffd7d7"
  },
  contentColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 16
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16
  },
  statCard: {
    borderRadius: 18,
    padding: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)"
  },
  statLabel: {
    color: "#95a7c4",
    fontSize: 13
  },
  statValue: {
    fontSize: 34,
    fontWeight: 700,
    marginTop: 10
  },
  card: {
    borderRadius: 20,
    padding: 22,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)"
  },
  unreadCard: {
    borderColor: "rgba(124, 58, 237, 0.32)",
    boxShadow: "0 0 0 1px rgba(124, 58, 237, 0.08) inset"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    marginBottom: 14
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600
  },
  cardMeta: {
    marginTop: 6,
    color: "#95a7c4",
    fontSize: 13
  },
  statusPill: {
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(56, 189, 248, 0.12)",
    color: "#9fe7ff",
    fontSize: 12,
    textTransform: "capitalize"
  },
  summaryText: {
    margin: 0,
    color: "#e3ebf8",
    lineHeight: 1.7,
    whiteSpace: "pre-wrap"
  },
  emptyState: {
    borderRadius: 18,
    padding: 28,
    textAlign: "center",
    color: "#95a7c4",
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)"
  }
};

export default EmployeeDashboard;
