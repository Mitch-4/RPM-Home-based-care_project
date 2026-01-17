// src/components/Login.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, db } from "../firebase";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleResendVerification = async () => {
    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await auth.signOut();
      setMessage("Verification email resent! Please check your inbox.");
      setLoading(false);
    } catch (error) {
      setMessage("Failed to resend verification email: " + error.message);
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // 1️⃣ Sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2️⃣ Email verification
      if (!user.emailVerified) {
        setMessage("Please verify your email before logging in.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      // 3️⃣ Fetch DB profile
      const snapshot = await get(ref(db, `users/${user.uid}`));
      const userData = snapshot.val();

      if (!userData) {
        setMessage("User data not found. Please contact support.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      // ✅ FIX #1 — Sync role from DB (single source of truth)
      setRole(userData.role);

      // ✅ FIX #2 — Remove role mismatch rejection
      // We TRUST Firebase DB, not user selection

      // 4️⃣ Redirect using DB role
      if (userData.role === "doctor") {
        navigate("/doctor");
      } else if (userData.role === "caregiver") {
        navigate("/caregiver");
      } else {
        navigate("/");
      }

    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "Login failed: ";
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage += "No account found with this email.";
          break;
        case "auth/wrong-password":
          errorMessage += "Incorrect password.";
          break;
        case "auth/invalid-email":
          errorMessage += "Invalid email address.";
          break;
        case "auth/too-many-requests":
          errorMessage += "Too many attempts. Try again later.";
          break;
        default:
          errorMessage += error.message;
      }
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        <div className="auth-form-section">
          <h2>Welcome Back</h2>

          {message && (
            <div
              className={`auth-message ${
                message.includes("verify") || message.includes("resent")
                  ? "warning"
                  : "error"
              }`}
            >
              {message}
              {message.includes("verify") && (
                <button onClick={handleResendVerification} disabled={loading}>
                  {loading ? "Sending..." : "Resend Verification Email"}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleLogin} autoComplete="on">
            <input
              type="email"
              name="email"
              id="login-email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              disabled={loading}
            />

            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                id="login-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            {/* Role dropdown KEPT — now informational */}
            <select
              name="role"
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              disabled={loading}
            >
              <option value="">Select Your Role</option>
              <option value="caregiver">Caregiver</option>
              <option value="doctor">Doctor</option>
            </select>

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p>
            Don't have an account? <a href="/register">Register Now</a>
          </p>
        </div>

        <div className="auth-image-section">
          <div className="auth-decorative-content">
            <div className="auth-decorative-icon"></div>
            <h3>AI-Based Healthcare</h3>
            <p>
              Monitor patient vitals in real-time. Get instant alerts.
              Provide better care with our advanced monitoring system.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
