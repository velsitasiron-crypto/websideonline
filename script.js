const API_URL = 'http://localhost:3000';
let token = null;
let currentUser = null;
let socket = null;
let currentDiscussionId = null;
let assignmentsChart = null;
let attendanceChart = null;

// Initialize on page load
if (window.location.pathname.includes('dashboard.html')) {
    token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
    } else {
        initDashboard();
    }
}

async function initDashboard() {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUser = payload;
        
        // Initialize socket
        socket = io(API_URL);
        
        // Load user data
        await loadUserProfile();
        
        // Load all dashboard data
        await Promise.all([
            loadDashboardStats(),
            loadSchedules(),
            loadAttendances(),
            loadAssignments(),
            loadAnnouncements(),
            loadDiscussions(),
            loadNotifications(),
            loadGrades()
        ]);
        
        // Setup event listeners
        setupEventListeners();
        
        // Initialize charts
        initAttendanceChart();
        
        // Start real-time updates
        setupRealtimeUpdates();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/api/profile`, {
            headers: { 'Authorization': token }
        });
        const user = await response.json();
        
        // Update UI with user data
        document.getElementById('sidebarAvatar').src = user.avatar;
        document.getElementById('sidebarName').innerText = user.fullName;
        document.getElementById('sidebarRole').innerText = user.role === 'teacher' ? 'Guru' : 'Siswa';
        document.getElementById('topBarAvatar').src = user.avatar;
        document.getElementById('topBarName').innerText = user.fullName;
        document.getElementById('welcomeName').innerText = user.fullName.split(' ')[0];
        
        // Show/hide teacher-specific elements
        if (user.role === 'teacher') {
            document.getElementById('showCreateAssignmentBtn').style.display = 'block';
            document.getElementById('createAnnouncementBtn').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/api/dashboard/stats`, {
            headers: { 'Authorization': token }
        });
        const stats = await response.json();
        
        const statsGrid = document.getElementById('statsGrid');
        if (currentUser.role === 'teacher') {
            statsGrid.innerHTML = `
                <div class="stat-card animate-slide-up" style="animation-delay:0s">
                    <div class="stat-icon"><i class="fas fa-users"></i></div>
                    <div class="stat-info">
                        <h3>${stats.totalStudents}</h3>
                        <p>Total Siswa</p>
                    </div>
                </div>
                <div class="stat-card animate-slide-up" style="animation-delay:0.1s">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <h3>${stats.totalAssignments}</h3>
                        <p>Total Tugas</p>
                    </div>
                </div>
                <div class="stat-card animate-slide-up" style="animation-delay:0.2s">
                    <div class="stat-icon"><i class="fas fa-upload"></i></div>
                    <div class="stat-info">
                        <h3>${stats.totalSubmissions}</h3>
                        <p>Pengumpulan Tugas</p>
                    </div>
                </div>
                <div class="stat-card animate-slide-up" style="animation-delay:0.3s">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <h3>${stats.averageAttendance}%</h3>
                        <p>Rata-rata Absensi</p>
                    </div>
                </div>
            `;
        } else {
            statsGrid.innerHTML = `
                <div class="stat-card animate-slide-up" style="animation-delay:0s">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <h3>${stats.totalAssignments}</h3>
                        <p>Total Tugas</p>
                    </div>
                </div>
                <div class="stat-card animate-slide-up" style="animation-delay:0.1s">
                    <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                    <div class="stat-info">
                        <h3>${stats.submittedAssignments}</h3>
                        <p>Tugas Dikumpulkan</p>
                    </div>
                </div>
                <div class="stat-card animate-slide-up" style="animation-delay:0.2s">
                    <div class="stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="stat-info">
                        <h3>${stats.pendingTasks}</h3>
                        <p>Tugas Belum</p>
                    </div>
                </div>
                <div class="stat-card animate-slide-up" style="animation-delay:0.3s">
                    <div class="stat-icon"><i class="fas fa-percent"></i></div>
                    <div class="stat-info">
                        <h3>${stats.attendanceRate}%</h3>
                        <p>Kehadiran</p>
                    </div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============ UPDATED SCHEDULES FUNCTION WITH JOIN MEETING ============
async function loadSchedules() {
    try {
        const response = await fetch(`${API_URL}/api/schedules`, {
            headers: { 'Authorization': token }
        });
        const schedules = await response.json();
        
        const container = document.getElementById('scheduleContainer');
        if (!container) return;
        
        container.innerHTML = schedules.map(schedule => `
            <div class="schedule-card animate-fade-in">
                <div class="schedule-card-header">
                    <i class="fas fa-book-open" style="font-size: 24px; color: var(--primary-color);"></i>
                    <h3>${schedule.subject}</h3>
                </div>
                <div class="schedule-info">
                    <p><i class="fas fa-calendar"></i> ${schedule.day}</p>
                    <p><i class="fas fa-clock"></i> ${schedule.time}</p>
                    <p><i class="fas fa-door-open"></i> Ruang ${schedule.room}</p>
                    <p><i class="fas fa-chalkboard-user"></i> ${schedule.teacher}</p>
                </div>
                ${schedule.isActive ? 
                    `<span class="meeting-active-badge"><i class="fas fa-circle"></i> Meeting Active</span>` : 
                    `<span class="meeting-inactive-badge"><i class="fas fa-clock"></i> Belum Dimulai</span>`
                }
                <button onclick="joinMeeting(${schedule.id})" class="btn-primary meeting-btn">
                    <i class="fas fa-video"></i> Join Meeting
                </button>
            </div>
        `).join('');
        
        // Update upcoming meetings for video conference tab
        const upcomingMeetings = document.getElementById('upcomingMeetings');
        if (upcomingMeetings) {
            const today = new Date();
            const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
            const todayName = dayNames[today.getDay()];
            const todayMeetings = schedules.filter(s => s.day === todayName);
            
            if (todayMeetings.length > 0) {
                upcomingMeetings.innerHTML = todayMeetings.map(m => `
                    <div class="schedule-card" style="margin-bottom: 15px;">
                        <h4>${m.subject}</h4>
                        <p>${m.time} - Ruang ${m.room}</p>
                        <p>Guru: ${m.teacher}</p>
                        <button onclick="joinMeeting(${m.id})" class="btn-primary" style="margin-top: 10px; width: 100%;">
                            <i class="fas fa-video"></i> Join Now
                        </button>
                    </div>
                `).join('');
            } else {
                upcomingMeetings.innerHTML = '<p style="text-align: center; padding: 20px;">Tidak ada meeting hari ini</p>';
            }
        }
        
    } catch (error) {
        console.error('Error loading schedules:', error);
    }
}

// ============ NEW JOIN MEETING FUNCTION (INTERNAL VIDEO CONFERENCE) ============
window.joinMeeting = async (scheduleId) => {
    try {
        // Tampilkan loading notification
        showNotification('Membuka ruang meeting...', 'info');
        
        // Get meeting info from server
        const response = await fetch(`${API_URL}/api/meeting/${scheduleId}`, {
            headers: { 'Authorization': token }
        });
        
        if (!response.ok) {
            throw new Error('Gagal mendapatkan info meeting');
        }
        
        const meeting = await response.json();
        
        // Jika user adalah guru, start meeting terlebih dahulu
        if (currentUser && currentUser.role === 'teacher') {
            try {
                await fetch(`${API_URL}/api/meeting/${scheduleId}/start`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token
                    }
                });
                showNotification('Meeting dimulai! Mengarahkan...', 'success');
            } catch (err) {
                console.log('Meeting mungkin sudah dimulai atau guru sudah bergabung');
            }
        }
        
        // Redirect ke halaman meeting
        setTimeout(() => {
            window.location.href = `meeting.html?scheduleId=${scheduleId}&meetingId=${meeting.meetingId}`;
        }, 500);
        
    } catch (error) {
        console.error('Error joining meeting:', error);
        showNotification('Gagal membuka meeting: ' + error.message, 'error');
    }
};

// ============ TEACHER MEETING CONTROLS ============
window.startMeetingAsTeacher = async (scheduleId) => {
    try {
        const response = await fetch(`${API_URL}/api/meeting/${scheduleId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            }
        });
        
        if (response.ok) {
            showNotification('Meeting berhasil dimulai!', 'success');
            loadSchedules(); // Refresh untuk update badge
        } else {
            const data = await response.json();
            showNotification(data.error || 'Gagal memulai meeting', 'error');
        }
    } catch (error) {
        console.error('Error starting meeting:', error);
        showNotification('Gagal memulai meeting', 'error');
    }
};

