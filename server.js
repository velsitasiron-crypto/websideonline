const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

const PORT = 3000;
const SECRET_KEY = 'rahasia_kelas_online_premium_2026';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// File upload configuration for general files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// ============ AVATAR UPLOAD CONFIGURATION ============
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads/avatars';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `avatar-${req.user.id}-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const avatarUpload = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Hanya file gambar yang diperbolehkan (JPG, PNG, GIF)'));
    }
  }
});

// Database initialization
let db = {
  users: [],
  attendances: [],
  assignments: [],
  schedules: [],
  announcements: [],
  discussions: [],
  grades: [],
  notifications: [],
  quizzes: [],
  quizResults: [],
  resources: [],
  points: [],
  badges: [],
  userBadges: [],
  certificates: [],
  parents: [],
  chatSupport: [],
  activeMeetings: []
};

// Load or init database
function loadDatabase() {
  if (fs.existsSync('./database.json')) {
    const data = fs.readFileSync('./database.json', 'utf8');
    db = JSON.parse(data);
    console.log('✅ Database loaded successfully');
  } else {
    console.log('📝 Creating new database with sample data...');
    
    // Create sample users
    db.users.push({
      id: 1,
      username: 'guru',
      email: 'guru@educlass.com',
      password: bcrypt.hashSync('guru123', 10),
      role: 'teacher',
      fullName: 'Budi Santoso, S.Pd',
      avatar: '/uploads/avatars/default-avatar-teacher.png',
      level: 5,
      totalPoints: 1250,
      createdAt: new Date().toISOString()
    });
    
    db.users.push({
      id: 2,
      username: 'siswa1',
      email: 'siswa1@educlass.com',
      password: bcrypt.hashSync('siswa123', 10),
      role: 'student',
      fullName: 'Ani Wijaya',
      avatar: '/uploads/avatars/default-avatar-student.png',
      level: 2,
      totalPoints: 450,
      createdAt: new Date().toISOString()
    });
    
    db.users.push({
      id: 3,
      username: 'siswa2',
      email: 'siswa2@educlass.com',
      password: bcrypt.hashSync('siswa123', 10),
      role: 'student',
      fullName: 'Bambang Prasetyo',
      avatar: '/uploads/avatars/default-avatar-student.png',
      level: 3,
      totalPoints: 680,
      createdAt: new Date().toISOString()
    });
    
    // Sample quizzes
    db.quizzes = [
      {
        id: 1,
        title: 'Quiz Matematika - Persamaan Linear',
        subject: 'Matematika',
        timeLimit: 30,
        questions: [
          {
            id: 1,
            text: 'Berapakah nilai x dari persamaan 2x + 5 = 15?',
            options: ['5', '10', '7', '8'],
            correct: 0
          },
          {
            id: 2,
            text: 'Jika 3x - 7 = 8, maka nilai x adalah...',
            options: ['3', '5', '7', '9'],
            correct: 1
          },
          {
            id: 3,
            text: 'Persamaan linear memiliki bentuk umum...',
            options: ['ax² + bx + c = 0', 'ax + b = 0', 'a^x = b', 'log x = y'],
            correct: 1
          }
        ],
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Quiz Bahasa Indonesia - Ejaan',
        subject: 'Bahasa Indonesia',
        timeLimit: 20,
        questions: [
          {
            id: 1,
            text: 'Kata baku yang benar adalah...',
            options: ['Aktip', 'Aktif', 'Aktip', 'Aktif'],
            correct: 1
          },
          {
            id: 2,
            text: 'Penulisan kata depan yang benar adalah...',
            options: ['Disekolah', 'Di sekolah', 'Di-sekolah', 'disekolah'],
            correct: 1
          }
        ],
        createdAt: new Date().toISOString()
      }
    ];
    
    // Sample resources
    db.resources = [
      {
        id: 1,
        title: 'Modul Matematika Bab 1',
        description: 'Materi persamaan linear lengkap dengan contoh soal',
        subject: 'Matematika',
        type: 'pdf',
        fileUrl: '/uploads/modul-matematika.pdf',
        downloads: 45,
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Video Tutorial Fisika',
        description: 'Penjelasan konsep gerak parabola',
        subject: 'Fisika',
        type: 'video',
        fileUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        downloads: 120,
        createdAt: new Date().toISOString()
      }
    ];
    
    // Sample badges
    db.badges = [
      { id: 1, name: 'Perfect Attendance', icon: 'fa-calendar-check', requirement: '100% kehadiran 1 bulan', points: 100 },
      { id: 2, name: 'Quiz Master', icon: 'fa-trophy', requirement: 'Nilai quiz 100', points: 150 },
      { id: 3, name: 'Assignment Hero', icon: 'fa-star', requirement: 'Kumpulkan 10 tugas', points: 200 },
      { id: 4, name: 'Discussion Leader', icon: 'fa-comments', requirement: 'Aktif di diskusi', points: 50 }
    ];
    
    db.schedules = [
      { 
        id: 1, 
        day: 'Senin', 
        subject: 'Matematika', 
        time: '08:00-09:30', 
        room: 'A101',
        teacher: 'Budi Santoso, S.Pd',
        meetingId: uuidv4(),
        isActive: false
      },
      { 
        id: 2, 
        day: 'Selasa', 
        subject: 'Bahasa Indonesia', 
        time: '10:00-11:30', 
        room: 'B202',
        teacher: 'Siti Aminah, M.Pd',
        meetingId: uuidv4(),
        isActive: false
      },
      { 
        id: 3, 
        day: 'Rabu', 
        subject: 'Fisika', 
        time: '13:00-14:30', 
        room: 'C303',
        teacher: 'Drs. Rahmat, M.Si',
        meetingId: uuidv4(),
        isActive: false
      },
      { 
        id: 4, 
        day: 'Kamis', 
        subject: 'Kimia', 
        time: '09:00-10:30', 
        room: 'D404',
        teacher: 'Dr. Dewi, M.Sc',
        meetingId: uuidv4(),
        isActive: false
      },
      { 
        id: 5, 
        day: 'Jumat', 
        subject: 'Biologi', 
        time: '11:00-12:30', 
        room: 'E505',
        teacher: 'Prof. Ahmad, Ph.D',
        meetingId: uuidv4(),
        isActive: false
      }
    ];
    
    db.announcements = [
      {
        id: 1,
        title: '🎉 Selamat Datang di Semester Baru!',
        content: 'Semester baru dimulai! Persiapkan diri kalian untuk belajar dengan giat. Jangan lupa cek jadwal dan tugas ya!',
        date: new Date().toISOString().split('T')[0],
        author: 'Admin',
        priority: 'high'
      }
    ];
    
    db.assignments = [
      { 
        id: 1, 
        title: 'Tugas Matematika - Persamaan Linear', 
        description: 'Kerjakan soal di halaman 10-15. Tulis dengan rapi di kertas kemudian upload dalam format PDF.', 
        deadline: '2026-05-20',
        maxScore: 100,
        submissions: [],
        createdAt: new Date().toISOString()
      },
      { 
        id: 2, 
        title: 'Essay Bahasa Indonesia', 
        description: 'Buat essay tentang pentingnya literasi di era digital. Minimal 500 kata.', 
        deadline: '2026-05-22',
        maxScore: 100,
        submissions: [],
        createdAt: new Date().toISOString()
      },
      { 
        id: 3, 
        title: 'Laporan Praktikum Fisika', 
        description: 'Buat laporan praktikum gerak parabola. Sertakan data percobaan dan analisis.', 
        deadline: '2026-05-25',
        maxScore: 100,
        submissions: [],
        createdAt: new Date().toISOString()
      }
    ];
    
    db.discussions = [
      {
        id: 1,
        topic: 'Diskusi Materi Matematika',
        messages: [
          { user: 'guru', message: 'Ada yang kurang paham tentang persamaan linear?', time: new Date().toLocaleString() }
        ],
        createdBy: 'guru',
        createdAt: new Date().toISOString()
      }
    ];
    
    saveDatabase();
    console.log('✅ Sample database created successfully');
  }
}

