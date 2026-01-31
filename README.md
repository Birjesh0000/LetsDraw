# LetsDraw - Real-Time Collaborative Drawing Canvas

A multi-user drawing application where multiple users can draw simultaneously on a shared canvas. Built with React, Vite, Node.js, and Socket.io.

## Project Overview

LetsDraw is a real-time collaborative drawing application that demonstrates:
- Real-time synchronization using WebSockets
- Shared state management across multiple users
- Global undo/redo functionality
- Native HTML5 Canvas API usage

## Project Structure

```
LetsDraw/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── README.md
│
├── server/                     # Node.js + Socket.io backend
│   ├── server.js
│   ├── rooms.js
│   ├── drawing-state.js
│   ├── package.json
│   └── README.md
│
├── instructions.md
├── ARCHITECTURE.md
└── README.md
```

## Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn

### Setup Frontend

```bash
cd client
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`

### Setup Backend

```bash
cd server
npm install
npm start
```

The backend will run on `http://localhost:3001`

## Development

### Frontend Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

### Backend Commands
- `npm start` - Start server
- `npm run dev` - Start with auto-reload (uses --watch)

## Features (To Be Implemented)

- [ ] Real-time drawing synchronization
- [ ] Multiple drawing tools (brush, eraser)
- [ ] Color selection
- [ ] Stroke width adjustment
- [ ] User indicators
- [ ] Global undo/redo
- [ ] User management
- [ ] Conflict handling

## Notes

- This project uses the native HTML5 Canvas API only (no external drawing libraries)
- All real-time communication is handled via Socket.io
- The server maintains the source of truth for drawing state
