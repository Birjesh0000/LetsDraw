/**
 * Socket Service - WebSocket Client
 * Manages real-time communication with the drawing server
 * Handles connection, event management, and data synchronization
 */

import io from 'socket.io-client';

class SocketService {
  constructor(serverUrl = 'http://localhost:3001') {
    this.serverUrl = serverUrl;
    this.socket = null;
    this.isConnected = false;
    this.userId = null;
    this.roomId = null;

    // Reconnection config
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isReconnecting = false;

    // Event batching for performance
    this.drawQueue = [];
    this.isProcessingQueue = false;
    this.queueFlushInterval = 16; // ~60fps

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
      onReconnecting: null,
      onReconnectFailed: null,
    };
  }

  /**
   * Connect to WebSocket server with error handling and reconnection
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ['websocket', 'polling'],
        });

        // Connection success handler
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.userId = this.socket.id;
          this.reconnectAttempts = 0;
          this.isReconnecting = false;

          console.log(`[Socket] Connected: ${this.userId}`);

          if (this.callbacks.onConnect) {
            this.callbacks.onConnect(this.userId);
          }

          resolve(this.userId);
        });

        // Disconnection handler
        this.socket.on('disconnect', (reason) => {
          this.isConnected = false;
          console.log(`[Socket] Disconnected: ${reason}`);

          if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect(reason);
          }

          // Don't reject on disconnect, only on failed reconnection
        });

        // Reconnection attempt handler
        this.socket.on('reconnect_attempt', () => {
          this.reconnectAttempts++;
          this.isReconnecting = true;

          console.log(
            `[Socket] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
          );

          if (this.callbacks.onReconnecting) {
            this.callbacks.onReconnecting(this.reconnectAttempts);
          }
        });

        // Final reconnection failure handler
        this.socket.on('reconnect_failed', () => {
          this.isReconnecting = false;
          console.error('[Socket] Failed to reconnect after max attempts');

          if (this.callbacks.onReconnectFailed) {
            this.callbacks.onReconnectFailed();
          }
        });

        // Error handler
        this.socket.on('error', (error) => {
          console.error('[Socket] Error:', error);

          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }

          // Only reject on initial connection error
          if (!this.isConnected) {
            reject(error);
          }
        });

        // Setup room and drawing event listeners
        this.setupEventListeners();
      } catch (error) {
        console.error('[Socket] Connection initialization failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Setup room and drawing event listeners
   */
  setupEventListeners() {
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
      // Only process strokes from other users
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
   * Join a drawing room with user metadata
   */
  joinRoom(roomId, userData = {}) {
    if (!this.isConnected) {
      console.warn('[Socket] Not connected, cannot join room');
      return;
    }

    console.log(`[Socket] Joining room: ${roomId}`);
    
    // Emit with acknowledgment for error handling
    this.socket.emit('join-room', roomId, userData, (ack) => {
      if (ack && ack.error) {
        console.error('[Socket] Room join error:', ack.error);
        if (this.callbacks.onError) {
          this.callbacks.onError(ack.error);
        }
      } else {
        console.log('[Socket] Successfully joined room:', roomId);
      }
    });
  }

  /**
   * Send drawing stroke with batching for performance
   * Batches multiple strokes to reduce network traffic
   */
  sendDraw(strokeData) {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    // Add to queue for batching
    this.drawQueue.push(strokeData);

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processDrawQueue();
    }
  }

  /**
   * Process batched draw queue
   * Sends queued strokes after a short interval
   */
  processDrawQueue() {
    if (this.drawQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;

    // Wait for next animation frame to batch updates
    setTimeout(() => {
      if (this.drawQueue.length > 0) {
        const strokes = this.drawQueue.splice(0);
        
        // Send all queued strokes
        strokes.forEach((stroke) => {
          this.socket.emit('draw', this.roomId, stroke);
        });

        console.log(`[Socket] Sent ${strokes.length} draw events`);
      }

      this.isProcessingQueue = false;

      // Continue processing if more items in queue
      if (this.drawQueue.length > 0) {
        this.processDrawQueue();
      }
    }, this.queueFlushInterval);
  }

  /**
   * Request undo with acknowledgment
   */
  requestUndo() {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    console.log('[Socket] Requesting undo');
    this.socket.emit('undo', this.roomId, (ack) => {
      if (ack && ack.error) {
        console.error('[Socket] Undo error:', ack.error);
      }
    });
  }

  /**
   * Request redo with acknowledgment
   */
  requestRedo() {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    console.log('[Socket] Requesting redo');
    this.socket.emit('redo', this.roomId, (ack) => {
      if (ack && ack.error) {
        console.error('[Socket] Redo error:', ack.error);
      }
    });
  }

  /**
   * Request clear canvas with acknowledgment
   */
  requestClear() {
    if (!this.isConnected || !this.roomId) {
      console.warn('[Socket] Not connected to room');
      return;
    }

    console.log('[Socket] Requesting clear');
    this.socket.emit('clear', this.roomId, (ack) => {
      if (ack && ack.error) {
        console.error('[Socket] Clear error:', ack.error);
      }
    });
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
   * Get connection status and metadata
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isReconnecting: this.isReconnecting,
      userId: this.userId,
      roomId: this.roomId,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.drawQueue.length,
    };
  }

  /**
   * Force reconnection to server
   */
  reconnect() {
    if (this.socket && !this.isConnected) {
      console.log('[Socket] Forcing reconnection');
      this.socket.connect();
    }
  }

  /**
   * Clear the draw queue (useful for cleanup)
   */
  clearDrawQueue() {
    const queueSize = this.drawQueue.length;
    this.drawQueue = [];
    console.log(`[Socket] Cleared ${queueSize} queued draw events`);
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