function saveDatabase() {
  fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

loadDatabase();

// Create default avatars directory if not exists
const defaultAvatarDir = './uploads/avatars';
if (!fs.existsSync(defaultAvatarDir)) {
  fs.mkdirSync(defaultAvatarDir, { recursive: true });
  console.log('📁 Created avatars directory');
}

// Meeting rooms for WebRTC signaling
const meetingRooms = new Map();

// Socket.io for WebRTC signaling and chat
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Join meeting room
  socket.on('join-meeting', ({ meetingId, user }) => {
    socket.join(`meeting-${meetingId}`);
    
    if (!meetingRooms.has(meetingId)) {
      meetingRooms.set(meetingId, {
        participants: [],
        messages: [],
        whiteboardData: []
      });
    }
    
    const room = meetingRooms.get(meetingId);
    const participant = {
      id: socket.id,
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      avatar: user.avatar,
      role: user.role,
      isMuted: false,
      isVideoOff: false,
      handRaised: false
    };
    
    room.participants.push(participant);
    
    // Notify others about new participant
    socket.to(`meeting-${meetingId}`).emit('user-joined', participant);
    
    // Send current participants to new user
    socket.emit('meeting-participants', room.participants);
    
    console.log(`👤 ${user.username} joined meeting ${meetingId}`);
  });
  
  // WebRTC signaling
  socket.on('offer', ({ meetingId, offer, to }) => {
    socket.to(to).emit('offer', { offer, from: socket.id });
  });
  
  socket.on('answer', ({ meetingId, answer, to }) => {
    socket.to(to).emit('answer', { answer, from: socket.id });
  });
  
  socket.on('ice-candidate', ({ meetingId, candidate, to }) => {
    socket.to(to).emit('ice-candidate', { candidate, from: socket.id });
  });
  
  // Toggle mute
  socket.on('toggle-mute', ({ meetingId, isMuted }) => {
    const room = meetingRooms.get(meetingId);
    if (room) {
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.isMuted = isMuted;
        socket.to(`meeting-${meetingId}`).emit('user-muted', { userId: socket.id, isMuted });
      }
    }
  });
  
  // Toggle video
  socket.on('toggle-video', ({ meetingId, isVideoOff }) => {
    const room = meetingRooms.get(meetingId);
    if (room) {
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.isVideoOff = isVideoOff;
        socket.to(`meeting-${meetingId}`).emit('user-video-toggled', { userId: socket.id, isVideoOff });
      }
    }
  });
  
  // Raise hand
  socket.on('raise-hand', ({ meetingId, isRaised }) => {
    const room = meetingRooms.get(meetingId);
    if (room) {
      const participant = room.participants.find(p => p.id === socket.id);
      if (participant) {
        participant.handRaised = isRaised;
        io.to(`meeting-${meetingId}`).emit('hand-raised', { userId: socket.id, username: participant.username, isRaised });
      }
    }
  });
  
  // Chat message in meeting
  socket.on('meeting-chat', ({ meetingId, message, user }) => {
    const chatMessage = {
      id: Date.now(),
      user: user,
      message: message,
      time: new Date().toLocaleTimeString()
    };
    
    const room = meetingRooms.get(meetingId);
    if (room) {
      room.messages.push(chatMessage);
      io.to(`meeting-${meetingId}`).emit('meeting-chat-message', chatMessage);
    }
  });
  
  // Whiteboard data
  socket.on('whiteboard-data', ({ meetingId, data }) => {
    socket.to(`meeting-${meetingId}`).emit('whiteboard-update', data);
  });
  
  // Screen sharing
  socket.on('start-screen-share', ({ meetingId, streamId }) => {
    socket.to(`meeting-${meetingId}`).emit('screen-share-started', { userId: socket.id, streamId });
  });
  
  socket.on('stop-screen-share', ({ meetingId }) => {
    socket.to(`meeting-${meetingId}`).emit('screen-share-stopped', { userId: socket.id });
  });
  
  // Leave meeting
  socket.on('leave-meeting', ({ meetingId }) => {
    const room = meetingRooms.get(meetingId);
    if (room) {
      const index = room.participants.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const participant = room.participants[index];
        room.participants.splice(index, 1);
        socket.to(`meeting-${meetingId}`).emit('user-left', { userId: socket.id, username: participant.username });
        
        // Delete room if empty
        if (room.participants.length === 0) {
          meetingRooms.delete(meetingId);
        }
      }
    }
    socket.leave(`meeting-${meetingId}`);
    console.log(`👋 User left meeting ${meetingId}`);
  });
  
  // Discussion chat
  socket.on('join-discussion', (discussionId) => {
    socket.join(`discussion-${discussionId}`);
  });
  
  socket.on('send-message', (data) => {
    const discussion = db.discussions.find(d => d.id == data.discussionId);
    if (discussion) {
      const newMessage = {
        user: data.user,
        message: data.message,
        time: new Date().toLocaleString()
      };
      discussion.messages.push(newMessage);
      saveDatabase();
      io.to(`discussion-${data.discussionId}`).emit('new-message', newMessage);
    }
  });
  
  socket.on('disconnect', () => {
    // Clean up - remove from all meetings
    for (const [meetingId, room] of meetingRooms) {
      const index = room.participants.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        const participant = room.participants[index];
        room.participants.splice(index, 1);
        io.to(`meeting-${meetingId}`).emit('user-left', { userId: socket.id, username: participant.username });
        
        if (room.participants.length === 0) {
          meetingRooms.delete(meetingId);
        }
      }
    }
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Authentication middleware
function verifyToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ============ API ROUTES ============

// Login Route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username);
  
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
  
  res.json({ token, role: user.role, user });
});

