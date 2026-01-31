/**
 * Conflict Resolver
 * Handles simultaneous drawing actions and maintains state consistency
 */

/**
 * Conflict detection types
 */
export const ConflictType = {
  NO_CONFLICT: 'no-conflict',
  OVERLAPPING_STROKE: 'overlapping-stroke',
  CLEAR_DURING_DRAW: 'clear-during-draw',
  UNDO_AFTER_DRAW: 'undo-after-draw',
  ORDER_MISMATCH: 'order-mismatch',
  STALE_ACTION: 'stale-action',
};

/**
 * Conflict resolution strategies
 */
export const ResolutionStrategy = {
  ACCEPT: 'accept', // Accept the incoming action
  REJECT: 'reject', // Reject the incoming action
  MERGE: 'merge', // Merge conflicting actions
  REBUILD: 'rebuild', // Rebuild canvas from history
};

/**
 * Action sequencer class
 * Maintains action ordering and detects conflicts
 */
export class ActionSequencer {
  constructor() {
    this.actionQueue = [];
    this.processedActions = [];
    this.conflictLog = [];
    this.lastProcessedTimestamp = 0;
    this.maxQueueSize = 1000;

    console.log('[ActionSequencer] Initialized');
  }

  /**
   * Add action to queue for processing
   */
  enqueueAction(action) {
    if (!action) return false;

    // Validate action
    if (!this._validateAction(action)) {
      console.warn('[ActionSequencer] Invalid action rejected');
      return false;
    }

    // Check queue size
    if (this.actionQueue.length >= this.maxQueueSize) {
      console.warn('[ActionSequencer] Queue size limit reached, removing oldest action');
      this.actionQueue.shift();
    }

    this.actionQueue.push({
      ...action,
      enqueuedAt: Date.now(),
      processed: false,
    });

    return true;
  }

  /**
   * Process queued actions in order
   */
  processQueue() {
    const processedBatch = [];

    while (this.actionQueue.length > 0) {
      const action = this.actionQueue.shift();

      // Check for conflicts with last processed action
      const conflict = this._detectConflict(action);

      if (conflict.type !== ConflictType.NO_CONFLICT) {
        const resolved = this._resolveConflict(action, conflict);

        this.conflictLog.push({
          action,
          conflict,
          resolution: resolved,
          timestamp: Date.now(),
        });

        if (!resolved.shouldProcess) {
          console.log(
            `[ActionSequencer] Action rejected due to ${conflict.type}`
          );
          continue;
        }
      }

      action.processed = true;
      action.processedAt = Date.now();
      this.processedActions.push(action);
      this.lastProcessedTimestamp = action.timestamp || Date.now();

      processedBatch.push(action);
    }

    return processedBatch;
  }

  /**
   * Validate action structure
   */
  _validateAction(action) {
    if (!action.type) return false;
    if (!action.userId) return false;
    if (action.timestamp === undefined) return false;

    // Type-specific validation
    switch (action.type) {
      case 'stroke':
        return this._validateStrokeAction(action);
      case 'clear':
        return true;
      case 'undo':
        return true;
      case 'redo':
        return true;
      default:
        return false;
    }
  }

