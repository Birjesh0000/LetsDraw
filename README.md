# LetsDraw - Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple users draw simultaneously on a shared canvas. Built with React, Vite, Node.js, and Socket.io.

## Quick Start

### Prerequisites
- Node.js v18+
- npm

### Setup & Run

**Terminal 1 - Backend:**
```bash
cd Server
npm install
npm start
```
Backend runs on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd client
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

## Testing with Multiple Users

1. Open `http://localhost:5173` in two browser windows/tabs
2. Both will auto-join the same room
3. Draw in one window → see it appear in the other in real-time
4. Test undo/redo/clear buttons - they work across both users

## Features Implemented

✅ Real-time drawing synchronization (Socket.io)
✅ Brush & eraser tools with adjustable size
✅ Color picker
✅ Global undo/redo (one user can undo another's drawing)
✅ Clear canvas
✅ Remote user cursor indicators with drawing state
✅ Automatic reconnection with exponential backoff
✅ Connection health monitoring
✅ Error notifications

## Project Structure

```
LetsDraw/
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── canvas.jsx
│   │   ├── socketService.jsx
│   │   ├── Toolbar.jsx
│   │   └── utils/       # historyManager, userCursorManager, etc.
│   └── vite.config.js
│
└── Server/              # Node.js backend
    ├── server.js        # Express + Socket.io
    ├── rooms.js         # Room management
    └── drawing-state.js # History & undo/redo
```

## Known Limitations

- Canvas doesn't persist after page refresh (state is lost)
- No export/download functionality
- Zoom/pan not implemented
- No touch pressure sensitivity
- Drawing performance may degrade with 10+ concurrent users

## Technical Decisions

- **Native Canvas API**: No external drawing libraries (Fabric.js, Konva forbidden)
- **Server as source of truth**: All drawing actions validated and stored server-side
- **Event batching**: Drawing events batched every 16ms to reduce network traffic
- **Dirty rectangle optimization**: Only redraw changed canvas regions for performance

## Time Spent

- Initial setup & architecture: ~1.5 hours
- Core drawing & sync: ~2.5 hours
- Undo/redo & conflict handling: ~1.5 hours
- User presence indicators: ~1 hour
- Bug fixes & deployment: ~1 hour
- **Total: ~7.5 hours**

## Deployment

Frontend: Vercel (`https://letsdraw-ebon.vercel.app`)
Backend: Render (`https://letsdraw.onrender.com`)

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture & design decisions
- [DEVELOPMENT.md](DEVELOPMENT.md) - Detailed development log
