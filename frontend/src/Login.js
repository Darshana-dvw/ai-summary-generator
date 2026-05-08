import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("admin");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = role === "admin" ? "/auth/admin/login" : "/auth/employee/login";
      const res = await api.post(endpoint, { email, password });

      if (res.data?.token) {
        localStorage.setItem("meetmind_token", res.data.token);
        localStorage.setItem("meetmind_user", JSON.stringify(res.data.user));
        navigate(role === "admin" ? "/admin/dashboard" : "/employee/dashboard");
      } else {
        setError(res.data?.error || "Invalid credentials");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Connection error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.grid}></div>
      <div style={styles.orb1}></div>
      <div style={styles.orb2}></div>

      <div style={styles.card}>
        <div style={styles.logoWrap}>
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#00E5FF" strokeWidth="2"/>
              <path d="M8 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#00E5FF" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="17" r="3" fill="#00E5FF"/>
            </svg>
          </div>
          <span style={styles.logoText}>MeetMind</span>
        </div>

        {/* Role Toggle */}
        <div style={styles.toggleWrap}>
          <button
            onClick={() => { setRole("admin"); setError(""); }}
            style={{
              ...styles.toggleBtn,
              ...(role === "admin" ? styles.toggleActive : {}),
            }}
          >
            👑 Admin
          </button>
          <button
            onClick={() => { setRole("employee"); setError(""); }}
            style={{
              ...styles.toggleBtn,
              ...(role === "employee" ? styles.toggleActiveEmployee : {}),
            }}
          >
            👤 Employee
          </button>
        </div>

        <h1 style={styles.heading}>
          {role === "admin" ? "Admin Portal" : "Employee Portal"}
        </h1>
        <p style={styles.sub}>
          {role === "admin"
            ? "Sign in to manage your team and meeting summaries"
            : "Sign in to view your meeting summaries and notifications"}
        </p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={role === "admin" ? "admin@company.com" : "you@company.com"}
              required
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = role === "admin" ? "#00E5FF" : "#7C3AED"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = role === "admin" ? "#00E5FF" : "#7C3AED"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.btn,
              background: role === "admin" ? "#00E5FF" : "#7C3AED",
              color: role === "admin" ? "#080C14" : "#fff",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.opacity = "0.85";
                e.target.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = "1";
              e.target.style.transform = "translateY(0)";
            }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <div style={styles.hint}>
          {role === "admin"
            ? "Default: admin@example.com / password123"
            : "Use credentials provided by your admin"}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#080C14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: "linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
  },
  orb1: {
    position: "absolute",
    top: "-200px",
    right: "-100px",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,229,255,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  orb2: {
    position: "absolute",
    bottom: "-200px",
    left: "-100px",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "48px",
    width: "100%",
    maxWidth: "440px",
    backdropFilter: "blur(20px)",
    position: "relative",
    zIndex: 1,
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "24px",
  },
  logoIcon: { display: "flex", alignItems: "center" },
  logoText: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "-0.5px",
    fontFamily: "'DM Sans', sans-serif",
  },
  toggleWrap: {
    display: "flex",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    padding: "4px",
    marginBottom: "24px",
    gap: "4px",
  },
  toggleBtn: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  },
  toggleActive: {
    background: "rgba(0,229,255,0.15)",
    color: "#00E5FF",
  },
  toggleActiveEmployee: {
    background: "rgba(124,58,237,0.15)",
    color: "#7C3AED",
  },
  heading: {
    color: "#fff",
    fontSize: "28px",
    fontWeight: "700",
    margin: "0 0 8px",
    letterSpacing: "-0.5px",
  },
  sub: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    margin: "0 0 32px",
    lineHeight: "1.6",
  },
  form: { display: "flex", flexDirection: "column", gap: "20px" },
  field: { display: "flex", flexDirection: "column", gap: "8px" },
  label: { color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: "500", letterSpacing: "0.3px" },
  input: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "10px",
    padding: "12px 16px",
    color: "#fff",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  },
  error: {
    background: "rgba(255,80,80,0.1)",
    border: "1px solid rgba(255,80,80,0.3)",
    color: "#ff6b6b",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
  },
  btn: {
    border: "none",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.2px",
    marginTop: "4px",
  },
  hint: {
    color: "rgba(255,255,255,0.2)",
    fontSize: "12px",
    textAlign: "center",
    marginTop: "20px",
    fontFamily: "monospace",
  },
};

export default Login;
