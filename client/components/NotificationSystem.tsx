import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import websocketService from '../lib/websocket';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
  timestamp: string;
}

const NotificationSystem: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Request browser notification permission
    if ('Notification' in window) {
      Notification.requestPermission().then(setPermission);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket
    websocketService.connect(user.id.toString(), user.role);

    // Define callback functions
    const systemNotificationCallback = (data: any) => {
      const notification = data.notification;
      addNotification(notification);
      showBrowserNotification(notification);
    };

    const userNotificationCallback = (data: any) => {
      const notification = data.notification;
      addNotification(notification);
      showBrowserNotification(notification);
    };

    const jobUpdateCallback = (data: any) => {
      const { action, job } = data;
      const notification: Notification = {
        id: Date.now(),
        title: 'Job Update',
        message: `Job ${job.jobNumber} ${action.toLowerCase()}`,
        type: getNotificationTypeForAction(action),
        timestamp: data.timestamp
      };
      addNotification(notification);
      showBrowserNotification(notification);
    };

    const inventoryUpdateCallback = (data: any) => {
      const { action, item } = data;
      const notification: Notification = {
        id: Date.now(),
        title: 'Inventory Update',
        message: `${item.name} ${action.toLowerCase()}`,
        type: action === 'STOCK_LOW' ? 'warning' : 'info',
        timestamp: data.timestamp
      };
      addNotification(notification);
      showBrowserNotification(notification);
    };

    const userUpdateCallback = (data: any) => {
      const { action, user: updatedUser } = data;
      const notification: Notification = {
        id: Date.now(),
        title: 'User Update',
        message: `User ${updatedUser.name} ${action.toLowerCase()}`,
        type: 'info',
        timestamp: data.timestamp
      };
      addNotification(notification);
      showBrowserNotification(notification);
    };

    // Listen for system notifications
    websocketService.onSystemNotification(systemNotificationCallback);

    // Listen for user-specific notifications
    websocketService.onUserNotification(userNotificationCallback);

    // Listen for job updates
    websocketService.onJobUpdate(jobUpdateCallback);

    // Listen for inventory updates
    websocketService.onInventoryUpdate(inventoryUpdateCallback);

    // Listen for user updates (admin only)
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      websocketService.onUserUpdate(userUpdateCallback);
    }

    return () => {
      websocketService.offSystemNotification(systemNotificationCallback);
      websocketService.offUserNotification(userNotificationCallback);
      websocketService.offJobUpdate(jobUpdateCallback);
      websocketService.offInventoryUpdate(inventoryUpdateCallback);
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        websocketService.offUserUpdate(userUpdateCallback);
      }
    };
  }, [user]);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep only 10 notifications
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(notification.id);
    }, 5000);
  };

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showBrowserNotification = (notification: Notification) => {
    if (permission === 'granted' && 'Notification' in window) {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id.toString()
      });
    }
  };

  const getNotificationTypeForAction = (action: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (action) {
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      case 'ASSIGNED':
        return 'info';
      default:
        return 'info';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-500 text-green-700';
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      case 'error':
        return 'bg-red-100 border-red-500 text-red-700';
      default:
        return 'bg-blue-100 border-blue-500 text-blue-700';
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`p-4 rounded-lg border-l-4 shadow-lg backdrop-blur-sm bg-white/90 ${getNotificationColor(notification.type)} animate-slide-in`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <span className="text-lg">{getNotificationIcon(notification.type)}</span>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">{notification.title}</h4>
                <p className="text-xs mt-1">{notification.message}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(notification.timestamp).toLocaleTimeString('id-ID')}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationSystem;

