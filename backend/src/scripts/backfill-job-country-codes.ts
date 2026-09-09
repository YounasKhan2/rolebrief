import { PrismaClient, Prisma } from "@prisma/client";
import { CountryResolverService } from "../common/country/country-resolver.service";
import {
  normalizeLocationRestrictions,
  normalizeRemoteRestrictions,
  normalizeTimezoneOffsetMinutes
} from "../providers/himalayas/himalayas.normalizer";

export interface BackfillMetrics {
  mode: "DRY_RUN" | "EXECUTE";
  totalProcessed: number;
  totalUpdated: number;
  totalUnchanged: number;
  worldwideCount: number;
  countryLimitedCount: number;
  timezoneLimitedCount: number;
  countryAndTimezoneLimitedCount: number;
  unresolvedLabelsCount: number;
  unresolvedUniqueLabels: string[];
  durationMs: number;
  lastJobId: string | null;
}

export async function runBackfill(options: {
  isExecute: boolean;
  afterId?: string | null;
  batchSize?: number;
  prisma?: PrismaClient;
}): Promise<BackfillMetrics> {
  const prisma = options.prisma ?? new PrismaClient();
  const shouldDisconnect = !options.prisma;
  const isExecute = options.isExecute;
  const batchSize = options.batchSize ?? 50;
  const resolver = new CountryResolverService();

  const startTime = Date.now();
  const metrics: BackfillMetrics = {
    mode: isExecute ? "EXECUTE" : "DRY_RUN",
    totalProcessed: 0,
    totalUpdated: 0,
    totalUnchanged: 0,
    worldwideCount: 0,
    countryLimitedCount: 0,
    timezoneLimitedCount: 0,
    countryAndTimezoneLimitedCount: 0,
    unresolvedLabelsCount: 0,
    unresolvedUniqueLabels: [],
    durationMs: 0,
    lastJobId: null
  };

  const unresolvedSet = new Set<string>();

  try {
    let cursorId: string | null = options.afterId ?? null;

    while (true) {
      const jobs = await prisma.job.findMany({
        where: {
          ...(cursorId ? { id: { gt: cursorId } } : {}),
          providerRecords: {
            some: { providerId: "himalayas.guid" }
          }
        },
        orderBy: { id: "asc" },
        take: batchSize,
        include: {
          providerRecords: {
            where: { providerId: "himalayas.guid" },
            take: 1
          }
        }
      });

      if (jobs.length === 0) {
        break;
      }

      const updates: Prisma.PrismaPromise<any>[] = [];

      for (const job of jobs) {
        metrics.totalProcessed++;
        metrics.lastJobId = job.id;

        // 1. Determine raw inputs from authoritative ProviderRecord rawPayload or stored fields
        let rawLocationRestrictions: any[] = [];
        let rawTimezoneRestrictions: any[] = [];

        const providerRecord = job.providerRecords[0];
        if (providerRecord && typeof providerRecord.rawPayload === "object" && providerRecord.rawPayload !== null) {
          const payload = providerRecord.rawPayload as Record<string, any>;
          if (Array.isArray(payload.locationRestrictions)) {
            rawLocationRestrictions = payload.locationRestrictions;
          }
          if (Array.isArray(payload.timezoneRestrictions)) {
            rawTimezoneRestrictions = payload.timezoneRestrictions;
          }
        }

        // Fallback to existing stored labels if raw payload was not found
        if (rawLocationRestrictions.length === 0 && job.remoteRestrictionLabels.length > 0) {
          rawLocationRestrictions = job.remoteRestrictionLabels;
        }
        if (rawTimezoneRestrictions.length === 0 && job.remoteTimezoneRestrictions.length > 0) {
          rawTimezoneRestrictions = job.remoteTimezoneRestrictions;
        }

        // 2. Normalization
        const { countries, countryCodes, labels, unresolvedLabels } = normalizeLocationRestrictions(
          rawLocationRestrictions,
          resolver
        );
        const timezones = rawTimezoneRestrictions.map((tz) => String(tz));
        const timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(rawTimezoneRestrictions);
        const canonicalRemote = normalizeRemoteRestrictions(
          countries,
          countryCodes,
          labels,
          unresolvedLabels,
          timezones,
          timezoneOffsetMinutes
        );

        // 3. Metric categorisation
        if (canonicalRemote.scope === "WORLDWIDE") metrics.worldwideCount++;
        else if (canonicalRemote.scope === "COUNTRY_LIMITED") metrics.countryLimitedCount++;
        else if (canonicalRemote.scope === "TIMEZONE_LIMITED") metrics.timezoneLimitedCount++;
        else if (canonicalRemote.scope === "COUNTRY_AND_TIMEZONE_LIMITED") metrics.countryAndTimezoneLimitedCount++;

        if (unresolvedLabels.length > 0) {
          metrics.unresolvedLabelsCount += unresolvedLabels.length;
          for (const u of unresolvedLabels) {
            unresolvedSet.add(u);
          }
        }

        // 4. Idempotency verification: compare existing fields vs normalized
        const existingRemoteCodes = job.remoteCountryCodes ?? [];
        const existingLabels = job.remoteRestrictionLabels ?? [];
        const existingTimezones = job.remoteTimezoneRestrictions ?? [];
        const existingScope = job.remoteScope ?? "";
        const existingRemoteJson = (job.remoteRestrictions as Record<string, any>) ?? {};

        const isUnchanged =
          JSON.stringify(existingRemoteCodes) === JSON.stringify(countryCodes) &&
          JSON.stringify(existingLabels) === JSON.stringify(labels) &&
          JSON.stringify(existingTimezones) === JSON.stringify(timezones) &&
          existingScope === canonicalRemote.scope &&
          JSON.stringify(existingRemoteJson.unresolvedLabels ?? []) === JSON.stringify(unresolvedLabels) &&
          JSON.stringify(existingRemoteJson.timezoneOffsetMinutes ?? []) === JSON.stringify(timezoneOffsetMinutes);

        if (isUnchanged) {
          metrics.totalUnchanged++;
        } else {
          metrics.totalUpdated++;
          if (isExecute) {
            updates.push(
              prisma.job.update({
                where: { id: job.id },
                data: {
                  remoteCountryCodes: { set: countryCodes },
                  remoteRestrictionLabels: { set: labels },
                  remoteTimezoneRestrictions: { set: timezones },
                  remoteScope: canonicalRemote.scope,
                  remoteRestrictions: canonicalRemote as unknown as Prisma.InputJsonValue
                }
              })
            );
          }
        }
      }

      if (isExecute && updates.length > 0) {
        await prisma.$transaction(updates);
      }

      cursorId = jobs[jobs.length - 1].id;
    }
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }

  metrics.unresolvedUniqueLabels = Array.from(unresolvedSet).sort();
  metrics.durationMs = Date.now() - startTime;
  return metrics;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const isExecute = args.includes("--execute");
  const afterIdArg = args.find((a) => a.startsWith("--after-id="));
  const afterId = afterIdArg ? afterIdArg.split("=")[1] : null;
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1], 10) : 50;

  console.log(
    `Starting Job Country Backfill (mode: ${isExecute ? "EXECUTE" : "DRY_RUN"}, batchSize: ${batchSize}${
      afterId ? `, afterId: ${afterId}` : ""
    })...`
  );

  runBackfill({ isExecute, afterId, batchSize })
    .then((metrics) => {
      console.log("\n=== Backfill Summary ===");
      console.log(JSON.stringify(metrics, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nBackfill failed:", error);
      process.exit(1);
    });
}