// Get user profile
app.get('/api/profile', verifyToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  res.json(user);
});

// Update profile
app.put('/api/profile', verifyToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (user) {
    user.fullName = req.body.fullName || user.fullName;
    user.email = req.body.email || user.email;
    if (req.body.password) {
      user.password = bcrypt.hashSync(req.body.password, 10);
    }
    saveDatabase();
    res.json({ message: 'Profil berhasil diperbarui' });
  } else {
    res.status(404).json({ error: 'User tidak ditemukan' });
  }
});

// ============ AVATAR UPLOAD ENDPOINT ============
app.post('/api/upload/avatar', verifyToken, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diupload' });
  }
  
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const user = db.users.find(u => u.id === req.user.id);
  
  if (user) {
    // Delete old avatar file if exists and not default
    if (user.avatar && !user.avatar.includes('default-avatar')) {
      const oldAvatarPath = path.join('.', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }
    user.avatar = avatarUrl;
    saveDatabase();
  }
  
  res.json({ 
    avatarUrl: avatarUrl,
    message: 'Avatar berhasil diupload'
  });
});

// Get schedules
app.get('/api/schedules', verifyToken, (req, res) => {
  res.json(db.schedules);
});

// Get meeting info
app.get('/api/meeting/:scheduleId', verifyToken, (req, res) => {
  const schedule = db.schedules.find(s => s.id == parseInt(req.params.scheduleId));
  if (!schedule) {
    return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
  }
  
  res.json({
    meetingId: schedule.meetingId,
    subject: schedule.subject,
    teacher: schedule.teacher,
    room: schedule.room,
    isActive: schedule.isActive
  });
});

