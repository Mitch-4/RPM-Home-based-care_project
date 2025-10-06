// src/components/DoctorDashboard.js
import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea
} from "recharts";
import {
  FaHeartbeat, FaLungs, FaWalking, FaBell, FaEnvelope,
  FaCog, FaUser, FaSignOutAlt, FaDownload, FaChartLine,
  FaExclamationTriangle, FaPaperPlane, FaTimes
} from "react-icons/fa";
import ThemeToggle from "./ThemeToggle";
import { ThemeContext } from "../context/ThemeContext";

// Connect to backend Socket.IO
const socket = io("http://localhost:5000", { transports: ["websocket"] });

// Format time for X-axis
const formatTime = (timeStr) => {
  const date = new Date(timeStr);
  if (isNaN(date)) return timeStr;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format full date time
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

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [profile, setProfile] = useState({});
  const [historicalVitals, setHistoricalVitals] = useState([]);
  const [realtimeVitals, setRealtimeVitals] = useState([]);
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
    // Reset arrays when changing patient
    setHistoricalVitals([]);
    setRealtimeVitals([]);
    setLatest({});
    setAlerts([]);
    setMessages([]);

    // Patient profile
    axios.get(`/api/v1/patients/${selectedPatient}/profile`)
      .then(res => setProfile(res.data || {}))
      .catch(err => console.error("Failed fetching profile:", err));

    // Historical vitals based on time range
    const limitMap = { "1h": 60, "6h": 360, "24h": 1440, "7d": 10080 };
    axios.get(`/api/v1/vitals/${selectedPatient}?limit=${limitMap[selectedTimeRange] || 1440}`)
      .then(res => {
        const data = res.data.data || [];
        const mapped = data.map(v => ({
          time: v.timeRecorded || v.time,
          heartRate: v.heartRate ?? 0,
          respirationRate: v.respirationRate ?? 0,
          movement: v.movement ?? 0
        }));
        mapped.sort((a, b) => new Date(a.time) - new Date(b.time));
        setHistoricalVitals(mapped);
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
          movement: l.movement ?? 0
        };
        setLatest(latestVitals);

        // Add to realtimeVitals if not already present
        setRealtimeVitals(prev => {
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
        setUnreadMessages(msgs.filter(m => !m.read && m.sender !== 'doctor').length);
      })
      .catch(err => console.error("Failed fetching messages:", err));

    // Join Socket.IO room for real-time updates
    socket.emit("join-patient-room", selectedPatient);

    const vitalsHandler = (data) => {
      const newVital = {
        time: data.time,
        heartRate: data.heartRate,
        respirationRate: data.respirationRate,
        movement: data.movement
      };

      setRealtimeVitals(prev => {
        const exists = prev.some(v => v.time === newVital.time);
        if (!exists) return [...prev.slice(-100), newVital];
        return prev;
      });

      setLatest(newVital);
    };

    const alertHandler = (alert) => {
      setAlerts(prev => [alert, ...prev]);
      setUnreadAlerts(prev => prev + 1);
    };

    const messageHandler = (msg) => {
      setMessages(prev => [...prev, msg]);
      if (msg.sender !== 'doctor') {
        setUnreadMessages(prev => prev + 1);
      }
    };

    socket.on("new-vital", vitalsHandler);
    socket.on("alert", alertHandler);
    socket.on("message", messageHandler);

    return () => {
      socket.emit("leave-patient-room", selectedPatient);
      socket.off("new-vital", vitalsHandler);
      socket.off("alert", alertHandler);
      socket.off("message", messageHandler);
    };
  }, [selectedPatient, selectedTimeRange]);

  // Mark alerts as read
  const markAlertsRead = () => {
    if (!selectedPatient) return;
    axios.post(`/api/v1/alerts/${selectedPatient}/mark-read`)
      .then(() => {
        setAlerts(prev => prev.map(a => ({ ...a, read: true })));
        setUnreadAlerts(0);
      })
      .catch(err => console.error("Failed marking alerts as read:", err));
  };

  // Send message to caregiver
  const sendMessage = () => {
    if (!newMessage.trim() || !selectedPatient) return;
    
    const msg = {
      patientId: selectedPatient,
      sender: "doctor",
      recipient: "caregiver",
      text: newMessage,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Send via socket
    socket.emit("message", msg);
    
    // Also save to backend
    axios.post(`/api/v1/messages`, msg)
      .catch(err => console.error("Failed to save message:", err));

    setMessages(prev => [...prev, msg]);
    setNewMessage("");
  };

  // Export vitals to CSV
  const exportCSV = () => {
    const allVitals = [...historicalVitals, ...realtimeVitals];
    if (!allVitals.length) return;

    const rows = ["Time,Heart Rate (bpm),Respiration Rate (br/min),Movement"];
    allVitals.forEach(v => rows.push(`${v.time},${v.heartRate},${v.respirationRate},${v.movement}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.name || selectedPatient}_vitals_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Get vital status
  const getVitalStatus = (type, value) => {
    if (type === 'heartRate') {
      if (value < 60) return { status: 'low', color: 'text-blue-500' };
      if (value > 100) return { status: 'high', color: 'text-red-500' };
      return { status: 'normal', color: 'text-green-500' };
    }
    if (type === 'respirationRate') {
      if (value < 12) return { status: 'low', color: 'text-blue-500' };
      if (value > 20) return { status: 'high', color: 'text-red-500' };
      return { status: 'normal', color: 'text-green-500' };
    }
    return { status: 'normal', color: 'text-gray-500' };
  };

  const chartProps = {
    strokeWidth: 2,
    dot: false,
    isAnimationActive: true,
    type: "monotone",
  };

  const cardStyle = `p-4 rounded-lg shadow-md transition-all hover:shadow-lg
    ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-900"}`;

  const allVitalsData = [...historicalVitals, ...realtimeVitals];
  // ✅ Deduplicate data before rendering
const dedupedVitalsData = allVitalsData.filter(
  (item, index, self) =>
    index === self.findIndex((t) => t.time === item.time)
);


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
          <button className="flex items-center space-x-3 hover:bg-blue-600 p-3 rounded-lg transition-all w-full">
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

              {/* Summary Cards */}
              {selectedPatient && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className={cardStyle}>
                    <div className="flex items-center justify-between">
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
                      <div className={`text-2xl ${getVitalStatus('heartRate', latest?.heartRate).color}`}>
                        {getVitalStatus('heartRate', latest?.heartRate).status !== 'normal' && <FaExclamationTriangle />}
                      </div>
                    </div>
                  </div>

                  <div className={cardStyle}>
                    <div className="flex items-center justify-between">
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
                      <div className={`text-2xl ${getVitalStatus('respirationRate', latest?.respirationRate).color}`}>
                        {getVitalStatus('respirationRate', latest?.respirationRate).status !== 'normal' && <FaExclamationTriangle />}
                      </div>
                    </div>
                  </div>

                  <div className={cardStyle}>
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-100 dark:bg-green-900 p-3 rounded-full">
                        <FaWalking className="text-green-500 text-2xl" />
                      </div>
                      <div>
                        <p className="text-sm opacity-75">Movement</p>
                        <p className="text-3xl font-bold">{latest?.movement ?? "--"}</p>
                        <p className="text-xs opacity-75">activity level</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts */}
              {selectedPatient && (
                <div className="space-y-6">
                  {loading && (
                    <div className="text-center py-8">
                      <p className="text-lg">Loading vital signs data...</p>
                    </div>
                  )}

                  {!loading && allVitalsData.length === 0 && (
                    <div className={`${cardStyle} text-center py-8`}>
                      <p className="text-lg">No vital signs data available for this patient.</p>
                    </div>
                  )}

                  {!loading && allVitalsData.length > 0 && (
                    <>
                      {/* Heart Rate Chart */}
                      <div className={cardStyle}>
                        <h2 className="font-semibold text-lg mb-4 flex items-center space-x-2">
                          <FaHeartbeat className="text-red-500" />
                          <span>Heart Rate Monitor (bpm)</span>
                        </h2>
                        <ResponsiveContainer width="67%" height={300}>
                          <LineChart data={dedupedVitalsData}>
                            <defs>
                              <filter id="shadow">
                                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/>
                              </filter>
                            </defs>
                            <CartesianGrid stroke={theme === "dark" ? "#374151" : "#e5e7eb"} strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time" 
                              tickFormatter={formatTime} 
                              tick={{ fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 }} 
                            />
                            <YAxis 
                              domain={[40, 120]} 
                              tick={{ fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 }} 
                              label={{ value: "bpm", angle: -90, position: 'insideLeft', fill: theme === "dark" ? "#9ca3af" : "#6b7280" }} 
                            />
                            <Tooltip 
                              labelFormatter={formatDateTime} 
                              formatter={(value) => [`${value} bpm`, "Heart Rate"]}
                              contentStyle={{ 
                                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                                border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                                borderRadius: '8px',
                                fontSize: 12
                              }}
                            />
                            <ReferenceArea y1={40} y2={60} fill="#3b82f6" fillOpacity={0.08} />
                            <ReferenceArea y1={100} y2={120} fill="#ef4444" fillOpacity={0.08} />
                            <ReferenceLine y={60} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Normal Low (60)', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }} />
                            <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Normal High (100)', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
                            <Line type= "natural" dataKey="heartRate" stroke="#ef4444" strokeWidth={2.5} dot={false} filter="url(#shadow)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Respiration Rate Chart */}
                      <div className={cardStyle}>
                        <h2 className="font-semibold text-lg mb-4 flex items-center space-x-2">
                          <FaLungs className="text-blue-500" />
                          <span>Respiration Rate Monitor (br/min)</span>
                        </h2>
                        <ResponsiveContainer width="67%" height={300}>
                          <LineChart data={dedupedVitalsData}>
                            <CartesianGrid stroke={theme === "dark" ? "#374151" : "#e5e7eb"} strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time" 
                              tickFormatter={formatTime} 
                              tick={{ fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 }} 
                            />
                            <YAxis 
                              domain={[8, 30]} 
                              tick={{ fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 }} 
                              label={{ value: "br/min", angle: -90, position: 'insideLeft', fill: theme === "dark" ? "#9ca3af" : "#6b7280" }} 
                            />
                            <Tooltip 
                              labelFormatter={formatDateTime} 
                              formatter={(value) => [`${value} br/min`, "Respiration"]}
                              contentStyle={{ 
                                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                                border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                                borderRadius: '8px',
                                fontSize: 12
                              }}
                            />
                            <ReferenceArea y1={8} y2={12} fill="#3b82f6" fillOpacity={0.08} />
                            <ReferenceArea y1={20} y2={30} fill="#ef4444" fillOpacity={0.08} />
                            <ReferenceLine y={12} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Normal Low (12)', position: 'insideTopLeft', fill: '#10b981', fontSize: 10 }} />
                            <ReferenceLine y={20} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Normal High (20)', position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }} />
                            <Line type= "natural" dataKey="respirationRate" stroke="#3b82f6" strokeWidth={2.5} dot={false} filter="url(#shadow)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Movement Chart */}
                      <div className={cardStyle}>
                        <h2 className="font-semibold text-lg mb-4 flex items-center space-x-2">
                          <FaWalking className="text-green-500" />
                          <span>Movement Activity</span>
                        </h2>
                        <ResponsiveContainer width="67%" height={300}>
                          <LineChart data={dedupedVitalsData}>
                            <CartesianGrid stroke={theme === "dark" ? "#374151" : "#e5e7eb"} strokeDasharray="3 3" />
                            <XAxis 
                              dataKey="time" 
                              tickFormatter={formatTime} 
                              tick={{ fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 }} 
                            />
                            <YAxis 
                              domain={[0, 'dataMax + 5']} 
                              tick={{ fill: theme === "dark" ? "#9ca3af" : "#6b7280", fontSize: 11 }} 
                            />
                            <Tooltip 
                              labelFormatter={formatDateTime} 
                              formatter={(value) => [value, "Movement"]}
                              contentStyle={{ 
                                backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
                                border: `1px solid ${theme === "dark" ? "#374151" : "#e5e7eb"}`,
                                borderRadius: '8px',
                                fontSize: 12
                              }}
                            />
                            <Line type= "natural" dataKey="movement" stroke="#10b981" strokeWidth={2.5} dot={false} filter="url(#shadow)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )}
                </div>
              )}

              {!selectedPatient && (
                <div className={`${cardStyle} text-center py-12`}>
                  <FaUser className="mx-auto text-6xl opacity-20 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Patient Selected</h3>
                  <p className="opacity-75">Please select a patient from the dropdown above to view their vital signs.</p>
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

                  <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                    {messages.length > 0 ? (
                      messages.map((msg, i) => (
                        <div 
                          key={i} 
                          className={`flex ${msg.sender === 'doctor' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            msg.sender === 'doctor' 
                              ? 'bg-blue-600 text-white' 
                              : theme === "dark" ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            <p className="text-sm font-semibold mb-1">
                              {msg.sender === 'doctor' ? 'You (Doctor)' : 'Caregiver'}
                            </p>
                            <p>{msg.text}</p>
                            <p className="text-xs opacity-75 mt-1">
                              {formatDateTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 opacity-75">
                        <p>No messages yet. Start a conversation with the caregiver.</p>
                      </div>
                    )}
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
                        <option selected>Last 24 Hours</option>
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