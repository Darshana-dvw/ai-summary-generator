import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("http://localhost:5000/auth/login", { email, password });
      if (res.data === "Login success" || res.data?.token) {
        localStorage.setItem("adminLoggedIn", "true");
        localStorage.setItem("adminEmail", email);
        navigate("/dashboard");
      } else {
        setError(res.data || "Invalid credentials");
      }
    } catch (err) {
      setError("Connection error. Please try again.");
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

        <h1 style={styles.heading}>Admin Portal</h1>
        <p style={styles.sub}>Sign in to manage your team and meeting reports</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@company.com"
              required
              style={styles.input}
              onFocus={(e) => e.target.style.borderColor = "#00E5FF"}
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
              onFocus={(e) => e.target.style.borderColor = "#00E5FF"}
              onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.btn}
            onMouseEnter={(e) => { if (!loading) { e.target.style.background = "#00b8cc"; e.target.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={(e) => { e.target.style.background = "#00E5FF"; e.target.style.transform = "translateY(0)"; }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <div style={styles.hint}>
          Default: admin@example.com / password123
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
    maxWidth: "420px",
    backdropFilter: "blur(20px)",
    position: "relative",
    zIndex: 1,
  },
  logoWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "32px",
  },
  logoIcon: {
    display: "flex",
    alignItems: "center",
  },
  logoText: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "-0.5px",
    fontFamily: "'DM Sans', sans-serif",
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
    background: "#00E5FF",
    color: "#080C14",
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
