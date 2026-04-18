require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { IgApiClient } = require('instagram-private-api');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve frontend files — open http://localhost:3001 in your browser
app.use(express.static(__dirname));

// Explicitly serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Silently handle Chrome DevTools internal requests
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.json({});
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// --- 📤 SMTP TRANSPORTER (for sending email replies) ---
const smtpTransporter = process.env.EMAIL_USER && !process.env.EMAIL_USER.includes('your-email')
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // TLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    })
    : null;

if (smtpTransporter) {
    smtpTransporter.verify((err) => {
        if (err) console.error('❌ SMTP Error:', err.message);
        else console.log('✅ SMTP (Email Sending) Ready');
    });
}

// --- 🟢 WHATSAPP SERVICE ---
const whatsapp = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

whatsapp.on('qr', (qr) => {
    console.log('\n[WhatsApp] SCAN QR CODE:');
    qrcode.generate(qr, { small: true });
});

whatsapp.on('ready', () => console.log('✅ WhatsApp Ready'));

whatsapp.on('message_create', async (msg) => {
    try {
        console.log('[WhatsApp] New message detected:', msg.body);
        const chat = await msg.getChat();
        io.emit('new-message', {
            id: msg.id.id,
            sender: chat.name || msg.from,
            app: 'whatsapp',
            content: msg.body || '[Media/Non-text message]',
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            priority: (msg.body || '').toLowerCase().includes('urgent') ? 95 : 50,
            chatId: msg.from
        });
    } catch (e) { console.error('WS Message Error:', e); }
});

// --- 📧 EMAIL SERVICE ---
if (process.env.EMAIL_USER && !process.env.EMAIL_USER.includes('your-email')) {
    const imap = new Imap({
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => {
        console.log('✅ Email (IMAP) Ready');
        imap.openBox('INBOX', true, (err, box) => {
            if (err) return console.error('Email Box Error:', err);

            // Helper to fetch emails
            const fetchEmails = (start, end) => {
                if (start < 1) start = 1;
                if (end < 1) return;
                const f = imap.seq.fetch(`${start}:${end}`, { bodies: '' });
                f.on('message', (msg) => {
                    msg.on('body', stream => {
                        simpleParser(stream, (err, parsed) => {
                            if (err || !parsed) return;
                            io.emit('new-message', {
                                id: parsed.messageId || Math.random().toString(),
                                sender: parsed.from?.text || parsed.from?.value?.[0]?.address || 'Unknown',
                                app: 'email',
                                content: parsed.subject || '(No Subject)',
                                timestamp: new Date(parsed.date || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                                priority: (parsed.subject || '').toLowerCase().includes('urgent') ? 90 : 70,
                                replyTo: parsed.from?.value?.[0]?.address
                            });
                        });
                    });
                });
            };

            // Fetch last 5 emails immediately on startup
            if (box.messages.total > 0) {
                const start = Math.max(1, box.messages.total - 4);
                fetchEmails(start, box.messages.total);
            }

            // Listen for brand new incoming emails
            imap.on('mail', (numNewMsgs) => {
                const end = box.messages.total;
                const start = Math.max(1, end - numNewMsgs + 1);
                fetchEmails(start, end);
            });
        });
    });

    imap.on('error', (err) => console.error('❌ Email Error:', err.message));
    imap.connect();
} else {
    console.log('⚠️ Email skipped (No credentials provided in .env)');
}

// --- 📸 INSTAGRAM SERVICE ---
if (process.env.INSTA_USERNAME && !process.env.INSTA_USERNAME.includes('your_username')) {
    const ig = new IgApiClient();
    ig.state.generateDevice(process.env.INSTA_USERNAME);

    (async () => {
        try {
            await ig.simulate.preLoginFlow();
            await ig.account.login(process.env.INSTA_USERNAME, process.env.INSTA_PASSWORD);
            console.log('✅ Instagram Ready');

            setInterval(async () => {
                try {
                    const inbox = await ig.feed.directInbox().items();
                    if (inbox.length > 0 && inbox[0].last_permanent_item) {
                        const lastMsg = inbox[0].last_permanent_item;
                        if (lastMsg.item_type === 'text') {
                            io.emit('new-message', {
                                id: lastMsg.item_id,
                                sender: 'Insta Direct',
                                app: 'instagram',
                                content: lastMsg.text,
                                timestamp: 'Live',
                                priority: 60
                            });
                        }
                    }
                } catch (e) { console.error('IG Poll Error:', e.message); }
            }, 30000);
        } catch (e) {
            console.error('❌ Instagram Login Failed:', e.message);
        }
    })();
} else {
    console.log('⚠️ Instagram skipped (No credentials provided in .env)');
}

// --- 🛠️ SOCKET HANDLING ---
io.on('connection', (socket) => {
    console.log('Dashboard connected');
    socket.on('send-reply', async (data) => {
        try {
            if (data.app === 'whatsapp' && data.chatId) {
                await whatsapp.sendMessage(data.chatId, data.content);
                socket.emit('reply-status', { success: true });

            } else if (data.app === 'email' && data.replyTo && smtpTransporter) {
                await smtpTransporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: data.replyTo,
                    subject: `Re: ${data.originalSubject || 'Your Message'}`,
                    text: data.content
                });
                socket.emit('reply-status', { success: true });

            } else {
                // Demo cards or unsupported apps
                socket.emit('reply-status', { success: true });
            }
        } catch (e) {
            console.error('Reply Error:', e.message);
            socket.emit('reply-status', { success: false, error: e.message });
        }
    });
});

server.listen(3001, () => {
    console.log('🚀 Nexus Multi-Bridge running on http://localhost:3001');
    whatsapp.initialize().catch(e => console.error('WhatsApp Init Error:', e));
});
