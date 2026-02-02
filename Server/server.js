import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './rooms.js';
import { StateManager } from './drawing-state.js';

const app = express();
const server = createServer(app);

// Get CORS origin from environment or use localhost for development
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

const io = new SocketIOServer(server, {
  cors: {
    origin: [corsOrigin, 'https://letsdraw-ebon.vercel.app'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

const PORT = process.env.PORT || 3001;

// Initialize managers
const roomManager = new RoomManager();
const stateManager = new StateManager();

// Map to track which room each user is in
const userRooms = new Map();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// API endpoint to get server statistics
app.get('/api/stats', (req, res) => {
  res.json({
    rooms: roomManager.getStatistics(),
    drawing: stateManager.getStatistics(),
  });
});

/**
 * WebSocket connection handler
 */
io.on('connection', (socket) => {
  console.log(`[Connection] User connected: ${socket.id}`);

  /**
   * Handle user joining a room
   * @event join-room
   * @param {string} roomId - Room ID to join
   * @param {object} userData - User information (name, etc.)
   */
  socket.on('join-room', (roomId, userData = {}) => {
    try {
      // Create room if it doesn't exist
      const room = roomManager.createRoom(roomId);

      // Create drawing state if it doesn't exist
      stateManager.createRoomState(roomId);

      // Add user to room
      const user = roomManager.addUserToRoom(roomId, socket.id, userData);

      // Track user's room
      userRooms.set(socket.id, roomId);

      // Join socket to room
      socket.join(roomId);

      console.log(`[Room] User ${socket.id} joined room ${roomId}`);

      // Send initial state to the user
      const history = stateManager.getHistory(roomId);
      const users = roomManager.getUsersInRoom(roomId);

      socket.emit('room-joined', {
        roomId,
        userId: socket.id,
        user,
        users,
        history,
      });

      // Broadcast to others in room that new user joined
      socket.to(roomId).emit('user-joined', {
        userId: socket.id,
        user,
        totalUsers: room.getUserCount(),
      });

      console.log(
        `[Broadcast] User joined notification sent to room ${roomId}`
      );
    } catch (error) {
      console.error(`[Error] join-room: ${error.message}`);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  /**
   * Handle drawing action
   * @event draw
   * @param {string} roomId - Room ID
   * @param {object} strokeData - Stroke data (x, y, color, size, etc.)
   */
  socket.on('draw', (roomId, strokeData) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room || !room.hasUser(socket.id)) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      // Add action to state
      const action = stateManager.addAction(roomId, socket.id, 'stroke', {
        ...strokeData,
        userId: socket.id,
      });

      if (!action) {
        socket.emit('error', { message: 'Failed to record drawing' });
        return;
      }

      // Broadcast to all users in the room
      io.to(roomId).emit('draw', {
        userId: socket.id,
        action,
      });
    } catch (error) {
      console.error(`[Error] draw: ${error.message}`);
      socket.emit('error', { message: 'Failed to process drawing' });
    }
  });

  /**
   * Handle undo action
   * @event undo
   * @param {string} roomId - Room ID
   */
  socket.on('undo', (roomId) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room || !room.hasUser(socket.id)) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      // Check if undo is available
      const roomState = stateManager.getRoomState(roomId);
      if (!roomState || !roomState.canUndo()) {
        socket.emit('error', { message: 'Nothing to undo' });
        return;
      }

      // Perform undo
      const undoneAction = stateManager.undo(roomId);

      if (!undoneAction) {
        socket.emit('error', { message: 'Failed to undo' });
        return;
      }

      // Broadcast undo to all users
      io.to(roomId).emit('undo', {
        userId: socket.id,
        action: undoneAction,
      });

      console.log(`[Action] Undo in room ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error(`[Error] undo: ${error.message}`);
      socket.emit('error', { message: 'Failed to undo' });
    }
  });

  /**
   * Handle redo action
   * @event redo
   * @param {string} roomId - Room ID
   */
  socket.on('redo', (roomId) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room || !room.hasUser(socket.id)) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      // Check if redo is available
      const roomState = stateManager.getRoomState(roomId);
      if (!roomState || !roomState.canRedo()) {
        socket.emit('error', { message: 'Nothing to redo' });
        return;
      }

      // Perform redo
      const redoneAction = stateManager.redo(roomId);

      if (!redoneAction) {
        socket.emit('error', { message: 'Failed to redo' });
        return;
      }

      // Broadcast redo to all users
      io.to(roomId).emit('redo', {
        userId: socket.id,
        action: redoneAction,
      });

      console.log(`[Action] Redo in room ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error(`[Error] redo: ${error.message}`);
      socket.emit('error', { message: 'Failed to redo' });
    }
  });

  /**
   * Handle clear canvas action
   * @event clear
   * @param {string} roomId - Room ID
   */
  socket.on('clear', (roomId) => {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room || !room.hasUser(socket.id)) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      // Add clear action to history
      const action = stateManager.addAction(roomId, socket.id, 'clear', {
        userId: socket.id,
      });

      if (!action) {
        socket.emit('error', { message: 'Failed to clear canvas' });
        return;
      }

      // Broadcast clear to all users
      io.to(roomId).emit('clear', {
        userId: socket.id,
        action,
      });

      console.log(`[Action] Clear in room ${roomId} by ${socket.id}`);
    } catch (error) {
      console.error(`[Error] clear: ${error.message}`);
      socket.emit('error', { message: 'Failed to clear canvas' });
    }
  });

  /**
   * Handle drawing state change (user started/stopped drawing)
   * @event drawing-state
   */
  socket.on('drawing-state', (data) => {
    try {
      const { roomId, userId, isDrawing } = data;

      if (!roomId || !userId) {
        console.warn('[DrawingState] Invalid drawing state data');
        return;
      }

      const room = roomManager.getRoom(roomId);
      if (!room) {
        console.warn(`[DrawingState] Room ${roomId} not found`);
        return;
      }

      // Broadcast drawing state to all users in room
      io.to(roomId).emit('user-drawing-state', {
        userId: userId,
        isDrawing: isDrawing,
        timestamp: data.timestamp || Date.now(),
      });

      console.log(`[DrawingState] User ${userId} drawing: ${isDrawing}`);
    } catch (error) {
      console.error(`[Error] drawing-state: ${error.message}`);
    }
  });

  /**
   * Handle user disconnect
   * @event disconnect
   */
  socket.on('disconnect', () => {
    try {
      const roomId = userRooms.get(socket.id);

      if (roomId) {
        // Remove user from room
        roomManager.removeUserFromRoom(roomId, socket.id);

        const room = roomManager.getRoom(roomId);

        // Notify others in room
        io.to(roomId).emit('user-left', {
          userId: socket.id,
          totalUsers: room ? room.getUserCount() : 0,
        });

        console.log(`[Disconnect] User ${socket.id} left room ${roomId}`);

        // If room is empty, clean up state
        if (!room || room.isEmpty()) {
          stateManager.deleteRoomState(roomId);
          console.log(`[Cleanup] Drawing state deleted for room ${roomId}`);
        }
      }

      // Remove from user tracking
      userRooms.delete(socket.id);

      console.log(`[Disconnect] User disconnected: ${socket.id}`);
    } catch (error) {
      console.error(`[Error] disconnect: ${error.message}`);
    }
  });

  /**
   * Handle errors
   * @event error
   */
  socket.on('error', (error) => {
    console.error(`[Socket Error] ${socket.id}: ${error}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[WebSocket] Socket.io ready for connections`);
  console.log(`[Production] CORS Origin: ${corsOrigin}`);
});
