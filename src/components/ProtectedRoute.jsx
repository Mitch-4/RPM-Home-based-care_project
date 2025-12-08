// src/components/ProtectedRoute.js
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "18px",
          color: "#666",
        }}
      >
        Loading...
      </div>
    );
  }

  // Not authenticated at all
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but email not verified
  if (!user.emailVerified) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          padding: "20px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚠️</div>
        <h2>Email Not Verified</h2>
        <p style={{ maxWidth: "500px", marginTop: "15px", color: "#666" }}>
          Please verify your email address before accessing this page. Check your
          inbox for the verification link.
        </p>
        <button
          onClick={() => {
            auth.signOut();
            window.location.href = "/login";
          }}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Authenticated and verified
  return children;
}

export default ProtectedRoute;