require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db } = require('./services/firebaseService');

// Routes
const patientsRoutes = require('./routes/patients');
const vitalsRoutes = require('./routes/vitals');
const alertsRoutes = require('./routes/alerts');
const messagesRoutes = require('./routes/messages'); // NEW

const { PORT = 5000, CORS_ORIGIN } = process.env;
const app = express();

const ragRoutes = require("./routes/rag");
app.use("/api/rag", ragRoutes);

app.use(bodyParser.json());
app.use(
  cors({
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',') : true,
    credentials: true,
  })
);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN ? CORS_ORIGIN.split(',') : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.locals.io = io;

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ ok: true, service: 'health-dashboard-backend' });
});

// API Routes
app.use('/api/v1/patients', patientsRoutes);
app.use('/api/v1/vitals', vitalsRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/messages', messagesRoutes); // NEW

// --- Socket.IO ---
io.on('connection', (socket) => {
  console.log('👍👍 Frontend connected:', socket.id);

  // Join/Leave patient-specific rooms
  socket.on('join-patient-room', (patientId) => {
    socket.join(patientId);
    console.log(`Socket ${socket.id} joined room ${patientId}`);
  });

  socket.on('leave-patient-room', (patientId) => {
    socket.leave(patientId);
    console.log(`Socket ${socket.id} left room ${patientId}`);
  });

  // Real-time messages
  socket.on('message', (msg) => {
    const { patientId } = msg;
    io.to(patientId).emit('message', msg);
    console.log('💬 Message sent to patient room:', patientId, msg);
  });

  socket.on('disconnect', () => {
    console.log('👎👎 Frontend disconnected:', socket.id);
  });
});

// --- Firebase listener for real-time vitals ---
db.ref('patients').on('child_changed', (snapshot) => {
  const patientId = snapshot.key;
  const val = snapshot.val();

  if (val && val.logs) {
    const keys = Object.keys(val.logs);
    const latestKey = keys[keys.length - 1];
    const latestData = val.logs[latestKey];

    // Emit to the specific patient room
    io.to(patientId).emit('new-vital', {
      patientId,
      time: latestKey,
      heartRate: latestData.heartRate,
      respiration: latestData.respirationRate,
      movement: latestData.movement ?? 0,
      deviceId: latestData.deviceId || null,
    });

    // Check for alert thresholds
    const { heartRate, respirationRate } = latestData;
    let severity = null;
    if (
      heartRate < 50 ||
      heartRate > 110 ||
      respirationRate < 9 ||
      respirationRate > 24
    )
      severity = 'red';
    else if (
      (heartRate >= 50 && heartRate < 60) ||
      (heartRate > 100 && heartRate <= 110) ||
      (respirationRate >= 9 && respirationRate < 12) ||
      (respirationRate > 20 && respirationRate <= 24)
    )
      severity = 'yellow';

    if (severity) {
      io.to(patientId).emit('alert', {
        patientId,
        heartRate,
        respirationRate,
        severity,
        createdAt: new Date().toISOString(),
      });
    }

    console.log(' Broadcast new vital for', patientId, latestData);
  }
});

// Start server
server.listen(PORT, () => {
  console.log(` Backend API + WebSocket running on http://localhost:${PORT}`);
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is alive' });
});
