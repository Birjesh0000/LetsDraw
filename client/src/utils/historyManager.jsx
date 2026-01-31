/**
 * History Manager Utility
 * Manages undo/redo state and history for collaborative drawing
 * Ensures consistency between local and remote undo/redo operations
 */

/**
 * History state types
 */
export const HistoryState = {
  IDLE: 'idle',
  WAITING_UNDO: 'waiting-undo',
  WAITING_REDO: 'waiting-redo',
};

/**
 * History Manager class
 * Tracks undo/redo capability and synchronizes with server
 */
export class HistoryManager {
  constructor(socketService) {
    this.socketService = socketService;

    // Undo/Redo state
    this.canUndo = false;
    this.canRedo = false;
    this.historyState = HistoryState.IDLE;

    // History metadata
    this.historySize = 0;
    this.undoStackSize = 0;
    this.redoStackSize = 0;

    // Server sync state
    this.lastHistorySize = 0;
    this.syncAttempts = 0;
    this.maxSyncAttempts = 3;

    // Event callbacks
    this.callbacks = {
      onHistoryChanged: null,
      onCanUndoChanged: null,
      onCanRedoChanged: null,
      onUndoComplete: null,
      onRedoComplete: null,
      onHistoryError: null,
      onHistorySync: null,
    };

    console.log('[HistoryManager] Initialized');
  }

