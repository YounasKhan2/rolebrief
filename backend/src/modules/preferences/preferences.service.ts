import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ContrastPreference, MotionPreference, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UpdatePreferencesDto } from "./dto/preferences.dto";

export function validateAndNormalizeTimezone(tz: string): string {
  if (typeof tz !== "string" || tz.trim().length === 0 || tz.length > 100) {
    throw new BadRequestException("Invalid timezone identifier.");
  }
  const trimmed = tz.trim();
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    const resolved = dtf.resolvedOptions().timeZone;
    return resolved || trimmed;
  } catch {
    throw new BadRequestException(`Unsupported or invalid IANA timezone: ${trimmed}`);
  }
}

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const [user, pref] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, timezone: true }
      }),
      this.prisma.userPreference.findUnique({
        where: { userId }
      })
    ]);

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (!pref) {
      // Virtual defaults: Zero database mutation on GET
      return {
        preferences: {
          productUpdates: false,
          marketingEmails: false,
          motionPreference: MotionPreference.SYSTEM,
          contrastPreference: ContrastPreference.SYSTEM,
          timezone: user.timezone || "UTC",
          revision: 0,
          isPersisted: false,
          updatedAt: null
        }
      };
    }

    return {
      preferences: {
        productUpdates: pref.productUpdates,
        marketingEmails: pref.marketingEmails,
        motionPreference: pref.motionPreference,
        contrastPreference: pref.contrastPreference,
        timezone: user.timezone || "UTC",
        revision: pref.revision,
        isPersisted: true,
        updatedAt: pref.updatedAt
      }
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    let normalizedTz: string | undefined;
    if (dto.timezone !== undefined) {
      normalizedTz = validateAndNormalizeTimezone(dto.timezone);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Verify user exists
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, timezone: true }
      });
      if (!user) {
        throw new NotFoundException("User not found.");
      }

      // 2. Check current preference record
      let existing = await tx.userPreference.findUnique({
        where: { userId }
      });

      const now = new Date();

      // First-write: if no record exists yet
      if (!existing) {
        if (dto.expectedRevision !== 0) {
          throw new ConflictException({
            message: "Initial preferences must be created with expectedRevision 0.",
            currentRevision: 0
          });
        }

        try {
          const created = await tx.userPreference.create({
            data: {
              userId,
              productUpdates: dto.productUpdates ?? false,
              productUpdatesConsentUpdatedAt: dto.productUpdates !== undefined ? now : null,
              marketingEmails: dto.marketingEmails ?? false,
              marketingConsentUpdatedAt: dto.marketingEmails !== undefined ? now : null,
              motionPreference: dto.motionPreference ?? MotionPreference.SYSTEM,
              contrastPreference: dto.contrastPreference ?? ContrastPreference.SYSTEM,
              revision: 1
            }
          });

          // Record consent audit events if consent fields were set on first write
          if (dto.productUpdates !== undefined) {
            await tx.authAuditEvent.create({
              data: {
                eventType: "preference.consent_changed",
                success: true,
                actorUserId: userId,
                targetUserId: userId,
                metadata: {
                  category: "product_updates",
                  previousValue: null,
                  newValue: dto.productUpdates,
                  timestamp: now.toISOString()
                }
              }
            });
          }
          if (dto.marketingEmails !== undefined) {
            await tx.authAuditEvent.create({
              data: {
                eventType: "preference.consent_changed",
                success: true,
                actorUserId: userId,
                targetUserId: userId,
                metadata: {
                  category: "marketing",
                  previousValue: null,
                  newValue: dto.marketingEmails,
                  timestamp: now.toISOString()
                }
              }
            });
          }

          let updatedTimezone = user.timezone;
          if (normalizedTz !== undefined) {
            const updatedUser = await tx.user.update({
              where: { id: userId },
              data: { timezone: normalizedTz },
              select: { timezone: true }
            });
            updatedTimezone = updatedUser.timezone;
          }

          return {
            preferences: {
              productUpdates: created.productUpdates,
              marketingEmails: created.marketingEmails,
              motionPreference: created.motionPreference,
              contrastPreference: created.contrastPreference,
              timezone: updatedTimezone || "UTC",
              revision: created.revision,
              isPersisted: true,
              updatedAt: created.updatedAt
            }
          };
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ) {
            // Concurrent first-write collided: another session already created the preferences
            throw new ConflictException({
              message: "Preferences were modified in another session. Please reload to see the latest settings.",
              currentRevision: 1
            });
          }
          throw error;
        }
      }

      // Existing row: perform atomic conditional update with expectedRevision
      if (existing.revision !== dto.expectedRevision) {
        throw new ConflictException({
          message: "Preferences were modified in another session. Please reload to see the latest settings.",
          currentRevision: existing.revision
        });
      }

      const updateData: Prisma.UserPreferenceUpdateInput = {
        revision: { increment: 1 }
      };

      if (dto.productUpdates !== undefined) {
        updateData.productUpdates = dto.productUpdates;
        if (dto.productUpdates !== existing.productUpdates) {
          updateData.productUpdatesConsentUpdatedAt = now;
          await tx.authAuditEvent.create({
            data: {
              eventType: "preference.consent_changed",
              success: true,
              actorUserId: userId,
              targetUserId: userId,
              metadata: {
                category: "product_updates",
                previousValue: existing.productUpdates,
                newValue: dto.productUpdates,
                timestamp: now.toISOString()
              }
            }
          });
        }
      }

      if (dto.marketingEmails !== undefined) {
        updateData.marketingEmails = dto.marketingEmails;
        if (dto.marketingEmails !== existing.marketingEmails) {
          updateData.marketingConsentUpdatedAt = now;
          await tx.authAuditEvent.create({
            data: {
              eventType: "preference.consent_changed",
              success: true,
              actorUserId: userId,
              targetUserId: userId,
              metadata: {
                category: "marketing",
                previousValue: existing.marketingEmails,
                newValue: dto.marketingEmails,
                timestamp: now.toISOString()
              }
            }
          });
        }
      }

      if (dto.motionPreference !== undefined) {
        updateData.motionPreference = dto.motionPreference;
      }
      if (dto.contrastPreference !== undefined) {
        updateData.contrastPreference = dto.contrastPreference;
      }

      const res = await tx.userPreference.updateMany({
        where: {
          userId,
          revision: dto.expectedRevision
        },
        data: updateData
      });

      if (res.count === 0) {
        const latest = await tx.userPreference.findUnique({ where: { userId } });
        throw new ConflictException({
          message: "Preferences were modified in another session. Please reload to see the latest settings.",
          currentRevision: latest?.revision ?? 0
        });
      }

      let updatedTimezone = user.timezone;
      if (normalizedTz !== undefined) {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { timezone: normalizedTz },
          select: { timezone: true }
        });
        updatedTimezone = updatedUser.timezone;
      }

      const updatedPref = await tx.userPreference.findUniqueOrThrow({
        where: { userId }
      });

      return {
        preferences: {
          productUpdates: updatedPref.productUpdates,
          marketingEmails: updatedPref.marketingEmails,
          motionPreference: updatedPref.motionPreference,
          contrastPreference: updatedPref.contrastPreference,
          timezone: updatedTimezone || "UTC",
          revision: updatedPref.revision,
          isPersisted: true,
          updatedAt: updatedPref.updatedAt
        }
      };
    });
  }
}
