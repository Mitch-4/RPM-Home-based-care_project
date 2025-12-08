// src/App.js
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./components/Home";
import CaregiverDashboard from "./components/CaregiverDashboard";
import DoctorDashboard from "./components/DoctorDashboard";
import Login from "./components/Login";
import Register from "./components/Register";
import EmailVerification from "./components/EmailVerification";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

function App() {
  return (
    <Router>
      <div style={{ fontFamily: "Segoe UI, sans-serif" }}>
        {/* Navigation */}
        <nav
          style={{
            padding: "1rem",
            backgroundColor: "#f4f4f4",
            borderBottom: "1px solid #ccc",
          }}
        >
          <Link
            to="/"
            style={{
              marginRight: "1.5rem",
              fontWeight: "bold",
              color: "#2c3e50",
            }}
          >
            Home
          </Link>
          <Link
            to="/login"
            style={{ marginRight: "1rem", color: "#7f8c8d" }}
          >
            Login
          </Link>
          <Link to="/register" style={{ color: "#8e44ad" }}>
            Register
          </Link>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/caregiver"
            element={
              <ProtectedRoute>
                <CaregiverDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<EmailVerification />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;