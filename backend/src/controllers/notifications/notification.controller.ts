import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import {
  deleteAllNotifications,
  deleteNotification,
  getNotificationByIdForUser,
  getUnreadCount,
  getUserNotifications,
  markAllAsRead,
  markAsRead,
} from "../../services/common/notification.service";

const getUserId = (req: AuthRequest, res: Response): number | null => {
  if (!req.user?.id) {
    res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    return null;
  }

  return req.user.id;
};

const userOwnsNotification = async (userId: number, notificationId: number): Promise<boolean> => {
  const notification = await getNotificationByIdForUser(userId, notificationId);
  return Boolean(notification);
};

export const getMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const result = await getUserNotifications(userId, skip, limit);
    res.status(200).json({ success: true, data: result.notifications, pagination: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch notifications" },
    });
  }
};

export const getMyUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const count = await getUnreadCount(userId);
    res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread count" },
    });
  }
};

export const markMyNotificationAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Invalid notification id" },
      });
      return;
    }

    const owns = await userOwnsNotification(userId, notificationId);
    if (!owns) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Notification not found" },
      });
      return;
    }

    const updated = await markAsRead(notificationId);
    res.status(200).json({ success: true, data: updated });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update notification" },
    });
  }
};

export const markAllMyNotificationsAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const result = await markAllAsRead(userId);
    res.status(200).json({ success: true, data: result });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update notifications" },
    });
  }
};

export const deleteMyNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      res.status(400).json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Invalid notification id" },
      });
      return;
    }

    const owns = await userOwnsNotification(userId, notificationId);
    if (!owns) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Notification not found" },
      });
      return;
    }

    const removed = await deleteNotification(notificationId);
    res.status(200).json({ success: true, data: removed });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to delete notification" },
    });
  }
};

export const clearMyNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const result = await deleteAllNotifications(userId);
    res.status(200).json({ success: true, data: result });
  } catch {
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to clear notifications" },
    });
  }
};