window.endMeetingAsTeacher = async (scheduleId) => {
    if (confirm('Apakah Anda yakin ingin mengakhiri meeting?')) {
        try {
            const response = await fetch(`${API_URL}/api/meeting/${scheduleId}/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                }
            });
            
            if (response.ok) {
                showNotification('Meeting diakhiri', 'success');
                loadSchedules();
            }
        } catch (error) {
            console.error('Error ending meeting:', error);
            showNotification('Gagal mengakhiri meeting', 'error');
        }
    }
};

async function loadAttendances() {
    try {
        const schedulesRes = await fetch(`${API_URL}/api/schedules`, {
            headers: { 'Authorization': token }
        });
        const schedules = await schedulesRes.json();
        
        const attendRes = await fetch(`${API_URL}/api/attendances`, {
            headers: { 'Authorization': token }
        });
        let attendances = await attendRes.json();
        
        if (currentUser.role === 'student') {
            attendances = attendances.filter(a => a.userId === currentUser.id);
        }
        
        const container = document.getElementById('attendanceList');
        const today = new Date().toISOString().split('T')[0];
        
        container.innerHTML = schedules.map(schedule => {
            const todayAtt = attendances.find(a => 
                a.scheduleId === schedule.id && a.date === today
            );
            const status = todayAtt ? todayAtt.status : 'Belum';
            
            return `
                <div class="attendance-item animate-fade-in">
                    <div>
                        <h4>${schedule.subject}</h4>
                        <p>${schedule.day} - ${schedule.time}</p>
                    </div>
                    <div>
                        <span class="status-badge status-${status.toLowerCase()}">${status}</span>
                        ${currentUser.role === 'student' ? `
                            <div class="attendance-buttons">
                                <button onclick="submitAttendance(${schedule.id}, 'Hadir')" class="attn-btn hadir">Hadir</button>
                                <button onclick="submitAttendance(${schedule.id}, 'Izin')" class="attn-btn izin">Izin</button>
                                <button onclick="submitAttendance(${schedule.id}, 'Sakit')" class="attn-btn sakit">Sakit</button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Update attendance chart if exists
        if (attendanceChart && currentUser.role === 'teacher') {
            updateAttendanceChart(attendances, schedules);
        }
        
    } catch (error) {
        console.error('Error loading attendances:', error);
    }
}

async function loadAssignments() {
    try {
        const response = await fetch(`${API_URL}/api/assignments`, {
            headers: { 'Authorization': token }
        });
        const assignments = await response.json();
        
        const container = document.getElementById('assignmentList');
        const now = new Date();
        
        container.innerHTML = assignments.map(assignment => {
            const deadline = new Date(assignment.deadline);
            const isOverdue = deadline < now;
            const userSubmission = assignment.submissions.find(s => s.userId === currentUser?.id);
            const isSubmitted = !!userSubmission;
            
            return `
                <div class="assignment-card animate-fade-in">
                    <div class="assignment-header">
                        <div class="assignment-title">${assignment.title}</div>
                        <div class="assignment-deadline ${isOverdue && !isSubmitted ? 'overdue' : ''}">
                            <i class="fas fa-calendar-alt"></i> Deadline: ${assignment.deadline}
                            ${isOverdue && !isSubmitted ? '<span class="badge-danger">Terlambat!</span>' : ''}
                        </div>
                    </div>
                    <div class="assignment-desc">${assignment.description}</div>
                    <div class="assignment-meta">
                        <span><i class="fas fa-star"></i> Max Score: ${assignment.maxScore}</span>
                        ${isSubmitted ? `<span><i class="fas fa-check-circle" style="color:#10b981"></i> Submitted: ${new Date(userSubmission.submittedAt).toLocaleDateString()}</span>` : ''}
                        ${userSubmission?.grade ? `<span><i class="fas fa-trophy"></i> Grade: ${userSubmission.grade}/${assignment.maxScore}</span>` : ''}
                    </div>
                    <div class="assignment-actions">
                        ${currentUser.role === 'student' && !isSubmitted ? `
                            <button onclick="showSubmitModal(${assignment.id})" class="btn-primary btn-sm">
                                <i class="fas fa-upload"></i> Kumpulkan Tugas
                            </button>
                        ` : currentUser.role === 'student' && isSubmitted ? `
                            <button class="btn-secondary btn-sm" disabled>
                                <i class="fas fa-check"></i> Sudah Dikumpulkan
                            </button>
                        ` : ''}
                        ${currentUser.role === 'teacher' ? `
                            <button onclick="viewSubmissions(${assignment.id})" class="btn-secondary btn-sm">
                                <i class="fas fa-users"></i> Lihat Pengumpulan (${assignment.submissions.length})
                            </button>
                            <button onclick="gradeAssignment(${assignment.id})" class="btn-primary btn-sm">
                                <i class="fas fa-star"></i> Beri Nilai
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        // Update upcoming tasks in dashboard
        const upcomingTasks = assignments
            .filter(a => !a.submissions.some(s => s.userId === currentUser?.id))
            .slice(0, 5);
        
        const tasksContainer = document.getElementById('upcomingTasks');
        if (tasksContainer && currentUser.role === 'student') {
            tasksContainer.innerHTML = upcomingTasks.map(task => `
                <div class="task-item">
                    <strong>${task.title}</strong>
                    <p>Deadline: ${task.deadline}</p>
                    <button onclick="showSubmitModal(${task.id})" class="btn-primary btn-sm">Kumpulkan</button>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading assignments:', error);
    }
}

async function loadAnnouncements() {
    try {
        const response = await fetch(`${API_URL}/api/announcements`, {
            headers: { 'Authorization': token }
        });
        const announcements = await response.json();
        
        const container = document.getElementById('announcementsList');
        container.innerHTML = announcements.map(ann => `
            <div class="assignment-card animate-fade-in">
                <div class="assignment-header">
                    <div class="assignment-title">
                        <i class="fas fa-bullhorn" style="color: var(--primary-color)"></i> ${ann.title}
                    </div>
                    <div class="assignment-deadline">${ann.date}</div>
                </div>
                <div class="assignment-desc">${ann.content}</div>
                <div class="assignment-meta">
                    <span><i class="fas fa-user"></i> Oleh: ${ann.author}</span>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading announcements:', error);
    }
}

async function loadDiscussions() {
    try {
        const response = await fetch(`${API_URL}/api/discussions`, {
            headers: { 'Authorization': token }
        });
        const discussions = await response.json();
        
        const container = document.getElementById('discussionList');
        container.innerHTML = discussions.map(disc => `
            <div class="discussion-topic" onclick="loadDiscussionChat(${disc.id})">
                <strong>${disc.topic}</strong>
                <small>${disc.messages.length} pesan</small>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading discussions:', error);
    }
}

async function loadNotifications() {
    try {
        const response = await fetch(`${API_URL}/api/notifications`, {
            headers: { 'Authorization': token }
        });
        const notifications = await response.json();
        
        const unreadCount = notifications.filter(n => !n.read).length;
        document.getElementById('notificationCount').innerText = unreadCount;
        
        const container = document.getElementById('notificationsList');
        container.innerHTML = notifications.slice(0, 10).map(notif => `
            <div class="notification-item ${!notif.read ? 'unread' : ''}" data-id="${notif.id}">
                <p>${notif.message}</p>
                <small>${new Date(notif.createdAt).toLocaleString()}</small>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

async function loadGrades() {
    if (currentUser.role !== 'student') return;
    
    try {
        const response = await fetch(`${API_URL}/api/assignments`, {
            headers: { 'Authorization': token }
        });
        const assignments = await response.json();
        
        const myGrades = assignments
            .map(a => {
                const submission = a.submissions.find(s => s.userId === currentUser.id);
                return submission?.grade ? {
                    title: a.title,
                    grade: submission.grade,
                    maxScore: a.maxScore,
                    percentage: (submission.grade / a.maxScore) * 100
                } : null;
            })
            .filter(g => g !== null);
        
        const avgGrade = myGrades.length > 0 
            ? (myGrades.reduce((sum, g) => sum + g.percentage, 0) / myGrades.length).toFixed(1)
            : 0;
        
        const container = document.getElementById('gradesContent');
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="stat-info">
                        <h3>${avgGrade}%</h3>
                        <p>Rata-rata Nilai</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                    <div class="stat-info">
                        <h3>${myGrades.length}</h3>
                        <p>Tugas Dinilai</p>
                    </div>
                </div>
            </div>
            <div class="assignment-list">
                ${myGrades.map(grade => `
                    <div class="assignment-card">
                        <div class="assignment-header">
                            <div class="assignment-title">${grade.title}</div>
                            <div class="assignment-deadline">Grade: ${grade.grade}/${grade.maxScore}</div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${grade.percentage}%"></div>
                        </div>
                        <p>Nilai: ${grade.percentage}%</p>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

// Real-time functions
function setupRealtimeUpdates() {
    if (!socket) return;
    
    socket.on('new-message', (message) => {
        if (currentDiscussionId) {
            addMessageToChat(message);
        }
    });
    
    // Refresh data periodically
    setInterval(() => {
        loadNotifications();
        if (document.querySelector('[data-tab="attendance"].active')) {
            loadAttendances();
        }
    }, 30000);
}

function loadDiscussionChat(discussionId) {
    currentDiscussionId = discussionId;
    socket.emit('join-discussion', discussionId);
    
    fetch(`${API_URL}/api/discussions`, {
        headers: { 'Authorization': token }
    })
    .then(res => res.json())
    .then(discussions => {
        const discussion = discussions.find(d => d.id === discussionId);
        if (discussion) {
            document.getElementById('chatHeader').innerHTML = discussion.topic;
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.innerHTML = discussion.messages.map(msg => `
                <div class="chat-message">
                    <div class="chat-message-user">${msg.user}</div>
                    <div class="chat-message-text">${msg.message}</div>
                    <div class="chat-message-time">${msg.time}</div>
                </div>
            `).join('');
            
            document.getElementById('chatInput').style.display = 'flex';
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });
}

function addMessageToChat(message) {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML += `
        <div class="chat-message">
            <div class="chat-message-user">${message.user}</div>
            <div class="chat-message-text">${message.message}</div>
            <div class="chat-message-time">${message.time}</div>
        </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Action functions
window.submitAttendance = async (scheduleId, status) => {
    try {
        const response = await fetch(`${API_URL}/api/attendance`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': token 
            },
            body: JSON.stringify({ scheduleId, status })
        });
        
        if (response.ok) {
            showNotification('Absensi berhasil!', 'success');
            loadAttendances();
        }
    } catch (error) {
        showNotification('Gagal melakukan absensi', 'error');
    }
};

// Modal functions
let currentAssignmentId = null;

window.showSubmitModal = (assignmentId) => {
    currentAssignmentId = assignmentId;
    document.getElementById('submitModal').style.display = 'block';
};

document.getElementById('confirmSubmit')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('assignmentFile');
    const notes = document.getElementById('submissionNotes').value;
    
    if (!fileInput.files[0]) {
        showNotification('Pilih file terlebih dahulu!', 'error');
        return;
    }
    
    // Upload file
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    try {
        const uploadRes = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': token },
            body: formData
        });
        
        const uploadData = await uploadRes.json();
        
        const submitRes = await fetch(`${API_URL}/api/assignments/${currentAssignmentId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ 
                fileUrl: uploadData.fileUrl,
                notes: notes 
            })
        });
        
        if (submitRes.ok) {
            showNotification('Tugas berhasil dikumpulkan!', 'success');
            document.getElementById('submitModal').style.display = 'none';
            document.getElementById('submissionNotes').value = '';
            fileInput.value = '';
            loadAssignments();
        }
    } catch (error) {
        showNotification('Gagal mengumpulkan tugas', 'error');
    }
});

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-item[data-tab]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            
            // Update active states
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
    
    // Profile button
    document.getElementById('profileBtn')?.addEventListener('click', () => {
        window.location.href = 'profile.html';
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
    });
    
    // Create assignment button
    document.getElementById('showCreateAssignmentBtn')?.addEventListener('click', () => {
        document.getElementById('assignmentModal').style.display = 'block';
    });
    
    document.getElementById('confirmCreateAssignment')?.addEventListener('click', async () => {
        const title = document.getElementById('newTitle').value;
        const description = document.getElementById('newDesc').value;
        const deadline = document.getElementById('newDeadline').value;
        const maxScore = document.getElementById('newMaxScore').value;
        
        if (!title || !description || !deadline) {
            showNotification('Lengkapi semua field!', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/assignments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ title, description, deadline, maxScore: parseInt(maxScore) })
        });
        
        if (response.ok) {
            showNotification('Tugas berhasil dibuat!', 'success');
            document.getElementById('assignmentModal').style.display = 'none';
            document.getElementById('newTitle').value = '';
            document.getElementById('newDesc').value = '';
            document.getElementById('newDeadline').value = '';
            loadAssignments();
        }
    });
    
    // Create announcement button
    document.getElementById('createAnnouncementBtn')?.addEventListener('click', () => {
        document.getElementById('announcementModal').style.display = 'block';
    });
    
    document.getElementById('confirmCreateAnnouncement')?.addEventListener('click', async () => {
        const title = document.getElementById('announcementTitle').value;
        const content = document.getElementById('announcementContent').value;
        
        if (!title || !content) {
            showNotification('Lengkapi semua field!', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/announcements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ title, content })
        });
        
        if (response.ok) {
            showNotification('Pengumuman berhasil dipublikasikan!', 'success');
            document.getElementById('announcementModal').style.display = 'none';
            document.getElementById('announcementTitle').value = '';
            document.getElementById('announcementContent').value = '';
            loadAnnouncements();
        }
    });
    
    // New discussion button
    document.getElementById('newDiscussionBtn')?.addEventListener('click', () => {
        document.getElementById('discussionModal').style.display = 'block';
    });
    
    document.getElementById('confirmCreateDiscussion')?.addEventListener('click', async () => {
        const topic = document.getElementById('discussionTopic').value;
        
        if (!topic) {
            showNotification('Masukkan judul topik diskusi!', 'error');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/discussions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify({ topic })
        });
        
        if (response.ok) {
            showNotification('Topik diskusi berhasil dibuat!', 'success');
            document.getElementById('discussionModal').style.display = 'none';
            document.getElementById('discussionTopic').value = '';
            loadDiscussions();
        }
    });
    
    // Close modals
    document.querySelectorAll('.close, .btn-secondary').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // Send message in chat
    document.getElementById('sendMessageBtn')?.addEventListener('click', () => {
        const message = document.getElementById('messageInput').value;
        if (message && currentDiscussionId) {
            socket.emit('send-message', {
                discussionId: currentDiscussionId,
                user: currentUser.username,
                message: message
            });
            document.getElementById('messageInput').value = '';
        }
    });
    
    // File upload area click
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.addEventListener('click', () => {
            document.getElementById('assignmentFile').click();
        });
        
        document.getElementById('assignmentFile')?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                fileUploadArea.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    <p>${e.target.files[0].name}</p>
                `;
            }
        });
    }
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const scheduleCards = document.querySelectorAll('.schedule-card');
            
            scheduleCards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
}

// Chart initialization
function initAttendanceChart() {
    const ctx = document.getElementById('attendanceChart')?.getContext('2d');
    if (ctx && currentUser.role === 'teacher') {
        attendanceChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Hadir', 'Izin', 'Sakit', 'Alpha'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
}

async function updateAttendanceChart(attendances, schedules) {
    if (!attendanceChart) return;
    
    const totalSchedules = schedules.length;
    const hadir = attendances.filter(a => a.status === 'Hadir').length;
    const izin = attendances.filter(a => a.status === 'Izin').length;
    const sakit = attendances.filter(a => a.status === 'Sakit').length;
    const alpha = totalSchedules - (hadir + izin + sakit);
    
    attendanceChart.data.datasets[0].data = [hadir, izin, sakit, alpha];
    attendanceChart.update();
}

// Notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast-notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add meeting badge styles
const meetingBadgeStyle = document.createElement('style');
meetingBadgeStyle.textContent = `
    .schedule-card-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 15px;
    }
    
    .meeting-active-badge {
        display: inline-block;
        background: #10b98120;
        color: #10b981;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        margin: 10px 0;
    }
    
    .meeting-active-badge i {
        font-size: 8px;
        margin-right: 5px;
        animation: pulse 1s infinite;
    }
    
    .meeting-inactive-badge {
        display: inline-block;
        background: #6b728020;
        color: #6b7280;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        margin: 10px 0;
    }
    
    .meeting-btn {
        width: 100%;
        margin-top: 10px;
        transition: all 0.3s;
    }
    
    .meeting-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(79, 70, 229, 0.3);
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(meetingBadgeStyle);

// Add to CSS
const style = document.createElement('style');
style.textContent = `
    .toast-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
    }
    
    .toast-notification.success { background: #10b981; }
    .toast-notification.error { background: #ef4444; }
    .toast-notification.info { background: #3b82f6; }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .status-badge {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
    }
    
    .status-hadir { background: #10b98120; color: #10b981; }
    .status-izin { background: #f59e0b20; color: #f59e0b; }
    .status-sakit { background: #ef444420; color: #ef4444; }
    .status-belum { background: #6b728020; color: #6b7280; }
    
    .progress-bar {
        width: 100%;
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin: 10px 0;
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
        transition: width 0.3s ease;
    }
    
    .assignment-meta {
        display: flex;
        gap: 20px;
        margin-top: 10px;
        font-size: 12px;
        color: var(--gray-color);
    }
`;
document.head.appendChild(style);