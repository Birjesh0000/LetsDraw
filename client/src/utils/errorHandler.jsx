/**
 * Error Handler & Notification System
 * Manages application errors, recovery, and user notifications
 */

export class ErrorNotificationManager {
  constructor() {
    this.notifications = [];
    this.callbacks = {
      onNotificationAdded: null,
      onNotificationRemoved: null,
      onErrorOccurred: null,
    };
    this.autoHideDuration = 5000; // 5 seconds for info/success
    this.errorDuration = 8000; // 8 seconds for errors
    this.criticalDuration = 15000; // 15 seconds for critical
  }

  /**
   * Create and add a notification
   */
  notify(message, type = 'info', duration = null) {
    const id = Date.now() + Math.random();
    const finalDuration =
      duration ||
      (type === 'error'
        ? this.errorDuration
        : type === 'critical'
          ? this.criticalDuration
          : this.autoHideDuration);

    const notification = {
      id,
      message,
      type, // 'info', 'success', 'warning', 'error', 'critical'
      timestamp: Date.now(),
      duration: finalDuration,
      dismissed: false,
    };

    this.notifications.push(notification);

    if (this.callbacks.onNotificationAdded) {
      this.callbacks.onNotificationAdded(notification);
    }

    // Auto-hide if duration is set
    if (finalDuration > 0) {
      setTimeout(() => this.dismissNotification(id), finalDuration);
    }

    return id;
  }

  /**
   * Dismiss a notification by ID
   */
  dismissNotification(id) {
    const notification = this.notifications.find((n) => n.id === id);
    if (notification && !notification.dismissed) {
      notification.dismissed = true;

      if (this.callbacks.onNotificationRemoved) {
        this.callbacks.onNotificationRemoved(id);
      }

      // Remove from array
      this.notifications = this.notifications.filter((n) => n.id !== id);
    }
  }

  /**
   * Dismiss all notifications
   */
  dismissAll() {
    const ids = this.notifications.map((n) => n.id);
    ids.forEach((id) => this.dismissNotification(id));
  }

  /**
   * Log and notify an error
   */
  notifyError(title, details = '', error = null) {
    console.error(`[Error] ${title}`, details, error);

    const message = details ? `${title}: ${details}` : title;
    const id = this.notify(message, 'error');

    if (this.callbacks.onErrorOccurred) {
      this.callbacks.onErrorOccurred({ title, details, error, id });
    }

    return id;
  }

