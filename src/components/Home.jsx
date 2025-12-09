// src/components/Home.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import RPM1 from "../assets/RPM1.png";

function Home() {
  return (
    <div className="home-container">
      {/* Left Content Section */}
      <div className="home-content">
        <div className="home-text">
          <h1>
            We're <span className="highlight">determined</span> for your{' '}
            <span className="highlight">better life.</span>
          </h1>
          <p className="home-description">
            AI-Powered Remote Health Monitoring & Emergency Response Home-Based Care.
            You can get the care you need 24/7 – be it online or in person. 
            You will be treated by caring specialist doctors.
          </p>

          <div className="home-buttons">
            <Link to="/login?role=caregiver" className="home-btn caregiver">
              Caregiver Portal
            </Link>
            <Link to="/login?role=doctor" className="home-btn doctor">
              Doctor Portal
            </Link>
          </div>

          <div className="auth-links">
            <p>
              Don't have an account? <Link to="/register">Register Now</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Image Section */}
      <div className="home-image-section">
        <div className="image-circle">
          <img 
            src={RPM1} 
            alt="Remote Health Monitoring - Caring for Your Family" 
            className="home-hero-image"
          />
        </div>
        
        {/* Decorative Elements */}
        <div className="decorative-dots dots-top-left"></div>
        <div className="decorative-dots dots-bottom-right"></div>
      </div>

      {/* Decorative Wave */}
      <div className="wave-decoration"></div>
    </div>
  );
}

export default Home;