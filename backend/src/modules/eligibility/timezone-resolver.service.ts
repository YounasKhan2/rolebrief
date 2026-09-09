import { Injectable } from "@nestjs/common";
import { DimensionEvaluationStatus, ReasonCode } from "./reason-codes";

export const HIMALAYAS_DECLARED_GLOBAL_OFFSET_SET = new Set<number>([
  -600, -540, -480, -420, -360, -300, -240, -180, -120, -60,
  0, 60, 120, 180, 240, 300, 330, 345, 360, 420, 480, 525, 540, 570, 600, 660, 720, 765, 780, 840
]);

export interface TimezoneEvaluationResult {
  readonly status: DimensionEvaluationStatus;
  readonly reasonCode: ReasonCode;
  readonly candidateCurrentOffset: number | null;
  readonly candidateSeasonalOffsets: number[];
  readonly declaredOffsets: number[];
  readonly headline: string;
  readonly details: string;
}

@Injectable()
export class TimezoneResolverService {
  /**
   * Calculates the UTC offset in minutes for an IANA timezone identifier at a given date.
   * Returns null if the timezone identifier is invalid.
   */
  getOffsetMinutes(timeZone: string, atDate: Date = new Date()): number | null {
    try {
      const formatterUtc = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });
      const formatterTz = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      });

      const partsUtc = formatterUtc.formatToParts(atDate);
      const partsTz = formatterTz.formatToParts(atDate);

      const getVal = (parts: Intl.DateTimeFormatPart[], type: string) =>
        parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

      const dUtc = Date.UTC(
        getVal(partsUtc, "year"),
        getVal(partsUtc, "month") - 1,
        getVal(partsUtc, "day"),
        getVal(partsUtc, "hour") % 24,
        getVal(partsUtc, "minute"),
        getVal(partsUtc, "second")
      );

      const dTz = Date.UTC(
        getVal(partsTz, "year"),
        getVal(partsTz, "month") - 1,
        getVal(partsTz, "day"),
        getVal(partsTz, "hour") % 24,
        getVal(partsTz, "minute"),
        getVal(partsTz, "second")
      );

      return Math.round((dTz - dUtc) / 60000);
    } catch {
      return null;
    }
  }

  /**
   * Returns both winter and summer active offsets for DST-observing zones.
   */
  getSeasonalOffsets(timeZone: string): number[] {
    const currentYear = new Date().getFullYear();
    const winter = this.getOffsetMinutes(timeZone, new Date(Date.UTC(currentYear, 0, 15)));
    const summer = this.getOffsetMinutes(timeZone, new Date(Date.UTC(currentYear, 6, 15)));

    const offsets: number[] = [];
    if (winter !== null) offsets.push(winter);
    if (summer !== null && !offsets.includes(summer)) offsets.push(summer);
    return offsets.sort((a, b) => a - b);
  }

  /**
   * Formats offset minutes into standard UTC representation (e.g. UTC-05:00, UTC+05:30).
   */
  formatOffset(minutes: number): string {
    const sign = minutes >= 0 ? "+" : "-";
    const abs = Math.abs(minutes);
    const hours = Math.floor(abs / 60);
    const mins = abs % 60;
    const hStr = String(hours).padStart(2, "0");
    const mStr = String(mins).padStart(2, "0");
    return `UTC${sign}${hStr}:${mStr}`;
  }

  /**
   * Evaluates timezone compatibility between candidate and job.
   */
  evaluate(
    candidateTimezone: string | null | undefined,
    jobDeclaredOffsets: readonly number[]
  ): TimezoneEvaluationResult {
    const declared = Array.from(jobDeclaredOffsets);

    // 1. If job has no declared timezone constraints
    if (declared.length === 0) {
      return {
        status: "SATISFIED",
        reasonCode: ReasonCode.TZ_NO_DECLARED_RESTRICTION,
        candidateCurrentOffset: candidateTimezone ? this.getOffsetMinutes(candidateTimezone) : null,
        candidateSeasonalOffsets: candidateTimezone ? this.getSeasonalOffsets(candidateTimezone) : [],
        declaredOffsets: declared,
        headline: "No timezone constraints",
        details: "No timezone constraints declared by employer."
      };
    }

    // 2. Candidate timezone unspecified or invalid
    if (!candidateTimezone) {
      return {
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.TZ_CANDIDATE_UNSPECIFIED,
        candidateCurrentOffset: null,
        candidateSeasonalOffsets: [],
        declaredOffsets: declared,
        headline: "Timezone unspecified",
        details: "Candidate profile does not state a timezone; check required."
      };
    }

    const currentOffset = this.getOffsetMinutes(candidateTimezone);
    if (currentOffset === null) {
      return {
        status: "INSUFFICIENT_DATA",
        reasonCode: ReasonCode.TZ_CANDIDATE_UNSPECIFIED,
        candidateCurrentOffset: null,
        candidateSeasonalOffsets: [],
        declaredOffsets: declared,
        headline: "Unrecognized timezone",
        details: `Candidate timezone "${candidateTimezone}" could not be parsed; check required.`
      };
    }

    const seasonalOffsets = this.getSeasonalOffsets(candidateTimezone);

    // 3. Check if current or seasonal offset falls within declared offsets
    const matchesCurrent = declared.includes(currentOffset);
    const matchesSeasonal = seasonalOffsets.some((o) => declared.includes(o));

    const declaredFormatted = declared.map((o) => this.formatOffset(o)).join(", ");
    const currentFormatted = this.formatOffset(currentOffset);

    if (matchesCurrent || matchesSeasonal) {
      return {
        status: "SATISFIED",
        reasonCode: ReasonCode.TZ_WITHIN_DECLARED_OFFSET,
        candidateCurrentOffset: currentOffset,
        candidateSeasonalOffsets: seasonalOffsets,
        declaredOffsets: declared,
        headline: `Timezone aligned (${currentFormatted})`,
        details: `Candidate timezone (${currentFormatted}) aligns with employer's declared timezone band (${declaredFormatted}).`
      };
    }

    // Mismatch is INSUFFICIENT_DATA (never CONFLICT)
    return {
      status: "INSUFFICIENT_DATA",
      reasonCode: ReasonCode.TZ_OUTSIDE_DECLARED_OFFSET,
      candidateCurrentOffset: currentOffset,
      candidateSeasonalOffsets: seasonalOffsets,
      declaredOffsets: declared,
      headline: "Timezone offset check required",
      details: `Candidate timezone (${currentFormatted}) is outside employer's declared band (${declaredFormatted}); check employer flexibility.`
    };
  }
}