  /**
   * Request undo from server
   */
  async requestUndo() {
    if (!this.canUndo) {
      console.warn('[HistoryManager] Cannot undo - no undo available');
      return false;
    }

    if (this.historyState !== HistoryState.IDLE) {
      console.warn(
        `[HistoryManager] Cannot undo - currently in ${this.historyState} state`
      );
      return false;
    }

    console.log('[HistoryManager] Requesting undo...');
    this.historyState = HistoryState.WAITING_UNDO;

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        console.error('[HistoryManager] Undo request timed out');
        this.historyState = HistoryState.IDLE;

        if (this.callbacks.onHistoryError) {
          this.callbacks.onHistoryError({
            operation: 'undo',
            message: 'Undo request timed out',
          });
        }

        resolve(false);
      }, 5000);

      // Store resolve handler for later
      this._undoResolve = resolve;
      this._undoTimeout = timeoutHandle;

      // Emit undo request
      this.socketService.requestUndo();
    });
  }

  /**
   * Request redo from server
   */
  async requestRedo() {
    if (!this.canRedo) {
      console.warn('[HistoryManager] Cannot redo - no redo available');
      return false;
    }

    if (this.historyState !== HistoryState.IDLE) {
      console.warn(
        `[HistoryManager] Cannot redo - currently in ${this.historyState} state`
      );
      return false;
    }

    console.log('[HistoryManager] Requesting redo...');
    this.historyState = HistoryState.WAITING_REDO;

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        console.error('[HistoryManager] Redo request timed out');
        this.historyState = HistoryState.IDLE;

        if (this.callbacks.onHistoryError) {
          this.callbacks.onHistoryError({
            operation: 'redo',
            message: 'Redo request timed out',
          });
        }

        resolve(false);
      }, 5000);

      // Store resolve handler for later
      this._redoResolve = resolve;
      this._redoTimeout = timeoutHandle;

      // Emit redo request
      this.socketService.requestRedo();
    });
  }

  /**
   * Handle undo operation response from server
   */
  handleUndoResponse(data) {
    console.log('[HistoryManager] Undo response received');

    if (this._undoTimeout) {
      clearTimeout(this._undoTimeout);
    }

    // Update state from server response
    if (data) {
      this.updateHistoryState(data);
    }

    // Resolve the promise
    if (this._undoResolve) {
      this._undoResolve(true);
      this._undoResolve = null;
    }

    // Reset state
    this.historyState = HistoryState.IDLE;

    // Trigger callback
    if (this.callbacks.onUndoComplete) {
      this.callbacks.onUndoComplete(data);
    }
  }

  /**
   * Handle redo operation response from server
   */
  handleRedoResponse(data) {
    console.log('[HistoryManager] Redo response received');

    if (this._redoTimeout) {
      clearTimeout(this._redoTimeout);
    }

    // Update state from server response
    if (data) {
      this.updateHistoryState(data);
    }

    // Resolve the promise
    if (this._redoResolve) {
      this._redoResolve(true);
      this._redoResolve = null;
    }

    // Reset state
    this.historyState = HistoryState.IDLE;

    // Trigger callback
    if (this.callbacks.onRedoComplete) {
      this.callbacks.onRedoComplete(data);
    }
  }

  /**
   * Handle initial room state with history info
   */
  handleInitialHistoryState(data) {
    console.log('[HistoryManager] Initial history state received');

    if (!data) return;

    // Update from server response
    this.updateHistoryState(data);

    // Trigger sync callback
    if (this.callbacks.onHistorySync) {
      this.callbacks.onHistorySync(this.getState());
    }
  }

  /**
   * Update history state from server response
   */
  updateHistoryState(data) {
    const previousCanUndo = this.canUndo;
    const previousCanRedo = this.canRedo;

    // Extract history metadata from server response
    if (data.canUndo !== undefined) {
      this.canUndo = data.canUndo;
    }

    if (data.canRedo !== undefined) {
      this.canRedo = data.canRedo;
    }

    if (data.historySize !== undefined) {
      this.historySize = data.historySize;
    }

    if (data.undoStackSize !== undefined) {
      this.undoStackSize = data.undoStackSize;
    }

    if (data.redoStackSize !== undefined) {
      this.redoStackSize = data.redoStackSize;
    }

    // Trigger callbacks on state changes
    if (previousCanUndo !== this.canUndo) {
      if (this.callbacks.onCanUndoChanged) {
        this.callbacks.onCanUndoChanged(this.canUndo);
      }
    }

    if (previousCanRedo !== this.canRedo) {
      if (this.callbacks.onCanRedoChanged) {
        this.callbacks.onCanRedoChanged(this.canRedo);
      }
    }

    if (this.callbacks.onHistoryChanged) {
      this.callbacks.onHistoryChanged(this.getState());
    }

    console.log(
      `[HistoryManager] State updated: canUndo=${this.canUndo}, canRedo=${this.canRedo}, historySize=${this.historySize}`
    );
  }

  /**
   * Clear history state (on room clear or disconnect)
   */
  clear() {
    console.log('[HistoryManager] Clearing history');

    this.canUndo = false;
    this.canRedo = false;
    this.historyState = HistoryState.IDLE;
    this.historySize = 0;
    this.undoStackSize = 0;
    this.redoStackSize = 0;

    if (this.callbacks.onCanUndoChanged) {
      this.callbacks.onCanUndoChanged(false);
    }

    if (this.callbacks.onCanRedoChanged) {
      this.callbacks.onCanRedoChanged(false);
    }
  }

  /**
   * Get current history state
   */
  getState() {
    return {
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      historyState: this.historyState,
      historySize: this.historySize,
      undoStackSize: this.undoStackSize,
      redoStackSize: this.redoStackSize,
      isBusy: this.historyState !== HistoryState.IDLE,
    };
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
      console.warn(`[HistoryManager] Unknown event: ${eventName}`);
    }
  }

  /**
   * Cancel pending undo/redo operations
   */
  cancelPendingOperations() {
    if (this._undoTimeout) {
      clearTimeout(this._undoTimeout);
      this._undoTimeout = null;
    }

    if (this._redoTimeout) {
      clearTimeout(this._redoTimeout);
      this._redoTimeout = null;
    }

    if (this._undoResolve) {
      this._undoResolve(false);
      this._undoResolve = null;
    }

    if (this._redoResolve) {
      this._redoResolve(false);
      this._redoResolve = null;
    }

    this.historyState = HistoryState.IDLE;
  }
}

/**
 * Create history manager instance
 */
export function createHistoryManager(socketService) {
  return new HistoryManager(socketService);
}

export default HistoryManager;
