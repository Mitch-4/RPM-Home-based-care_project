// src/components/Register.js
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const defaultRole = params.get("role") || "";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: defaultRole,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [userCreated, setUserCreated] = useState(null); // store user to resend verification
  const [showPassword, setShowPassword] = useState(false); // toggle password visibility

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // 1️⃣ Create user account in Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;
      setUserCreated(user); // store user for resending verification

      // 2️⃣ Update user profile with display name
      await updateProfile(user, { displayName: formData.name });

      // 3️⃣ Send email verification
      await sendEmailVerification(user, {
        url: `${window.location.origin}/login?role=${formData.role}`,
        handleCodeInApp: false,
      });

      // 4️⃣ Show success message
      setMessage("Registration successful! Please check your email to verify your account.");

      // 5️⃣ Immediately sign out the user
      await auth.signOut();

      // 6️⃣ Redirect to verification page after short delay
      setTimeout(() => {
        navigate("/verify-email", {
          state: { email: formData.email, role: formData.role },
        });
      }, 3000);

    } catch (error) {
      console.error("Registration error:", error);

      // 7️⃣ User-friendly error messages
      let errorMessage = "Registration failed: ";
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage += "This email is already registered. Please login instead.";
          break;
        case "auth/weak-password":
          errorMessage += "Password should be at least 6 characters long.";
          break;
        case "auth/invalid-email":
          errorMessage += "Please enter a valid email address.";
          break;
        default:
          errorMessage += error.message;
      }
      setMessage(errorMessage);
      setLoading(false);
    }
  };

  // ✅ Resend verification email
  const handleResendVerification = async () => {
    if (!userCreated) return;
    try {
      await sendEmailVerification(userCreated, {
        url: `${window.location.origin}/login?role=${formData.role}`,
        handleCodeInApp: false,
      });
      alert("Verification email resent! Check your inbox (and spam folder).");
    } catch (error) {
      console.error("Error resending verification email:", error);
      alert("Failed to resend verification email. Try again later.");
    }
  };

  return (
    <div className="auth-container">
      <h2>
        Register as{" "}
        {formData.role
          ? formData.role.charAt(0).toUpperCase() + formData.role.slice(1)
          : "User"}
      </h2>

      {message && (
        <div
          style={{
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "5px",
            backgroundColor: message.includes("successful") ? "#d4edda" : "#f8d7da",
            color: message.includes("successful") ? "#155724" : "#721c24",
            border: `1px solid ${message.includes("successful") ? "#c3e6cb" : "#f5c6cb"}`,
          }}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleRegister}>
        {/* Name */}
        <input
          name="name"
          type="text"
          placeholder="Full Name"
          value={formData.name}
          onChange={handleChange}
          required
          disabled={loading}
        />

        {/* Email */}
        <input
          name="email"
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          disabled={loading}
        />

        {/* Password + Show/Hide Eye */}
        <div style={{ position: "relative", width: "100%", marginBottom: "15px" }}>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            disabled={loading}
            style={{ width: "100%", paddingRight: "40px" }}
          />
          <span
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              cursor: "pointer",
              transform: "translateY(-50%)",
              fontSize: "18px",
              userSelect: "none",
            }}
          >
            {showPassword ? "🙈" : "👁️"}
          </span>
        </div>

        {/* Role */}
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
          disabled={loading}
        >
          <option value="">Select Role</option>
          <option value="caregiver">Caregiver</option>
          <option value="doctor">Doctor</option>
        </select>

        {/* Submit */}
        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {/* Resend Verification */}
      {userCreated && (
        <button
          onClick={handleResendVerification}
          style={{
            marginTop: "15px",
            padding: "10px 15px",
            backgroundColor: "#3498db",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Resend Verification Email
        </button>
      )}

      <p>
        Already registered? <a href="/login">Login</a>
      </p>
    </div>
  );
}

export default Register;
