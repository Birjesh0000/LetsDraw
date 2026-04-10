<div align="center">

# 🎨 LetsDraw

### Real-Time Collaborative Drawing Canvas

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-letsdraw--ebon.vercel.app-brightgreen?style=for-the-badge)](https://letsdraw-ebon.vercel.app)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io)](https://socket.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

A **multi-user real-time drawing application** where multiple users can draw simultaneously on a shared canvas. Changes are synced instantly across all connected clients via WebSockets.

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🖌️ **Real-Time Sync** | Drawing strokes are broadcast to all connected users instantly via Socket.io |
| 🖊️ **Brush & Eraser** | Adjustable brush/eraser size for precise or broad strokes |
| 🎨 **Color Picker** | Full color palette with custom color selection |
| ↩️ **Global Undo/Redo** | Any user can undo/redo — consistent state across all clients |
| 🗑️ **Clear Canvas** | Broadcast clear action synced to all users |
| 👥 **Live Cursors** | See other users' cursors and drawing states in real time |
| 🔄 **Auto-Reconnect** | Exponential backoff reconnection with full state recovery |
| 📡 **Connection Status** | Live indicator showing WebSocket connection health |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS |
| **Real-Time** | Socket.io (WebSocket + fallback) |
| **Backend** | Node.js, Express |
| **Drawing** | Native HTML5 Canvas API |
| **Deployment** | Vercel (frontend), Render (backend) |

---

## 🚀 Quick Start

**Requirements:** Node.js v18+

### 1. Clone the repository

```bash
git clone https://github.com/Birjesh0000/LetsDraw.git
cd LetsDraw
```

### 2. Start the Backend

```bash
cd Server
npm install
npm start
```

> Runs on **http://localhost:3001**

### 3. Start the Frontend

```bash
cd client
npm install
npm run dev
```

> Runs on **http://localhost:5173**

### 4. Test with Multiple Users

1. Open **http://localhost:5173** in two separate browser windows
2. Both windows auto-join the same shared room
3. Draw in one window — it appears instantly in the other
4. Try undo/redo/clear — all actions sync across users

---

## 📁 Project Structure

```
LetsDraw/
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx          # Root component, socket event handling
│   │   ├── canvas.jsx       # Drawing logic, Canvas API
│   │   ├── socketService.jsx # WebSocket connection management
│   │   ├── Toolbar.jsx      # Tools UI (brush, eraser, color, size)
│   │   └── utils/           # Helper utilities
│   ├── tailwind.config.js
│   └── vite.config.js
│
└── Server/                  # Node.js + Express backend
    ├── server.js            # Socket.io server, event routing
    ├── rooms.js             # Room and user session tracking
    └── drawing-state.js     # Per-room stroke history, undo/redo
```

---

## 📸 Screenshots

> **Live at:** [https://letsdraw-ebon.vercel.app](https://letsdraw-ebon.vercel.app)

*Open the live demo in two browser windows side-by-side to see real-time collaboration in action.*

---

## ⚙️ How It Works

- **Server as source of truth** — all stroke history lives on the server
- **Event batching every 16ms** (~60 fps) to reduce WebSocket traffic by 60–70%
- **Dirty rectangle rendering** — only changed canvas regions are redrawn, reducing CPU load
- **Sequence numbers** on every action prevent split-brain between clients and server
- **Room-based isolation** — users only receive updates for their room, enabling horizontal scaling

See [ARCHITECTURE.md](ARCHITECTURE.md) for a deep-dive into the technical design.

---

## ⚠️ Known Limitations

- No persistence — drawing is lost if the server restarts
- No export / download functionality
- Zoom and pan are not implemented
- No touch pressure sensitivity
- Performance may degrade with 10+ concurrent users in the same room

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ by [Brijesh](https://github.com/Birjesh0000)

</div>