// Start meeting (teacher only)
app.post('/api/meeting/:scheduleId/start', verifyToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Hanya guru yang dapat memulai meeting' });
  }
  
  const schedule = db.schedules.find(s => s.id == parseInt(req.params.scheduleId));
  if (!schedule) {
    return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
  }
  
  schedule.isActive = true;
  saveDatabase();
  
  res.json({ message: 'Meeting dimulai', meetingId: schedule.meetingId });
});

// End meeting (teacher only)
app.post('/api/meeting/:scheduleId/end', verifyToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Hanya guru yang dapat mengakhiri meeting' });
  }
  
  const schedule = db.schedules.find(s => s.id == parseInt(req.params.scheduleId));
  if (!schedule) {
    return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
  }
  
  schedule.isActive = false;
  saveDatabase();
  
  // Notify all participants to leave
  io.to(`meeting-${schedule.meetingId}`).emit('meeting-ended');
  
  res.json({ message: 'Meeting diakhiri' });
});

// Submit attendance
app.post('/api/attendance', verifyToken, (req, res) => {
  const { scheduleId, status, notes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  const existingIndex = db.attendances.findIndex(a => 
    a.userId === req.user.id && a.scheduleId === scheduleId && a.date === today
  );
  
  const attendanceData = {
    userId: req.user.id,
    userName: req.user.username,
    scheduleId,
    status,
    notes: notes || '',
    date: today,
    updatedAt: new Date().toISOString()
  };
  
  if (existingIndex !== -1) {
    db.attendances[existingIndex] = { ...db.attendances[existingIndex], ...attendanceData };
  } else {
    attendanceData.id = db.attendances.length + 1;
    attendanceData.createdAt = new Date().toISOString();
    db.attendances.push(attendanceData);
  }
  
  saveDatabase();
  res.json({ message: 'Absensi berhasil', status });
});

// Get attendances
app.get('/api/attendances', verifyToken, (req, res) => {
  let attendances = db.attendances;
  if (req.user.role === 'student') {
    attendances = attendances.filter(a => a.userId === req.user.id);
  }
  res.json(attendances);
});

// Get assignments
app.get('/api/assignments', verifyToken, (req, res) => {
  res.json(db.assignments);
});

// Create assignment
app.post('/api/assignments', verifyToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Hanya guru yang dapat membuat tugas' });
  }
  
  const newAssignment = {
    id: db.assignments.length + 1,
    title: req.body.title,
    description: req.body.description,
    deadline: req.body.deadline,
    maxScore: req.body.maxScore || 100,
    submissions: [],
    createdAt: new Date().toISOString()
  };
  
  db.assignments.push(newAssignment);
  saveDatabase();
  res.json(newAssignment);
});

