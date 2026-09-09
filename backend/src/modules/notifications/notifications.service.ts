import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AppConfigService } from "../../common/config/app-config.service";
import { NotificationsQueryDto } from "./dto/notifications-query.dto";
import {
  decodeNotificationCursor,
  encodeNotificationCursor
} from "./notification-cursor.util";

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

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  private get cursorSecret(): string {
    return this.config.cursorSigningSecret;
  }

  async listNotifications(
    userId: string,
    query: NotificationsQueryDto
  ): Promise<PaginatedNotifications> {
    const limit = query.limit ?? 20;
    const where: any = {
      userId
    };

    if (query.unreadOnly) {
      where.readAt = null;
    }

    if (query.cursor) {
      const decoded = decodeNotificationCursor(query.cursor, this.cursorSecret, userId);
      const cursorDate = new Date(decoded.createdAt);

      where.OR = [
        {
          createdAt: {
            lt: cursorDate
          }
        },
        {
          createdAt: cursorDate,
          id: {
            lt: decoded.id
          }
        }
      ];
    }

    const items = await this.prisma.notification.findMany({
      where,
      take: limit + 1,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" }
      ]
    });

    const hasMore = items.length > limit;
    const pagedItems = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasMore && pagedItems.length > 0) {
      const lastItem = pagedItems[pagedItems.length - 1];
      nextCursor = encodeNotificationCursor(
        {
          v: 1,
          userId,
          id: lastItem.id,
          createdAt: lastItem.createdAt.toISOString()
        },
        this.cursorSecret
      );
    }

    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null
      }
    });

    return {
      items: pagedItems.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        linkUrl: n.linkUrl,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
        metadata: (n.metadata as Record<string, unknown>) || null
      })),
      nextCursor,
      hasMore,
      unreadCount
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        readAt: null
      }
    });

    return { unreadCount };
  }

  async markAsRead(userId: string, id: string): Promise<SerializedNotification> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId }
    });

    if (!existing) {
      throw new NotFoundException("Notification not found.");
    }

    if (existing.readAt) {
      return {
        id: existing.id,
        type: existing.type,
        title: existing.title,
        body: existing.body,
        linkUrl: existing.linkUrl,
        readAt: existing.readAt.toISOString(),
        createdAt: existing.createdAt.toISOString(),
        metadata: (existing.metadata as Record<string, unknown>) || null
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        readAt: new Date()
      }
    });

    return {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      body: updated.body,
      linkUrl: updated.linkUrl,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      metadata: (updated.metadata as Record<string, unknown>) || null
    };
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    return { count: result.count };
  }
}
