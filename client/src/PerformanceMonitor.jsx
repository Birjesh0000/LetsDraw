/**
 * Performance Monitor Component
 * Displays real-time performance metrics
 */

import { memo, useState, useEffect } from 'react';

const PerformanceMonitor = memo(function PerformanceMonitor({
  canvas,
  isVisible = false,
}) {
  const [metrics, setMetrics] = useState({
    fps: 0,
    pendingActions: 0,
    dirtyRects: 0,
  });

  useEffect(() => {
    if (!isVisible || !canvas) return;

    const interval = setInterval(() => {
      const fps = canvas.getFPS ? canvas.getFPS() : 0;
      const dirtyRects = canvas.getDirtyRects ? canvas.getDirtyRects().length : 0;

      setMetrics({
        fps,
        pendingActions: 0,
        dirtyRects,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, canvas]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-green-400 p-3 rounded font-mono text-xs shadow-lg border border-green-500/50">
      <div className="font-bold mb-2 text-green-300">PERF</div>
      <div>FPS: {metrics.fps}</div>
      <div>Dirty Rects: {metrics.dirtyRects}</div>
    </div>
  );
});

export default PerformanceMonitor;
