/**
 * Drawing Synchronization Utility
 * Handles coordination between local drawing and remote drawing events
 */

/**
 * Drawing Action types
 */
export const ActionType = {
  STROKE: 'stroke',
  CLEAR: 'clear',
  UNDO: 'undo',
  REDO: 'redo',
};

/**
 * Create a stroke action for transmission
 */
export function createStrokeAction(tool, x, y, color, size) {
  return {
    type: ActionType.STROKE,
    tool,
    x,
    y,
    color,
    size,
    timestamp: Date.now(),
  };
}

/**
 * Create a clear action
 */
export function createClearAction() {
  return {
    type: ActionType.CLEAR,
    timestamp: Date.now(),
  };
}

/**
 * Create an undo action
 */
export function createUndoAction() {
  return {
    type: ActionType.UNDO,
    timestamp: Date.now(),
  };
}

/**
 * Create a redo action
 */
export function createRedoAction() {
  return {
    type: ActionType.REDO,
    timestamp: Date.now(),
  };
}

/**
 * Validate stroke data
 */
export function validateStroke(stroke) {
  if (!stroke) return false;

  const required = ['tool', 'x', 'y', 'color', 'size', 'timestamp'];
  for (const field of required) {
    if (stroke[field] === undefined || stroke[field] === null) {
      console.warn(`[DrawingSync] Missing field: ${field}`);
      return false;
    }
  }

  // Validate coordinate ranges (assuming canvas 0-1200, 0-600)
  if (stroke.x < 0 || stroke.x > 1200 || stroke.y < 0 || stroke.y > 600) {
    console.warn('[DrawingSync] Coordinates out of range');
    return false;
  }

  // Validate color format
  if (!/^#[0-9A-F]{6}$/i.test(stroke.color)) {
    console.warn('[DrawingSync] Invalid color format');
    return false;
  }

  // Validate size
  if (stroke.size < 1 || stroke.size > 100) {
    console.warn('[DrawingSync] Size out of range');
    return false;
  }

  return true;
}

/**
 * Batch multiple stroke actions
 */
export function batchStrokes(strokes) {
  if (!Array.isArray(strokes)) {
    return [];
  }

  return strokes.filter((stroke) => stroke.type === ActionType.STROKE);
}

/**
 * Calculate stroke similarity (for deduplication)
 * Returns true if strokes are likely the same (within threshold)
 */
export function areStrokesSimilar(stroke1, stroke2, threshold = 5) {
  if (!stroke1 || !stroke2) return false;

  const dx = Math.abs(stroke1.x - stroke2.x);
  const dy = Math.abs(stroke1.y - stroke2.y);
  const distance = Math.sqrt(dx * dx + dy * dy);

  return (
    distance <= threshold &&
    stroke1.color === stroke2.color &&
    stroke1.size === stroke2.size &&
    stroke1.tool === stroke2.tool
  );
}

/**
 * Create a remote stroke event with metadata
 */
export function createRemoteStrokeEvent(stroke, userId, userName) {
  return {
    ...stroke,
    userId,
    userName,
    isRemote: true,
    receivedAt: Date.now(),
  };
}

/**
 * Debounce drawing events to reduce network traffic
 */
export function createDrawingDebouncer(callback, delay = 16) {
  let timeoutId = null;
  let lastStroke = null;

  return {
    send(stroke) {
      lastStroke = stroke;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        if (lastStroke && callback) {
          callback(lastStroke);
        }
        lastStroke = null;
        timeoutId = null;
      }, delay);
    },

    flush() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (lastStroke && callback) {
        callback(lastStroke);
      }

      lastStroke = null;
      timeoutId = null;
    },

    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      lastStroke = null;
      timeoutId = null;
    },
  };
}

/**
 * Track drawing state for synchronization
 */
export class DrawingStateTracker {
  constructor() {
    this.localHistory = [];
    this.remoteHistory = [];
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistorySize = 500;
  }

  /**
   * Add local stroke to history
   */
  addLocalStroke(stroke) {
    if (!validateStroke(stroke)) {
      console.warn('[DrawingStateTracker] Invalid stroke rejected');
      return false;
    }

    this.localHistory.push(stroke);

    // Clear redo stack when new action is taken
    this.redoStack = [];

    // Maintain history size limit
    if (this.localHistory.length > this.maxHistorySize) {
      const removed = this.localHistory.shift();
      console.log('[DrawingStateTracker] History limit reached, removed oldest stroke');
    }

    return true;
  }

  /**
   * Add remote stroke to history
   */
  addRemoteStroke(stroke) {
    if (!validateStroke(stroke)) {
      console.warn('[DrawingStateTracker] Invalid remote stroke rejected');
      return false;
    }

    this.remoteHistory.push(stroke);

    // Maintain history size limit
    if (this.remoteHistory.length > this.maxHistorySize) {
      this.remoteHistory.shift();
    }

    return true;
  }

  /**
   * Get all strokes (local + remote) in order
   */
  getAllStrokes() {
    return [...this.localHistory, ...this.remoteHistory].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  /**
   * Clear all history
   */
  clear() {
    this.localHistory = [];
    this.remoteHistory = [];
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get history statistics
   */
  getStats() {
    return {
      localStrokes: this.localHistory.length,
      remoteStrokes: this.remoteHistory.length,
      totalStrokes: this.localHistory.length + this.remoteHistory.length,
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
    };
  }
}
