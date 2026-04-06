import { io } from 'socket.io-client';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const resolveSocketOrigin = () => {
  try {
    const url = new URL(API_BASE);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:5000';
  }
};

export const connectNotificationsSocket = ({
  onConnected,
  onNotification,
  onUnreadCount,
  onError,
} = {}) => {
  const socket = io(resolveSocketOrigin(), {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    socket.emit('notifications:subscribe');
    if (typeof onConnected === 'function') {
      onConnected();
    }
  });

  socket.on('notifications:new', (payload) => {
    if (typeof onNotification === 'function') {
      onNotification(payload);
    }
  });

  socket.on('notifications:unread-count', (payload) => {
    if (typeof onUnreadCount === 'function') {
      onUnreadCount(payload);
    }
  });

  socket.on('connect_error', (error) => {
    if (typeof onError === 'function') {
      onError(error);
    }
  });

  return socket;
};
