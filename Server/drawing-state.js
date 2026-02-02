/**
 * Global canvas state and drawing history management
 * Handles undo/redo and ensures state consistency across users
 */

/**
 * Represents a single drawing action
 * @class
 */
class DrawingAction {
  constructor(userId, type, data) {
    this.id = `${userId}-${Date.now()}-${Math.random()}`;
    this.userId = userId;
    this.type = type; // 'stroke', 'clear', etc.
    this.data = data; // stroke coordinates, color, size, etc.
    this.timestamp = new Date();
  }
}

/**
 * Manages drawing history with undo/redo capability
 * @class
 */
class DrawingState {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = 500; // Prevent unbounded memory growth
  }

  /**
   * Add a new drawing action to history
   * @param {string} userId - User who performed the action
   * @param {string} type - Type of action (stroke, clear, etc.)
   * @param {object} data - Action data (coordinates, color, size, etc.)
   * @returns {object} The added action
   */
  addAction(userId, type, data) {
    // Remove redo history if new action is added
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    const action = new DrawingAction(userId, type, data);
    this.history.push(action);
    this.currentIndex++;

    // Implement history size limit
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    return action;
  }

  /**
   * Undo the last action
   * @returns {object|null} The action that was undone, or null if at start
   */
  undo() {
    if (this.currentIndex >= 0) {
      const undoneAction = this.history[this.currentIndex];
      this.currentIndex--;
      return undoneAction;
    }
    return null;
  }

  /**
   * Redo the last undone action
   * @returns {object|null} The action that was redone, or null if at end
   */
  redo() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Get the complete valid history (up to current index)
   * @returns {array} Array of actions
   */
  getHistory() {
    return this.history.slice(0, this.currentIndex + 1);
  }

  /**
   * Get a specific action by index
   * @param {number} index - Action index
   * @returns {object|null} Action or null if out of bounds
   */
  getActionAt(index) {
    if (index >= 0 && index <= this.currentIndex) {
      return this.history[index];
    }
    return null;
  }

  /**
   * Check if undo is possible
   * @returns {boolean} True if undo available
   */
  canUndo() {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is possible
   * @returns {boolean} True if redo available
   */
  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get the count of actions in current valid history
   * @returns {number} Number of actions
   */
  getActionCount() {
    return this.currentIndex + 1;
  }

  /**
   * Get state metadata
   * @returns {object} History statistics
   */
  getMetadata() {
    return {
      totalActions: this.history.length,
      currentIndex: this.currentIndex,
      validActions: this.getActionCount(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}

/**
 * Manages drawing state for a specific room
 * @class
 */
class RoomDrawingState {
  constructor(roomId) {
    this.roomId = roomId;
    this.state = new DrawingState();
    this.createdAt = new Date();
    this.lastModified = new Date();
  }

  /**
   * Add a drawing action
   * @param {string} userId - User who performed action
   * @param {string} type - Action type
   * @param {object} data - Action data
   * @returns {object} The added action
   */
  addAction(userId, type, data) {
    const action = this.state.addAction(userId, type, data);
    this.lastModified = new Date();
    return action;
  }

  /**
   * Undo last action
   * @returns {object|null} The undone action
   */
  undo() {
    const action = this.state.undo();
    if (action) {
      this.lastModified = new Date();
    }
    return action;
  }

  /**
   * Redo last undone action
   * @returns {object|null} The redone action
   */
  redo() {
    const action = this.state.redo();
    if (action) {
      this.lastModified = new Date();
    }
    return action;
  }

  /**
   * Get valid history for this room
   * @returns {array} Array of actions
   */
  getHistory() {
    return this.state.getHistory();
  }

  /**
   * Check if undo available
   * @returns {boolean} True if undo possible
   */
  canUndo() {
    return this.state.canUndo();
  }

  /**
   * Check if redo available
   * @returns {boolean} True if redo possible
   */
  canRedo() {
    return this.state.canRedo();
  }

  /**
   * Clear all history
   */
  clear() {
    this.state.clear();
    this.lastModified = new Date();
  }

  /**
   * Get room state metadata
   * @returns {object} Room state information
   */
  getMetadata() {
    return {
      roomId: this.roomId,
      createdAt: this.createdAt,
      lastModified: this.lastModified,
      ...this.state.getMetadata(),
    };
  }
}

/**
 * Manages drawing state for all rooms
 * @class
 */
class StateManager {
  constructor() {
    this.roomStates = new Map();
  }

  /**
   * Create or get drawing state for a room
   * @param {string} roomId - Room ID
   * @returns {object} RoomDrawingState instance
   */
  createRoomState(roomId) {
    if (!this.roomStates.has(roomId)) {
      const roomState = new RoomDrawingState(roomId);
      this.roomStates.set(roomId, roomState);
      console.log(`[StateManager] Drawing state created for room: ${roomId}`);
    }
    return this.roomStates.get(roomId);
  }

  /**
   * Get drawing state for a room
   * @param {string} roomId - Room ID
   * @returns {object|null} RoomDrawingState or null if not found
   */
  getRoomState(roomId) {
    return this.roomStates.get(roomId) || null;
  }

  /**
   * Delete drawing state for a room
   * @param {string} roomId - Room ID
   * @returns {boolean} True if deleted
   */
  deleteRoomState(roomId) {
    if (this.roomStates.has(roomId)) {
      this.roomStates.delete(roomId);
      console.log(`[StateManager] Drawing state deleted for room: ${roomId}`);
      return true;
    }
    return false;
  }

  /**
   * Check if room state exists
   * @param {string} roomId - Room ID
   * @returns {boolean} True if exists
   */
  hasRoomState(roomId) {
    return this.roomStates.has(roomId);
  }

  /**
   * Add drawing action to a room
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @param {string} type - Action type
   * @param {object} data - Action data
   * @returns {object|null} The added action or null if room not found
   */
  addAction(roomId, userId, type, data) {
    const roomState = this.getRoomState(roomId);
    if (!roomState) {
      console.warn(`[StateManager] Room state not found: ${roomId}`);
      return null;
    }
    return roomState.addAction(userId, type, data);
  }

  /**
   * Undo action in a room
   * @param {string} roomId - Room ID
   * @returns {object|null} The undone action or null
   */
  undo(roomId) {
    const roomState = this.getRoomState(roomId);
    if (!roomState) {
      console.warn(`[StateManager] Room state not found: ${roomId}`);
      return null;
    }
    return roomState.undo();
  }

  /**
   * Redo action in a room
   * @param {string} roomId - Room ID
   * @returns {object|null} The redone action or null
   */
  redo(roomId) {
    const roomState = this.getRoomState(roomId);
    if (!roomState) {
      console.warn(`[StateManager] Room state not found: ${roomId}`);
      return null;
    }
    return roomState.redo();
  }

  /**
   * Get complete history for a room
   * @param {string} roomId - Room ID
   * @returns {array|null} Array of actions or null if room not found
   */
  getHistory(roomId) {
    const roomState = this.getRoomState(roomId);
    return roomState ? roomState.getHistory() : null;
  }

  /**
   * Clear all actions in a room
   * @param {string} roomId - Room ID
   * @returns {boolean} True if cleared
   */
  clearRoom(roomId) {
    const roomState = this.getRoomState(roomId);
    if (roomState) {
      roomState.clear();
      return true;
    }
    return false;
  }

  /**
   * Get all room states
   * @returns {array} Array of RoomDrawingState objects
   */
  getAllRoomStates() {
    return Array.from(this.roomStates.values());
  }

  /**
   * Get manager statistics
   * @returns {object} Statistics about all rooms
   */
  getStatistics() {
    let totalActions = 0;
    const roomStats = [];

    this.roomStates.forEach((roomState) => {
      const metadata = roomState.getMetadata();
      totalActions += metadata.validActions;
      roomStats.push(metadata);
    });

    return {
      totalRooms: this.roomStates.size,
      totalActions,
      rooms: roomStats,
    };
  }
}

export { StateManager, RoomDrawingState, DrawingState, DrawingAction };
