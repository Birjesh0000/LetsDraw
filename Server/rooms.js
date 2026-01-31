/**
 * Room and session management for collaborative drawing rooms
 * Handles user sessions, room creation, and room lifecycle
 */

class DrawingRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.users = new Map();
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Add a user to the room
   * @param {string} userId - Unique user identifier (socket id)
   * @param {object} userInfo - User information
   * @returns {object} The added user object
   */
  addUser(userId, userInfo = {}) {
    const user = {
      id: userId,
      name: userInfo.name || `User-${userId.slice(0, 5)}`,
      color: userInfo.color || this.generateRandomColor(),
      joinedAt: new Date(),
      isActive: true,
    };

    this.users.set(userId, user);
    this.updatedAt = new Date();

    return user;
  }

  /**
   * Remove a user from the room
   * @param {string} userId - User ID to remove
   * @returns {boolean} True if user was removed, false if not found
   */
  removeUser(userId) {
    const existed = this.users.has(userId);
    if (existed) {
      this.users.delete(userId);
      this.updatedAt = new Date();
    }
    return existed;
  }

  /**
   * Get a specific user from the room
   * @param {string} userId - User ID to retrieve
   * @returns {object|null} User object or null if not found
   */
  getUser(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * Get all users in the room
   * @returns {array} Array of user objects
   */
  getUsers() {
    return Array.from(this.users.values());
  }

  /**
   * Get the number of users in the room
   * @returns {number} User count
   */
  getUserCount() {
    return this.users.size;
  }

  /**
   * Check if a user exists in the room
   * @param {string} userId - User ID to check
   * @returns {boolean} True if user exists
   */
  hasUser(userId) {
    return this.users.has(userId);
  }

  /**
   * Check if room is empty
   * @returns {boolean} True if no users in room
   */
  isEmpty() {
    return this.users.size === 0;
  }

  /**
   * Get room metadata
   * @returns {object} Room information
   */
  getMetadata() {
    return {
      roomId: this.roomId,
      userCount: this.getUserCount(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Generate a random color for user identification
   * @returns {string} Hex color code
   */
  generateRandomColor() {
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Light Salmon
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2', // Light Blue
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  /**
   * Create a new room
   * @param {string} roomId - Unique room identifier
   * @returns {object} The created room
   */
  createRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      const room = new DrawingRoom(roomId);
      this.rooms.set(roomId, room);
      console.log(`[RoomManager] Room created: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  /**
   * Get a room by ID
   * @param {string} roomId - Room ID to retrieve
   * @returns {object|null} Room object or null if not found
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Delete a room
   * @param {string} roomId - Room ID to delete
   * @returns {boolean} True if room was deleted, false if not found
   */
  deleteRoom(roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.delete(roomId);
      console.log(`[RoomManager] Room deleted: ${roomId}`);
      return true;
    }
    return false;
  }

  /**
   * Check if a room exists
   * @param {string} roomId - Room ID to check
   * @returns {boolean} True if room exists
   */
  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  /**
   * Get all active rooms
   * @returns {array} Array of room objects
   */
  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room count
   * @returns {number} Number of active rooms
   */
  getRoomCount() {
    return this.rooms.size;
  }

  /**
   * Add user to a room
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @param {object} userInfo - User information
   * @returns {object|null} User object or null if room doesn't exist
   */
  addUserToRoom(roomId, userId, userInfo = {}) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.warn(`[RoomManager] Room not found: ${roomId}`);
      return null;
    }
    const user = room.addUser(userId, userInfo);
    console.log(`[RoomManager] User ${userId} added to room ${roomId}`);
    return user;
  }

  /**
   * Remove user from a room
   * @param {string} roomId - Room ID
   * @param {string} userId - User ID
   * @returns {boolean} True if user was removed
   */
  removeUserFromRoom(roomId, userId) {
    const room = this.getRoom(roomId);
    if (!room) {
      console.warn(`[RoomManager] Room not found: ${roomId}`);
      return false;
    }

    const removed = room.removeUser(userId);
    console.log(`[RoomManager] User ${userId} removed from room ${roomId}`);

    // Clean up empty rooms
    if (room.isEmpty()) {
      this.deleteRoom(roomId);
    }

    return removed;
  }

  /**
   * Get all users in a room
   * @param {string} roomId - Room ID
   * @returns {array|null} Array of users or null if room doesn't exist
   */
  getUsersInRoom(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.getUsers() : null;
  }

  /**
   * Get room statistics
   * @returns {object} Statistics about all rooms
   */
  getStatistics() {
    let totalUsers = 0;
    this.rooms.forEach((room) => {
      totalUsers += room.getUserCount();
    });

    return {
      totalRooms: this.getRoomCount(),
      totalUsers,
      rooms: this.getAllRooms().map((room) => room.getMetadata()),
    };
  }
}

export { RoomManager, DrawingRoom };
