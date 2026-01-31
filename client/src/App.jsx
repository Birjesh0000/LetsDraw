import { useState, useEffect, useRef, useCallback } from 'react';
import Toolbar from './Toolbar';
import ConnectionStatus from './ConnectionStatus';
import ConnectionIndicator from './ConnectionIndicator.jsx';
import CanvasDrawing from './canvas.jsx';
import PerformanceMonitor from './PerformanceMonitor.jsx';
import NotificationContainer from './NotificationContainer.jsx';
import socketService from './socketService.jsx';
import { createDrawingDebouncer } from './utils/drawingSync.jsx';
import { RoomManager } from './utils/roomManager.jsx';
import { HistoryManager } from './utils/historyManager.jsx';
import { UserCursorManager } from './utils/userCursorManager.jsx';
import { ActionSequencer, CanvasStateValidator } from './utils/conflictResolver.jsx';

function App() {
  const canvasRef = useRef(null);
  const drawingRef = useRef(null);
  const drawDebouncer = useRef(null);
  const roomManager = useRef(null);
  const historyManager = useRef(null);
  const userCursorManager = useRef(null);
  const cursorPositionDebouncer = useRef(null);
  const actionSequencer = useRef(null);
  const stateValidator = useRef(null);

  // Drawing state
  const [currentTool, setCurrentTool] = useState('brush');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(5);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(null);
  const [roomId, setRoomId] = useState('default-room');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  // History state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isUndoRedoPending, setIsUndoRedoPending] = useState(false);

  // Performance monitoring state (disabled by default, enable with Ctrl+Shift+P)
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);

  // Error handling and notifications
  const [notifications, setNotifications] = useState([]);
  const [connectionHealth, setConnectionHealth] = useState({
    isHealthy: true,
    latency: 0,
  });
  const [reconnectStatus, setReconnectStatus] = useState({
    isAttemptingReconnect: false,
    attempts: 0,
    maxAttempts: 10,
  });

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const drawing = new CanvasDrawing(canvasRef.current);
    drawingRef.current = drawing;

    // Set initial tool and color
    drawing.setTool(currentTool);
    drawing.setColor(currentColor);
    drawing.setSize(currentSize);

    // Create debouncer for drawing events
    drawDebouncer.current = createDrawingDebouncer((strokeData) => {
      socketService.sendDraw(strokeData);
    }, 16); // ~60fps batching

    // Create debouncer for cursor position events
    cursorPositionDebouncer.current = createDrawingDebouncer((position) => {
      socketService.socket?.emit('cursor-move', position);
    }, 100); // Send cursor updates at ~10Hz

    // Setup draw callback - use debouncer
    drawing.onDraw = (strokeData) => {
      if (drawDebouncer.current) {
        drawDebouncer.current.send(strokeData);
      }
    };

    // Track mouse position for cursor indicator
    const handleCanvasMouseMove = (e) => {
      const rect = drawing.canvas.getBoundingClientRect();
      const scaleX = drawing.canvas.width / rect.width;
      const scaleY = drawing.canvas.height / rect.height;

      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      if (cursorPositionDebouncer.current) {
        cursorPositionDebouncer.current.send({
          x,
          y,
          isDrawing: drawing.isDrawing,
        });
      }
    };

    // Keyboard handler for performance monitor toggle (Ctrl+Shift+P)
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
        e.preventDefault();
        setShowPerformanceMonitor((prev) => !prev);
      }
    };

    drawing.canvas.addEventListener('mousemove', handleCanvasMouseMove);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      // Flush pending draws on cleanup
      if (drawDebouncer.current) {
        drawDebouncer.current.flush();
      }
      if (cursorPositionDebouncer.current) {
        cursorPositionDebouncer.current.flush();
      }
      drawing.canvas.removeEventListener('mousemove', handleCanvasMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      drawing.clearCanvas();
    };
  }, []);

  // Initialize WebSocket connection and room joining
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] Initializing application...');

        // Setup error notification system
        const errorManager = socketService.getErrorManager();
        errorManager.on('notificationAdded', (notification) => {
          setNotifications((prev) => [...prev, notification]);
        });

        errorManager.on('notificationRemoved', (id) => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        });

        // Setup connection health monitoring
        const healthMonitor = socketService.healthMonitor;
        healthMonitor.on('healthStatusChanged', (status) => {
          setConnectionHealth({
            isHealthy: status.isHealthy,
            latency: status.latency,
          });
        });

        // Setup reconnection monitoring
        const reconnectionManager = socketService.reconnectionManager;
        reconnectionManager.on('reconnectAttempt', (status) => {
          setReconnectStatus({
            isAttemptingReconnect: true,
            attempts: status.attempt,
            maxAttempts: status.maxAttempts,
          });
        });

        reconnectionManager.on('reconnectSuccess', () => {
          setReconnectStatus({
            isAttemptingReconnect: false,
            attempts: 0,
            maxAttempts: 10,
          });
        });

        // Step 1: Connect to WebSocket server
        console.log('[App] Step 1: Connecting to server...');
        const newUserId = await socketService.connect();
        setUserId(newUserId);

        // Step 2: Initialize room manager, history manager, and cursor manager
        console.log('[App] Step 2: Initializing managers...');
        roomManager.current = new RoomManager(socketService);
        historyManager.current = new HistoryManager(socketService);
        userCursorManager.current = new UserCursorManager(
          socketService,
          drawingRef.current.cursorOverlayCanvas
        );
        actionSequencer.current = new ActionSequencer();
        stateValidator.current = new CanvasStateValidator();

        // Set cursor manager in canvas
        if (drawingRef.current) {
          drawingRef.current.setCursorManager(userCursorManager.current);
        }

        // Setup history manager callbacks
        historyManager.current.on('can-undo-changed', (canUndo) => {
          setCanUndo(canUndo);
          console.log(`[App] Can undo: ${canUndo}`);

        });

        historyManager.current.on('can-redo-changed', (canRedo) => {
          setCanRedo(canRedo);
          console.log(`[App] Can redo: ${canRedo}`);
        });

        historyManager.current.on('undo-complete', (data) => {
          setIsUndoRedoPending(false);
          // Re-render canvas from history
          if (data && data.history && drawingRef.current) {
            console.log('[App] Rendering canvas after undo');
            drawingRef.current.clearCanvas();
            drawingRef.current.renderFromHistory(data.history);
          }
        });

        historyManager.current.on('redo-complete', (data) => {
          setIsUndoRedoPending(false);
          // Re-render canvas from history
          if (data && data.history && drawingRef.current) {
            console.log('[App] Rendering canvas after redo');
            drawingRef.current.clearCanvas();
            drawingRef.current.renderFromHistory(data.history);
          }
        });

        historyManager.current.on('history-error', (error) => {
          console.error('[App] History error:', error);
          setIsUndoRedoPending(false);
        });

        // Setup room manager callbacks
        roomManager.current.on('RoomJoined', (data) => {
          console.log('[App] Room joined event received');
          setUsers(data.users || []);
          setRoomId(data.roomId);

          // Update history state from initial room data
          if (data.canUndo !== undefined || data.canRedo !== undefined) {
            historyManager.current.updateHistoryState(data);
          }

          // Render initial history on canvas
          if (data.history && drawingRef.current) {
            console.log(
              `[App] Rendering initial history: ${data.history.length} actions`
            );
            drawingRef.current.renderFromHistory(data.history);
          }
        });

        roomManager.current.on('UsersUpdated', (updatedUsers) => {
          console.log(`[App] Users list updated: ${updatedUsers.length} users`);

          setUsers(updatedUsers);
        });

        roomManager.current.on('JoinAttempt', (attempt) => {
          console.log(`[App] Join attempt ${attempt}`);
          setIsJoiningRoom(true);
        });

        roomManager.current.on('RoomError', (error) => {
          console.error('[App] Room error:', error);
          setIsJoiningRoom(false);
        });

        // Setup socket callbacks for drawing and other events
        socketService.on('Connect', () => {
          setIsConnected(true);
          console.log('[App] Socket connected');
        });

        socketService.on('Disconnect', () => {
          setIsConnected(false);
          setUsers([]);
          console.log('[App] Socket disconnected');
        });

        socketService.on('ReconnectFailed', () => {
          console.error('[App] Reconnection failed');
          setIsConnected(false);
        });

        // Handle remote drawing strokes
        socketService.on('Draw', (data) => {
          if (drawingRef.current && data.userId !== newUserId) {
            // Create action object for conflict detection
            const action = {
              type: 'stroke',
              userId: data.userId,
              timestamp: data.timestamp || Date.now(),
              id: data.action?.id,
              data: data.action.data,
            };

            // Enqueue action for processing
            if (actionSequencer.current) {
              actionSequencer.current.enqueueAction(action);
              
              // Process queue to detect and resolve conflicts
              const processed = actionSequencer.current.processQueue();

              // Apply processed actions to canvas
              processed.actions.forEach((processedAction) => {
                if (processedAction.resolution !== 'REJECTED') {
                  drawingRef.current.applyRemoteStroke(processedAction.data);
                }
              });

              // Record state checkpoint after drawing
              if (stateValidator.current) {
                stateValidator.current.recordCheckpoint({
                  timestamp: Date.now(),
                  actions: processed.actions,
                  hasConflicts: processed.conflicts.length > 0,
                });
              }

              // If rebuild needed, clear and replay all strokes
              if (actionSequencer.current.needsRebuild()) {
                console.log('[App] Rebuilding canvas due to conflicts');
                drawingRef.current.clearCanvas();
                
                const actionsToReplay = actionSequencer.current.getActionsToReplay();
                actionsToReplay.forEach((replayAction) => {
                  drawingRef.current.applyRemoteStroke(replayAction.data);
                });
              }
            } else {
              // Fallback: apply stroke directly if sequencer not initialized
              drawingRef.current.applyRemoteStroke(data.action.data);
            }
          }
        });

        socketService.on('Undo', (data) => {
          console.log('[App] Undo event received');
          if (historyManager.current) {
            historyManager.current.handleUndoResponse(data);
          }
        });

        socketService.on('Redo', (data) => {
          console.log('[App] Redo event received');
          if (historyManager.current) {
            historyManager.current.handleRedoResponse(data);
          }
        });

        socketService.on('Clear', (data) => {
          if (drawingRef.current && data.userId !== newUserId) {
            // Create clear action for conflict detection
            const clearAction = {
              type: 'clear',
              userId: data.userId,
              timestamp: data.timestamp || Date.now(),
              id: data.id,
            };

            // Enqueue and process clear action
            if (actionSequencer.current) {
              actionSequencer.current.enqueueAction(clearAction);
              const processed = actionSequencer.current.processQueue();

              // Apply clear if not rejected
              if (processed.actions.length > 0 && processed.actions[0].resolution !== 'REJECTED') {
                drawingRef.current.clearCanvas();

                // Record state checkpoint
                if (stateValidator.current) {
                  stateValidator.current.recordCheckpoint({
                    timestamp: Date.now(),
                    actions: processed.actions,
                    hasConflicts: processed.conflicts.length > 0,
                  });
                }

                // Rebuild canvas if needed
                if (actionSequencer.current.needsRebuild()) {
                  console.log('[App] Rebuilding canvas after clear due to conflicts');
                  const actionsToReplay = actionSequencer.current.getActionsToReplay();
                  actionsToReplay.forEach((replayAction) => {
                    if (replayAction.type === 'stroke') {
                      drawingRef.current.applyRemoteStroke(replayAction.data);
                    }
                  });
                }
              }
            } else {
              // Fallback: clear directly if sequencer not initialized
              drawingRef.current.clearCanvas();
            }
            console.log('[App] Canvas cleared by remote user');
          }
        });

        socketService.on('UserJoined', (data) => {
          console.log(`[App] User joined: ${data.user.name}`);
          if (roomManager.current) {
            roomManager.current.handleUserJoined(data.user);
          }
        });

        socketService.on('UserLeft', (data) => {
          console.log(`[App] User left: ${data.userId}`);
          if (roomManager.current) {
            roomManager.current.handleUserLeft(data.userId);
          }
          // Remove their cursor indicator
          if (userCursorManager.current) {
            userCursorManager.current.removeRemoteCursor(data.userId);
          }
        });

        // Handle remote cursor movement
        socketService.on('CursorMove', (data) => {
          if (userCursorManager.current && data.userId !== newUserId) {
            const cursor = userCursorManager.current.addRemoteCursor(
              data.userId,
              data.userName || 'User',
              data.color || '#0000FF'
            );

            if (cursor) {
              userCursorManager.current.updateCursorPosition(
                data.userId,
                data.x,
                data.y,
                data.isDrawing || false
              );
            }
          }
        });

        // Start rendering user cursors after joining room
        const originalRoomCallback = roomManager.current.callbacks.onRoomJoined;
        roomManager.current.callbacks.onRoomJoined = (data) => {
          // Start cursor rendering
          if (userCursorManager.current) {
            userCursorManager.current.startRendering();
            console.log('[App] Started cursor rendering');
          }

          // Call original callback
          if (originalRoomCallback) {
            originalRoomCallback(data);
          }
        };

        // Step 3: Join the room
        console.log(`[App] Step 3: Joining room "${roomId}"...`);
        setIsJoiningRoom(true);
        const joinSuccess = await roomManager.current.joinRoom(roomId, {
          name: `User-${newUserId.slice(0, 5)}`,
        });

        if (joinSuccess) {
          console.log('[App] Successfully joined room');
          setIsJoiningRoom(false);
        } else {
          console.error('[App] Failed to join room');
          setIsJoiningRoom(false);
        }
      } catch (error) {
        console.error('[App] Initialization error:', error);
        setIsConnected(false);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      if (userCursorManager.current) {
        userCursorManager.current.stopRendering();
        userCursorManager.current.clearAllCursors();
      }
      if (roomManager.current) {
        roomManager.current.leaveRoom();
      }
      socketService.disconnect();
    };
  }, [roomId]);

  // Handle tool change
  useEffect(() => {
    if (drawingRef.current) {
      drawingRef.current.setTool(currentTool);
    }
  }, [currentTool]);

  // Handle color change
  useEffect(() => {
    if (drawingRef.current) {
      drawingRef.current.setColor(currentColor);
    }
  }, [currentColor]);

  // Handle size change
  useEffect(() => {
    if (drawingRef.current) {
      drawingRef.current.setSize(currentSize);
    }
  }, [currentSize]);

  const handleToolChange = useCallback((tool) => {
    setCurrentTool(tool);
  }, []);

  const handleColorChange = useCallback((color) => {
    setCurrentColor(color);
  }, []);

  const handleSizeChange = useCallback((size) => {
    setCurrentSize(size);
  }, []);

  const handleClear = useCallback(() => {
    if (drawingRef.current) {
      drawingRef.current.clearCanvas();
      socketService.requestClear();
    }
  }, []);

  const handleUndo = useCallback(async () => {
    if (!historyManager.current || !canUndo) return;

    console.log('[App] Undo requested');
    setIsUndoRedoPending(true);
    const success = await historyManager.current.requestUndo();

    if (!success) {
      setIsUndoRedoPending(false);
    }
  }, [canUndo]);

  const handleRedo = useCallback(async () => {
    if (!historyManager.current || !canRedo) return;

    console.log('[App] Redo requested');
    setIsUndoRedoPending(true);
    const success = await historyManager.current.requestRedo();

    if (!success) {
      setIsUndoRedoPending(false);
    }
  }, [canRedo]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Notification Container */}
      <NotificationContainer
        notifications={notifications}
        onDismiss={(id) => {
          socketService.getErrorManager().dismissNotification(id);
        }}
      />

      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-wider">LetsDraw</h1>
            <p className="text-gray-300 text-sm font-light mt-1">
              Collaborative Drawing Canvas
            </p>
          </div>
          <ConnectionIndicator
            isConnected={isConnected}
            isReconnecting={reconnectStatus.isAttemptingReconnect}
            reconnectAttempt={reconnectStatus.attempts}
            maxReconnectAttempts={reconnectStatus.maxAttempts}
            connectionHealth={connectionHealth}
          />
        </div>
      </header>

      {/* Loading Indicator */}
      {isJoiningRoom && (
        <div className="bg-info text-white px-4 py-3 text-center font-medium">
          <span className="inline-block mr-2">🔄</span>
          Joining room...
        </div>
      )}

      {/* Connection Status Bar */}
      <ConnectionStatus
        isConnected={isConnected}
        users={users}
        currentUserId={userId}
      />

      {/* Toolbar */}
      <Toolbar
        currentTool={currentTool}
        onToolChange={handleToolChange}
        currentColor={currentColor}
        onColorChange={handleColorChange}
        currentSize={currentSize}
        onSizeChange={handleSizeChange}
        onClear={handleClear}
        canUndo={canUndo}
        onUndo={handleUndo}
        canRedo={canRedo}
        onRedo={handleRedo}
        isConnected={isConnected}
        isUndoRedoPending={isUndoRedoPending}
      />

      {/* Canvas Area */}
      <div className="flex-1 flex justify-center items-center p-6 bg-gray-100 overflow-auto">
        <canvas
          ref={canvasRef}
          className="bg-white border-4 border-gray-800 rounded-lg shadow-2xl cursor-crosshair"
          width={1200}
          height={600}
        />
      </div>

      {/* Footer */}
      <footer className="bg-secondary text-gray-400 px-6 py-3 text-center text-sm border-t border-primary">
        <p>
          Room: <span className="font-semibold text-gray-300">{roomId}</span> |
          Users: <span className="font-semibold text-gray-300">{users.length}</span>
        </p>
      </footer>

      {/* Performance Monitor (toggle with Ctrl+Shift+P) */}
      <PerformanceMonitor canvas={drawingRef.current} isVisible={showPerformanceMonitor} />
    </div>
  );
}

export default App;