// Submit assignment
app.post('/api/assignments/:id/submit', verifyToken, (req, res) => {
  const assignment = db.assignments.find(a => a.id == req.params.id);
  if (!assignment) {
    return res.status(404).json({ error: 'Tugas tidak ditemukan' });
  }
  
  const existingIndex = assignment.submissions.findIndex(s => s.userId === req.user.id);
  const submissionData = {
    userId: req.user.id,
    userName: req.user.username,
    fileUrl: req.body.fileUrl,
    notes: req.body.notes || '',
    submittedAt: new Date().toISOString()
  };
  
  if (existingIndex !== -1) {
    assignment.submissions[existingIndex] = { ...assignment.submissions[existingIndex], ...submissionData };
  } else {
    assignment.submissions.push(submissionData);
  }
  
  saveDatabase();
  res.json({ message: 'Tugas berhasil dikumpulkan' });
});

// Grade assignment
app.post('/api/assignments/:id/grade', verifyToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Hanya guru yang dapat memberi nilai' });
  }
  
  const assignment = db.assignments.find(a => a.id == req.params.id);
  if (!assignment) {
    return res.status(404).json({ error: 'Tugas tidak ditemukan' });
  }
  
  const submission = assignment.submissions.find(s => s.userId == req.body.userId);
  if (submission) {
    submission.grade = req.body.grade;
    submission.feedback = req.body.feedback;
    saveDatabase();
    res.json({ message: 'Nilai berhasil diberikan' });
  } else {
    res.status(404).json({ error: 'Submission tidak ditemukan' });
  }
});

