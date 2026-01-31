/**
 * Performance Optimizer Utilities
 * Provides optimizations for canvas rendering, React components, and WebSocket communication
 */

/**
 * DirtyRectangleRenderer - Optimizes canvas rendering with dirty rectangle technique
 * Only redraws the regions that have changed instead of the entire canvas
 */
export class DirtyRectangleRenderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.dirtyRects = [];
    this.lastFrameTime = Date.now();
    this.frameCount = 0;
    this.fps = 60;
    this.isOptimizationEnabled = true;
  }

  /**
   * Mark a rectangular region as dirty (needs redraw)
   */
  markDirty(x, y, width, height, padding = 5) {
    if (!this.isOptimizationEnabled) return;

    // Add padding for brush stroke edges
    const rect = {
      x: Math.max(0, x - padding),
      y: Math.max(0, y - padding),
      width: width + padding * 2,
      height: height + padding * 2,
    };

    // Clamp to canvas bounds
    rect.width = Math.min(rect.width, this.canvas.width - rect.x);
    rect.height = Math.min(rect.height, this.canvas.height - rect.y);

    // Merge overlapping rectangles
    this.dirtyRects = this._mergeRectangles([...this.dirtyRects, rect]);
  }

  /**
   * Get all dirty rectangles and clear the list
   */
  getDirtyRects() {
    const rects = [...this.dirtyRects];
    this.dirtyRects = [];
    return rects;
  }

  /**
   * Merge overlapping or adjacent rectangles to reduce redraw count
   */
  _mergeRectangles(rects) {
    if (rects.length === 0) return [];
    if (rects.length === 1) return rects;

    // Simple merge: if more than 50% of canvas would be redrawn, redraw all
    let totalArea = 0;
    rects.forEach((rect) => {
      totalArea += rect.width * rect.height;
    });

    const canvasArea = this.canvas.width * this.canvas.height;
    if (totalArea > canvasArea * 0.5) {
      return [{ x: 0, y: 0, width: this.canvas.width, height: this.canvas.height }];
    }

    // Merge overlapping rectangles
    const merged = [];
    const sorted = rects.sort((a, b) => a.x - b.x);

    for (const rect of sorted) {
      let overlapped = false;

      for (let i = 0; i < merged.length; i++) {
        if (this._rectsOverlap(merged[i], rect)) {
          merged[i] = this._unionRectangles(merged[i], rect);
          overlapped = true;
          break;
        }
      }

      if (!overlapped) {
        merged.push(rect);
      }
    }

    return merged;
  }

  /**
   * Check if two rectangles overlap or are adjacent
   */
  _rectsOverlap(r1, r2) {
    const padding = 10;
    return !(
      r1.x + r1.width + padding < r2.x ||
      r2.x + r2.width + padding < r1.x ||
      r1.y + r1.height + padding < r2.y ||
      r2.y + r2.height + padding < r1.y
    );
  }

  /**
   * Create union of two rectangles
   */
  _unionRectangles(r1, r2) {
    const x = Math.min(r1.x, r2.x);
    const y = Math.min(r1.y, r2.y);
    const right = Math.max(r1.x + r1.width, r2.x + r2.width);
    const bottom = Math.max(r1.y + r1.height, r2.y + r2.height);

    return {
      x,
      y,
      width: right - x,
      height: bottom - y,
    };
  }

  /**
   * Track FPS for performance monitoring
   */
  trackFrame() {
    this.frameCount++;
    const now = Date.now();
    const elapsed = now - this.lastFrameTime;

    if (elapsed >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameTime = now;
    }

    return this.fps;
  }

  /**
   * Get current FPS
   */
  getFPS() {
    return this.fps;
  }

  /**
   * Toggle optimization on/off
   */
  setOptimizationEnabled(enabled) {
    this.isOptimizationEnabled = enabled;
  }
}

/**
 * ActionBatcher - Batches drawing actions for efficient processing
 * Reduces unnecessary re-renders and network messages
 */
export class ActionBatcher {
  constructor(flushInterval = 16) {
    // ~60fps
    this.flushInterval = flushInterval;
    this.batch = [];
    this.flushTimer = null;
    this.callbacks = [];
    this.isProcessing = false;
  }

  /**
   * Add action to batch
   */
  addAction(action) {
    this.batch.push(action);

    // Auto-flush if batch exceeds 100 items (likely a large stroke)
    if (this.batch.length >= 100) {
      this.flush();
    } else if (!this.flushTimer) {
      // Schedule flush if not already scheduled
      this.flushTimer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Flush accumulated actions
   */
  flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.batch.length === 0) return;

    const actions = [...this.batch];
    this.batch = [];

    // Notify all callbacks
    this.callbacks.forEach((callback) => {
      try {
        callback(actions);
      } catch (error) {
        console.error('[ActionBatcher] Callback error:', error);
      }
    });
  }

