// src/components/Register.js
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "../firebase";
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
  const [showPassword, setShowPassword] = useState(false); // 👁️ Password visibility state

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    if (!formData.role) {
      setMessage("Please select a role before registering.");
      setLoading(false);
      return;
    }


    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      const user = userCredential.user;

      // Update user profile with name
      await updateProfile(user, {
        displayName: formData.name
      });

       // 3️⃣ Save user profile to Realtime Database (CRITICAL)
      await set(ref(db, `users/${user.uid}`), {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        role: formData.role, // doctor | caregiver
        createdAt: new Date().toISOString()
      });

      // Send verification email
      await sendEmailVerification(user, {
        url: window.location.origin + '/login?role=' + formData.role,
        handleCodeInApp: false
      });

      setMessage("Registration successful! Please check your email to verify your account.");
      
      // Sign out the user immediately after registration
      await auth.signOut();
      
      // Redirect to verification page after 3 seconds
      setTimeout(() => {
        navigate("/verify-email", { 
          state: { 
            email: formData.email, 
            role: formData.role 
          } 
        });
      }, 3000);

    } catch (error) {
      console.error("Registration error:", error);

      
      // Provide user-friendly error messages
      let errorMessage = "Registration failed: ";
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage += "This email is already registered. Please login instead.";
          break;
        case 'auth/weak-password':
          errorMessage += "Password should be at least 6 characters long.";
          break;
        case 'auth/invalid-email':
          errorMessage += "Please enter a valid email address.";
          break;
        default:
          errorMessage += error.message;
      }
      
      setMessage(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container">
        {/* Left Side - Form */}
        <div className="auth-form-section">
          <h2>Create Account</h2>
      
          {message && (
            <div
              className={`auth-message ${
                message.includes("successful") ? "success" : "error"
              }`}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleRegister}>
            <input
              name="name"
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
            <input
              name="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
            
            {/* Password Input with Eye Icon */}
            <div className="password-input-wrapper">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 6 characters)"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
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
              value={formData.role}
              onChange={handleChange}
              required
              disabled={loading}
            >
              <option value="">Select Your Role</option>
              <option value="caregiver">Caregiver</option>
              <option value="doctor">Doctor</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? "Creating Account..." : "Register"}
            </button>
          </form>
          <p>
            Already have an account? <a href="/login">Login</a>
          </p>
        </div>

        {/* Right Side - Decorative/Image */}
        <div className="auth-image-section">
          <div className="auth-decorative-content">
            <div className="auth-decorative-icon"></div>
            <h3>Join Our Platform</h3>
            <p>
              Start monitoring your patients remotely. Real-time alerts, 
              comprehensive analytics, and seamless collaboration between 
              doctors and caregivers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;