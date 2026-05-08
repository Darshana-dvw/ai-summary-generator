import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import AdminDashboard from "./AdminDashboard";
import EmployeeDashboard from "./EmployeeDashboard";

function ProtectedRoute({ children, requiredRole }) {
  const stored = localStorage.getItem("meetmind_user");
  const token = localStorage.getItem("meetmind_token");

  if (!stored || !token) return <Navigate to="/" />;

  const user = JSON.parse(stored);
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" />;

  return children;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin/dashboard" element={
          <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
        } />
        <Route path="/employee/dashboard" element={
          <ProtectedRoute requiredRole="employee"><EmployeeDashboard /></ProtectedRoute>
        } />
        {/* Redirect old route */}
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
