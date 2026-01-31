/**
 * Connection Status Indicator
 * Shows detailed connection status and reconnection progress
 */

import { memo } from 'react';

const ConnectionIndicator = memo(function ConnectionIndicator({
  isConnected,
  isReconnecting,
  reconnectAttempt,
  maxReconnectAttempts,
  connectionHealth,
}) {
  const getStatusColor = () => {
    if (isConnected && connectionHealth?.isHealthy) {
      return 'bg-green-500';
    }
    if (isReconnecting) {
      return 'bg-yellow-500';
    }
    return 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected && connectionHealth?.isHealthy) {
      return 'Connected';
    }
    if (isReconnecting) {
      return `Reconnecting (${reconnectAttempt}/${maxReconnectAttempts})`;
    }
    return 'Disconnected';
  };

  const getStatusIcon = () => {
    if (isConnected && connectionHealth?.isHealthy) {
      return '●';
    }
    if (isReconnecting) {
      return '◐';
    }
    return '○';
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
      <span className={`text-lg ${getStatusColor()} animate-pulse`}>
        {getStatusIcon()}
      </span>
      <div className="flex flex-col text-xs">
        <span className="font-semibold text-gray-200">{getStatusText()}</span>
        {connectionHealth?.latency > 0 && (
          <span className="text-gray-400">
            Latency: {connectionHealth.latency}ms
          </span>
        )}
      </div>
    </div>
  );
});

export default ConnectionIndicator;
