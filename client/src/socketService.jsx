/**
 * Socket Service - WebSocket Client
 * Manages real-time communication with the drawing server
 */

import io from 'socket.io-client';

class SocketService {
  constructor(serverUrl = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.isConnected = false;
    this.userId = null;
    this.roomId = null;

    // Event callbacks
    this.callbacks = {
      onConnect: null,
      onDisconnect: null,
      onError: null,
      onRoomJoined: null,
      onDraw: null,
      onUndo: null,
      onRedo: null,
      onClear: null,
      onUserJoined: null,
      onUserLeft: null,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        // Connection handlers
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.userId = this.socket.id;
          console.log(`[Socket] Connected: ${this.userId}`);
          if (this.callbacks.onConnect) {
            this.callbacks.onConnect(this.userId);
          }
          resolve(this.userId);
        });

        this.socket.on('disconnect', () => {
          this.isConnected = false;
          console.log('[Socket] Disconnected');
          if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect();
          }
        });

        this.socket.on('error', (error) => {
          console.error('[Socket] Error:', error);
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          reject(error);
        });

        // Room events
        this.socket.on('room-joined', (data) => {
          console.log('[Socket] Room joined:', data.roomId);
          this.roomId = data.roomId;
          if (this.callbacks.onRoomJoined) {
            this.callbacks.onRoomJoined(data);
          }
        });

        // Drawing events
        this.socket.on('draw', (data) => {
          if (this.callbacks.onDraw && data.userId !== this.userId) {
            this.callbacks.onDraw(data);
          }
        });

        this.socket.on('undo', (data) => {
          console.log('[Socket] Undo received');
          if (this.callbacks.onUndo) {
            this.callbacks.onUndo(data);
          }
        });

        this.socket.on('redo', (data) => {
          console.log('[Socket] Redo received');
          if (this.callbacks.onRedo) {
            this.callbacks.onRedo(data);
          }
        });

        this.socket.on('clear', (data) => {
          console.log('[Socket] Clear received');
          if (this.callbacks.onClear) {
            this.callbacks.onClear(data);
          }
        });

        // User management events
        this.socket.on('user-joined', (data) => {
          console.log('[Socket] User joined:', data.userId);
          if (this.callbacks.onUserJoined) {
            this.callbacks.onUserJoined(data);
          }
        });

        this.socket.on('user-left', (data) => {
          console.log('[Socket] User left:', data.userId);
          if (this.callbacks.onUserLeft) {
            this.callbacks.onUserLeft(data);
          }
        });
      } catch (error) {
        console.error('[Socket] Connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Join a drawing room
   */
  joinRoom(roomId, userData = {}) {
    if (!this.isConnected) {
      console.warn('[Socket] Not connected, cannot join room');
      return;
    }

    console.log(`[Socket] Joining room: ${roomId}`);
    this.socket.emit('join-room', roomId, userData);
  }

  /**
   * Send drawing stroke
   */
  sendDraw(strokeData) {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    this.socket.emit('draw', this.roomId, strokeData);
  }

  /**
   * Request undo
   */
  requestUndo() {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    console.log('[Socket] Requesting undo');
    this.socket.emit('undo', this.roomId);
  }

  /**
   * Request redo
   */
  requestRedo() {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    console.log('[Socket] Requesting redo');
    this.socket.emit('redo', this.roomId);
  }

  /**
   * Request clear canvas
   */
  requestClear() {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    console.log('[Socket] Requesting clear');
    this.socket.emit('clear', this.roomId);
  }

  /**
   * Register event callback
   */
  on(eventName, callback) {
    if (this.callbacks.hasOwnProperty(`on${eventName}`)) {
      this.callbacks[`on${eventName}`] = callback;
    } else {
      console.warn(`[Socket] Unknown event: ${eventName}`);
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      userId: this.userId,
      roomId: this.roomId,
    };
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