// Get announcements
app.get('/api/announcements', verifyToken, (req, res) => {
  res.json(db.announcements);
});

// Create announcement
app.post('/api/announcements', verifyToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Hanya guru yang dapat membuat pengumuman' });
  }
  
  const newAnnouncement = {
    id: db.announcements.length + 1,
    title: req.body.title,
    content: req.body.content,
    date: new Date().toISOString().split('T')[0],
    author: req.user.username,
    priority: req.body.priority || 'normal'
  };
  
  db.announcements.push(newAnnouncement);
  saveDatabase();
  res.json(newAnnouncement);
});

// Get discussions
app.get('/api/discussions', verifyToken, (req, res) => {
  res.json(db.discussions);
});

// Create discussion
app.post('/api/discussions', verifyToken, (req, res) => {
  const newDiscussion = {
    id: db.discussions.length + 1,
    topic: req.body.topic,
    messages: [],
    createdBy: req.user.username,
    createdAt: new Date().toISOString()
  };
  db.discussions.push(newDiscussion);
  saveDatabase();
  res.json(newDiscussion);
});

// Get notifications
app.get('/api/notifications', verifyToken, (req, res) => {
  const userNotifications = db.notifications.filter(n => n.userId === req.user.id);
  res.json(userNotifications);
});

// Dashboard stats
app.get('/api/dashboard/stats', verifyToken, (req, res) => {
  if (req.user.role === 'teacher') {
    const stats = {
      totalStudents: db.users.filter(u => u.role === 'student').length,
      totalAssignments: db.assignments.length,
      totalSubmissions: db.assignments.reduce((sum, a) => sum + a.submissions.length, 0),
      averageAttendance: 85,
      totalQuizzes: db.quizzes.length,
      averageQuizScore: 75
    };
    res.json(stats);
  } else {
    const userSubmissions = db.assignments.reduce((sum, a) => 
      sum + (a.submissions.some(s => s.userId === req.user.id) ? 1 : 0), 0);
    const userQuizzes = db.quizResults.filter(q => q.userId === req.user.id);
    const avgQuizScore = userQuizzes.length > 0 
      ? userQuizzes.reduce((sum, q) => sum + q.score, 0) / userQuizzes.length 
      : 0;
    
    const stats = {
      totalAssignments: db.assignments.length,
      submittedAssignments: userSubmissions,
      attendanceRate: 88,
      pendingTasks: db.assignments.length - userSubmissions,
      completedQuizzes: userQuizzes.length,
      averageQuizScore: Math.round(avgQuizScore)
    };
    res.json(stats);
  }
});

// ============ NEW FEATURES API ROUTES ============

// Get user points and level
app.get('/api/user/points', verifyToken, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  const userPoints = db.points.filter(p => p.userId === req.user.id);
  const totalPoints = userPoints.reduce((sum, p) => sum + p.points, 0);
  
  // Update user level based on points
  let level = 1;
  if (totalPoints >= 5000) level = 10;
  else if (totalPoints >= 4000) level = 9;
  else if (totalPoints >= 3200) level = 8;
  else if (totalPoints >= 2500) level = 7;
  else if (totalPoints >= 1900) level = 6;
  else if (totalPoints >= 1400) level = 5;
  else if (totalPoints >= 1000) level = 4;
  else if (totalPoints >= 600) level = 3;
  else if (totalPoints >= 250) level = 2;
  else level = 1;
  
  if (user && user.level !== level) {
    user.level = level;
    saveDatabase();
  }
  
  res.json({
    totalPoints: totalPoints,
    level: level,
    nextLevelPoints: level * 500,
    recentPoints: userPoints.slice(-5)
  });
});

