# LetsDraw Server

Real-time collaborative drawing canvas server built with Node.js and Socket.io.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. For development with auto-reload:
   ```bash
   npm run dev
   ```

The server will run on `http://localhost:3001` by default.

## Architecture

- **server.js** - Main server setup and WebSocket initialization
- **rooms.js** - Room and session management (to be implemented)
- **drawing-state.js** - Global canvas state and drawing history (to be implemented)

## WebSocket Events

(To be documented as features are implemented)