  /**
   * Subscribe to notification events
   */
  on(event, callback) {
    if (this.callbacks[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`]) {
      this.callbacks[
        `on${event.charAt(0).toUpperCase()}${event.slice(1)}`
      ] = callback;
    }
  }

  /**
   * Get all active notifications
   */
  getNotifications() {
    return [...this.notifications];
  }

  /**
   * Clear all notifications
   */
  clear() {
    this.notifications = [];
  }
}

/**
 * Reconnection Strategy Manager
 * Handles automatic reconnection with configurable strategies
 */
export class ReconnectionManager {
  constructor(options = {}) {
    this.isAttemptingReconnect = false;
    this.reconnectAttempts = 0;
    this.maxAttempts = options.maxAttempts || 10;
    this.baseDelay = options.baseDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.backoffMultiplier = options.backoffMultiplier || 1.5;
    this.useExponentialBackoff = options.useExponentialBackoff !== false;

    this.reconnectTimer = null;
    this.callbacks = {
      onReconnectAttempt: null,
      onReconnectSuccess: null,
      onReconnectFailed: null,
      onMaxAttemptsReached: null,
    };
  }

  /**
   * Get next reconnection delay based on attempt count
   */
  getNextDelay() {
    if (!this.useExponentialBackoff) {
      return this.baseDelay;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(this.backoffMultiplier, this.reconnectAttempts),
      this.maxDelay
    );

    return Math.floor(delay);
  }

  /**
   * Start reconnection process
   */
  async startReconnection(reconnectFn) {
    if (this.isAttemptingReconnect) return;

    this.isAttemptingReconnect = true;

    while (this.reconnectAttempts < this.maxAttempts) {
      this.reconnectAttempts++;
      const delay = this.getNextDelay();

      if (this.callbacks.onReconnectAttempt) {
        this.callbacks.onReconnectAttempt({
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxAttempts,
          nextDelay: delay,
        });
      }

      // Wait before attempting
      await new Promise((resolve) => {
        this.reconnectTimer = setTimeout(resolve, delay);
      });

      try {
        // Attempt to reconnect
        const success = await reconnectFn();

        if (success) {
          this.isAttemptingReconnect = false;
          this.reconnectAttempts = 0; // Reset on success

          if (this.callbacks.onReconnectSuccess) {
            this.callbacks.onReconnectSuccess();
          }

          return true;
        }
      } catch (error) {
        console.error(
          `[Reconnection] Attempt ${this.reconnectAttempts} failed:`,
          error
        );
      }
    }

    // Max attempts reached
    this.isAttemptingReconnect = false;

    if (this.callbacks.onMaxAttemptsReached) {
      this.callbacks.onMaxAttemptsReached({
        totalAttempts: this.reconnectAttempts,
        maxAttempts: this.maxAttempts,
      });
    }

    return false;
  }

  /**
   * Cancel ongoing reconnection
   */
  cancelReconnection() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isAttemptingReconnect = false;
  }

  /**
   * Reset reconnection state
   */
  reset() {
    this.cancelReconnection();
    this.reconnectAttempts = 0;
  }

  /**
   * Subscribe to reconnection events
   */
  on(event, callback) {
    const eventKey = `on${event.charAt(0).toUpperCase()}${event.slice(1).replace(/-/g, '')}`;
    if (this.callbacks[eventKey]) {
      this.callbacks[eventKey] = callback;
    }
  }

  /**
   * Get current reconnection status
   */
  getStatus() {
    return {
      isAttemptingReconnect: this.isAttemptingReconnect,
      attempts: this.reconnectAttempts,
      maxAttempts: this.maxAttempts,
      nextDelay: this.getNextDelay(),
    };
  }
}

/**
 * State Recovery Manager
 * Manages recovery of application state after disconnections
 */
export class StateRecoveryManager {
  constructor() {
    this.stateSnapshots = new Map();
    this.lastSyncTimestamp = null;
    this.isRecoveringState = false;
    this.callbacks = {
      onStateRestored: null,
      onRecoveryStarted: null,
      onRecoveryFailed: null,
    };
  }

  /**
   * Save a state snapshot
   */
  saveSnapshot(key, state, metadata = {}) {
    this.stateSnapshots.set(key, {
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      timestamp: Date.now(),
      metadata,
    });

    console.log(`[StateRecovery] Snapshot saved: ${key}`);
  }

  /**
   * Restore a state snapshot
   */
  restoreSnapshot(key) {
    const snapshot = this.stateSnapshots.get(key);
    if (!snapshot) {
      console.warn(`[StateRecovery] Snapshot not found: ${key}`);
      return null;
    }

    console.log(`[StateRecovery] Snapshot restored: ${key}`);
    return JSON.parse(JSON.stringify(snapshot.state)); // Deep clone
  }

  /**
   * Check if snapshot exists and is fresh
   */
  isSnapshotValid(key, maxAge = 60000) {
    const snapshot = this.stateSnapshots.get(key);
    if (!snapshot) return false;

    const age = Date.now() - snapshot.timestamp;
    return age <= maxAge;
  }

  /**
   * Start state recovery process
   */
  async startRecovery(recoveryFn) {
    if (this.isRecoveringState) return false;

    this.isRecoveringState = true;

    if (this.callbacks.onRecoveryStarted) {
      this.callbacks.onRecoveryStarted();
    }

    try {
      const recovered = await recoveryFn(this);

      if (recovered) {
        this.lastSyncTimestamp = Date.now();

        if (this.callbacks.onStateRestored) {
          this.callbacks.onStateRestored();
        }

        return true;
      }
    } catch (error) {
      console.error('[StateRecovery] Recovery failed:', error);

      if (this.callbacks.onRecoveryFailed) {
        this.callbacks.onRecoveryFailed(error);
      }
    }

    this.isRecoveringState = false;
    return false;
  }

  /**
   * Clear a specific snapshot
   */
  clearSnapshot(key) {
    this.stateSnapshots.delete(key);
  }

  /**
   * Clear all snapshots
   */
  clearAllSnapshots() {
    this.stateSnapshots.clear();
  }

  /**
   * Get snapshot info
   */
  getSnapshotInfo(key) {
    const snapshot = this.stateSnapshots.get(key);
    if (!snapshot) return null;

    return {
      key,
      timestamp: snapshot.timestamp,
      age: Date.now() - snapshot.timestamp,
      metadata: snapshot.metadata,
    };
  }

  /**
   * List all snapshots
   */
  listSnapshots() {
    const snapshots = [];
    this.stateSnapshots.forEach((snapshot, key) => {
      snapshots.push({
        key,
        timestamp: snapshot.timestamp,
        age: Date.now() - snapshot.timestamp,
      });
    });
    return snapshots;
  }

  /**
   * Subscribe to recovery events
   */
  on(event, callback) {
    const eventKey = `on${event.charAt(0).toUpperCase()}${event.slice(1).replace(/-/g, '')}`;
    if (this.callbacks[eventKey]) {
      this.callbacks[eventKey] = callback;
    }
  }
}

/**
 * Connection Health Monitor
 * Tracks connection quality and issues
 */
export class ConnectionHealthMonitor {
  constructor() {
    this.lastMessageTime = Date.now();
    this.messageCount = 0;
    this.errorCount = 0;
    this.latency = 0;
    this.isHealthy = true;
    this.healthThreshold = {
      minMessagesPerMinute: 1,
      maxErrorsPerMinute: 5,
      maxLatency: 5000, // 5 seconds
    };

    this.lastMinuteStats = {
      messages: 0,
      errors: 0,
      timestamp: Date.now(),
    };

    this.callbacks = {
      onHealthStatusChanged: null,
      onHighLatency: null,
      onHighErrorRate: null,
    };
  }

  /**
   * Record a successful message
   */
  recordMessage(responseTime = 0) {
    this.lastMessageTime = Date.now();
    this.messageCount++;
    this.lastMinuteStats.messages++;
    this.latency = responseTime;

    this._checkHealth();
  }

  /**
   * Record an error
   */
  recordError() {
    this.errorCount++;
    this.lastMinuteStats.errors++;

    this._checkHealth();
  }

  /**
   * Check and update health status
   */
  _checkHealth() {
    this._resetIfMinutePassed();

    let wasHealthy = this.isHealthy;

    // Check latency
    if (this.latency > this.healthThreshold.maxLatency) {
      this.isHealthy = false;

      if (this.callbacks.onHighLatency) {
        this.callbacks.onHighLatency({ latency: this.latency });
      }
    }

    // Check error rate
    if (this.lastMinuteStats.errors > this.healthThreshold.maxErrorsPerMinute) {
      this.isHealthy = false;

      if (this.callbacks.onHighErrorRate) {
        this.callbacks.onHighErrorRate({
          errors: this.lastMinuteStats.errors,
          period: '1 minute',
        });
      }
    }

    // If no messages or errors low, likely healthy
    if (
      this.lastMinuteStats.messages >= this.healthThreshold.minMessagesPerMinute &&
      this.latency <= this.healthThreshold.maxLatency &&
      this.lastMinuteStats.errors <= this.healthThreshold.maxErrorsPerMinute
    ) {
      this.isHealthy = true;
    }

    // Notify if status changed
    if (wasHealthy !== this.isHealthy && this.callbacks.onHealthStatusChanged) {
      this.callbacks.onHealthStatusChanged({ isHealthy: this.isHealthy });
    }
  }

  /**
   * Reset stats if a minute has passed
   */
  _resetIfMinutePassed() {
    const now = Date.now();
    if (now - this.lastMinuteStats.timestamp >= 60000) {
      this.lastMinuteStats = {
        messages: 0,
        errors: 0,
        timestamp: now,
      };
    }
  }

  /**
   * Get health status
   */
  getStatus() {
    return {
      isHealthy: this.isHealthy,
      latency: this.latency,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
      lastMessageTime: this.lastMessageTime,
      timeSinceLastMessage: Date.now() - this.lastMessageTime,
    };
  }

  /**
   * Subscribe to health events
   */
  on(event, callback) {
    const eventKey = `on${event.charAt(0).toUpperCase()}${event.slice(1).replace(/-/g, '')}`;
    if (this.callbacks[eventKey]) {
      this.callbacks[eventKey] = callback;
    }
  }
}
