// Demo messages shown on startup — real messages will be prepended on top
const messages = [
    {
        id: 'demo-1',
        sender: "Demo: Send yourself a WhatsApp",
        app: "whatsapp",
        content: "When someone sends you a WhatsApp message it will appear here in real-time, sorted by priority.",
        timestamp: "Waiting for messages...",
        priority: 40
    },
    {
        id: 'demo-2',
        sender: "Demo: Instagram DM",
        app: "instagram",
        content: "Instagram DMs will appear here once connected via the .env credentials.",
        timestamp: "Waiting for messages...",
        priority: 30
    },
    {
        id: 'demo-3',
        sender: "Demo: Email (Urgent)",
        app: "email",
        content: "[URGENT] Emails with keywords like 'Urgent' will be ranked High Priority and float to the top!",
        timestamp: "Waiting for messages...",
        priority: 90
    }
];

// Socket.io Connection
const socket = io('http://localhost:3001');
const statusDot = document.getElementById('ws-status-dot');
const statusText = document.getElementById('ws-status-text');

socket.on('connect', () => {
    console.log('Connected to Nexus Bridge');
    statusDot.classList.add('connected');
    statusText.textContent = 'Bridge: Connected';
});

socket.on('disconnect', () => {
    statusDot.classList.remove('connected');
    statusText.textContent = 'Bridge: Disconnected';
});

socket.on('new-message', (data) => {
    console.log('New real-time message:', data);
    // Add to our messages array and re-render
    messages.unshift(data);
    renderMessages(document.querySelector('.nav-item.active').dataset.filter);
});

// Priority Labels helper
function getPriorityLabel(score) {
    if (score >= 85) return "High";
    if (score >= 50) return "Medium";
    return "Low";
}

function getPriorityClass(score) {
    if (score >= 85) return "high";
    if (score >= 50) return "medium";
    return "low";
}

// Render Messages
function renderMessages(filter = "all") {
    const feed = document.getElementById('message-feed');
    feed.innerHTML = "";

    // Sort by priority (highest first)
    const sortedMessages = [...messages].sort((a, b) => b.priority - a.priority);

    sortedMessages.forEach(msg => {
        if (filter !== "all" && msg.app !== filter) return;

        const card = document.createElement('div');
        card.className = `message-card priority-${getPriorityClass(msg.priority)}`;
        card.innerHTML = `
            <div class="app-indicator ${msg.app}">
                ${msg.app[0].toUpperCase()}
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender-name">${msg.sender}</span>
                    <div class="header-meta">
                        <span class="timestamp">${msg.timestamp}</span>
                        <span class="priority-badge ${getPriorityClass(msg.priority)}">${getPriorityLabel(msg.priority)}</span>
                    </div>
                </div>
                <p class="message-body">${msg.content}</p>
            </div>
        `;

        card.addEventListener('click', () => openReplyModal(msg));
        feed.appendChild(card);
    });
}

// Modal Logic
const modal = document.getElementById('reply-modal');
const closeModalBtn = document.getElementById('close-modal');
const sendReplyBtn = document.getElementById('send-reply-btn');
const replyInput = document.getElementById('reply-input');
let currentReplyingTo = null;

function openReplyModal(msg) {
    currentReplyingTo = msg;
    document.getElementById('reply-sender-name').textContent = msg.sender;
    document.getElementById('original-message-text').textContent = msg.content;
    replyInput.value = "";
    modal.classList.remove('hidden');
    replyInput.focus();
}

closeModalBtn.onclick = () => modal.classList.add('hidden');

sendReplyBtn.onclick = () => {
    const replyText = replyInput.value.trim();
    if (!replyText) return;

    if (currentReplyingTo.chatId) {
        // Real WhatsApp message — send via bridge
        socket.emit('send-reply', {
            chatId: currentReplyingTo.chatId,
            content: replyText,
            app: currentReplyingTo.app
        });
        sendReplyBtn.textContent = "Sending...";
    } else if (currentReplyingTo.app === 'email' && currentReplyingTo.replyTo) {
        // Real Email — send via SMTP
        socket.emit('send-reply', {
            app: 'email',
            replyTo: currentReplyingTo.replyTo,
            originalSubject: currentReplyingTo.content,
            content: replyText
        });
        sendReplyBtn.textContent = "Sending via Email...";
    } else {
        // Demo message — simulate send
        sendReplyBtn.textContent = "Sending...";
    }

    sendReplyBtn.disabled = true;

    setTimeout(() => {
        modal.classList.add('hidden');
        sendReplyBtn.textContent = "Send Reply";
        sendReplyBtn.disabled = false;
        showToast(`✅ Reply sent to ${currentReplyingTo.sender}!`);
    }, 1200);
};

socket.on('reply-status', (data) => {
    if (data.success) {
        console.log('Reply sent successfully!');
    } else {
        alert('Failed to send message: ' + data.error);
    }
});

// Filter Navigation
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        renderMessages(item.dataset.filter);
    });
});

// Search Logic
const searchInput = document.querySelector('.search-bar input');
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.message-card');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(term) ? "flex" : "none";
    });
});

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('visible'), 10);
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Initialize
window.onload = () => {
    renderMessages();
};
