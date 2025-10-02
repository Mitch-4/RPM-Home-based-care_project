// src/components/LogoutButton.js
import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth)
      .then(() => navigate("/"))
      .catch((error) => alert("Logout failed: " + error.message));
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        backgroundColor: "#e74c3c",
        color: "#fff",
        border: "none",
        padding: "8px 16px",
        borderRadius: "5px",
        cursor: "pointer",
        fontWeight: "bold"
      }}
    >
      Logout
    </button>
  );
}

export default LogoutButton;
