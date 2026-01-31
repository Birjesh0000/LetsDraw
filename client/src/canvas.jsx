/**
 * Canvas Drawing System
 * Handles drawing operations using native HTML5 Canvas API
 * No external drawing libraries - raw canvas only
 */

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

    // Initialize canvas
    this.setupCanvas();
    this.setupEventListeners();
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
   * Handle mouse down event
   */
  handleMouseDown(e) {
    this.isDrawing = true;

    const { x, y } = this.getMousePosition(e);
    this.lastX = x;
    this.lastY = y;
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(e) {
    if (!this.isDrawing) return;

    const { x, y } = this.getMousePosition(e);

    // Draw stroke from last position to current
    this.draw(this.lastX, this.lastY, x, y);

    // Update last position
    this.lastX = x;
    this.lastY = y;

    // Emit local drawing event for WebSocket sending
    this.emitDrawAction(this.lastX, this.lastY);
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(e) {
    this.isDrawing = false;
  }

  /**
   * Handle mouse leave event
   */
  handleMouseLeave(e) {
    this.isDrawing = false;
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
  }

  /**
   * Emit draw action for WebSocket transmission
   * Called internally - subscribe to drawAction callback
   */
  emitDrawAction(x, y) {
    if (this.onDraw) {
      this.onDraw({
        tool: this.currentTool,
        x,
        y,
        color: this.currentColor,
        size: this.currentSize,
      });
    }
  }

  /**
   * Apply a remote drawing stroke
   * Called when receiving drawing from other users
   */
  applyRemoteStroke(strokeData) {
    if (strokeData.tool === 'brush') {
      this.ctx.strokeStyle = strokeData.color;
      this.ctx.lineWidth = strokeData.size;
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.arc(strokeData.x, strokeData.y, strokeData.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else if (strokeData.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.clearRect(
        strokeData.x - strokeData.size / 2,
        strokeData.y - strokeData.size / 2,
        strokeData.size,
        strokeData.size
      );
      this.ctx.globalCompositeOperation = 'source-over';
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
   * Get canvas state
   */
  getState() {
    return {
      tool: this.currentTool,
      color: this.currentColor,
      size: this.currentSize,
      isDrawing: this.isDrawing,
    };
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
}

export default CanvasDrawing;
