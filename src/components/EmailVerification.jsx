// src/components/EmailVerification.jsx
import React from "react";
import { useSearchParams } from "react-router-dom";

function EmailVerification() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      {token ? (
        <h2>Verifying your account...</h2>
      ) : (
        <h2>Please check your email to verify your account!</h2>
      )}
    </div>
  );
}

export default EmailVerification;
