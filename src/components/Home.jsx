// src/components/Home.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <h1>
        {' '}
        AI-Powered Remote Health Monitoring & Emergency Response Home-Based Care
      </h1>
      <p class="text-red-600">
        Empowering caregivers and doctors to monitor patients from home with
        real-time vitals, alerts, and medical feedback.
      </p>

      <div className="home-buttons">
        <Link to="/login?role=caregiver" className="home-btn caregiver">
          {' '}
          Caregiver
        </Link>
        <Link to="/login?role=doctor" className="home-btn doctor">
          {' '}
          Doctor
        </Link>
      </div>

      <div className="auth-links">
        <p>
          Don’t have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Home;