// Get badges
app.get('/api/badges', verifyToken, (req, res) => {
  const userBadges = db.userBadges?.filter(b => b.userId === req.user.id) || [];
  const allBadges = db.badges.map(badge => ({
    ...badge,
    earned: userBadges.some(ub => ub.badgeId === badge.id)
  }));
  res.json(allBadges);
});

// Get quizzes
app.get('/api/quizzes', verifyToken, (req, res) => {
  res.json(db.quizzes);
});

// Get single quiz
app.get('/api/quizzes/:id', verifyToken, (req, res) => {
  const quiz = db.quizzes.find(q => q.id == req.params.id);
  if (!quiz) {
    return res.status(404).json({ error: 'Quiz tidak ditemukan' });
  }
  res.json(quiz);
});

// Submit quiz
app.post('/api/quizzes/:id/submit', verifyToken, (req, res) => {
  const quiz = db.quizzes.find(q => q.id == req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz tidak ditemukan' });
  
  const { answers } = req.body;
  let score = 0;
  
  quiz.questions.forEach((question, index) => {
    if (answers[index] === question.correct) {
      score++;
    }
  });
  
  const percentage = (score / quiz.questions.length) * 100;
  
  // Check if already taken
  const existingResult = db.quizResults.find(qr => qr.userId === req.user.id && qr.quizId === quiz.id);
  if (!existingResult) {
    db.quizResults.push({
      id: db.quizResults.length + 1,
      userId: req.user.id,
      quizId: quiz.id,
      score: percentage,
      answers,
      completedAt: new Date().toISOString()
    });
    
    // Add points if score >= 70
    if (percentage >= 70) {
      const points = Math.floor(percentage * 2);
      db.points.push({
        id: db.points.length + 1,
        userId: req.user.id,
        points: points,
        reason: `Quiz: ${quiz.title} (${percentage}%)`,
        createdAt: new Date().toISOString()
      });
      
      // Check for Quiz Master badge
      if (percentage === 100) {
        const hasBadge = db.userBadges?.some(ub => ub.userId === req.user.id && ub.badgeId === 2);
        if (!hasBadge) {
          if (!db.userBadges) db.userBadges = [];
          db.userBadges.push({
            id: db.userBadges.length + 1,
            userId: req.user.id,
            badgeId: 2,
            earnedAt: new Date().toISOString()
          });
        }
      }
    }
    
    saveDatabase();
  }
  
  res.json({ score: percentage, message: 'Quiz selesai!', isNew: !existingResult });
});

// Get quiz results
app.get('/api/quiz/results', verifyToken, (req, res) => {
  const results = db.quizResults.filter(qr => qr.userId === req.user.id);
  res.json(results);
});

// Get resources
app.get('/api/resources', verifyToken, (req, res) => {
  res.json(db.resources);
});

// Create resource (teacher only)
app.post('/api/resources', verifyToken, (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Hanya guru yang dapat menambah materi' });
  }
  
  const newResource = {
    id: db.resources.length + 1,
    title: req.body.title,
    description: req.body.description,
    subject: req.body.subject,
    type: req.body.type,
    fileUrl: req.body.fileUrl,
    downloads: 0,
    createdAt: new Date().toISOString()
  };
  
  db.resources.push(newResource);
  saveDatabase();
  res.json(newResource);
});

// Download resource
app.post('/api/resources/:id/download', verifyToken, (req, res) => {
  const resource = db.resources.find(r => r.id == req.params.id);
  if (resource) {
    resource.downloads = (resource.downloads || 0) + 1;
    saveDatabase();
    res.json({ message: 'Download recorded', url: resource.fileUrl });
  } else {
    res.status(404).json({ error: 'Resource tidak ditemukan' });
  }
});

