import { authRequest } from "./auth-api";

export interface SerializedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface PaginatedNotifications {
  items: SerializedNotification[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}

export interface NotificationsQueryParams {
  limit?: number;
  cursor?: string;
  unreadOnly?: boolean;
}

export async function getNotifications(
  params: NotificationsQueryParams = {}
): Promise<PaginatedNotifications> {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.unreadOnly != null) query.set("unreadOnly", String(params.unreadOnly));

  const qs = query.toString();
  return authRequest<PaginatedNotifications>(`/notifications${qs ? `?${qs}` : ""}`);
}

export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  return authRequest<{ unreadCount: number }>("/notifications/unread-count");
}

export async function markAsRead(id: string): Promise<SerializedNotification> {
  return authRequest<SerializedNotification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    csrf: true
  });
}

export async function markAllAsRead(): Promise<{ count: number }> {
  return authRequest<{ count: number }>("/notifications/mark-all-read", {
    method: "POST",
    csrf: true
  });
}
