/**
 * User Cursor Manager
 * Tracks and renders remote user cursors and presence indicators
 */

/**
 * Remote cursor representation
 */
export class RemoteCursor {
  constructor(userId, userName, color) {
    this.userId = userId;
    this.userName = userName;
    this.color = color;
    this.x = 0;
    this.y = 0;
    this.isDrawing = false;
    this.lastUpdated = Date.now();
    this.opacity = 1;
  }

  /**
   * Update cursor position
   */
  updatePosition(x, y, isDrawing = false) {
    this.x = x;
    this.y = y;
    this.isDrawing = isDrawing;
    this.lastUpdated = Date.now();
    this.opacity = 1; // Reset opacity on update
  }

  /**
   * Check if cursor is stale (hasn't been updated recently)
   */
  isStale(staleDuration = 5000) {
    return Date.now() - this.lastUpdated > staleDuration;
  }

  /**
   * Fade cursor opacity based on age
   */
  updateOpacity(maxAge = 3000) {
    const age = Date.now() - this.lastUpdated;
    if (age > maxAge) {
      this.opacity = 0;
    } else {
      this.opacity = 1 - age / maxAge;
    }
  }
}

/**
 * User Cursor Manager class
 * Manages multiple remote user cursors
 */
export class UserCursorManager {
  constructor(socketService, canvasElement) {
    this.socketService = socketService;
    this.canvas = canvasElement;
    this.ctx = canvasElement ? canvasElement.getContext('2d') : null;

    // Remote cursors map
    this.remoteCursors = new Map();

    // Rendering settings
    this.cursorSize = 8;
    this.labelFontSize = 12;
    this.staleCursorDuration = 5000;
    this.fadeOutDuration = 3000;

    // Animation frame
    this.animationFrameId = null;
    this.isAnimating = false;

    // Event callbacks
    this.callbacks = {
      onCursorAdded: null,
      onCursorRemoved: null,
      onCursorUpdated: null,
    };

    console.log('[UserCursorManager] Initialized');
  }

  /**
   * Add or update remote cursor
   */
  addRemoteCursor(userId, userName, color) {
    if (!this.remoteCursors.has(userId)) {
      const cursor = new RemoteCursor(userId, userName, color);
      this.remoteCursors.set(userId, cursor);

      console.log(`[UserCursorManager] Cursor added: ${userName}`);

      if (this.callbacks.onCursorAdded) {
        this.callbacks.onCursorAdded(cursor);
      }

      return cursor;
    }

    return this.remoteCursors.get(userId);
  }

  /**
   * Remove remote cursor
   */
  removeRemoteCursor(userId) {
    if (this.remoteCursors.has(userId)) {
      const cursor = this.remoteCursors.get(userId);
      this.remoteCursors.delete(userId);

      console.log(`[UserCursorManager] Cursor removed: ${cursor.userName}`);

      if (this.callbacks.onCursorRemoved) {
        this.callbacks.onCursorRemoved(cursor);
      }

      return true;
    }

    return false;
  }

  /**
   * Update cursor position
   */
  updateCursorPosition(userId, x, y, isDrawing = false) {
    const cursor = this.remoteCursors.get(userId);

    if (cursor) {
      cursor.updatePosition(x, y, isDrawing);

      if (this.callbacks.onCursorUpdated) {
        this.callbacks.onCursorUpdated(cursor);
      }

      return true;
    }

    return false;
  }

  /**
   * Get all remote cursors
   */
  getAllCursors() {
    return Array.from(this.remoteCursors.values());
  }

  /**
   * Get cursor by user ID
   */
  getCursor(userId) {
    return this.remoteCursors.get(userId);
  }

  /**
   * Start rendering animation loop
   */
  startRendering() {
    if (this.isAnimating) return;

    this.isAnimating = true;
    console.log('[UserCursorManager] Started rendering');

    const render = () => {
      if (this.isAnimating) {
        this.renderCursors();
        this.animationFrameId = requestAnimationFrame(render);
      }
    };

    this.animationFrameId = requestAnimationFrame(render);
  }

  /**
   * Stop rendering animation loop
   */
  stopRendering() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.isAnimating = false;
    console.log('[UserCursorManager] Stopped rendering');
  }

  /**
   * Render all cursors on canvas
   */
  renderCursors() {
    if (!this.ctx || !this.canvas) return;

    // Clean up stale cursors
    const staleCursors = Array.from(this.remoteCursors.values()).filter((c) =>
      c.isStale(this.staleCursorDuration)
    );

    staleCursors.forEach((cursor) => {
      console.log(`[UserCursorManager] Removing stale cursor: ${cursor.userName}`);
      this.removeRemoteCursor(cursor.userId);
    });

    // Update opacities and render
    this.remoteCursors.forEach((cursor) => {
      cursor.updateOpacity(this.fadeOutDuration);

      if (cursor.opacity > 0.1) {
        this.renderCursor(cursor);
      }
    });
  }

  /**
   * Render a single cursor
   */
  renderCursor(cursor) {
    if (!this.ctx || cursor.opacity < 0.01) return;

    const ctx = this.ctx;

    // Save context state
    ctx.save();
    ctx.globalAlpha = cursor.opacity;

    // Draw cursor circle
    ctx.fillStyle = cursor.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, this.cursorSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw crosshair
    ctx.strokeStyle = cursor.color;
    ctx.lineWidth = 1;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(cursor.x - 10, cursor.y);
    ctx.lineTo(cursor.x + 10, cursor.y);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(cursor.x, cursor.y - 10);
    ctx.lineTo(cursor.x, cursor.y + 10);
    ctx.stroke();

    // Draw label
    const labelX = cursor.x + 15;
    const labelY = cursor.y - 10;

    ctx.font = `bold ${this.labelFontSize}px Arial`;
    ctx.fillStyle = cursor.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    // Background for label
    const metrics = ctx.measureText(cursor.userName);
    const textWidth = metrics.width;
    const textHeight = this.labelFontSize + 4;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(labelX - 2, labelY - textHeight + 2, textWidth + 4, textHeight);

    // Label text
    ctx.fillStyle = cursor.color;
    ctx.fillText(cursor.userName, labelX, labelY);

    // Draw drawing indicator
    if (cursor.isDrawing) {
      ctx.fillStyle = '#FFD700';
      ctx.font = `${this.labelFontSize - 2}px Arial`;
      ctx.fillText('✎ drawing', labelX, labelY + 12);
    }

    // Restore context state
    ctx.restore();
  }

  /**
   * Clear all cursors
   */
  clearAllCursors() {
    const count = this.remoteCursors.size;
    this.remoteCursors.clear();
    console.log(`[UserCursorManager] Cleared ${count} cursors`);
  }

  /**
   * Register event callback
   */
  on(eventName, callback) {
    const callbackKey = `on${eventName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')}`;

    if (this.callbacks.hasOwnProperty(callbackKey)) {
      this.callbacks[callbackKey] = callback;
    } else {
      console.warn(`[UserCursorManager] Unknown event: ${eventName}`);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeCursors: this.remoteCursors.size,
      isAnimating: this.isAnimating,
      cursorsList: Array.from(this.remoteCursors.entries()).map(([id, cursor]) => ({
        userId: id,
        userName: cursor.userName,
        isDrawing: cursor.isDrawing,
        opacity: cursor.opacity,
      })),
    };
  }
}

/**
 * Create user cursor manager instance
 */
export function createUserCursorManager(socketService, canvasElement) {
  return new UserCursorManager(socketService, canvasElement);
}

export default UserCursorManager;
