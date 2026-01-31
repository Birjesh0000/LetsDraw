/**
 * Notification Toast Component
 * Displays error messages and notifications to users
 */

import { memo, useState, useEffect } from 'react';

const NotificationToast = memo(function NotificationToast({
  notification,
  onDismiss,
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Auto-dismiss after duration
    if (notification.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(notification.id), 300);
      }, notification.duration);

      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  const getTypeStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-500 border-green-600 text-white';
      case 'error':
        return 'bg-red-500 border-red-600 text-white';
      case 'warning':
        return 'bg-yellow-500 border-yellow-600 text-white';
      case 'critical':
        return 'bg-red-600 border-red-700 text-white shadow-lg shadow-red-600/50';
      default:
        return 'bg-blue-500 border-blue-600 text-white';
    }
  };

  const getTypeIcon = () => {
    switch (notification.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'critical':
        return '⛔';
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 mb-3 p-4 rounded border-l-4 border-l-current
        ${getTypeStyles()}
        transition-all duration-300 ease-in-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        shadow-md animate-in
      `}
      role="alert"
    >
      <span className="text-xl font-bold flex-shrink-0">{getTypeIcon()}</span>
      <div className="flex-grow">
        <p className="font-semibold text-sm">{notification.message}</p>
      </div>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(() => onDismiss(notification.id), 300);
        }}
        className="flex-shrink-0 text-lg hover:opacity-75 transition-opacity"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
});

const NotificationContainer = memo(function NotificationContainer({
  notifications,
  onDismiss,
}) {
  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-2">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
});

export default NotificationContainer;
export { NotificationToast };
