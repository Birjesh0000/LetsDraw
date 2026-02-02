/**
 * Room Manager Utility
 * Handles room-related operations and state management
 */

/**
 * Default room configuration
 */
const DEFAULT_ROOM_CONFIG = {
  id: 'default-room',
  name: 'Drawing Room',
  maxUsers: 10,
};

/**
 * Room Manager class
 */
export class RoomManager {
  constructor(socketService) {
    this.socketService = socketService;
    this.currentRoom = null;
    this.users = [];
    this.history = [];
    this.isJoining = false;
    this.joinTimeout = null;
    this.maxJoinAttempts = 3;
    this.joinAttempts = 0;

    // Event callbacks
    this.callbacks = {
      onRoomJoined: null,
      onRoomError: null,
      onUsersUpdated: null,
      onJoinAttempt: null,
    };
  }

  /**
   * Join a room with retry logic
   */
  async joinRoom(roomId = DEFAULT_ROOM_CONFIG.id, userData = {}) {
    if (this.isJoining) {
      console.warn('[RoomManager] Already joining a room');
      return false;
    }

    this.isJoining = true;
    this.joinAttempts = 0;

    return this._attemptJoin(roomId, userData);
  }

  /**
   * Attempt to join room with retry logic
   */
  async _attemptJoin(roomId, userData) {
    return new Promise((resolve) => {
      this.joinAttempts++;

      if (this.joinAttempts > this.maxJoinAttempts) {
        console.error('[RoomManager] Max join attempts exceeded');
        this.isJoining = false;

        if (this.callbacks.onRoomError) {
          this.callbacks.onRoomError({
            message: 'Failed to join room after max attempts',
            attempts: this.joinAttempts,
          });
        }

        resolve(false);
        return;
      }

      console.log(
        `[RoomManager] Attempting to join room "${roomId}" (attempt ${this.joinAttempts}/${this.maxJoinAttempts})`
      );

      if (this.callbacks.onJoinAttempt) {
        this.callbacks.onJoinAttempt(this.joinAttempts);
      }

      // Setup one-time listener for room-joined response
      const timeoutHandle = setTimeout(() => {
        console.error('[RoomManager] Room join attempt timed out');
        this._attemptJoin(roomId, userData).then(resolve);
      }, 5000); // 5 second timeout

      // Emit join request with acknowledgment
      this.socketService.joinRoom(roomId, {
        ...userData,
        joinedAt: Date.now(),
      });

      // Listen for room-joined event
      const originalCallback = this.socketService.callbacks.onRoomJoined;
      this.socketService.callbacks.onRoomJoined = (data) => {
        clearTimeout(timeoutHandle);
        this.isJoining = false;
        this.joinAttempts = 0;

        // Store room data
        this.currentRoom = {
          id: data.roomId,
          users: data.users || [],
          history: data.history || [],
          metadata: data.metadata || {},
        };

        this.users = data.users || [];
        this.history = data.history || [];

        console.log(
          `[RoomManager] Successfully joined room "${roomId}" with ${this.users.length} users`
        );

        if (this.callbacks.onRoomJoined) {
          this.callbacks.onRoomJoined(data);
        }

        // Restore original callback
        if (originalCallback) {
          this.socketService.callbacks.onRoomJoined = originalCallback;
        }

        resolve(true);
      };
    });
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    if (this.currentRoom) {
      console.log(`[RoomManager] Leaving room "${this.currentRoom.id}"`);
      this.socketService.disconnect();
      this.currentRoom = null;
      this.users = [];
      this.history = [];
    }
  }

  /**
   * Update users list when user joins
   * Now receives full user list from server to ensure consistency
   */
  handleUserJoined(data) {
    // If server sends full user list, use it directly (most reliable)
    if (data.users && Array.isArray(data.users)) {
      this.users = data.users;
      console.log(`[RoomManager] User joined: ${data.user?.name || data.id} - synced user list (${this.users.length} total)`);
    } else {
      // Fallback to local list management if server doesn't send full list
      const userData = data.user || data;
      const existingIndex = this.users.findIndex((u) => u.id === userData.id);

      if (existingIndex === -1) {
        this.users.push(userData);
        console.log(`[RoomManager] User joined: ${userData.name}`);
      } else {
        console.log(`[RoomManager] User rejoined: ${userData.name}`);
      }
    }

    if (this.callbacks.onUsersUpdated) {
      this.callbacks.onUsersUpdated(this.users);
    }
  }

  /**
   * Update users list when user leaves
   * Now receives full user list from server to ensure consistency
   */
  handleUserLeft(data) {
    // If server sends full user list, use it directly (most reliable)
    if (data.users && Array.isArray(data.users)) {
      this.users = data.users;
      console.log(`[RoomManager] User left - synced user list (${this.users.length} remaining)`);
    } else {
      // Fallback to local list management if server doesn't send full list
      const userIndex = this.users.findIndex((u) => u.id === data.userId || u.id === data.id);

      if (userIndex !== -1) {
        const userName = this.users[userIndex].name;
        this.users.splice(userIndex, 1);
        console.log(`[RoomManager] User left: ${userName}`);
      }
    }

    if (this.callbacks.onUsersUpdated) {
      this.callbacks.onUsersUpdated(this.users);
    }
  }

  /**
   * Get current room info
   */
  getRoomInfo() {
    return {
      currentRoom: this.currentRoom?.id || null,
      userCount: this.users.length,
      users: this.users,
      historySize: this.history.length,
      isJoining: this.isJoining,
    };
  }

  /**
   * Register event callback
   */
  on(eventName, callback) {
    const callbackKey = `on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`;
    if (this.callbacks.hasOwnProperty(callbackKey)) {
      this.callbacks[callbackKey] = callback;
    } else {
      console.warn(`[RoomManager] Unknown event: ${eventName}`);
    }
  }

  /**
   * Check if user is in room
   */
  isUserInRoom(userId) {
    return this.users.some((u) => u.id === userId);
  }

  /**
   * Get user by ID
   */
  getUser(userId) {
    return this.users.find((u) => u.id === userId);
  }

  /**
   * Get all users except current user
   */
  getOtherUsers(currentUserId) {
    return this.users.filter((u) => u.id !== currentUserId);
  }
}

/**
 * Create default room manager instance
 */
export function createRoomManager(socketService) {
  return new RoomManager(socketService);
}

export default RoomManager;
