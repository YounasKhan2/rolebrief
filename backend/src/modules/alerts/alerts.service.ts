import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Alert, AlertStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AlertCriteriaDto } from "./dto/alert-criteria.dto";
import { CreateAlertDto } from "./dto/create-alert.dto";
import { UpdateAlertDto } from "./dto/update-alert.dto";
import { AlertCriteriaV1, SerializedAlert } from "./alerts.types";
import { AppConfigService } from "../../common/config/app-config.service";
import { verifyAlertUnsubscribeToken } from "./alert-unsubscribe.util";

export const MAX_ALERTS_PER_USER = 10;

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService
  ) {}

  async listAlerts(userId: string): Promise<SerializedAlert[]> {
    const alerts = await this.prisma.alert.findMany({
      where: { userId },
      include: {
        _count: {
          select: { matches: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return alerts.map((a) => this.serialize(a, a._count?.matches ?? 0));
  }

  async getAlert(userId: string, id: string): Promise<SerializedAlert> {
    const alert = await this.prisma.alert.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { matches: true }
        }
      }
    });

    if (!alert) {
      throw new NotFoundException("Alert not found.");
    }

    return this.serialize(alert, alert._count?.matches ?? 0);
  }

  async createAlert(userId: string, dto: CreateAlertDto): Promise<SerializedAlert> {
    const existingCount = await this.prisma.alert.count({
      where: { userId, status: { not: AlertStatus.DISABLED } }
    });

    if (existingCount >= MAX_ALERTS_PER_USER) {
      throw new BadRequestException(`Maximum limit of ${MAX_ALERTS_PER_USER} active alerts reached.`);
    }

    const criteria = this.normalizeCriteria(dto.criteria);

    const alert = await this.prisma.alert.create({
      data: {
        userId,
        name: dto.name.trim(),
        channel: dto.channel,
        cadence: dto.cadence,
        deliveryHourUtc: dto.deliveryHourUtc ?? 9,
        deliveryDayOfWeek: dto.deliveryDayOfWeek,
        workModes: criteria.workModes,
        employmentTypes: criteria.employmentTypes,
        countryCodes: criteria.countryCodes,
        providers: criteria.providers,
        salaryDisclosed: criteria.salaryDisclosed,
        eligibilityPolicy: criteria.eligibilityPolicy,
        criteriaVersion: 1,
        criteriaJson: criteria as unknown as Prisma.InputJsonValue,
        revision: 0
      }
    });

    return this.serialize(alert, 0);
  }

  async updateAlert(userId: string, id: string, dto: UpdateAlertDto): Promise<SerializedAlert> {
    const current = await this.prisma.alert.findFirst({
      where: { id, userId }
    });

    if (!current) {
      throw new NotFoundException("Alert not found.");
    }

    if (current.revision !== dto.expectedRevision) {
      throw new ConflictException({
        message: "Alert has been modified concurrently. Please reload.",
        currentRevision: current.revision
      });
    }

    const criteria = dto.criteria ? this.normalizeCriteria(dto.criteria) : undefined;

    const res = await this.prisma.alert.updateMany({
      where: { id: current.id, revision: dto.expectedRevision },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        channel: dto.channel !== undefined ? dto.channel : undefined,
        cadence: dto.cadence !== undefined ? dto.cadence : undefined,
        deliveryHourUtc: dto.deliveryHourUtc !== undefined ? dto.deliveryHourUtc : undefined,
        deliveryDayOfWeek: dto.deliveryDayOfWeek !== undefined ? dto.deliveryDayOfWeek : undefined,
        workModes: criteria ? criteria.workModes : undefined,
        employmentTypes: criteria ? criteria.employmentTypes : undefined,
        countryCodes: criteria ? criteria.countryCodes : undefined,
        providers: criteria ? criteria.providers : undefined,
        salaryDisclosed: criteria ? criteria.salaryDisclosed : undefined,
        eligibilityPolicy: criteria ? criteria.eligibilityPolicy : undefined,
        criteriaJson: criteria ? (criteria as unknown as Prisma.InputJsonValue) : undefined,
        revision: { increment: 1 }
      }
    });

    if (res.count === 0) {
      const latest = await this.prisma.alert.findFirst({ where: { id } });
      throw new ConflictException({
        message: "Alert has been modified concurrently. Please reload.",
        currentRevision: latest?.revision ?? current.revision
      });
    }

    const updated = await this.prisma.alert.findUniqueOrThrow({
      where: { id: current.id },
      include: {
        _count: {
          select: { matches: true }
        }
      }
    });

    return this.serialize(updated, updated._count?.matches ?? 0);
  }

  async setStatus(
    userId: string,
    id: string,
    targetStatus: AlertStatus,
    expectedRevision: number
  ): Promise<SerializedAlert> {
    const current = await this.prisma.alert.findFirst({
      where: { id, userId }
    });

    if (!current) {
      throw new NotFoundException("Alert not found.");
    }

    if (current.revision !== expectedRevision) {
      throw new ConflictException({
        message: "Alert has been modified concurrently. Please reload.",
        currentRevision: current.revision
      });
    }

    const res = await this.prisma.alert.updateMany({
      where: { id: current.id, revision: expectedRevision },
      data: {
        status: targetStatus,
        revision: { increment: 1 }
      }
    });

    if (res.count === 0) {
      const latest = await this.prisma.alert.findFirst({ where: { id } });
      throw new ConflictException({
        message: "Alert has been modified concurrently. Please reload.",
        currentRevision: latest?.revision ?? current.revision
      });
    }

    const updated = await this.prisma.alert.findUniqueOrThrow({
      where: { id: current.id },
      include: {
        _count: {
          select: { matches: true }
        }
      }
    });

    return this.serialize(updated, updated._count?.matches ?? 0);
  }

  async deleteAlert(userId: string, id: string): Promise<{ deleted: boolean }> {
    const current = await this.prisma.alert.findFirst({
      where: { id, userId }
    });

    if (!current) {
      throw new NotFoundException("Alert not found.");
    }

    await this.prisma.alert.delete({
      where: { id: current.id }
    });

    return { deleted: true };
  }

  async handleUnsubscribe(token: string): Promise<{ success: boolean; action: string; alertId: string }> {
    const payload = verifyAlertUnsubscribeToken(token, this.config.cursorSigningSecret);
    const alert = await this.prisma.alert.findFirst({
      where: { id: payload.alertId, userId: payload.userId }
    });

    if (!alert) {
      throw new NotFoundException("Alert not found or already deleted.");
    }

    if (payload.action === "delete") {
      await this.prisma.alert.delete({ where: { id: alert.id } });
      return { success: true, action: "deleted", alertId: alert.id };
    }

    await this.prisma.alert.update({
      where: { id: alert.id },
      data: {
        status: AlertStatus.PAUSED,
        revision: { increment: 1 }
      }
    });

    return { success: true, action: "paused", alertId: alert.id };
  }

  private normalizeCriteria(criteria: AlertCriteriaDto): AlertCriteriaV1 {
    return {
      version: 1,
      targetTitles: (criteria.targetTitles || [])
        .map((t) => t.trim())
        .filter(Boolean),
      workModes: criteria.workModes || [],
      employmentTypes: (criteria.employmentTypes || [])
        .map((e) => e.trim())
        .filter(Boolean),
      countryCodes: (criteria.countryCodes || [])
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
      providers: (criteria.providers || [])
        .map((p) => p.trim())
        .filter(Boolean),
      salaryDisclosed: criteria.salaryDisclosed,
      eligibilityPolicy: criteria.eligibilityPolicy,
      alignment: criteria.alignment
    };
  }

  private serialize(alert: Alert, matchCount: number = 0): SerializedAlert {
    const rawCriteria = (alert.criteriaJson as unknown as AlertCriteriaV1) || {
      version: 1,
      targetTitles: [],
      workModes: alert.workModes,
      employmentTypes: alert.employmentTypes,
      countryCodes: alert.countryCodes,
      providers: alert.providers,
      salaryDisclosed: alert.salaryDisclosed ?? undefined,
      eligibilityPolicy: alert.eligibilityPolicy,
      alignment: "ANY"
    };

    return {
      id: alert.id,
      name: alert.name,
      status: alert.status,
      channel: alert.channel,
      cadence: alert.cadence,
      deliveryHourUtc: alert.deliveryHourUtc,
      deliveryDayOfWeek: alert.deliveryDayOfWeek,
      criteria: rawCriteria,
      revision: alert.revision,
      matchCount,
      lastEvaluatedAt: alert.lastEvaluatedAt ? alert.lastEvaluatedAt.toISOString() : null,
      lastDeliveredAt: alert.lastDeliveredAt ? alert.lastDeliveredAt.toISOString() : null,
      nextDeliveryDueAt: alert.nextDeliveryDueAt ? alert.nextDeliveryDueAt.toISOString() : null,
      createdAt: alert.createdAt.toISOString(),
      updatedAt: alert.updatedAt.toISOString()
    };
  }
}
