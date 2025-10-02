// src/components/Login.js
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const defaultRole = params.get("role") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(defaultRole);

  const handleLogin = (e) => {
    e.preventDefault();

    signInWithEmailAndPassword(auth, email, password)
      .then(() => {
        if (role === "doctor") navigate("/doctor");
        else if (role === "caregiver") navigate("/caregiver");
        else navigate("/");
      })
      .catch((error) => {
        alert("Login failed: " + error.message);
      });
  };

  return (
    <div className="auth-container">
      <h2>Login as {role ? role.charAt(0).toUpperCase() + role.slice(1) : "User"}</h2>
      <form onSubmit={handleLogin}>
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} required />
        <select value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="">Select Role</option>
          <option value="caregiver">Caregiver</option>
          <option value="doctor">Doctor</option>
        </select>
        <button type="submit">Login</button>
      </form>
      <p>Don’t have an account? <a href="/register">Register</a></p>
    </div>
  );
}

export default Login;
