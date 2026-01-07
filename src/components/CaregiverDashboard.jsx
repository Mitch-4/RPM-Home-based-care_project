// src/components/CaregiverDashboard.js - COMPLETE WITH ENHANCED CLINICAL ANALYSIS
import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ReferenceLine, ReferenceArea
} from "recharts";
import {
  FaHeartbeat, FaLungs, FaWalking, FaBell, FaEnvelope,
  FaCog, FaUser, FaSignOutAlt, FaChartLine, FaExclamationTriangle,
  FaPaperPlane, FaCircle, FaTimes, FaCheckCircle
} from "react-icons/fa";
import { ThemeContext } from "../context/ThemeContext";
import RagAssistant from "./RagAssistant";
import { ClinicalAnalysis } from "../utils/clinicalAnalysis";





const socket = io("http://localhost:5000", { transports: ["websocket"] });

const formatTime = (timeStr) => {
  const date = new Date(timeStr);
  if (isNaN(date)) return timeStr;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (timeStr) => {
  const date = new Date(timeStr);
  if (isNaN(date)) return timeStr;
  return date.toLocaleString([], { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const getTimeAgo = (timeStr) => {
  const now = new Date();
  const time = new Date(timeStr);
  const diffMs = now - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
};

export default function CaregiverDashboard() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const messagesEndRef = useRef(null); // added
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [profile, setProfile] = useState({});
  const [vitals, setVitals] = useState([]); // Single vitals array
  const [latest, setLatest] = useState({});
  const [tab, setTab] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);

  

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const [loading, setLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [clinicalData, setClinicalData] = useState(null);

  // Listen to all messages globally for caregiver
  useEffect(() => {
    const globalMessageHandler = (msg) => {
      console.log("Received message:", msg); // <-- check this
      setMessages(prev => {
        // Check if the message already exists
        const exists = prev.some(
          m =>
            m.createdAt === msg.createdAt &&
            m.text === msg.text &&
            m.senderId === msg.senderId
        );

        if (exists) return prev; // Duplicate found, do not add

        return [...prev, msg]; // Otherwise, add the new message
      });

      // Increment unread if the message is from someone else
      const sender = msg.senderId || msg.sender;
      if (msg.senderId !== 'caregiver') {
        console.log("Incrementing unread messages"); // <-- check if this runs
        setUnreadMessages(prev => prev + 1);
      }
    };

    socket.on("message", globalMessageHandler);

    return () => {
      socket.off("message", globalMessageHandler);
    };
  }, []);

  useEffect(() => {
  if (tab === "messages" && selectedPatient) {
    axios.patch(`/api/v1/messages/${selectedPatient}/read`)
      .then(() => {
        setUnreadMessages(0); // Reset counter
      })
      .catch(err => console.error("Failed to mark messages as read", err));
  }
}, [tab, selectedPatient]);

      
  const chartProps = {
    strokeWidth: 2.5,
    dot: false,
    isAnimationActive: true,
    type: "monotone",
  };

  const cardStyle = `p-6 rounded-xl shadow-sm ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`;

  useEffect(() => {
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
    };
  }, []);

  // Fetch patients
  useEffect(() => {
    axios.get("/api/v1/patients")
      .then(res => {
        const pts = res.data.patients || res.data || [];
        if (Array.isArray(pts)) {
          setPatients(pts);
        } else {
          setPatients(Object.entries(pts).map(([id, data]) => ({ id, ...data })));
        }
      })
      .catch(err => console.error("Failed to fetch patients:", err));
  }, []);

  // Fetch patient data
  useEffect(() => {
    if (!selectedPatient) return;

    setLoading(true);
    setVitals([]);
    setLatest({});
    setAlerts([]);
    setMessages([]);
    setClinicalData(null);

    // Profile
    axios.get(`/api/v1/patients/${selectedPatient}/profile`)
      .then(res => setProfile(res.data || {}))
      .catch(err => console.error("Failed to fetch profile:", err));

    // Vitals - FIXED DATA MAPPING to match doctor
    const limitMap = { "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
    axios.get(`/api/v1/vitals/${selectedPatient}?limit=${limitMap[selectedTimeRange] || 1440}`)
      .then(res => {
        let data = Array.isArray(res.data) ? res.data : (res.data.data || res.data.vitals || []);
        console.log("Caregiver fetched", data.length, "vitals");
        
        const mapped = data.map(v => ({
          time: new Date(v.timeRecorded || v.time).toISOString(),
          heartRate: v.heartRate ?? 0,  // ✅ FIXED: Using heartRate (consistent with doctor)
          respirationRate: v.respirationRate ?? 0,  // ✅ FIXED: Using respirationRate (consistent with doctor)
          movement: v.movement ?? 0,
          presence: v.presence ?? 0,
          movementRange: v.movementRange ?? 0
        }));
        
        mapped.sort((a, b) => new Date(a.time) - new Date(b.time));
        
        // Remove duplicates
        const deduped = mapped.filter(
          (item, index, self) => index === self.findIndex((t) => t.time === item.time)
        );
        
        console.log("After dedup:", deduped.length, "vitals");
        setVitals(deduped);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch vitals:", err);
        setLoading(false);
      });

    // Latest
    axios.get(`/api/v1/patients/${selectedPatient}/latest`)
      .then(res => {
        const l = res.data.latest || res.data || {};
        const latestVitals = {
          time: l.timeRecorded || l.time,
          heartRate: l.heartRate ?? 0,
          respirationRate: l.respirationRate ?? 0,
          movement: l.movement ?? 0,
          presence: l.presence ?? 0,
          movementRange: l.movementRange ?? 0
        };
        setLatest(latestVitals);

        // Add to vitals if not already there
        setVitals(prev => {
          const exists = prev.some(v => v.time === latestVitals.time);
          if (!exists) return [...prev, latestVitals];
          return prev;
        });
      })
      .catch(err => console.error("Failed to fetch latest:", err));

    // Alerts
    axios.get(`/api/v1/alerts/${selectedPatient}?limit=50`)
      .then(res => {
        let alertsData = res.data.alerts || res.data || [];
        if (!Array.isArray(alertsData)) {
          alertsData = [];
        }
        setAlerts(alertsData);
        setUnreadAlerts(alertsData.filter(a => !a.read).length);
      })
      .catch(err => console.error("Failed to fetch alerts:", err));

    // Messages
    axios.get(`/api/v1/messages/${selectedPatient}?limit=100`)
      .then(res => {
        const msgs = res.data.messages || res.data || [];
        setMessages(msgs);
        setUnreadMessages(msgs.filter(m => !m.read && m.senderId !== 'caregiver').length);
      })
      .catch(err => console.error("Failed to fetch messages:", err));

    // Socket
    socket.emit("join-patient-room", selectedPatient);

    const vitalsHandler = (data) => {
      if (!data.timeRecorded) {
        return;
      }
      if (data.heartRate === undefined && data.respirationRate === undefined) {
        return;
      }
      const newVital = {
        time: new Date(data.timeRecorded).toISOString(),
        heartRate: data.heartRate ?? 0,
        respirationRate: data.respirationRate ?? 0,
        movement: data.movement ?? 0,
        presence: data.presence ?? 0,
        movementRange: data.movementRange ?? 0
      };
      
      setVitals(prev => {
        const exists = prev.some(v => v.time === newVital.time);
        if (exists) return prev;

        const updated = [...prev, newVital].sort((a, b) => 
          new Date(a.time) - new Date(b.time)
        );
        
        return updated.slice(-200);
      });

      setLatest(newVital);
    };

    const alertHandler = (alert) => {
      setAlerts(prev => [alert, ...prev]);
      setUnreadAlerts(prev => prev + 1);
    };

    

    socket.on("new-vital", vitalsHandler);
    socket.on("alert", alertHandler);
    

    return () => {
      socket.emit("leave-patient-room", selectedPatient);
      socket.off("new-vital", vitalsHandler);
      socket.off("alert", alertHandler);
      
    };
  }, [selectedPatient, selectedTimeRange]);

  // Calculate clinical analysis - USE FRIENDLY LABELS FOR CAREGIVERS
  useEffect(() => {
    if (vitals.length > 0) {
      console.log("Analyzing", vitals.length, "vitals for caregiver clinical data");
      // ✅ Use friendly labels for caregivers (true = user-friendly)
      const analysis = ClinicalAnalysis.analyzeVitals(vitals, true);
      setClinicalData(analysis);
    }
  }, [vitals]);

  // Handlers
  const handleLogout = () => {
    signOut(auth)
      .then(() => navigate("/"))
      .catch((error) => alert("Logout failed: " + error.message));
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedPatient) return;
    const msg = {
      patientId: selectedPatient,
      senderId: "caregiver",
      receiver: "doctor",
      text: newMessage,
      createdAt: new Date().toISOString()
    };
    socket.emit("message", msg);
    axios.post(`/api/v1/messages`, msg).catch(err => console.error(err));
    
    setNewMessage("");
  };

  const markAlertsRead = () => {
    if (!selectedPatient) return;
    axios.post(`/api/v1/alerts/${selectedPatient}/mark-read`, {
      alertIds: alerts.map(a => a.id || a.key) // send actual alert IDs
    })
    .then(() => {
      setAlerts(prev => prev.map(a => ({ ...a, read: true })));
      setUnreadAlerts(0);
    })
    .catch(err => console.error(err));
  };


  const acknowledgeAlert = (alertId) => {
    axios.post(`/api/v1/alerts/${alertId}/acknowledge`, { patientId: selectedPatient })
      .then(() => {
        setAlerts(prev => prev.map(a => 
          a.id === alertId ? { ...a, acknowledged: true } : a
        ));
        setShowAlertModal(false);
      })
      .catch(err => console.error(err));
  };

  // Custom Y-axis tick renderer for clinical zones
  const renderClinicalYAxis = (vitalType) => (props) => {
    const { x, y, payload } = props;
    const ranges = ClinicalAnalysis.CLINICAL_RANGES[vitalType];
    
    let color = theme === "dark" ? '#9ca3af' : '#6b7280';
    
    for (const range of Object.values(ranges)) {
      if (payload.value >= range.min && payload.value <= range.max) {
        color = range.color;
        break;
      }
    }
    
    return (
      <text x={x} y={y} fill={color} fontSize={11} textAnchor="end" dy={4}>
        {payload.value}
      </text>
    );
  };

  return (
    <div className={`min-h-screen flex ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Sidebar */}
      <aside className={`w-64 ${theme === "dark" ? "bg-green-800" : "bg-green-700"} text-white flex flex-col`}>
        <div className="p-6 border-b border-green-600">
          <h1 className="text-2xl font-bold mb-1">Caregiver Portal</h1>
          <p className="text-sm text-green-200">Patient Care System</p>
          
          {socketConnected && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <FaCircle className="text-green-300 animate-pulse" />
              <span>Connected</span>
            </div>
          )}
        </div>

        {/* Patient Quick List */}
        {patients.length > 0 && (
          <div className="p-4 border-b border-green-600">
            <p className="text-xs text-green-200 mb-2 font-semibold">MY PATIENTS</p>
            <div className="space-y-1">
              {patients.slice(0, 3).map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatient(p.id)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-all ${
                    selectedPatient === p.id 
                      ? 'bg-green-600 font-semibold' 
                      : 'hover:bg-green-600 opacity-80'
                  }`}
                >
                  {p.profile?.name || p.name || 'Unnamed'}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setTab("dashboard")} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              tab === "dashboard" ? "bg-green-600 shadow-lg" : "hover:bg-green-600"
            }`}
          >
            <FaChartLine className="text-lg" />
            <span className="font-medium">Dashboard</span>
          </button>
          
          <button 
            onClick={() => { setTab("alerts"); markAlertsRead(); }} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${
              tab === "alerts" ? "bg-green-600 shadow-lg" : "hover:bg-green-600"
            }`}
          >
            <FaBell className="text-lg" />
            <span className="font-medium">Alerts</span>
            {unreadAlerts > 0 && (
              <span className="absolute right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadAlerts}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setTab("messages")} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${
              tab === "messages" ? "bg-green-600 shadow-lg" : "hover:bg-green-600"
            }`}
          >
            <FaEnvelope className="text-lg" />
            <span className="font-medium">Messages</span>
            {unreadMessages > 0 && (
              <span className="absolute right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadMessages}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => setTab("settings")} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
              tab === "settings" ? "bg-green-600 shadow-lg" : "hover:bg-green-600"
            }`}
          >
            <FaCog className="text-lg" />
            <span className="font-medium">Settings</span>
          </button>
        </nav>

        <div className="p-4 space-y-2 border-t border-green-600">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-green-600 transition-all"
          >
            <span>{theme === "light" ? "🌙" : "☀️"}</span>
            <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-600 transition-all"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
          {tab === "dashboard" && (
            <div className="space-y-6">
              <header className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Patient Care Dashboard</h2>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    Real-time patient monitoring system
                  </p>
                </div>
                {latest?.time && (
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Last update</p>
                    <p className="font-semibold">{getTimeAgo(latest.time)}</p>
                  </div>
                )}
              </header>

              {/* Controls */}
              <div className={cardStyle}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1">
                    <label className="font-semibold text-sm whitespace-nowrap">Patient:</label>
                    <select 
                      value={selectedPatient} 
                      onChange={(e) => setSelectedPatient(e.target.value)} 
                      className={`flex-1 px-4 py-2 rounded-lg border ${
                        theme === "dark" 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300 text-gray-900"
                      } focus:ring-2 focus:ring-green-500 focus:border-transparent`}
                    >
                      <option value="">Select a patient</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.profile?.name || p.name || "Unnamed"} (Age: {p.profile?.age || p.age || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPatient && (
                    <select
                      value={selectedTimeRange}
                      onChange={(e) => setSelectedTimeRange(e.target.value)}
                      className={`px-4 py-2 rounded-lg border ${
                        theme === "dark" 
                          ? "bg-gray-700 border-gray-600 text-white" 
                          : "bg-white border-gray-300"
                      } focus:ring-2 focus:ring-green-500`}
                    >
                      <option value="1h">Last Hour</option>
                      <option value="6h">Last 6 Hours</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Patient Info */}
              {selectedPatient && profile?.name && (
                <div className={cardStyle}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                        <FaUser className="text-2xl text-green-600 dark:text-green-300" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{profile.name}</h3>
                        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          Age: {profile.age} | Gender: {profile.gender}
                        </p>
                        <p className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          <span className="font-semibold">Condition:</span> {profile.condition || "Not specified"}
                        </p>
                      </div>
                    </div>
                    {socketConnected && (
                      <div className="flex items-center gap-2 text-green-500">
                        <FaCircle className="text-xs animate-pulse" />
                        <span className="text-sm font-semibold">LIVE</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Patient Status Summary - User Friendly */}
              {selectedPatient && clinicalData && (
                <div className={`${cardStyle} border-l-4`} style={{ borderColor: clinicalData.summary.statusColor }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">Patient Status</h3>
                        <span 
                          className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: clinicalData.summary.statusColor }}
                        >
                          {clinicalData.summary.overallStatus}
                        </span>
                      </div>
                      <p className="text-sm mb-3">{clinicalData.summary.statusMessage}</p>
                      
                      {clinicalData.summary.alerts.length > 0 && (
                        <div className="space-y-2">
                          {clinicalData.summary.alerts.map((alert, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <FaExclamationTriangle className="text-orange-500 mt-0.5" />
                              <span>{alert.message}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {clinicalData.newsScore && (
                      <div className="text-right">
                        <p className="text-xs opacity-75">{clinicalData.newsScore.friendlyLevel}</p>
                        <p 
                          className="text-3xl font-bold"
                          style={{ color: clinicalData.newsScore.color }}
                        >
                          {clinicalData.newsScore.score}
                        </p>
                        <p className="text-xs mt-1 max-w-xs">{clinicalData.newsScore.friendlyAction}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vital Signs Cards with User-Friendly Info */}
              {selectedPatient && clinicalData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Heart Rate Card */}
                  <div className={cardStyle}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-red-100 dark:bg-red-900 p-3 rounded-full">
                          <FaHeartbeat className="text-red-500 text-2xl" />
                        </div>
                        <div>
                          <p className="text-sm opacity-75">Heart Rate</p>
                          <p className="text-3xl font-bold">{latest?.heartRate ?? "--"}</p>
                          <p className="text-xs opacity-75">beats per minute</p>
                        </div>
                      </div>
                    </div>
                    <div 
                      className="px-2 py-1 rounded text-xs font-semibold text-white mb-2"
                      style={{ backgroundColor: clinicalData.heartRate.zone.color }}
                    >
                      {clinicalData.heartRate.zone.friendlyLabel}
                    </div>
                    <p className="text-xs opacity-75">{clinicalData.heartRate.trend.friendlyMessage}</p>
                  </div>

                  {/* Respiration Card */}
                  <div className={cardStyle}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                          <FaLungs className="text-blue-500 text-2xl" />
                        </div>
                        <div>
                          <p className="text-sm opacity-75">Breathing Rate</p>
                          <p className="text-3xl font-bold">{latest?.respirationRate ?? "--"}</p>
                          <p className="text-xs opacity-75">breaths per minute</p>
                        </div>
                      </div>
                    </div>
                    <div 
                      className="px-2 py-1 rounded text-xs font-semibold text-white mb-2"
                      style={{ backgroundColor: clinicalData.respirationRate.zone.color }}
                    >
                      {clinicalData.respirationRate.zone.friendlyLabel}
                    </div>
                    <p className="text-xs opacity-75">{clinicalData.respirationRate.trend.friendlyMessage}</p>
                  </div>

                  {/* Movement Card */}
                  <div className={cardStyle}>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                        <FaWalking className="text-green-500 text-2xl" />
                      </div>
                      <div>
                        <p className="text-sm opacity-75">Movement</p>
                        <p className="text-3xl font-bold">{latest?.movement ?? "--"}</p>
                        <p className="text-xs opacity-75">{clinicalData.movement.zone.friendlyLabel}</p>
                      </div>
                    </div>
                    <div 
                      className="px-2 py-1 rounded text-xs font-semibold text-white mb-2"
                      style={{ backgroundColor: clinicalData.movement.zone.color }}
                    >
                      {clinicalData.movement.zone.label}
                    </div>
                    <p className="text-xs opacity-75">{clinicalData.movement.zone.description}</p>
                  </div>
                </div>
              )}

              {/* Caregiver Support Assistant */}
              {selectedPatient && (
                <div className={cardStyle}>
                  <h2 className="text-xl font-semibold mb-2">Caregiver Support Assistant</h2>
                  <p className="text-sm opacity-75 mb-4">
                    Get simple explanations of the patient's vital signs and guidance on when to seek help.
                  </p>
                  <RagAssistant
                    patientId={selectedPatient}
                    role="caregiver"
                    latestVitals={latest}
                    historicalVitals={vitals}
                    profile={profile}
                  />
                </div>
              )}

              {/* ENHANCED CHARTS WITH CLINICAL ANALYSIS */}
              {selectedPatient && !loading && vitals.length > 0 && clinicalData && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Enhanced Heart Rate Chart */}
                    <div className={cardStyle}>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <FaHeartbeat className="text-red-500 text-xl" />
                            <h3 className="text-lg font-bold">Heart Rate Monitor</h3>
                          </div>
                           <p className="text-xs text-gray-400 mt-1">
                            Normal range: 60–100 bpm. Higher values may indicate stress, fever, or pain.
                          </p>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-red-500">{latest.heartRate}</span>
                            <span className="text-sm text-gray-500 ml-1">bpm</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span 
                            className="px-2 py-1 rounded text-xs font-semibold text-white"
                            style={{ backgroundColor: clinicalData.heartRate.zone.color }}
                          >
                            {clinicalData.heartRate.zone.friendlyLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            {clinicalData.heartRate.trend.arrow} 
                            <span className={`font-medium ${
                              clinicalData.heartRate.trend.severity === 'high' ? 'text-red-500' : 
                              clinicalData.heartRate.trend.severity === 'moderate' ? 'text-orange-500' : 
                              'text-green-500'
                            }`}>
                              {clinicalData.heartRate.trend.trend}
                            </span>
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            Baseline: {clinicalData?.heartRate?.baseline?.median
                              ? clinicalData.heartRate.baseline.median.toFixed(1)
                              : "--"} bpm
                          </span>
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={vitals}>
                          {/* Clinical Zone Backgrounds */}
                          {Object.entries(ClinicalAnalysis.CLINICAL_RANGES.heartRate).map(([key, range]) => (
                            <ReferenceArea
                              key={key}
                              y1={range.min}
                              y2={range.max}
                              fill={range.color}
                              fillOpacity={0.08}
                              strokeOpacity={0}
                            />
                          ))}
                          
                          <CartesianGrid 
                            stroke={theme === "dark" ? "#374151" : "#e5e7eb"} 
                            strokeDasharray="3 3" 
                          />
                          
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={formatTime}
                            tick={{ fill: theme === "dark" ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                          />
                          
                          <YAxis 
                            domain={[30, 140]}
                            tick={renderClinicalYAxis('heartRate')}
                            width={80}
                          />
                          
                          <Tooltip 
                            labelFormatter={formatDateTime}
                            formatter={(value) => [`${value} bpm`, "Heart Rate"]}
                            contentStyle={{ 
                              backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                              border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                              borderRadius: '8px'
                            }}
                          />
                          
                          {/* Baseline Reference */}
                          {clinicalData?.heartRate?.baseline?.median && (
                            <ReferenceLine 
                              y={clinicalData.heartRate.baseline.median} 
                              stroke="#6B7280" 
                              strokeDasharray="5 5"
                              label={{ 
                                value: `Baseline (${clinicalData.heartRate.baseline.median.toFixed(1)})`, 
                                position: 'insideTopRight',
                                fill: '#6B7280',
                                fontSize: 10
                              }}
                            />
                          )}
                          
                          <ReferenceLine y={60} stroke="#10B981" strokeDasharray="3 3" />
                          <ReferenceLine y={100} stroke="#F59E0B" strokeDasharray="3 3" />
                          
                          <Line 
                            {...chartProps} 
                            dataKey="heartRate" 
                            stroke="#ef4444" 
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      <div className="mt-3 text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          {clinicalData.heartRate.zone.friendlyLabel === 'Healthy Range' ? (
                            <FaCheckCircle className="text-green-500 mt-0.5" />
                          ) : (
                            <FaExclamationTriangle className="text-yellow-500 mt-0.5" />
                          )}
                          <p className="text-gray-600 dark:text-gray-400">
                            {clinicalData.heartRate.zone.description}
                          </p>
                        </div>
                        <p className="text-gray-500">
                          {vitals.length} readings | {clinicalData.heartRate.trend.friendlyMessage}
                        </p>
                      </div>
                    </div>

                    {/* Enhanced Respiration Chart */}
                    <div className={cardStyle}>
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <FaLungs className="text-blue-500 text-xl" />
                            <h3 className="text-lg font-bold">Respiration Rate</h3>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            Normal range: 12–20 breaths per minute. Faster breathing may signal distress.
                          </p>

                          <div className="text-right">
                            <span className="text-2xl font-bold text-blue-500">{latest.respirationRate}</span>
                            <span className="text-sm text-gray-500 ml-1">br/min</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span 
                            className="px-2 py-1 rounded text-xs font-semibold text-white"
                            style={{ backgroundColor: clinicalData.respirationRate.zone.color }}
                          >
                            {clinicalData.respirationRate.zone.friendlyLabel}
                          </span>
                          <span className="flex items-center gap-1">
                            {clinicalData.respirationRate.trend.arrow} 
                            <span className={`font-medium ${
                              clinicalData.respirationRate.trend.severity === 'high' ? 'text-red-500' : 
                              clinicalData.respirationRate.trend.severity === 'moderate' ? 'text-orange-500' : 
                              'text-green-500'
                            }`}>
                              {clinicalData.respirationRate.trend.trend}
                            </span>
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">
                            Baseline: {clinicalData?.respirationRate?.baseline?.median
                              ? clinicalData.respirationRate.baseline.median.toFixed(1)
                              : "--"} br/min
                          </span>
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={vitals}>
                          {/* Clinical Zone Backgrounds */}
                          {Object.entries(ClinicalAnalysis.CLINICAL_RANGES.respirationRate).map(([key, range]) => (
                            <ReferenceArea
                              key={key}
                              y1={range.min}
                              y2={range.max}
                              fill={range.color}
                              fillOpacity={0.08}
                              strokeOpacity={0}
                            />
                          ))}
                          
                          <CartesianGrid 
                            stroke={theme === "dark" ? "#374151" : "#e5e7eb"} 
                            strokeDasharray="3 3" 
                          />
                          
                          <XAxis 
                            dataKey="time" 
                            tickFormatter={formatTime}
                            tick={{ fill: theme === "dark" ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                          />
                          
                          <YAxis 
                            domain={[6, 35]}
                            tick={renderClinicalYAxis('respirationRate')}
                            width={80}
                          />
                          
                          <Tooltip 
                            labelFormatter={formatDateTime}
                            formatter={(value) => [`${value} br/min`, "Respiration"]}
                            contentStyle={{ 
                              backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                              border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                              borderRadius: '8px'
                            }}
                          />
                          
                          {clinicalData?.respirationRate?.baseline?.median && (
                            <ReferenceLine
                              y={clinicalData.respirationRate.baseline.median}
                              stroke="#6B7280"
                              strokeDasharray="5 5"
                              label={{
                                value: `Baseline (${clinicalData.respirationRate.baseline.median.toFixed(1)})`,
                                position: 'insideTopRight',
                                fill: '#6B7280',
                                fontSize: 10,
                              }}
                            />
                          )}
                          
                          <ReferenceLine y={12} stroke="#10B981" strokeDasharray="3 3" />
                          <ReferenceLine y={20} stroke="#F59E0B" strokeDasharray="3 3" />
                          
                          <Line 
                            {...chartProps} 
                            dataKey="respirationRate" 
                            stroke="#3b82f6" 
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      <div className="mt-3 text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          {clinicalData.respirationRate.zone.friendlyLabel === 'Healthy Range' ? (
                            <FaCheckCircle className="text-green-500 mt-0.5" />
                          ) : (
                            <FaExclamationTriangle className="text-yellow-500 mt-0.5" />
                          )}
                          <p className="text-gray-600 dark:text-gray-400">
                            {clinicalData.respirationRate.zone.description}
                          </p>
                        </div>
                        <p className="text-gray-500">
                          {vitals.length} readings | {clinicalData.respirationRate.trend.friendlyMessage}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Movement Chart - Full Width */}
                  <div className={cardStyle}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <FaWalking className="text-green-500 text-xl" />
                        <h3 className="text-lg font-bold">Movement Activity</h3>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Activity scale: 0 = no movement, 1 = minimal, 2 = light, 3 = high activity.
                      </p>

                      <div className="text-right">
                        <span 
                          className="px-3 py-1 rounded text-xs font-semibold text-white"
                          style={{ backgroundColor: clinicalData.movement.zone.color }}
                        >
                          {clinicalData.movement.zone.friendlyLabel}
                        </span>
                      </div>
                    </div>

                    {/* Presence Timeline */}
                      <div className="flex items-center gap-1 mb-3">
                        <span className="text-xs text-gray-500 mr-2">Presence</span>
                        <div className="flex w-80 h-3 rounded overflow-hidden">
                          {vitals.map((v, i) => (
                            <div
                              key={i}
                              className={`flex-1 ${
                                v.presence === 1
                                  ? "bg-teal-500"
                                  : "bg-gray-400 dark:bg-gray-600"
                              }`}
                              title={`${formatDateTime(v.time)} — ${
                                v.presence === 1 ? "Present" : "Absent"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    
                    
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={vitals}>
                        {/* Movement Zone Backgrounds */}
                        {Object.entries(ClinicalAnalysis.CLINICAL_RANGES.movement).map(([key, range]) => (
                          <ReferenceArea
                            key={key}
                            y1={range.min}
                            y2={range.max}
                            fill={range.color}
                            fillOpacity={0.08}
                            strokeOpacity={0}
                          />
                        ))}
                        
                        <CartesianGrid 
                          stroke={theme === "dark" ? "#374151" : "#e5e7eb"} 
                          strokeDasharray="3 3" 
                        />
                        <XAxis 
                          dataKey="time" 
                          tickFormatter={formatTime}
                          tick={{ fill: theme === "dark" ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                        />
                        <YAxis 
                          domain={[0, 'dataMax + 1']}
                          tick={{ fill: theme === "dark" ? '#9ca3af' : '#6b7280', fontSize: 11 }}
                        />
                        <Tooltip 
                          labelFormatter={formatDateTime}
                          formatter={(value) => {
                            const zone = Object.values(ClinicalAnalysis.CLINICAL_RANGES.movement).find(
                              r => value >= r.min && value <= r.max
                            );
                            return [zone ? zone.friendlyLabel : value, "Movement"];
                          }}
                          contentStyle={{ 
                            backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                            border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                            borderRadius: '8px'
                          }}
                        />

                        {clinicalData?.movement?.baseline?.median && (
                          <ReferenceLine
                            y={clinicalData.movement.baseline.median}
                            stroke="#6B7280"
                            strokeDasharray="5 5"
                            label={{
                              value: `Baseline (${clinicalData.movement.baseline.median.toFixed(1)})`,
                              position: 'insideTopRight',
                              fill: '#6B7280',
                              fontSize: 10,
                            }}
                          />
                        )}

                        <Line 
                          {...chartProps} 
                          dataKey="movement" 
                          stroke="#22c55e" 
                        />
                        <Line
                          dataKey="movementRange"
                          stroke="#0ea5e9"          // calm blue
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                          yAxisId={0}
                          name="Movement Intensity"
                        />


                      
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="mt-3 text-xs">
                      <p className="text-gray-600 dark:text-gray-400">
                        {clinicalData.movement.zone.description}
                      </p>
                      <p className="text-gray-500 mt-1">
                        Current activity: {clinicalData.movement.zone.friendlyLabel}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {loading && selectedPatient && (
                <div className={`p-12 rounded-xl text-center ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                  <p className="text-lg">Loading vitals data...</p>
                </div>
              )}

              {!loading && selectedPatient && vitals.length === 0 && (
                <div className={`p-12 rounded-xl text-center ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                  <FaChartLine className="mx-auto text-6xl opacity-20 mb-4" />
                  <p className="text-xl font-semibold mb-2">No Data Available</p>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    No vital signs recorded for this patient yet.
                  </p>
                </div>
              )}

              {!selectedPatient && (
                <div className={`p-16 rounded-xl text-center ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                  <FaUser className="mx-auto text-6xl opacity-20 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">No Patient Selected</h3>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    Select a patient from the sidebar or dropdown to view their vital signs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {tab === "alerts" && (
            <div className="space-y-6">
              <header>
                <h2 className="text-3xl font-bold mb-2">Patient Alerts</h2>
                <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                  Critical notifications and warnings
                </p>
              </header>
              
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        setSelectedAlert(alert);
                        setShowAlertModal(true);
                      }}
                      className={`${theme === "dark" ? "bg-gray-800" : "bg-white"} p-6 rounded-xl shadow-sm border-l-4 cursor-pointer hover:shadow-md transition-all ${
                        alert.severity === 'critical' ? 'border-red-600' :
                        alert.severity === 'high' ? 'border-orange-500' :
                        'border-yellow-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <FaExclamationTriangle className={`text-2xl mt-1 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'high' ? 'text-orange-500' :
                            'text-yellow-500'
                          }`} />
                          <div>
                            <p className="font-semibold text-lg">
                              {alert.message || `${alert.severity} severity alert`}
                            </p>
                            <p className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                              {formatDateTime(alert.createdAt)}
                            </p>
                            {alert.vitals && (
                              <div className="mt-2 text-sm">
                                <span className="font-semibold">Vitals: </span>
                                HR: {alert.vitals.heartRate} bpm, RR: {alert.vitals.respirationRate} br/min
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {!alert.read && (
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">New</span>
                          )}
                          {alert.acknowledged && (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                              <FaCheckCircle />
                              <span>Done</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`p-16 rounded-xl text-center ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                  <FaBell className="mx-auto text-6xl opacity-20 mb-4" />
                  <h3 className="text-xl font-bold mb-2">No Alerts</h3>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    All patients are stable.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Messages Tab */}
          {tab === "messages" && (
            <div className="space-y-6">
              <header>
                <h2 className="text-3xl font-bold mb-2">Messages with Doctor</h2>
              </header>
              
              {selectedPatient ? (
                <div className={`p-6 rounded-xl ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                  <div className="mb-6 pb-4 border-b">
                    <p className="font-semibold">Conversation about: {profile.name || selectedPatient}</p>
                  </div>

                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto px-2">
                    {messages.length > 0 ? (
                      messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.senderId === 'caregiver' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow-sm ${
                              msg.senderId === 'caregiver'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : theme === "dark"
                                  ? 'bg-gray-700 text-white rounded-bl-none'
                                  : 'bg-gray-200 text-gray-900 rounded-bl-none'
                            }`}
                          >
                            <p className="text-xs font-semibold mb-1">
                              {msg.senderId === 'caregiver' ? 'You (Caregiver)' : 'Doctor'}
                            </p>
                            <p className="text-sm">{msg.text}</p>
                            <p className="text-xs opacity-50 mt-1 text-right">
                              {formatDateTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 opacity-50 text-sm">
                        No messages yet. Start a conversation with the caregiver.
                      </div>
                    )}

                    <div ref={messagesEndRef}></div>
                  </div>


                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className={`flex-1 px-4 py-3 rounded-lg border ${
                        theme === "dark" 
                          ? "bg-gray-700 border-gray-600" 
                          : "bg-white border-gray-300"
                      } focus:ring-2 focus:ring-green-500`}
                      placeholder="Type your message..."
                    />
                    <button 
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-all"
                    >
                      <FaPaperPlane />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`p-16 rounded-xl text-center ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                  <FaEnvelope className="mx-auto text-6xl opacity-20 mb-4" />
                  <h3 className="text-2xl font-bold mb-2">No Patient Selected</h3>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                    Select a patient to message their doctor.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {tab === "settings" && (
            <div className="space-y-6">
              <header>
                <h2 className="text-3xl font-bold mb-2">Settings</h2>
              </header>
              <div className={`p-6 rounded-xl ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="text-lg font-bold mb-4">Notification Preferences</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    <span>Critical alerts</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    <span>High priority alerts</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                    <span>New messages from doctor</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4" />
                    <span>Sound notifications</span>
                  </label>
                </div>
              </div>

              <div className={`p-6 rounded-xl ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
                <h3 className="text-lg font-bold mb-4">Display Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Theme</label>
                    <button
                      onClick={toggleTheme}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        theme === "light"
                          ? "bg-gray-200 text-gray-900 hover:bg-gray-300"
                          : "bg-gray-700 text-gray-100 hover:bg-gray-600"
                      }`}
                    >
                      {theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Alert Detail Modal */}
      {showAlertModal && selectedAlert && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${theme === "dark" ? "bg-gray-800" : "bg-white"} rounded-xl shadow-xl max-w-lg w-full p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FaExclamationTriangle className={
                  selectedAlert.severity === 'critical' ? 'text-red-600' :
                  selectedAlert.severity === 'high' ? 'text-orange-500' :
                  'text-yellow-500'
                } />
                <span>Alert Details</span>
              </h3>
              <button 
                onClick={() => setShowAlertModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className={`text-sm font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Message</p>
                <p className="text-lg">{selectedAlert.message}</p>
              </div>

              <div>
                <p className={`text-sm font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Severity</p>
                <p className="text-lg capitalize">{selectedAlert.severity}</p>
              </div>

              <div>
                <p className={`text-sm font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Time</p>
                <p className="text-lg">{formatDateTime(selectedAlert.createdAt)}</p>
              </div>

              {selectedAlert.vitals && (
                <div>
                  <p className={`text-sm font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Vital Signs</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className={`p-3 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"}`}>
                      <p className="text-xs opacity-75">Heart Rate</p>
                      <p className="text-lg font-bold">{selectedAlert.vitals.heartRate} bpm</p>
                    </div>
                    <div className={`p-3 rounded ${theme === "dark" ? "bg-gray-700" : "bg-gray-100"}`}>
                      <p className="text-xs opacity-75">Respiration</p>
                      <p className="text-lg font-bold">{selectedAlert.vitals.respirationRate} br/min</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button 
                  onClick={() => setShowAlertModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white transition-all"
                >
                  Close
                </button>
                {!selectedAlert.acknowledged && (
                  <button 
                    onClick={() => acknowledgeAlert(selectedAlert.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                  >
                    <FaCheckCircle />
                    <span>Acknowledge</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}