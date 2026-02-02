/**
 * Canvas Drawing System
 * Handles drawing operations using native HTML5 Canvas API
 * No external drawing libraries - raw canvas only
 */

import { DirtyRectangleRenderer, RenderScheduler } from './utils/performanceOptimizer.jsx';

class CanvasDrawing {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    // Drawing state
    this.isDrawing = false;
    this.currentTool = 'brush';
    this.currentColor = '#000000';
    this.currentSize = 5;

    // Track last position for smooth line drawing
    this.lastX = 0;
    this.lastY = 0;

    // Performance optimization
    this.pendingActions = [];
    this.isProcessingActions = false;
    this.dirtyRectRenderer = new DirtyRectangleRenderer(this.canvas, this.ctx);
    this.renderScheduler = new RenderScheduler();

    // Stroke tracking for synchronization
    this.currentStroke = null;
    this.strokeBuffer = [];
    this.isStrokeInProgress = false;

    // Canvas layers for cursor rendering
    this.cursorOverlayCanvas = null;
    this.cursorOverlayCtx = null;
    this.cursorManager = null;    // Initialize canvas
    this.setupCanvas();
    this.setupEventListeners();
    this.setupCursorOverlay();

    console.log('[Canvas] Initialized');
  }

  /**
   * Setup cursor overlay canvas for rendering remote cursors
   */
  setupCursorOverlay() {
    // Create overlay canvas for remote cursors
    const container = this.canvas.parentElement;
    if (!container) return;

    this.cursorOverlayCanvas = document.createElement('canvas');
    this.cursorOverlayCanvas.width = this.canvas.width;
    this.cursorOverlayCanvas.height = this.canvas.height;

    // Style as overlay
    this.cursorOverlayCanvas.style.position = 'absolute';
    this.cursorOverlayCanvas.style.top = this.canvas.offsetTop + 'px';
    this.cursorOverlayCanvas.style.left = this.canvas.offsetLeft + 'px';
    this.cursorOverlayCanvas.style.pointerEvents = 'none';
    this.cursorOverlayCanvas.style.zIndex = '10';
    this.cursorOverlayCanvas.className = 'cursor-overlay-canvas';

    // Get context
    this.cursorOverlayCtx = this.cursorOverlayCanvas.getContext('2d');

    // Insert before main canvas or after
    container.style.position = 'relative';
    container.appendChild(this.cursorOverlayCanvas);

    console.log('[Canvas] Cursor overlay created');
  }

  /**
   * Setup canvas properties and styling
   */
  setupCanvas() {
    // Set canvas resolution
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;

    // Set default canvas styling
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.imageSmoothingEnabled = true;

    // Fill with white background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    console.log(
      `[Canvas] Initialized: ${this.canvas.width}x${this.canvas.height}`
    );
  }

  /**
   * Setup canvas properties and styling
   */
  setupCanvas() {
    // Set canvas resolution
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;

    // Set default canvas styling
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.imageSmoothingEnabled = true;

    // Fill with white background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    console.log(
      `[Canvas] Initialized: ${this.canvas.width}x${this.canvas.height}`
    );
  }

  /**
   * Setup mouse event listeners
   */
  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) =>
      this.handleMouseDown(e)
    );
    this.canvas.addEventListener('mousemove', (e) =>
      this.handleMouseMove(e)
    );
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) =>
      this.handleMouseLeave(e)
    );

    // Touch support for mobile
    this.canvas.addEventListener('touchstart', (e) =>
      this.handleTouchStart(e)
    );
    this.canvas.addEventListener('touchmove', (e) =>
      this.handleTouchMove(e)
    );
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    console.log('[Canvas] Event listeners attached');
  }

  /**
   * Handle mouse down event - start new stroke
   */
  handleMouseDown(e) {
    this.isDrawing = true;
    this.isStrokeInProgress = true;

    const { x, y } = this.getMousePosition(e);
    this.lastX = x;
    this.lastY = y;

    // Start new stroke tracking
    this.currentStroke = {
      tool: this.currentTool,
      color: this.currentColor,
      size: this.currentSize,
      points: [{ x, y }],
      startTime: Date.now(),
    };

    // Notify that user started drawing
    if (window.socketService) {
      window.socketService.sendDrawingState(true);
    }
  }

  /**
   * Handle mouse move event - draw and track stroke
   */
  handleMouseMove(e) {
    if (!this.isDrawing) return;

    const { x, y } = this.getMousePosition(e);

    // Draw stroke from last position to current
    this.draw(this.lastX, this.lastY, x, y);

    // Track point in current stroke
    if (this.currentStroke) {
      this.currentStroke.points.push({ x, y });
    }

    // Update last position
    const prevX = this.lastX;
    const prevY = this.lastY;
    this.lastX = x;
    this.lastY = y;

    // Emit drawing event for synchronization
    this.emitDrawAction({
      tool: this.currentTool,
      x,
      y,
      lastX: prevX,
      lastY: prevY,
      color: this.currentColor,
      size: this.currentSize,
    });
  }

  /**
   * Handle mouse up event - end stroke
   */
  handleMouseUp(e) {
    this.isDrawing = false;

    // Finalize stroke and add to buffer
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.currentStroke.endTime = Date.now();
      this.currentStroke.duration = this.currentStroke.endTime - this.currentStroke.startTime;
      this.strokeBuffer.push(this.currentStroke);

      console.log(`[Canvas] Stroke completed: ${this.currentStroke.points.length} points`);
    }

    // Notify that user stopped drawing
    if (window.socketService) {
      window.socketService.sendDrawingState(false);
    }

    this.isStrokeInProgress = false;
    this.currentStroke = null;
  }

  /**
   * Handle mouse leave event - end stroke
   */
  handleMouseLeave(e) {
    this.isDrawing = false;

    // Finalize stroke if in progress
    if (this.isStrokeInProgress && this.currentStroke) {
      this.currentStroke.endTime = Date.now();
      this.strokeBuffer.push(this.currentStroke);
    }

    this.isStrokeInProgress = false;
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      this.canvas.dispatchEvent(mouseEvent);
    }
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
      });
      this.canvas.dispatchEvent(mouseEvent);
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(e) {
    e.preventDefault();
    const mouseEvent = new MouseEvent('mouseup', {});
    this.canvas.dispatchEvent(mouseEvent);
  }

  /**
   * Get mouse position relative to canvas
   */
  getMousePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  /**
   * Main drawing method - delegates to tool-specific methods
   */
  draw(fromX, fromY, toX, toY) {
    if (this.currentTool === 'brush') {
      this.drawBrush(fromX, fromY, toX, toY);
    } else if (this.currentTool === 'eraser') {
      this.drawEraser(fromX, fromY, toX, toY);
    }
  }

  /**
   * Draw brush stroke with smooth line
   * Uses quadratic curves for smooth connections
   */
  drawBrush(fromX, fromY, toX, toY) {
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = this.currentSize;
    this.ctx.globalCompositeOperation = 'source-over';

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
    this.ctx.closePath();

    // Mark region as dirty for optimized rendering
    const padding = this.currentSize / 2 + 2;
    const minX = Math.min(fromX, toX);
    const minY = Math.min(fromY, toY);
    const maxX = Math.max(fromX, toX);
    const maxY = Math.max(fromY, toY);

    this.dirtyRectRenderer.markDirty(
      minX,
      minY,
      maxX - minX + this.currentSize,
      maxY - minY + this.currentSize,
      padding
    );
  }

  /**
   * Draw eraser by clearing pixels
   * Uses clearRect with the current brush size
   */
  drawEraser(fromX, fromY, toX, toY) {
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineWidth = this.currentSize;

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
    this.ctx.closePath();

    // Reset composite operation
    this.ctx.globalCompositeOperation = 'source-over';

    // Mark region as dirty for optimized rendering
    const padding = this.currentSize / 2 + 2;
    const minX = Math.min(fromX, toX);
    const minY = Math.min(fromY, toY);
    const maxX = Math.max(fromX, toX);
    const maxY = Math.max(fromY, toY);

    this.dirtyRectRenderer.markDirty(
      minX,
      minY,
      maxX - minX + this.currentSize,
      maxY - minY + this.currentSize,
      padding
    );
  }

  /**
   * Emit draw action for WebSocket transmission
   * Called during drawing - subscribe to onDraw callback
   */
  emitDrawAction(strokeData) {
    if (this.onDraw) {
      this.onDraw(strokeData);
    }
  }

  /**
   * Apply a remote drawing stroke
   * Called when receiving drawing from other users
   * Renders stroke efficiently without rebuilding entire canvas
   */
  applyRemoteStroke(strokeData) {
    if (!strokeData) return;

    // Set up context for remote stroke
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.imageSmoothingEnabled = true;

    if (strokeData.tool === 'brush') {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = strokeData.color;
      this.ctx.lineWidth = strokeData.size;

      // Draw from last position to current position
      // Use stored lastX/Y to create connected lines
      const fromX = strokeData.lastX !== undefined ? strokeData.lastX : strokeData.x;
      const fromY = strokeData.lastY !== undefined ? strokeData.lastY : strokeData.y;

      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(strokeData.x, strokeData.y);
      this.ctx.stroke();
      this.ctx.closePath();

      // Mark region as dirty
      const minX = Math.min(fromX, strokeData.x);
      const minY = Math.min(fromY, strokeData.y);
      const maxX = Math.max(fromX, strokeData.x);
      const maxY = Math.max(fromY, strokeData.y);

      this.dirtyRectRenderer.markDirty(
        minX,
        minY,
        maxX - minX + strokeData.size,
        maxY - minY + strokeData.size,
        2
      );
    } else if (strokeData.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';

      // Erase line from last position to current position
      const fromX = strokeData.lastX !== undefined ? strokeData.lastX : strokeData.x;
      const fromY = strokeData.lastY !== undefined ? strokeData.lastY : strokeData.y;

      this.ctx.lineWidth = strokeData.size;
      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(strokeData.x, strokeData.y);
      this.ctx.stroke();
      this.ctx.closePath();

      // Reset composite operation
      this.ctx.globalCompositeOperation = 'source-over';

      // Mark region as dirty
      const minX = Math.min(fromX, strokeData.x);
      const minY = Math.min(fromY, strokeData.y);
      const maxX = Math.max(fromX, strokeData.x);
      const maxY = Math.max(fromY, strokeData.y);

      this.dirtyRectRenderer.markDirty(
        minX,
        minY,
        maxX - minX + strokeData.size,
        maxY - minY + strokeData.size,
        2
      );
    }
  }

  /**
   * Render entire canvas from history
   * Used when receiving full state from server
   */
  renderFromHistory(history) {
    this.clearCanvas();

    if (!history || history.length === 0) {
      return;
    }

    history.forEach((action) => {
      if (action.type === 'stroke') {
        this.applyRemoteStroke(action.data);
      } else if (action.type === 'clear') {
        this.clearCanvas();
      }
    });

    console.log(`[Canvas] Rendered ${history.length} actions from history`);
  }

  /**
   * Clear entire canvas
   */
  clearCanvas() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Set current drawing tool
   */
  setTool(tool) {
    if (['brush', 'eraser'].includes(tool)) {
      this.currentTool = tool;
      this.updateCursor();
      console.log(`[Canvas] Tool changed to: ${tool}`);
    }
  }

  /**
   * Set current color
   */
  setColor(color) {
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(color)) {
      this.currentColor = color;
      console.log(`[Canvas] Color changed to: ${color}`);
    }
  }

  /**
   * Set current brush size
   */
  setSize(size) {
    const numSize = parseInt(size);
    if (numSize > 0 && numSize <= 100) {
      this.currentSize = numSize;
      console.log(`[Canvas] Size changed to: ${numSize}`);
    }
  }

  /**
   * Update cursor based on current tool
   */
  updateCursor() {
    if (this.currentTool === 'eraser') {
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  /**
   * Set cursor manager for rendering remote cursors
   */
  setCursorManager(cursorManager) {
    this.cursorManager = cursorManager;
    if (cursorManager && this.cursorOverlayCanvas) {
      // Update cursor manager's canvas reference if needed
      console.log('[Canvas] Cursor manager set');
    }
  }

  /**
   * Get canvas as image data
   */
  getImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Set canvas from image data
   */
  setImageData(imageData) {
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Export canvas as PNG
   */
  exportCanvas() {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Get current stroke state
   */
  getState() {
    return {
      tool: this.currentTool,
      color: this.currentColor,
      size: this.currentSize,
      isDrawing: this.isDrawing,
      isStrokeInProgress: this.isStrokeInProgress,
      strokeBufferSize: this.strokeBuffer.length,
    };
  }

  /**
   * Get and clear stroke buffer
   */
  getStrokeBuffer() {
    const buffer = this.strokeBuffer;
    this.strokeBuffer = [];
    return buffer;
  }

  /**
   * Clear stroke buffer without returning
   */
  clearStrokeBuffer() {
    const size = this.strokeBuffer.length;
    this.strokeBuffer = [];
    return size;
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Get current canvas data
    const imageData = this.getImageData();

    // Reset canvas size
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;

    // Restore canvas data if size is similar
    if (imageData) {
      this.setImageData(imageData);
    }

    console.log(`[Canvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
  }

  /**
   * Get dirty rectangles from renderer
   */
  getDirtyRects() {
    return this.dirtyRectRenderer.getDirtyRects();
  }

  /**
   * Get current FPS
   */
  getFPS() {
    return this.dirtyRectRenderer.getFPS();
  }

  /**
   * Track render frame for performance monitoring
   */
  trackFrame() {
    return this.dirtyRectRenderer.trackFrame();
  }

  /**
   * Enable/disable dirty rectangle optimization
   */
  setDirtyRectOptimization(enabled) {
    this.dirtyRectRenderer.setOptimizationEnabled(enabled);
  }
}

export default CanvasDrawing;
