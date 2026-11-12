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
connectDB().then(async () => {
  await seedInitialData();
  const { ensureSubjectsPerClass } = require('./routes/subjectRoutes');
  await ensureSubjectsPerClass();
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files and uploaded media
app.use('/uploads', express.static(uploadsDir));

// Serve dynamic PWA and Device Icons (for mobile homescreens, desktop PWAs, and favicons)
app.get(['/manifest-icon-192.png', '/manifest-icon-512.png', '/api/app-icon', '/favicon.ico'], async (req, res) => {
  try {
    const AppSettings = require('./models/AppSettings');
    const settings = await AppSettings.findOne();
    if (settings && settings.appLogo) {
      const logo = settings.appLogo.trim();
      if (logo.startsWith('/uploads/')) {
        const localPath = path.join(__dirname, '..', 'public', logo);
        if (fs.existsSync(localPath)) {
          res.setHeader('Cache-Control', 'public, max-age=60');
          return res.sendFile(localPath);
        }
      } else if (logo.startsWith('http://') || logo.startsWith('https://')) {
        return res.redirect(logo);
      }
    }
  } catch (err) {}
  res.sendFile(path.join(__dirname, '../public/icons/icon-192.png'));
});

// Dynamic Web App Manifest reflecting custom App Name & App Logo for devices
app.get('/manifest.json', async (req, res) => {
  try {
    const AppSettings = require('./models/AppSettings');
    const settings = await AppSettings.findOne();
    const manifestPath = path.join(__dirname, '../public/manifest.json');
    let manifestData = {};
    if (fs.existsSync(manifestPath)) {
      manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
    if (settings) {
      if (settings.appName) {
        manifestData.name = settings.appName;
        manifestData.short_name = settings.appName;
      }
      const iconUrl = settings.appLogo ? settings.appLogo : '/icons/icon-192.png';
      const iconExt = path.extname(iconUrl.split('?')[0]).toLowerCase();
      const mime = iconExt === '.png' ? 'image/png' : (iconExt === '.webp' ? 'image/webp' : (iconExt === '.svg' ? 'image/svg+xml' : 'image/jpeg'));
      manifestData.icons = [
        {
          src: iconUrl,
          sizes: "192x192",
          type: mime,
          purpose: "any"
        },
        {
          src: iconUrl,
          sizes: "512x512",
          type: mime,
          purpose: "any"
        },
        {
          src: iconUrl,
          sizes: "192x192",
          type: mime,
          purpose: "maskable"
        },
        {
          src: iconUrl,
          sizes: "512x512",
          type: mime,
          purpose: "maskable"
        }
      ];
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.json(manifestData);
  } catch (err) {
    res.sendFile(path.join(__dirname, '../public/manifest.json'));
  }
});

app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/classes', require('./routes/classRoutes'));
app.use('/api/subjects', require('./routes/subjectRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/teachers', require('./routes/teacherRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/backup', require('./routes/backupRoutes'));
app.use('/api/logs', require('./routes/logRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/timetable', require('./routes/timetableRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[REGISTERLY] Server running on http://localhost:${PORT}`);
});