  /**
   * Subscribe to batch flush events
   */
  onFlush(callback) {
    this.callbacks.push(callback);
  }

  /**
   * Get pending action count
   */
  getPendingCount() {
    return this.batch.length;
  }

  /**
   * Clear all pending actions
   */
  clear() {
    this.batch = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * RenderScheduler - Schedules renders using requestAnimationFrame for smooth performance
 */
export class RenderScheduler {
  constructor() {
    this.scheduledRenders = new Map();
    this.animationFrameId = null;
    this.isScheduled = false;
  }

  /**
   * Schedule a render operation (deduplicates multiple render requests)
   */
  scheduleRender(key, renderFn) {
    this.scheduledRenders.set(key, renderFn);

    if (!this.isScheduled) {
      this.isScheduled = true;
      this.animationFrameId = requestAnimationFrame(() => {
        this._executeScheduledRenders();
      });
    }
  }

  /**
   * Execute all scheduled renders in one animation frame
   */
  _executeScheduledRenders() {
    const renders = Array.from(this.scheduledRenders.values());
    this.scheduledRenders.clear();
    this.isScheduled = false;

    renders.forEach((renderFn) => {
      try {
        renderFn();
      } catch (error) {
        console.error('[RenderScheduler] Render error:', error);
      }
    });
  }

  /**
   * Cancel pending renders
   */
  cancel() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.scheduledRenders.clear();
    this.isScheduled = false;
  }

  /**
   * Get count of pending renders
   */
  getPendingCount() {
    return this.scheduledRenders.size;
  }
}

/**
 * MemoryOptimizer - Monitors and optimizes memory usage
 */
export class MemoryOptimizer {
  constructor(maxMemoryMB = 200) {
    this.maxMemoryMB = maxMemoryMB;
    this.caches = new Map();
    this.checkInterval = 30000; // 30 seconds
    this.monitoringEnabled = false;
  }

  /**
   * Register a cache for monitoring
   */
  registerCache(name, cache, getSize) {
    this.caches.set(name, { cache, getSize, lastSize: 0 });
  }

  /**
   * Start memory monitoring
   */
  startMonitoring() {
    if (this.monitoringEnabled) return;
    this.monitoringEnabled = true;

    this.monitorInterval = setInterval(() => {
      this._checkMemory();
    }, this.checkInterval);
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitoringEnabled = false;
  }

  /**
   * Check and log memory usage
   */
  _checkMemory() {
    if (performance.memory) {
      const usedMB = performance.memory.usedJSHeapSize / 1048576;
      const limitMB = performance.memory.jsHeapSizeLimit / 1048576;

      console.log(
        `[Memory] Used: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB`
      );

      // Log cache sizes
      this.caches.forEach(({ cache, getSize }, name) => {
        const size = getSize(cache);
        console.log(`[Memory] Cache "${name}": ${size} items`);
      });

      // Warn if approaching limit
      if (usedMB > limitMB * 0.8) {
        console.warn('[Memory] Approaching heap size limit!');
      }
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.caches.forEach(({ cache }) => {
      if (cache.clear) cache.clear();
    });
  }
}

/**
 * ImageDataCache - Caches canvas ImageData to avoid expensive re-renders
 */
export class ImageDataCache {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  /**
   * Store ImageData with a key
   */
  set(key, imageData) {
    // Remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, imageData);
  }

  /**
   * Retrieve cached ImageData
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }
}

/**
 * DebugPerformance - Performance monitoring and debugging utilities
 */
export class DebugPerformance {
  constructor() {
    this.marks = new Map();
    this.measures = new Map();
  }

  /**
   * Mark a performance point
   */
  mark(name) {
    this.marks.set(name, performance.now());
  }

  /**
   * Measure time between marks
   */
  measure(name, startMark, endMark) {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);

    if (start && end) {
      const duration = end - start;
      this.measures.set(name, duration);
      return duration;
    }

    return null;
  }

  /**
   * Get measurement
   */
  getMeasure(name) {
    return this.measures.get(name);
  }

  /**
   * Clear marks and measures
   */
  clear() {
    this.marks.clear();
    this.measures.clear();
  }

  /**
   * Log all measurements
   */
  logAll() {
    console.group('[Performance] Measurements');
    this.measures.forEach((duration, name) => {
      console.log(`${name}: ${duration.toFixed(2)}ms`);
    });
    console.groupEnd();
  }
}
