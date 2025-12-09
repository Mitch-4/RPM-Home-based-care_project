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
  const [showPassword, setShowPassword] = useState(false); // 👁️ Password visibility state

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
      // 1️⃣ Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2️⃣ Check email verification
      if (!user.emailVerified) {
        setMessage("Please verify your email before logging in. Check your inbox for the verification link.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      // 3️⃣ Fetch user data from Realtime Database
      const snapshot = await get(ref(db, `users/${user.uid}`));
      const userData = snapshot.val();

      if (!userData) {
        setMessage("User data not found. Please contact support.");
        await auth.signOut();
        setLoading(false);
        return;
      }

      // 4️⃣ Enforce RBAC: check role
      if (role !== userData.role) {
        setMessage(`Access denied. You registered as ${userData.role}, not ${role}.`);
        await auth.signOut();
        setLoading(false);
        return;
      }

      // 5️⃣ Redirect based on role
      if (role === "doctor") navigate("/doctor");
      else if (role === "caregiver") navigate("/caregiver");
      else navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      
      let errorMessage = "Login failed: ";
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage += "No account found with this email. Please register first.";
          break;
        case 'auth/wrong-password':
          errorMessage += "Incorrect password. Please try again.";
          break;
        case 'auth/invalid-email':
          errorMessage += "Please enter a valid email address.";
          break;
        case 'auth/too-many-requests':
          errorMessage += "Too many failed attempts. Please try again later.";
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
        {/* Left Side - Form */}
        <div className="auth-form-section">
          <h2>Welcome Back</h2>

          {message && (
            <div
              className={`auth-message ${
                message.includes("verify") || message.includes("resent") ? "warning" : "error"
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
              autoFocus={false}
              required
              disabled={loading}
            />
            
            {/* Password Input with Eye Icon */}
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
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={loading}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>

            <select
              name="role"
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              autoComplete="off"
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

        {/* Right Side - Decorative/Image */}
        <div className="auth-image-section">
          <div className="auth-decorative-content">
            <div className="auth-decorative-icon">🏥</div>
            <h3>AI-Powered Healthcare</h3>
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