  /**
   * Validate stroke action
   */
  _validateStrokeAction(action) {
    const { data } = action;
    if (!data) return false;

    const { x, y, color, size, tool } = data;

    if (x === undefined || y === undefined) return false;
    if (typeof color !== 'string' || !/^#[0-9A-F]{6}$/i.test(color))
      return false;
    if (!Number.isInteger(size) || size < 1 || size > 100) return false;
    if (!['brush', 'eraser'].includes(tool)) return false;

    return true;
  }

  /**
   * Detect conflicts with previously processed actions
   */
  _detectConflict(action) {
    // Check if action is too old (stale)
    const now = Date.now();
    if (now - action.timestamp > 30000) {
      return {
        type: ConflictType.STALE_ACTION,
        message: 'Action is older than 30 seconds',
      };
    }

    // Check action ordering
    if (action.timestamp < this.lastProcessedTimestamp) {
      return {
        type: ConflictType.ORDER_MISMATCH,
        message: 'Action timestamp is before last processed action',
      };
    }

    // Check for clear operations conflicting with recent strokes
    if (action.type === 'clear') {
      const recentStrokes = this.processedActions.filter(
        (a) => a.type === 'stroke' && now - a.timestamp < 1000
      );

      if (recentStrokes.length > 0) {
        return {
          type: ConflictType.CLEAR_DURING_DRAW,
          message: 'Clear operation during recent drawing activity',
          affectedActions: recentStrokes.length,
        };
      }
    }

    return {
      type: ConflictType.NO_CONFLICT,
    };
  }

  /**
   * Resolve detected conflicts
   */
  _resolveConflict(action, conflict) {
    switch (conflict.type) {
      case ConflictType.NO_CONFLICT:
        return { shouldProcess: true, strategy: ResolutionStrategy.ACCEPT };

      case ConflictType.STALE_ACTION:
        // Reject stale actions
        return { shouldProcess: false, strategy: ResolutionStrategy.REJECT };

      case ConflictType.ORDER_MISMATCH:
        // Re-insert action in correct position and rebuild
        return {
          shouldProcess: true,
          strategy: ResolutionStrategy.REBUILD,
          requiresRebuild: true,
        };

      case ConflictType.CLEAR_DURING_DRAW:
        // Accept clear but mark for rebuild
        return {
          shouldProcess: true,
          strategy: ResolutionStrategy.MERGE,
          requiresRebuild: true,
        };

      default:
        return { shouldProcess: true, strategy: ResolutionStrategy.ACCEPT };
    }
  }

  /**
   * Check if canvas rebuild is needed
   */
  needsRebuild() {
    return this.conflictLog.some(
      (log) => log.resolution.requiresRebuild === true
    );
  }

  /**
   * Get actions that need to be replayed
   */
  getActionsToReplay() {
    return this.processedActions
      .filter((a) => a.type === 'stroke')
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all tracked data
   */
  clear() {
    this.actionQueue = [];
    this.processedActions = [];
    this.conflictLog = [];
    this.lastProcessedTimestamp = 0;
    console.log('[ActionSequencer] Cleared');
  }

  /**
   * Get sequencer statistics
   */
  getStats() {
    return {
      queueSize: this.actionQueue.length,
      processedCount: this.processedActions.length,
      conflictCount: this.conflictLog.length,
      lastProcessedTimestamp: this.lastProcessedTimestamp,
      recentConflicts: this.conflictLog.slice(-10),
    };
  }
}

/**
 * Canvas state validator
 * Verifies canvas consistency
 */
export class CanvasStateValidator {
  constructor() {
    this.knownStates = new Map();
    this.stateCheckpoints = [];

    console.log('[CanvasStateValidator] Initialized');
  }

  /**
   * Record canvas state checkpoint
   */
  recordCheckpoint(timestamp, stateHash, metadata = {}) {
    this.stateCheckpoints.push({
      timestamp,
      stateHash,
      metadata,
      recorded: Date.now(),
    });

    // Keep only last 100 checkpoints
    if (this.stateCheckpoints.length > 100) {
      this.stateCheckpoints.shift();
    }
  }

  /**
   * Verify current state matches expected state
   */
  verifyState(currentHash, expectedHash, timestamp) {
    if (currentHash === expectedHash) {
      return {
        isValid: true,
        message: 'State matches expected',
      };
    }

    // Check if state matches any recent checkpoint
    const matchingCheckpoint = this.stateCheckpoints.find(
      (cp) => cp.stateHash === currentHash && Math.abs(cp.timestamp - timestamp) < 5000
    );

    if (matchingCheckpoint) {
      return {
        isValid: true,
        message: 'State matches recent checkpoint',
        matchedCheckpoint: matchingCheckpoint,
      };
    }

    return {
      isValid: false,
      message: 'State mismatch - potential corruption',
      currentHash,
      expectedHash,
    };
  }

  /**
   * Get closest matching state
   */
  findClosestState(timestamp, stateHash) {
    return this.stateCheckpoints.reduce((closest, checkpoint) => {
      const timeDiff = Math.abs(checkpoint.timestamp - timestamp);
      const closestTimeDiff = Math.abs(closest.timestamp - timestamp);

      return timeDiff < closestTimeDiff ? checkpoint : closest;
    });
  }

  /**
   * Clear validation history
   */
  clear() {
    this.knownStates.clear();
    this.stateCheckpoints = [];
  }

  /**
   * Get validator statistics
   */
  getStats() {
    return {
      checkpointCount: this.stateCheckpoints.length,
      stateCount: this.knownStates.size,
    };
  }
}

/**
 * Create action sequencer instance
 */
export function createActionSequencer() {
  return new ActionSequencer();
}

/**
 * Create canvas state validator instance
 */
export function createCanvasStateValidator() {
  return new CanvasStateValidator();
}

export default {
  ActionSequencer,
  CanvasStateValidator,
  ConflictType,
  ResolutionStrategy,
};
