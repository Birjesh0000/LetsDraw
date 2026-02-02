/**
 * Socket Service - WebSocket Client
 * Manages real-time communication with the drawing server
 * Handles connection, event management, and data synchronization
 */

import io from 'socket.io-client';
import {
  ErrorNotificationManager,
  ReconnectionManager,
  StateRecoveryManager,
  ConnectionHealthMonitor,
} from './utils/errorHandler.jsx';

class SocketService {
  constructor(serverUrl = 'https://letsdraw.onrender.com') {
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

    // Error handling and recovery managers
    this.errorManager = new ErrorNotificationManager();
    this.reconnectionManager = new ReconnectionManager({
      maxAttempts: 10,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 1.5,
    });
    this.stateRecoveryManager = new StateRecoveryManager();
    this.healthMonitor = new ConnectionHealthMonitor();

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
      onDrawingStateChanged: null,
      onReconnecting: null,
      onReconnectFailed: null,
      onErrorNotification: null,
      onConnectionHealthChanged: null,
    };
  }

  /**
   * Set the current room ID
   * @param {string} roomId - Room ID to join
   */
  setRoomId(roomId) {
    this.roomId = roomId;
    console.log(`[Socket] Room ID set to: ${roomId}`);
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
          this.healthMonitor.recordMessage();

          console.log(`[Socket] Connected: ${this.userId}`);

          // Success notification
          this.errorManager.notify('Connected to server', 'success', 3000);

          if (this.callbacks.onConnect) {
            this.callbacks.onConnect(this.userId);
          }

          // Trigger state recovery if needed
          if (this.reconnectAttempts > 0) {
            this._triggerStateRecovery();
          }

          resolve(this.userId);
        });

        // Disconnection handler with graceful degradation
        this.socket.on('disconnect', (reason) => {
          this.isConnected = false;
          console.log(`[Socket] Disconnected: ${reason}`);

          if (reason === 'io server disconnect') {
            // Server disconnected - not expected to reconnect
            this.errorManager.notifyError('Server disconnected', 'Please refresh the page');
          } else if (reason === 'io client disconnect') {
            // Client disconnected on purpose
            console.log('[Socket] Client initiated disconnect');
          } else {
            // Network error - will attempt reconnection
            this.errorManager.notify('Lost connection to server', 'warning');
          }

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

          this.errorManager.notify(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
            'warning'
          );

          if (this.callbacks.onReconnecting) {
            this.callbacks.onReconnecting(this.reconnectAttempts);
          }
        });

        // Reconnection success handler
        this.socket.on('reconnect', () => {
          this.isReconnecting = false;
          this.reconnectAttempts = 0;

          console.log('[Socket] Reconnected successfully');
          this.errorManager.notify('Reconnected to server', 'success', 3000);

          // Trigger state recovery
          this._triggerStateRecovery();
        });

        // Final reconnection failure handler
        this.socket.on('reconnect_failed', () => {
          this.isReconnecting = false;
          console.error('[Socket] Failed to reconnect after max attempts');

          this.errorManager.notifyError(
            'Failed to reconnect',
            'Maximum reconnection attempts reached. Please refresh the page.'
          );

          if (this.callbacks.onReconnectFailed) {
            this.callbacks.onReconnectFailed();
          }
        });

        // Error handler with detailed error reporting
        this.socket.on('error', (error) => {
          console.error('[Socket] Error:', error);
          this.healthMonitor.recordError();

          const errorMessage = typeof error === 'string' ? error : error?.message || 'Unknown error';
          this.errorManager.notifyError('Connection error', errorMessage);

          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }

          // Only reject on initial connection error
          if (!this.isConnected && !this.isReconnecting) {
            reject(error);
          }
        });

        // Setup room and drawing event listeners
        this.setupEventListeners();
      } catch (error) {
        console.error('[Socket] Connection initialization failed:', error);
        this.errorManager.notifyError(
          'Connection failed',
          'Unable to initialize WebSocket connection'
        );
        reject(error);
      }
    });
  }

  /**
   * Trigger state recovery after reconnection
   */
  _triggerStateRecovery() {
    this.stateRecoveryManager.startRecovery(async (manager) => {
      console.log('[Socket] Starting state recovery...');

      // Request full room state from server
      return new Promise((resolve) => {
        this.socket?.emit(
          'request-room-state',
          { roomId: this.roomId },
          (success) => {
            if (success) {
              console.log('[Socket] Room state recovered');
              this.errorManager.notify('State recovered', 'success', 2000);
            }
            resolve(success);
          }
        );
      });
    });
  }

  /**
   * Record connection event for health monitoring
   */
  _recordConnectionEvent(eventType, duration = 0) {
    if (eventType === 'message') {
      this.healthMonitor.recordMessage(duration);
    } else if (eventType === 'error') {
      this.healthMonitor.recordError();
    }

    // Notify health status changes
    const status = this.healthMonitor.getStatus();
    if (this.callbacks.onConnectionHealthChanged) {
      this.callbacks.onConnectionHealthChanged(status);
    }
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

    // User drawing state events
    this.socket.on('user-drawing-state', (data) => {
      console.log(`[Socket] User drawing state: ${data.userId} drawing=${data.isDrawing}`);
      if (this.callbacks.onDrawingStateChanged) {
        this.callbacks.onDrawingStateChanged(data);
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
   * Send drawing state (is user currently drawing)
   * @param {boolean} isDrawing - Whether user is currently drawing
   */
  sendDrawingState(isDrawing) {
    if (!this.isConnected || !this.roomId || !this.socket) {
      return;
    }

    this.socket.emit('drawing-state', {
      roomId: this.roomId,
      userId: this.userId,
      isDrawing: isDrawing,
      timestamp: Date.now(),
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

  /**
   * Get error manager for notification control
   */
  getErrorManager() {
    return this.errorManager;
  }

  /**
   * Get connection health status
   */
  getHealthStatus() {
    return this.healthMonitor.getStatus();
  }

  /**
   * Get reconnection status
   */
  getReconnectionStatus() {
    return this.reconnectionManager.getStatus();
  }

  /**
   * Save application state snapshot for recovery
   */
  saveStateSnapshot(key, state) {
    this.stateRecoveryManager.saveSnapshot(key, state);
  }

  /**
   * Restore application state snapshot
   */
  restoreStateSnapshot(key) {
    return this.stateRecoveryManager.restoreSnapshot(key);
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
