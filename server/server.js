require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const seedInitialData = require('./utils/seed');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure public/uploads directory exists
const uploadsDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Connect to MongoDB
connectDB().then(() => {
  seedInitialData();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files and uploaded media
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/classes', require('./routes/classRoutes'));
app.use('/api/subjects', require('./routes/subjectRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/backup', require('./routes/backupRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[REGISTERLY] Server running on http://localhost:${PORT}`);
});
