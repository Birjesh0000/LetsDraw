# LetsDraw — Real-Time Collaborative Drawing Canvas

[![Live Demo](https://img.shields.io/badge/Live%20Demo-letsdraw--ebon.vercel.app-brightgreen?style=flat-square&logo=vercel)](https://letsdraw-ebon.vercel.app)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

> A multi-user drawing application where multiple users can draw simultaneously on a shared canvas, with real-time synchronization powered by WebSockets.

<!-- Add a screenshot here once available:
![LetsDraw Screenshot](./assets/screenshot.png)
-->

## Quick Start

Requirements: Node.js v18+

**Backend:**
```bash
cd Server
npm install
npm start
```
Runs on http://localhost:3001

**Frontend:**
```bash
cd client
npm install
npm run dev
```
Runs on http://localhost:5173

## Testing with Multiple Users

1. Open http://localhost:5173 in two browser windows
2. Both will auto-join the same room
3. Draw in one window - it appears in the other in real-time
4. Test undo/redo/clear buttons - they work across both users

## Features Implemented

- Real-time drawing synchronization via Socket.io
- Brush and eraser tools with adjustable size
- Color picker
- Global undo/redo (one user can undo another's drawing)
- Clear canvas
- Remote user cursor indicators with drawing state
- Automatic reconnection with exponential backoff
- Connection status monitoring
- Error notifications

## Project Structure

```
LetsDraw/
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── canvas.jsx
│   │   ├── socketService.jsx
│   │   ├── Toolbar.jsx
│   │   └── utils/
│   └── vite.config.js
│
└── Server/              # Node.js backend
    ├── server.js
    ├── rooms.js
    └── drawing-state.js
```

## Known Limitations

- No persistence - drawing lost if server restarts
- No export/download functionality
- Zoom and pan not implemented
- No touch pressure sensitivity
- Performance degrades with 10+ concurrent users

## Technical Approach

- Native Canvas API (no external drawing libraries)
- Server as source of truth for all drawing state
- Event batching every 16ms to reduce network traffic
- Dirty rectangle rendering optimization for performance

## Time Spent

- Setup and architecture: 1.5 hours
- Core drawing and sync: 2.5 hours
- Undo/redo and conflict handling: 1.5 hours
- User presence indicators: 1 hour
- Bug fixes and deployment: 1 hour
- Total: 7.5 hours

See ARCHITECTURE.md for technical details.
