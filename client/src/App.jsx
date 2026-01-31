import { useState, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import ConnectionStatus from './ConnectionStatus';
import CanvasDrawing from './canvas.jsx';
import socketService from './socketService.jsx';
import { createDrawingDebouncer } from './utils/drawingSync.jsx';

function App() {
  const canvasRef = useRef(null);
  const drawingRef = useRef(null);
  const drawDebouncer = useRef(null);

  // Drawing state
  const [currentTool, setCurrentTool] = useState('brush');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(5);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState(null);
  const [roomId, setRoomId] = useState('default-room');

  // History state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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

    // Setup draw callback - use debouncer
    drawing.onDraw = (strokeData) => {
      if (drawDebouncer.current) {
        drawDebouncer.current.send(strokeData);
      }
    };

    return () => {
      // Flush pending draws on cleanup
      if (drawDebouncer.current) {
        drawDebouncer.current.flush();
      }
      drawing.clearCanvas();
    };
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeSocket = async () => {
      try {
        // Connect to server
        const newUserId = await socketService.connect();
        setUserId(newUserId);

        // Setup socket callbacks
        socketService.on('Connect', () => {
          setIsConnected(true);
          console.log('Connected to server');
        });

        socketService.on('Disconnect', () => {
          setIsConnected(false);
          setUsers([]);
          console.log('Disconnected from server');
        });

        socketService.on('RoomJoined', (data) => {
          setUsers(data.users || []);
          setCanUndo(false);
          setCanRedo(false);

          // Render initial history on canvas
          if (data.history && drawingRef.current) {
            drawingRef.current.renderFromHistory(data.history);
          }

          console.log('Joined room:', data.roomId);
        });

        // Handle remote drawing strokes
        socketService.on('Draw', (data) => {
          if (drawingRef.current && data.userId !== newUserId) {
            // Apply remote stroke to canvas
            drawingRef.current.applyRemoteStroke(data.action.data);
            console.log(`[App] Applied remote stroke from ${data.userId}`);
          }
        });


        socketService.on('Draw', (data) => {
          if (drawingRef.current && data.userId !== newUserId) {
            drawingRef.current.applyRemoteStroke(data.action.data);
          }
        });

        socketService.on('Undo', (data) => {
          if (drawingRef.current) {
            // Rebuild canvas from current history
            // (will be implemented when we receive updated history)
            console.log('Undo received');
          }
        });

        socketService.on('Redo', (data) => {
          if (drawingRef.current) {
            console.log('Redo received');
          }
        });

        socketService.on('Clear', (data) => {
          if (drawingRef.current && data.userId !== newUserId) {
            drawingRef.current.clearCanvas();
          }
        });

        socketService.on('UserJoined', (data) => {
          setUsers((prevUsers) => [...prevUsers, data.user]);
          console.log('User joined:', data.user.name);
        });

        socketService.on('UserLeft', (data) => {
          setUsers((prevUsers) =>
            prevUsers.filter((u) => u.id !== data.userId)
          );
          console.log('User left');
        });

        socketService.on('Error', (error) => {
          console.error('Socket error:', error);
        });

        // Join room after connection
        socketService.joinRoom(roomId, {
          name: `User-${newUserId.slice(0, 5)}`,
        });
      } catch (error) {
        console.error('Failed to connect:', error);
      }
    };

    initializeSocket();

    // Cleanup on unmount
    return () => {
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

  const handleToolChange = (tool) => {
    setCurrentTool(tool);
  };

  const handleColorChange = (color) => {
    setCurrentColor(color);
  };

  const handleSizeChange = (size) => {
    setCurrentSize(size);
  };

  const handleClear = () => {
    if (drawingRef.current) {
      drawingRef.current.clearCanvas();
      socketService.requestClear();
    }
  };

  const handleUndo = () => {
    socketService.requestUndo();
  };

  const handleRedo = () => {
    socketService.requestRedo();
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold tracking-wider">LetsDraw</h1>
          <p className="text-gray-300 text-sm font-light mt-1">
            Collaborative Drawing Canvas
          </p>
        </div>
      </header>

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
    </div>
  );
}

export default App;
