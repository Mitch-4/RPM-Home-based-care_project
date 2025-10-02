// src/components/Register.js
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
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

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = (e) => {
    e.preventDefault();

    createUserWithEmailAndPassword(auth, formData.email, formData.password)
      .then(() => {
        if (formData.role === "doctor") navigate("/doctor");
        else if (formData.role === "caregiver") navigate("/caregiver");
        else navigate("/");
      })
      .catch((error) => {
        alert("Registration failed: " + error.message);
      });
  };

  return (
    <div className="auth-container">
      <h2>Register as {formData.role ? formData.role.charAt(0).toUpperCase() + formData.role.slice(1) : "User"}</h2>
      <form onSubmit={handleRegister}>
        <input name="name" type="text" placeholder="Full Name"
          value={formData.name} onChange={handleChange} required />
        <input name="email" type="email" placeholder="Email"
          value={formData.email} onChange={handleChange} required />
        <input name="password" type="password" placeholder="Password"
          value={formData.password} onChange={handleChange} required />
        <select name="role" value={formData.role} onChange={handleChange} required>
          <option value="">Select Role</option>
          <option value="caregiver">Caregiver</option>
          <option value="doctor">Doctor</option>
        </select>
        <button type="submit">Register</button>
      </form>
      <p>Already registered? <a href="/login">Login</a></p>
    </div>
  );
}

export default Register;
