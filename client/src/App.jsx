import { useState, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import ConnectionStatus from './ConnectionStatus';
import CanvasDrawing from './canvas.jsx';

function App() {
  const canvasRef = useRef(null);
  const drawingRef = useRef(null);

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

    return () => {
      // Cleanup
      drawing.clearCanvas();
    };
  }, []);

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
      // TODO: Emit clear event to socket
    }
  };

  const handleUndo = () => {
    // TODO: Emit undo event to socket
  };

  const handleRedo = () => {
    // TODO: Emit redo event to socket
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
