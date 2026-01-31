/**
 * Toolbar Component
 * Provides all drawing controls: tools, colors, size, actions
 */

function Toolbar({
  currentTool,
  onToolChange,
  currentColor,
  onColorChange,
  currentSize,
  onSizeChange,
  onClear,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  isConnected,
  isUndoRedoPending = false,
}) {
  const toolButtonClass = (tool) =>
    `px-4 py-2 rounded font-semibold transition-all ${
      currentTool === tool
        ? 'bg-green-500 border-2 border-green-600 shadow-lg shadow-green-500/50'
        : 'bg-blue-500 border-2 border-blue-400 hover:bg-blue-600 hover:shadow-md hover:-translate-y-0.5'
    } text-white disabled:opacity-50 disabled:cursor-not-allowed`;

  const actionButtonClass = (baseColor) =>
    `px-4 py-2 rounded font-semibold transition-all border-2 text-white disabled:opacity-40 disabled:cursor-not-allowed ${baseColor}`;

  return (
    <div className="bg-gradient-to-r from-primary to-secondary text-white px-6 py-4 shadow-lg flex flex-wrap items-center gap-6">
      {/* Tools Section */}
      <div className="flex items-center gap-3">
        <label className="font-semibold text-gray-200">Tool:</label>
        <div className="flex gap-2">
          <button
            className={toolButtonClass('brush')}
            onClick={() => onToolChange('brush')}
            title="Brush Tool"
          >
            🖌️ Brush
          </button>
          <button
            className={toolButtonClass('eraser')}
            onClick={() => onToolChange('eraser')}
            title="Eraser Tool"
          >
            🧹 Eraser
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-gray-600"></div>

      {/* Color Section */}
      <div className="flex items-center gap-3">
        <label htmlFor="colorPicker" className="font-semibold text-gray-200">
          Color:
        </label>
        <input
          id="colorPicker"
          type="color"
          value={currentColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-12 h-10 rounded border-2 border-gray-300 cursor-pointer hover:border-blue-400 transition-colors"
          title="Pick a color"
        />
        <span className="font-mono text-xs text-gray-300 min-w-max">
          {currentColor}
        </span>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-gray-600"></div>

      {/* Size Section */}
      <div className="flex items-center gap-3">
        <label htmlFor="sizeSlider" className="font-semibold text-gray-200">
          Size:
        </label>
        <input
          id="sizeSlider"
          type="range"
          min="1"
          max="50"
          value={currentSize}
          onChange={(e) => onSizeChange(parseInt(e.target.value))}
          className="w-32 h-2 rounded bg-gray-600 appearance-none cursor-pointer accent-blue-400"
          title={`Brush size: ${currentSize}px`}
        />
        <span className="font-mono text-xs text-gray-300 min-w-max">
          {currentSize}px
        </span>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-gray-600"></div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          className={actionButtonClass(
            'bg-amber-500 border-amber-400 hover:bg-amber-600 hover:shadow-md hover:-translate-y-0.5'
          )}
          onClick={onUndo}
          disabled={!canUndo || !isConnected || isUndoRedoPending}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          className={actionButtonClass(
            'bg-amber-500 border-amber-400 hover:bg-amber-600 hover:shadow-md hover:-translate-y-0.5'
          )}
          onClick={onRedo}
          disabled={!canRedo || !isConnected || isUndoRedoPending}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-gray-600"></div>

      {/* Clear Button */}
      <button
        className={actionButtonClass(
          'bg-red-500 border-red-400 hover:bg-red-600 hover:shadow-md hover:-translate-y-0.5'
        )}
        onClick={onClear}
        disabled={!isConnected}
        title="Clear entire canvas"
      >
        🗑️ Clear
      </button>
    </div>
  );
}

export default Toolbar;
