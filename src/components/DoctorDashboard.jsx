// src/components/DoctorDashboard.js - FIXED CHARTS ISSUE
import React, { useEffect, useState, useContext, useRef } from "react";
import axios from "axios";
axios.defaults.baseURL = "http://localhost:5000";  // <-- ADD THIS RIGHT HERE

import { io } from "socket.io-client";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ReferenceLine, ReferenceArea
} from "recharts";
import {
  FaHeartbeat, FaLungs, FaWalking, FaBell, FaEnvelope,
  FaCog, FaUser, FaSignOutAlt, FaDownload, FaChartLine,
  FaExclamationTriangle, FaPaperPlane, FaTimes, FaCheckCircle
} from "react-icons/fa";
import ThemeToggle from "./ThemeToggle";
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

export default function DoctorDashboard() {
  const { theme } = useContext(ThemeContext);
  
  // Chart props for smooth curves
  const chartProps = {
    strokeWidth: 2.5,
    dot: false,
    isAnimationActive: true,
    type: "monotone",
  };

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [profile, setProfile] = useState({});
  const [vitals, setVitals] = useState([]); // Combined vitals array
  const [latest, setLatest] = useState({});
  const [tab, setTab] = useState("dashboard");
  const [alerts, setAlerts] = useState([]);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [clinicalData, setClinicalData] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
  if (tab === "messages" && selectedPatient) {
    axios.patch(`/api/v1/messages/${selectedPatient}/read`)
    .then(() => {
        // 🔥 IMPORTANT: update frontend state
        setMessages(prev =>
          prev.map(m =>
            m.senderId !== "doctor" ? { ...m, read: true } : m
          )
        );
        setUnreadMessages(0); // ✅ RESET BADGE
      })
      .catch(err => console.error("Failed to mark messages as read", err));
  }
}, [tab, selectedPatient]);


  
  // Listen to all messages globally (only once)
  useEffect(() => {
    const globalMessageHandler = (msg) => {
      setMessages(prev => {
        const exists = prev.some(
          m =>
            m.createdAt === msg.createdAt &&
            m.text === msg.text &&
            m.senderId === msg.senderId
        );
        return exists ? prev : [...prev, msg];
      });

      if (msg.senderId !== 'doctor') {
        setUnreadMessages(prev => prev + 1);
        
      }
    };

    socket.on("message", globalMessageHandler);

    return () => {
      socket.off("message", globalMessageHandler);
    };
  }, []); // empty dependency = run once


  // Fetch patients on mount
  useEffect(() => {
    axios.get("/api/v1/patients")
      .then(res => {
        const pts = res.data.patients || [];
        if (Array.isArray(pts)) setPatients(pts);
        else setPatients(Object.entries(pts).map(([id, data]) => ({ id, ...data })));
      })
      .catch(err => console.error("Failed to fetch patients:", err));
  }, []);

  // Fetch vitals, latest, alerts, and profile when patient changes
  useEffect(() => {
    if (!selectedPatient) return;

    setLoading(true);
    setVitals([]);
    setLatest({});
    setAlerts([]);
    setMessages([]);
    setClinicalData(null);

    // Patient profile
    axios.get(`/api/v1/patients/${selectedPatient}/profile`)
      .then(res => setProfile(res.data || {}))
      .catch(err => console.error("Failed fetching profile:", err));

    // Historical vitals - FIXED DATA MAPPING
    const limitMap = { "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
    axios.get(`/api/v1/vitals/${selectedPatient}?limit=${limitMap[selectedTimeRange] || 1440}`)
      .then(res => {
        const data = res.data.data || res.data.vitals || res.data || [];
        console.log("Doctor fetched", data.length, "vitals");
        
        const mapped = data.map(v => ({
          time: new Date(v.timeRecorded || v.time).toISOString(),
          heartRate: v.heartRate ?? 0,
          respirationRate: v.respirationRate ?? 0,
          movement: v.movement ?? 0,
          presence: v.presence ?? 0,          // ✅ ADD
          movementRange: v.movementRange ?? 0 // (we'll graph later)
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
        console.error("Failed fetching vitals:", err);
        setLoading(false);
      });

    // Latest vitals
    axios.get(`/api/v1/patients/${selectedPatient}/latest`)
      .then(res => {
        const l = res.data.latest || {};
        const latestVitals = {
          time: l.timeRecorded || l.time,
          heartRate: l.heartRate ?? 0,
          respirationRate: l.respirationRate ?? 0,
          movement: l.movement ?? 0,
          presence: l.presence ?? 0,          // ✅ ADD
          movementRange: l.movementRange ?? 0 // keep for later
        };
        setLatest(latestVitals);

        // Add to vitals if not already there
        setVitals(prev => {
          const exists = prev.some(v => v.time === latestVitals.time);
          if (!exists) return [...prev, latestVitals];
          return prev;
        });
      })
      .catch(err => console.error("Failed fetching latest vitals:", err));

    // Alerts
    axios.get(`/api/v1/alerts/${selectedPatient}?limit=50`)
      .then(res => {
        const alertsData = res.data.alerts || [];
        setAlerts(alertsData);
        setUnreadAlerts(alertsData.filter(a => !a.read).length);
      })
      .catch(err => console.error("Failed fetching alerts:", err));

    // Messages
    axios.get(`/api/v1/messages/${selectedPatient}?limit=100`)
      .then(res => {
        const msgs = res.data.messages || [];
        setMessages(msgs);
        const unread = msgs.filter(
      m => !m.read && m.senderId !== "doctor"
    ).length;
        setUnreadMessages(msgs.filter(m => !m.read && m.senderId !== 'doctor').length);
      })
      .catch(err => console.error("Failed fetching messages:", err));

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
        presence: data.presence ?? 0,          // ✅ ADD
        movementRange: data.movementRange ?? 0 // store now, graph later
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

  // Calculate clinical analysis when vitals change
  useEffect(() => {
    if (vitals.length > 0) {
      console.log("Analyzing", vitals.length, "vitals for clinical data");
      // Use medical terms (false = technical labels for doctors)
      const analysis = ClinicalAnalysis.analyzeVitals(vitals, false);
      setClinicalData(analysis);
    }
  }, [vitals]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const markAlertsRead = () => {
    if (!selectedPatient) return;
      axios.post(`/api/v1/alerts/${selectedPatient}/mark-read`, { 
        alertIds: alerts.map(a => a.id) // send the alert IDs
      })
      .then(() => {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
        setUnreadAlerts(0);
      })
      .catch(err => console.error("Failed marking alerts as read:", err));
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedPatient) return;
    
    const msg = {
      patientId: selectedPatient,
      senderId: "doctor",
      recipient: "caregiver",
      text: newMessage,
      createdAt: new Date().toISOString(),
      read: false
    };

    
    axios.post(`/api/v1/messages`, msg).catch(err => console.error("Failed to save message:", err));
    setNewMessage("");
  };

  const exportCSV = () => {
    if (!vitals.length) return;

    const rows = ["Time,Heart Rate (bpm),Respiration Rate (br/min),Movement"];
    vitals.forEach(v => rows.push(`${v.time},${v.heartRate},${v.respirationRate},${v.movement}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.name || selectedPatient}_vitals_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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

  const cardStyle = `p-4 rounded-lg shadow-md transition-all hover:shadow-lg
    ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`;

  return (
    <div className={`flex h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      {/* Sidebar */}
      <div className={`w-64 ${theme === "dark" ? "bg-blue-800" : "bg-blue-700"} text-white p-5 flex flex-col space-y-2`}>
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Doctor Portal</h2>
          <p className="text-sm opacity-75">Patient Monitoring</p>
        </div>
        
        <button 
          onClick={() => setTab("dashboard")} 
          className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
            tab === "dashboard" ? "bg-blue-600 shadow-lg" : "hover:bg-blue-600"
          }`}
        >
          <FaChartLine className="text-lg" />
          <span>Dashboard</span>
        </button>
        
        <button 
          onClick={() => { setTab("alerts"); markAlertsRead(); }} 
          className={`flex items-center space-x-3 p-3 rounded-lg transition-all relative ${
            tab === "alerts" ? "bg-blue-600 shadow-lg" : "hover:bg-blue-600"
          }`}
        >
          <FaBell className="text-lg" />
          <span>Alerts</span>
          {unreadAlerts > 0 && (
            <span className="absolute right-3 top-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadAlerts}
            </span>
          )}
        </button>
        
        <button 
          onClick={() => setTab("messages")} 
          className={`flex items-center space-x-3 p-3 rounded-lg transition-all relative ${
            tab === "messages" ? "bg-blue-600 shadow-lg" : "hover:bg-blue-600"
          }`}
        >
          <FaEnvelope className="text-lg" />
          <span>Messages</span>
          {unreadMessages > 0 && (
            <span className="absolute right-3 top-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadMessages}
            </span>
          )}
        </button>
        
        <button 
          onClick={() => setTab("settings")} 
          className={`flex items-center space-x-3 p-3 rounded-lg transition-all ${
            tab === "settings" ? "bg-blue-600 shadow-lg" : "hover:bg-blue-600"
          }`}
        >
          <FaCog className="text-lg" />
          <span>Settings</span>
        </button>

        <div className="mt-auto space-y-2">
          <ThemeToggle />
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 hover:bg-blue-600 p-3 rounded-lg transition-all w-full"
          >
            <FaSignOutAlt className="text-lg" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          {tab === "dashboard" && (
            <div>
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">Patient Monitoring Dashboard</h1>
                <p className="text-gray-500">Real-time vital signs and health metrics</p>
              </div>

              {/* Patient Selector */}
              <div className={`${cardStyle} mb-6`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <label className="font-semibold text-sm">Patient:</label>
                    <select 
                      value={selectedPatient} 
                      onChange={(e) => setSelectedPatient(e.target.value)} 
                      className={`p-2 border rounded-lg flex-1 max-w-xs ${
                        theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                      }`}
                    >
                      <option value="">-- Select Patient --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.profile?.name || p.name || "Unnamed Patient"} (Age: {p.profile?.age || p.age || "--"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedPatient && (
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedTimeRange}
                        onChange={(e) => setSelectedTimeRange(e.target.value)}
                        className={`p-2 border rounded-lg text-sm ${
                          theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                        }`}
                      >
                        <option value="1h">Last Hour</option>
                        <option value="6h">Last 6 Hours</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                      </select>
                      
                      <button 
                        onClick={exportCSV} 
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
                      >
                        <FaDownload />
                        <span>Export</span>
                      </button>

                      <button 
                        onClick={() => setShowMessageModal(true)} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
                      >
                        <FaPaperPlane />
                        <span>Message Caregiver</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Patient Profile */}
              {profile?.name && (
                <div className={`${cardStyle} mb-6 flex items-center justify-between`}>
                  <div className="flex items-center space-x-4">
                    <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                      <FaUser className="text-blue-600 dark:text-blue-300 text-2xl" />
                    </div>
                    <div>
                      <p className="font-bold text-xl">{profile.name}</p>
                      <p className="text-sm opacity-75">
                        Age: {profile.age} | Gender: {profile.gender} | ID: {selectedPatient}
                      </p>
                      <p className="text-sm mt-1">
                        <span className="font-semibold">Condition:</span> {profile.condition || "Not specified"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-75">Last Updated</p>
                    <p className="font-semibold">{latest?.time ? formatDateTime(latest.time) : "--"}</p>
                  </div>
                </div>
              )}

              {/* Clinical Summary Alert Card */}
              {selectedPatient && clinicalData && (
                <div className={`${cardStyle} mb-6 border-l-4`} style={{ borderColor: clinicalData.summary.statusColor }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">Clinical Status</h3>
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
                        <p className="text-xs opacity-75">NEWS Score</p>
                        <p 
                          className="text-3xl font-bold"
                          style={{ color: clinicalData.newsScore.color }}
                        >
                          {clinicalData.newsScore.score}
                        </p>
                        <p className="text-xs">{clinicalData.newsScore.level}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary Cards with Enhanced Details */}
              {selectedPatient && clinicalData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                          <p className="text-xs opacity-75">bpm</p>
                        </div>
                      </div>
                    </div>
                    <div 
                      className="px-2 py-1 rounded text-xs font-semibold text-white mb-2"
                      style={{ backgroundColor: clinicalData.heartRate.zone.color }}
                    >
                      {clinicalData.heartRate.zone.label}
                    </div>
                    <p className="text-xs opacity-75">{clinicalData.heartRate.trend.message}</p>
                  </div>

                  {/* Respiration Card */}
                  <div className={cardStyle}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-full">
                          <FaLungs className="text-blue-500 text-2xl" />
                        </div>
                        <div>
                          <p className="text-sm opacity-75">Respiration Rate</p>
                          <p className="text-3xl font-bold">{latest?.respirationRate ?? "--"}</p>
                          <p className="text-xs opacity-75">br/min</p>
                        </div>
                      </div>
                    </div>
                    <div 
                      className="px-2 py-1 rounded text-xs font-semibold text-white mb-2"
                      style={{ backgroundColor: clinicalData.respirationRate.zone.color }}
                    >
                      {clinicalData.respirationRate.zone.label}
                    </div>
                    <p className="text-xs opacity-75">{clinicalData.respirationRate.trend.message}</p>
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
                        <p className="text-xs opacity-75">activity level</p>
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

              {/* AI Clinical Assistant */}
              {selectedPatient && (
                <div className={`${cardStyle} mb-6`}>
                  <h2 className="text-xl font-semibold mb-2">Clinical Assistant</h2>
                  <p className="text-sm opacity-75 mb-4">
                    Ask questions about this patient's condition and trends.
                  </p>
                  <RagAssistant
                    patientId={selectedPatient}
                    role="doctor"
                    latestVitals={latest}
                    historicalVitals={vitals}
                    profile={profile}
                  />
                </div>
              )}

              {/* FIXED CHARTS - Now with proper data */}
              {selectedPatient && !loading && vitals.length > 0 && clinicalData && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Heart Rate Chart */}
                    <div className={`p-6 rounded-xl shadow-sm ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
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
                            {clinicalData.heartRate.zone.label}
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
                          {clinicalData.heartRate.zone.label === 'Normal' ? (
                            <FaCheckCircle className="text-green-500 mt-0.5" />
                          ) : (
                            <FaExclamationTriangle className="text-yellow-500 mt-0.5" />
                          )}
                          <p className="text-gray-600 dark:text-gray-400">
                            {clinicalData.heartRate.zone.description}
                          </p>
                        </div>
                        <p className="text-gray-500">
                          {vitals.length} readings | {clinicalData.heartRate.trend.message}
                        </p>
                      </div>
                    </div>

                    {/* Respiration Chart */}
                    <div className={`p-6 rounded-xl shadow-sm ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
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
                            {clinicalData.respirationRate.zone.label}
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
                          {clinicalData.respirationRate.zone.label === 'Normal' ? (
                            <FaCheckCircle className="text-green-500 mt-0.5" />
                          ) : (
                            <FaExclamationTriangle className="text-yellow-500 mt-0.5" />
                          )}
                          <p className="text-gray-600 dark:text-gray-400">
                            {clinicalData.respirationRate.zone.description}
                          </p>
                        </div>
                        <p className="text-gray-500">
                          {vitals.length} readings | {clinicalData.respirationRate.trend.message}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Movement Chart - Full Width */}
                  <div className={`p-6 rounded-xl shadow-sm ${theme === "dark" ? "bg-gray-800" : "bg-white"}`}>
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
                          {clinicalData.movement.zone.label}
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
                            return [zone ? zone.label : value, "Movement"];
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
                        Current activity: {clinicalData.movement.zone.label}
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
                    Select a patient from the dropdown to view their vital signs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Alerts Tab */}
          {tab === "alerts" && (
            <div>
              <h1 className="text-3xl font-bold mb-6">Patient Alerts</h1>
              <div className="space-y-3">
                {alerts.length > 0 ? (
                  alerts.map((alert, i) => (
                    <div 
                      key={i} 
                      className={`${cardStyle} border-l-4 ${
                        alert.severity === 'critical' ? 'border-red-600' :
                        alert.severity === 'high' ? 'border-orange-500' :
                        'border-yellow-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <FaExclamationTriangle className={`text-2xl mt-1 ${
                            alert.severity === 'critical' ? 'text-red-600' :
                            alert.severity === 'high' ? 'text-orange-500' :
                            'text-yellow-500'
                          }`} />
                          <div>
                            <p className="font-semibold text-lg">
                              {alert.message || `${alert.severity} severity alert`}
                            </p>
                            <p className="text-sm opacity-75 mt-1">
                              Patient: {alert.patientId} | {formatDateTime(alert.createdAt)}
                            </p>
                            {alert.vitals && (
                              <div className="mt-2 text-sm">
                                <span className="font-semibold">Vitals: </span>
                                HR: {alert.vitals.heartRate} bpm, RR: {alert.vitals.respirationRate} br/min
                              </div>
                            )}
                          </div>
                        </div>
                        {!alert.read && (
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">New</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`${cardStyle} text-center py-12`}>
                    <FaBell className="mx-auto text-6xl opacity-20 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Alerts</h3>
                    <p className="opacity-75">All patients are stable. No alerts to display.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {tab === "messages" && (
            <div>
              <h1 className="text-3xl font-bold mb-6">Messages with Caregivers</h1>
              
              {selectedPatient ? (
                <div className={cardStyle}>
                  <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <p className="font-semibold">Conversation about: {profile.name || selectedPatient}</p>
                  </div>

                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto px-2">
                    {messages.length > 0 ? (
                      messages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.senderId === 'doctor' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow-sm ${
                              msg.senderId === 'doctor'
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : theme === "dark"
                                  ? 'bg-gray-700 text-white rounded-bl-none'
                                  : 'bg-gray-200 text-gray-900 rounded-bl-none'
                            }`}
                          >
                            <p className="text-xs font-semibold mb-1">
                              {msg.senderId === 'doctor' ? 'You (Doctor)' : 'Caregiver'}
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

                    {/* Dummy div to scroll into view */}
                    <div ref={messagesEndRef}></div>
                  </div>


                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                      className={`flex-1 p-3 border rounded-lg ${
                        theme === "dark" 
                          ? "bg-gray-700 border-gray-600" 
                          : "bg-white border-gray-300"
                      }`}
                      placeholder="Type your message to the caregiver..."
                    />
                    <button 
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg flex items-center space-x-2 transition-all"
                    >
                      <FaPaperPlane />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`${cardStyle} text-center py-12`}>
                  <FaEnvelope className="mx-auto text-6xl opacity-20 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Patient Selected</h3>
                  <p className="opacity-75">Select a patient to view and send messages to their caregiver.</p>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {tab === "settings" && (
            <div>
              <h1 className="text-3xl font-bold mb-6">Settings</h1>
              <div className="space-y-4">
                <div className={cardStyle}>
                  <h3 className="font-semibold text-lg mb-4">Notification Preferences</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span>Critical alerts</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span>High priority alerts</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" className="w-4 h-4" />
                      <span>Medium priority alerts</span>
                    </label>
                    <label className="flex items-center space-x-3">
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                      <span>New messages from caregivers</span>
                    </label>
                  </div>
                </div>

                <div className={cardStyle}>
                  <h3 className="font-semibold text-lg mb-4">Display Preferences</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Chart Animation</label>
                      <select className={`p-2 border rounded-lg w-full ${
                        theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                      }`}>
                        <option>Enabled</option>
                        <option>Disabled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">Default Time Range</label>
                      <select className={`p-2 border rounded-lg w-full ${
                        theme === "dark" ? "bg-gray-700 border-gray-600" : "bg-white border-gray-300"
                      }`}>
                        <option>Last Hour</option>
                        <option>Last 6 Hours</option>
                        <option value="24h">Last 24 Hours</option>
                        <option>Last 7 Days</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={cardStyle}>
                  <h3 className="font-semibold text-lg mb-4">Account</h3>
                  <div className="space-y-3">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all">
                      Change Password
                    </button>
                    <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-all ml-2">
                      Update Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Message Modal */}
      {showMessageModal && selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${cardStyle} max-w-lg w-full mx-4`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Quick Message to Caregiver</h3>
              <button 
                onClick={() => setShowMessageModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>
            <p className="text-sm opacity-75 mb-4">Patient: {profile.name}</p>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className={`w-full p-3 border rounded-lg mb-4 h-32 ${
                theme === "dark" 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              }`}
              placeholder="Type your message to the caregiver..."
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setShowMessageModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  sendMessage();
                  setShowMessageModal(false);
                }}
                disabled={!newMessage.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-all"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}