const API_URL = 'http://localhost:3000';
let token = localStorage.getItem('token');
let socket = null;
let currentUser = null;
let currentMeeting = null;
let localStream = null;
let isMuted = false;
let isVideoOff = false;
let currentDiscussionId = null;

// Check authentication
if (!token) {
    window.location.href = 'index.html';
}

// Get meeting info from URL params
const urlParams = new URLSearchParams(window.location.search);
const scheduleId = urlParams.get('scheduleId');
const meetingId = urlParams.get('meetingId');

if (!scheduleId || !meetingId) {
    alert('Invalid meeting link');
    window.location.href = 'dashboard.html';
}

// Update loading status
function updateLoadingStatus(message) {
    const statusEl = document.getElementById('loadingStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
    console.log('Loading status:', message);
}

// Show error and redirect
function showErrorAndRedirect(message) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 16px;"></i>
                <p>${message}</p>
                <button class="return-btn" onclick="window.location.href='dashboard.html'">
                    <i class="fas fa-arrow-left"></i> Kembali ke Dashboard
                </button>
            </div>
        `;
    }
}

// Initialize meeting
async function initMeeting() {
    try {
        updateLoadingStatus('Mendapatkan info user...');
        
        // Get user info from token
        const payload = JSON.parse(atob(token.split('.')[1]));
        currentUser = {
            id: payload.id,
            username: payload.username,
            fullName: payload.fullName || payload.username,
            role: payload.role
        };
        
        console.log('Current user:', currentUser);
        updateLoadingStatus(`Halo ${currentUser.fullName}, menyiapkan meeting...`);
        
        // Get meeting details
        updateLoadingStatus('Mendapatkan info meeting...');
        const meetingRes = await fetch(`${API_URL}/api/meeting/${scheduleId}`, {
            headers: { 'Authorization': token }
        });
        
        if (!meetingRes.ok) {
            throw new Error('Gagal mendapatkan info meeting');
        }
        
        currentMeeting = await meetingRes.json();
        console.log('Meeting info:', currentMeeting);
        
        // Connect to socket
        updateLoadingStatus('Menghubungkan ke server...');
        socket = io(API_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5
        });
        
        socket.on('connect', () => {
            console.log('Socket connected!');
            updateLoadingStatus('Terhubung ke server, bergabung ke meeting...');
            
            // Join meeting room
            socket.emit('join-meeting', {
                meetingId: currentMeeting.meetingId,
                user: currentUser
            });
        });
        
        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            updateLoadingStatus('Gagal terhubung ke server...');
        });
        
        // Socket event handlers
        setupSocketHandlers();
        
        // Get user media (camera & microphone)
        updateLoadingStatus('Meminta akses kamera dan mikrofon...');
        await getMediaStream();
        
        // Hide loading overlay after everything is ready
        setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
            updateLoadingStatus('Siap!');
        }, 1000);
        
    } catch (error) {
        console.error('Error initializing meeting:', error);
        showErrorAndRedirect('Gagal masuk meeting: ' + error.message);
    }
}

async function getMediaStream() {
    try {
        // Try to get both video and audio
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
            console.log('Local video stream attached');
        }
        
        // Set initial mute state
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !isMuted;
        }
        
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !isVideoOff;
        }
        
        updateLoadingStatus('Kamera dan mikrofon siap');
        
    } catch (error) {
        console.error('Error getting media stream:', error);
        
        // Try audio only
        try {
            updateLoadingStatus('Mencoba mode audio saja...');
            localStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo && localStream) {
                localVideo.srcObject = localStream;
            }
            
            // Show video off indicator
            isVideoOff = true;
            const videoBtn = document.getElementById('toggleVideoBtn');
            if (videoBtn) {
                videoBtn.innerHTML = '<i class="fas fa-video-slash"></i><span>Video</span>';
                videoBtn.classList.add('danger');
            }
            
            updateLoadingStatus('Mode audio saja aktif');
            
        } catch (audioError) {
            console.error('Even audio failed:', audioError);
            updateLoadingStatus('Tidak dapat mengakses kamera/mikrofon');
            // Still continue without media
        }
    }
}

function setupSocketHandlers() {
    // User joined
    socket.on('user-joined', (participant) => {
        console.log('User joined:', participant);
        addParticipantToList(participant);
        showNotification(`${participant.fullName || participant.username} bergabung`, 'info');
    });
    
    // Meeting participants list
    socket.on('meeting-participants', (participants) => {
        console.log('Participants list:', participants);
        participants.forEach(participant => {
            if (participant.id !== socket.id) {
                addParticipantToList(participant);
            }
        });
        updateParticipantsList(participants);
    });
    
    // User left
    socket.on('user-left', ({ userId, username }) => {
        console.log('User left:', username);
        removeParticipantFromList(userId);
        showNotification(`${username} meninggalkan meeting`, 'info');
    });
    
    // Chat message
    socket.on('meeting-chat-message', (message) => {
        console.log('Chat message:', message);
        addChatMessage(message);
    });
    
    // Meeting ended
    socket.on('meeting-ended', () => {
        showNotification('Meeting telah diakhiri oleh guru', 'warning');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
    });
}

function addParticipantToList(participant) {
    const videoGrid = document.getElementById('videoGrid');
    
    // Check if already exists
    if (document.getElementById(`video-${participant.id}`)) {
        return;
    }
    
    const videoCard = document.createElement('div');
    videoCard.className = 'video-card';
    videoCard.id = `video-${participant.id}`;
    
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    placeholder.innerHTML = `
        <i class="fas fa-user-circle"></i>
        <div>${participant.fullName || participant.username}</div>
        <small>${participant.role === 'teacher' ? '👑 Guru' : '👩‍🎓 Siswa'}</small>
    `;
    
    videoCard.appendChild(placeholder);
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.innerHTML = `
        <i class="fas ${participant.role === 'teacher' ? 'fa-chalkboard-user' : 'fa-user-graduate'}"></i>
        ${participant.fullName || participant.username}
    `;
    videoCard.appendChild(label);
    
    videoGrid.appendChild(videoCard);
}

function removeParticipantFromList(userId) {
    const element = document.getElementById(`video-${userId}`);
    if (element) {
        element.remove();
    }
}

function updateParticipantsList(participants) {
    const container = document.getElementById('participantsContainer');
    if (!container) return;
    
    const allParticipants = [currentUser, ...participants.filter(p => p.id !== socket.id)];
    
    container.innerHTML = allParticipants.map(p => `
        <div class="participant-item">
            <div class="participant-avatar">
                ${(p.fullName || p.username).charAt(0).toUpperCase()}
            </div>
            <div>
                <div class="participant-name">
                    ${p.fullName || p.username}
                    ${p.role === 'teacher' ? ' 👑' : ''}
                    ${p.id === socket.id ? ' (You)' : ''}
                </div>
                <div class="participant-status">
                    ${isMuted ? '🔇 Muted' : '🎤 Online'}
                </div>
            </div>
        </div>
    `).join('');
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.innerHTML = `
        <div class="chat-message-user">${message.user.fullName || message.user.username || message.user}</div>
        <div class="chat-message-text">${message.message}</div>
        <div class="chat-message-time">${message.time || new Date().toLocaleTimeString()}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showNotification(message, type = 'info') {
    // Simple alert for now, can be improved
    console.log(`[${type}] ${message}`);
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#10b981'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Control handlers
document.getElementById('toggleMicBtn')?.addEventListener('click', () => {
    isMuted = !isMuted;
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !isMuted;
        }
    }
    
    const btn = document.getElementById('toggleMicBtn');
    if (isMuted) {
        btn.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Mic</span>';
        btn.classList.add('danger');
    } else {
        btn.innerHTML = '<i class="fas fa-microphone"></i><span>Mic</span>';
        btn.classList.remove('danger');
    }
    
    if (socket && currentMeeting) {
        socket.emit('toggle-mute', {
            meetingId: currentMeeting.meetingId,
            isMuted: isMuted
        });
    }
});

