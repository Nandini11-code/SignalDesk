# Nexus: Unified Messaging Command Center 🚀

Nexus is a high-performance, premium dashboard that aggregates real-time messages from **WhatsApp**, **Instagram DMs**, and **Email** into a single, prioritized feed. Built for speed and focus, it allows you to read and reply to all your communications without switching apps.

## ✨ Features

- **Unified Feed**: WhatsApp, Instagram, and Email in one sleek UI.
- **Intelligent Priority Engine**: Messages are automatically ranked by importance (Urgent, Medium, Low).
- **Real-Time Bridge**: Powered by Socket.io for instant message delivery.
- **Premium Design**: Dark mode, glassmorphism, and smooth animations.

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.
- A mobile device with WhatsApp for the initial link.

### 2. Installation
Clone or navigate to the project directory and run:
```bash
npm install
```

### 3. Configuration
1. Locate the `.env` file in the root directory.
2. Fill in your credentials:
   - **Instagram**: Your username and password.
   - **Email**: Your email address and an **App Password** (for Gmail/Outlook).
   - *Note: WhatsApp does not need credentials; you will use a QR code.*

### 4. Running the Dashboard
1. Start the backend bridge:
   ```bash
   npm run start
   ```
2. **Scan the QR Code**: A QR code will appear in your terminal. Open WhatsApp on your phone → **Linked Devices** → **Link a Device** and scan it.
3. Once the terminal says `✅ WhatsApp Ready` and `✅ Instagram Ready`, open **`index.html`** in your browser.

---

## 🔒 Security & Privacy
- **Local Only**: All credentials and messages are handled locally on your machine.
- **Encrypted Session**: WhatsApp uses `LocalAuth` to store your session securely in the `.wwebjs_auth` folder.
- **Caution**: Never share your `.env` file or terminal output containing your QR code with others.

## 🏆 Hackathon Demo Tips
- **The "Urgent" Test**: Have someone send you a WhatsApp message with the word "Urgent" to see the priority engine float it to the top instantly!
- **Multi-App Filter**: Use the sidebar to show judges how you can isolate WhatsApp or Instagram feeds with one click.

---
Built with ❤️ for the Hackathon.
