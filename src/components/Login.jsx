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
    <div className="auth-container">
      <h2>Login</h2>

      {message && (
        <div
          style={{
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "5px",
            backgroundColor: message.includes("verify") || message.includes("resent") 
              ? "#fff3cd" 
              : "#f8d7da",
            color: message.includes("verify") || message.includes("resent")
              ? "#856404"
              : "#721c24",
            border: `1px solid ${
              message.includes("verify") || message.includes("resent")
                ? "#ffeaa7"
                : "#f5c6cb"
            }`,
          }}
        >
          {message}
          {message.includes("verify") && (
            <button
              onClick={handleResendVerification}
              disabled={loading}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
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
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus={false}
          required
          disabled={loading}
        />
        <input
          type="password"
          name="password"
          id="login-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          disabled={loading}
        />
        <select
          name="role"
          id="login-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          autoComplete="off"
          required
          disabled={loading}
        >
          <option value="">Select Role</option>
          <option value="caregiver">Caregiver</option>
          <option value="doctor">Doctor</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p>
        Don't have an account? <a href="/register">Register</a>
      </p>
    </div>
  );
}

export default Login;