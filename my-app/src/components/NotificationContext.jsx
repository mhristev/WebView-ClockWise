import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};

const NotificationItem = ({ notification, onRemove }) => {
  const { id, type, title, message, duration } = notification;
  const [isExiting, setIsExiting] = React.useState(false);

  const getNotificationStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-emerald-50 border-emerald-200",
          text: "text-emerald-800",
          icon: <CheckCircle className="w-5 h-5 text-emerald-600" />,
          accent: "border-l-emerald-500",
        };
      case "error":
        return {
          bg: "bg-red-50 border-red-200",
          text: "text-red-800",
          icon: <XCircle className="w-5 h-5 text-red-600" />,
          accent: "border-l-red-500",
        };
      case "warning":
        return {
          bg: "bg-amber-50 border-amber-200",
          text: "text-amber-800",
          icon: <AlertCircle className="w-5 h-5 text-amber-600" />,
          accent: "border-l-amber-500",
        };
      case "info":
      default:
        return {
          bg: "bg-blue-50 border-blue-200",
          text: "text-blue-800",
          icon: <Info className="w-5 h-5 text-blue-600" />,
          accent: "border-l-blue-500",
        };
    }
  };

  const styles = getNotificationStyles();

  const handleRemove = () => {
    setIsExiting(true);
    // Wait for animation to complete before removing from state
    setTimeout(() => {
      onRemove(id);
    }, 300); // Match the duration of the exit animation
  };

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration]);

  return (
    <div
      className={`
        ${styles.bg} ${
        styles.accent
      } border-l-4 border rounded-lg shadow-lg p-4 mb-3
        transform transition-all duration-300 ease-in-out
        hover:shadow-xl hover:scale-[1.02]
        ${
          isExiting
            ? "animate-out slide-out-to-right-full fade-out duration-300"
            : "animate-in slide-in-from-right-full fade-in duration-300"
        }
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">{styles.icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${styles.text}`}>{title}</div>
          {message && (
            <div className={`text-sm mt-1 ${styles.text} opacity-80`}>
              {message}
            </div>
          )}
        </div>
        <button
          onClick={handleRemove}
          className={`
            flex-shrink-0 p-1 rounded-full transition-colors duration-200
            hover:bg-white hover:bg-opacity-50 focus:outline-none
            ${styles.text}
          `}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      duration: 3000, // Default 3 seconds
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Return the ID so it can be used to manually remove if needed
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const showSuccess = useCallback(
    (title, message, duration = 3000) => {
      return addNotification({ type: "success", title, message, duration });
    },
    [addNotification]
  );

  const showError = useCallback(
    (title, message, duration = 4000) => {
      return addNotification({ type: "error", title, message, duration });
    },
    [addNotification]
  );

  const showWarning = useCallback(
    (title, message, duration = 3000) => {
      return addNotification({ type: "warning", title, message, duration });
    },
    [addNotification]
  );

  const showInfo = useCallback(
    (title, message, duration = 3000) => {
      return addNotification({ type: "info", title, message, duration });
    },
    [addNotification]
  );

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Notification Container */}
      <div className="fixed top-4 right-4 z-50 w-96 max-w-sm">
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onRemove={removeNotification}
            />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
};
