# Architecture & Technical Design

## Data Flow

```
User Input (Client)
        ↓
Canvas.jsx (local rendering)
        ↓
socketService.emit("draw")
        ↓
Server receives & validates
        ↓
drawing-state.js processes
        ↓
Server broadcasts to room
        ↓
App.jsx receives & re-renders
        ↓
Canvas.jsx applies remote stroke
```

## WebSocket Events

### Client to Server

**draw** - Sends stroke data with tool, x, y, lastX, lastY, color, size

**undo / redo / clear** - Action request with roomId

**drawing-state** - Indicates if user is actively drawing

### Server to Client

**draw** - Broadcasts stroke to all users in room

**action-response** - Returns updated history state with canUndo/canRedo flags

**remote-cursor-move** - Sends other users' cursor positions and states

## State Management

### Client
- **App.jsx** - Canvas ref, button states, user list
- **canvas.jsx** - Local drawing state, brush settings
- **socketService.jsx** - Connection management
- **HistoryManager** - Local undo/redo stack (20 item limit)
- **UserCursorManager** - Remote cursor positions

### Server
- **rooms.js** - Room and user tracking
- **drawing-state.js** - Per-room history and undo/redo state
- **In-memory storage** - No database persistence

## Undo/Redo Strategy

Each room maintains a chronological history of strokes. When undo is triggered, the most recent stroke is removed (regardless of who drew it) and the updated history is broadcast to all users. Redo restores the last removed stroke. This ensures global consistency - all users see the same undo/redo state.

## Performance Optimization

### Event Batching
Drawing generates 100-200 events per second per user. Instead of sending each event, we batch them every 16ms (~60fps), reducing bandwidth usage by 60-70% while maintaining smooth visual experience.

### Dirty Rectangle Rendering
Instead of redrawing the entire canvas each frame, we track the bounding box of changed regions and only redraw those areas. This significantly reduces CPU usage on large canvases with sparse drawing.

### Room-based Architecture
Users only receive updates for their current room. This allows horizontal scaling - multiple rooms operate independently, distributing load efficiently.

### Server Configuration
The server binds to 0.0.0.0 (all interfaces) rather than localhost, allowing connections from external services like Vercel and Render. CORS is configured for the frontend domain.

## Conflict Resolution

Each action includes a sequence number. The server tracks expected sequence per room. Out-of-order actions trigger validation:
- Duplicate actions are ignored
- Missing prerequisites are queued and retried
- Real conflicts trigger a client resync from authoritative server state

This prevents split-brain scenarios where client and server state diverge.

## Error Handling & Reconnection

Socket.io provides automatic reconnection with exponential backoff. On disconnect, the client attempts to reconnect with increasing delays between attempts (max 10 retries). Upon successful reconnection, the client re-joins the room and receives the full drawing history to catch up.

## Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Drawing | Canvas API | No external libraries allowed; native rendering |
| Real-time | Socket.io | WebSocket with fallback; excellent DX |
| Frontend | React + Vite | Fast HMR, modern tooling, component reusability |
| Backend | Express + Node | Async I/O, handles many concurrent connections |
| Storage | In-memory | Sufficient for demo; simpler than database |
| Styling | Tailwind CSS | Rapid UI development |

## Known Trade-offs

- **No Persistence** - Drawing is lost when server restarts
- **Limited Scale** - ~100 concurrent users before memory constraints
- **No Authentication** - Any user can join any room
- **Full History Replay** - New users download entire stroke history