document.getElementById('toggleVideoBtn')?.addEventListener('click', () => {
    isVideoOff = !isVideoOff;
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !isVideoOff;
        }
    }
    
    const btn = document.getElementById('toggleVideoBtn');
    if (isVideoOff) {
        btn.innerHTML = '<i class="fas fa-video-slash"></i><span>Video</span>';
        btn.classList.add('danger');
    } else {
        btn.innerHTML = '<i class="fas fa-video"></i><span>Video</span>';
        btn.classList.remove('danger');
    }
    
    if (socket && currentMeeting) {
        socket.emit('toggle-video', {
            meetingId: currentMeeting.meetingId,
            isVideoOff: isVideoOff
        });
    }
});

// Leave meeting
document.getElementById('leaveMeetingBtn')?.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin meninggalkan meeting?')) {
        leaveMeeting();
    }
});

function leaveMeeting() {
    if (socket && currentMeeting) {
        socket.emit('leave-meeting', { meetingId: currentMeeting.meetingId });
        socket.disconnect();
    }
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    window.location.href = 'dashboard.html';
}

// Chat functionality
document.getElementById('sendChatBtn')?.addEventListener('click', () => {
    const input = document.getElementById('chatInput');
    const message = input?.value.trim();
    if (message && socket && currentMeeting) {
        socket.emit('meeting-chat', {
            meetingId: currentMeeting.meetingId,
            message: message,
            user: currentUser
        });
        input.value = '';
    }
});

document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('sendChatBtn')?.click();
    }
});

// Panel functionality
let isPanelOpen = false;

document.getElementById('togglePanelBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('sidePanel');
    panel?.classList.toggle('open');
});

document.getElementById('closePanelBtn')?.addEventListener('click', () => {
    document.getElementById('sidePanel')?.classList.remove('open');
});

// Tab switching
document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabName = tab.dataset.tab;
        const chatContainer = document.getElementById('chatContainer');
        const participantsContainer = document.getElementById('participantsContainer');
        
        if (chatContainer) chatContainer.style.display = tabName === 'chat' ? 'block' : 'none';
        if (participantsContainer) participantsContainer.style.display = tabName === 'participants' ? 'block' : 'none';
    });
});

// Start meeting
initMeeting();