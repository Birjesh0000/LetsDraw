# LetsDraw Architecture

## Overview

LetsDraw is built with a clear separation between client-side rendering and server-side coordination.

### Core Architecture Principles

1. **Client-Server Model**: The client handles UI rendering and user input. The server is the source of truth for shared state.
2. **Real-Time Communication**: WebSocket (Socket.io) enables real-time bidirectional communication.
3. **State Synchronization**: All drawing actions are validated and stored on the server before being broadcast to other clients.
4. **Global Undo/Redo**: History is managed centrally on the server to ensure consistency.

## Frontend Architecture

### Files & Responsibilities

- **App.jsx** - Main React component, orchestrates UI layout and controls
- **app-init.js** - Application initialization, manages app lifecycle
- **canvas.js** - Canvas drawing logic, handles brush/eraser, rendering
- **websocket.js** - WebSocket client wrapper, manages connection and events

### Data Flow

```
User Input (Mouse)
    ↓
Canvas.js (handles drawing locally)
    ↓
Emit to Server via WebSocket
    ↓
(Other clients receive update)
    ↓
Canvas re-renders
```

## Backend Architecture

### Files & Responsibilities

- **server.js** - Main server file, Express app, Socket.io setup
- **rooms.js** - Room management, tracks users and sessions
- **drawing-state.js** - Manages drawing history, undo/redo logic

### Data Flow

```
Client emits drawing action
    ↓
Server receives action
    ↓
Validate and store in history
    ↓
Broadcast to all users in room
    ↓
Update state in StateManager
```

## WebSocket Events (To Be Implemented)

### Client → Server
- `join-room` - User joins a drawing room
- `draw` - User draws on canvas
- `undo` - Request undo action
- `redo` - Request redo action
- `clear` - Clear canvas

### Server → Client
- `room-state` - Initial room state
- `draw` - Broadcast drawing action
- `undo` - Broadcast undo action
- `redo` - Broadcast redo action
- `user-joined` - New user joined
- `user-left` - User left
- `users-list` - Current online users

## State Management

### Client-Side
- Local canvas state (current drawing)
- Tool/color/size preferences
- Connection status

### Server-Side
- Global drawing history (all strokes)
- Room state (users, metadata)
- Current canvas state (derived from history)

## Performance Considerations

1. **Canvas Optimization**
   - Use `requestAnimationFrame` for smooth drawing
   - Batch render updates where possible

2. **Network Optimization**
   - Compress drawing data for transmission
   - Only send critical information
   - Debounce mouse events if needed

3. **State Management**
   - Keep history size reasonable
   - Implement history pruning if needed
   - Use efficient data structures

## Security & Error Handling

- Validate all drawing actions on the server
- Handle network failures gracefully
- Implement reconnection logic
- Prevent malicious state manipulation
- Rate limit drawing actions if needed

## Scalability

- Use room-based isolation to scale to many concurrent users
- Each room has its own drawing state
- Users only receive updates for their current room
- History can be persisted to database for recovery