// Pomodoro timer - save session
app.post('/api/pomodoro/session', verifyToken, (req, res) => {
  const { duration, type } = req.body;
  const pointsEarned = type === 'study' ? 10 : 5;
  
  db.points.push({
    id: db.points.length + 1,
    userId: req.user.id,
    points: pointsEarned,
    reason: `Selesai sesi ${type === 'study' ? 'belajar' : 'istirahat'} selama ${duration} menit`,
    createdAt: new Date().toISOString()
  });
  
  saveDatabase();
  res.json({ message: 'Session saved', points: pointsEarned });
});

// Get leaderboard
app.get('/api/leaderboard', verifyToken, (req, res) => {
  const students = db.users.filter(u => u.role === 'student');
  const leaderboard = students.map(student => {
    const userPoints = db.points.filter(p => p.userId === student.id);
    const totalPoints = userPoints.reduce((sum, p) => sum + p.points, 0);
    return {
      id: student.id,
      name: student.fullName,
      username: student.username,
      avatar: student.avatar,
      level: student.level || 1,
      points: totalPoints
    };
  }).sort((a, b) => b.points - a.points).slice(0, 10);
  
  res.json(leaderboard);
});

// Generate certificate
app.post('/api/certificate/generate', verifyToken, (req, res) => {
  const { courseName, score } = req.body;
  const user = db.users.find(u => u.id === req.user.id);
  
  const certificate = {
    id: db.certificates.length + 1,
    userId: req.user.id,
    userName: user.fullName,
    courseName: courseName,
    score: score,
    certificateId: 'CERT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    issuedAt: new Date().toISOString()
  };
  
  db.certificates.push(certificate);
  saveDatabase();
  
  res.json(certificate);
});

// Get certificates
app.get('/api/certificates', verifyToken, (req, res) => {
  const userCertificates = db.certificates.filter(c => c.userId === req.user.id);
  res.json(userCertificates);
});

// Weekly activity chart data
app.get('/api/analytics/activity', verifyToken, (req, res) => {
  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  // Generate random activity data based on user's actual data
  const userSubmissions = db.assignments.reduce((sum, a) => 
    sum + (a.submissions.some(s => s.userId === req.user.id) ? 1 : 0), 0);
  const baseActivity = Math.min(100, Math.max(20, 40 + userSubmissions * 5));
  
  const activities = days.map(() => Math.floor(baseActivity + (Math.random() * 20) - 10));
  res.json({ days, activities });
});

// General file upload
app.post('/api/upload', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diupload' });
  }
  res.json({ 
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname
  });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Start server
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🚀 EduClass Premium Server Running!`);
  console.log(`${'='.repeat(50)}`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`\n📚 AKUN DEMO:`);
  console.log(`┌─────────────────────────────────────────────┐`);
  console.log(`│ 👨‍🏫 Guru    : guru    | guru123              │`);
  console.log(`│ 👩‍🎓 Siswa 1 : siswa1  | siswa123             │`);
  console.log(`│ 👨‍🎓 Siswa 2 : siswa2  | siswa123             │`);
  console.log(`└─────────────────────────────────────────────┘`);
  console.log(`\n✨ FITUR LENGKAP:`);
  console.log(`   📝 Quiz & Assessment System`);
  console.log(`   🎮 Gamification (Points, Levels & Badges)`);
  console.log(`   ⏱️ Pomodoro Timer`);
  console.log(`   📚 Resource Library`);
  console.log(`   📜 Digital Certificates`);
  console.log(`   📊 Learning Analytics`);
  console.log(`   🎥 Video Conference (WebRTC)`);
  console.log(`   💬 Real-time Chat & Discussion`);
  console.log(`   📋 Assignment Management`);
  console.log(`   ✅ Attendance System`);
  console.log(`   📢 Announcement System`);
  console.log(`   🖼️ Avatar Upload & Management`);
  console.log(`\n${'='.repeat(50)}\n`);
});