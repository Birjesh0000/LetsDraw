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
drawing-state.js processes action
        ↓
Server broadcasts to all clients in room
        ↓
App.jsx receives & re-renders canvas
        ↓
Canvas.jsx applies remote stroke
```

## WebSocket Events

### Client → Server

**draw**
```javascript
{
  tool: "brush" | "eraser",
  x: number,
  y: number,
  lastX: number,     // Previous position for smooth lines
  lastY: number,
  color: string,
  size: number
}
```

**undo, redo, clear**
- Payload: `{ roomId: string }`
- Server processes and returns updated history state

**drawing-state**
```javascript
{
  isDrawing: boolean,
  userId: string
}
```
Used for remote cursor "drawing" indicator animation.

### Server → Client

**draw** (broadcast to room)
- Same stroke data + userId, processed and applied to canvas

**action-response** (draw/undo/redo/clear)
```javascript
{
  type: "draw" | "undo" | "redo" | "clear",
  canUndo: boolean,
  canRedo: boolean,
  history: [...strokes]
}
```

**remote-cursor-move**
```javascript
{
  userId: string,
  x: number,
  y: number,
  color: string,
  label: string
}
```

## State Management

### Client
- **App.jsx**: Owns canvas ref, undo/redo button states, user list
- **canvas.jsx**: Local drawing state, brush settings, history tracking
- **socketService.jsx**: Connection state, event handlers
- **HistoryManager**: Local undo/redo stack (20 action limit)
- **UserCursorManager**: Remote cursor positions and animation

### Server
- **rooms.js**: Active rooms and user tracking
- **drawing-state.js**: Per-room drawing history and undo/redo state
- **In-memory storage**: No database; state lost on server restart

## Undo/Redo Strategy

1. **Client-side**: HistoryManager keeps local stack (20 item limit)
2. **Server-side**: drawing-state.js maintains per-room history
3. **Global undo**: One user's undo removes the most recent stroke (any user's)
4. **Conflict handling**: ActionSequencer validates action sequence to prevent state divergence
5. **Optimization**: Only re-render affected canvas regions on undo/redo

Example:
- User A draws → Server appends to history
- User B draws → Server appends to history
- User B presses undo → User A's stroke is removed (most recent)
- Both users see consistent state

## Performance Decisions

### Event Batching
Drawing events are batched every 16ms (~60fps) to reduce network traffic:
- Raw mouse events: ~100-200 per second per user
- Batched events: ~60 per second per user
- Saves 60-70% bandwidth while maintaining smooth appearance

### Dirty Rectangle Rendering
Only redraw changed canvas regions:
- Track bounding box of all strokes in frame
- `ctx.clearRect()` only that region instead of entire canvas
- Saves CPU on large canvas with sparse drawing

### Room-based Architecture
- Users only sync with same room
- Allows horizontal scaling (multiple rooms = multiple independent states)
- Memory efficient for many concurrent users

### Server Binding
- Listens on `0.0.0.0` (all interfaces) not `localhost`
- Allows external services (Vercel, Render) to connect
- CORS configured for frontend domain

## Conflict Resolution

**ActionSequencer Pattern:**
1. Each action includes sequence number
2. Server maintains expected sequence counter per room
3. Out-of-order actions trigger validation:
   - If action is duplicate: ignore
   - If action is missing prerequisites: queue and retry
   - If conflict detected: resync client history

**Example:**
```
Client sequence: 1 → 2 → 3 → 5 (4 missing)
Server detects gap, sends most recent history
Client rebuilds from authoritative server state
```

This prevents split-brain scenarios where client and server drawing states diverge.

## Error Handling & Reconnection

1. **Socket.io automatic reconnection**: Built-in with exponential backoff
2. **Custom retry logic**: Manual retry with max 10 attempts (30 second total)
3. **State recovery**: On reconnect, client re-enters room and receives full history
4. **Notification**: UI shows connection status (connected/connecting/disconnected)

## Technology Choices

| Component | Choice | Why |
|-----------|--------|-----|
| Drawing | Canvas API | No external libraries allowed; fast native rendering |
| Real-time | Socket.io | WebSocket with fallback; excellent developer experience |
| Frontend | React + Vite | Fast HMR, modern tooling, component reusability |
| Backend | Express + Node | Fast, async I/O for many concurrent connections |
| Storage | In-memory | Sufficient for drawing demo; simpler than database |
| Styling | Tailwind CSS | Rapid UI development; utility-first approach |

## Known Trade-offs

1. **No persistence**: Drawing lost on server restart (acceptable for demo)
2. **In-memory scaling**: Max ~100 concurrent users before memory issues (could add Redis)
3. **No authentication**: Any user can join any room (acceptable for demo)
4. **Full history replay**: New users download entire stroke history (fine for < 5 min sessions)
