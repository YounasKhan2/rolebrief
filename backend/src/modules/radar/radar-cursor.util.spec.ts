import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { decodeRadarCursor, encodeRadarCursor, radarQueryKey } from "./radar-cursor.util";

test("radar cursor round-trips a snapshot-bound payload", () => {
  const payload = {
    v: 1 as const,
    engineVersion: "radar-v1",
    userId: "user-1",
    profileRevision: 3,
    feedSnapshotId: "snapshot-1",
    queryKey: radarQueryKey({ tracked: "include", sort: "relevance", country: ["US", "PK"] }),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    last: { jobId: "job-1", rank: 20 }
  };

  const cursor = encodeRadarCursor(payload, "secret");

  assert.deepEqual(decodeRadarCursor(cursor, "secret"), payload);
});

test("radar cursor rejects tampering", () => {
  const cursor = encodeRadarCursor(
    {
      v: 1,
      engineVersion: "radar-v1",
      userId: "user-1",
      profileRevision: 0,
      feedSnapshotId: "snapshot-1",
      queryKey: "q",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      last: { jobId: "job-1", rank: 1 }
    },
    "secret"
  );

  assert.throws(() => decodeRadarCursor(`${cursor.slice(0, -1)}x`, "secret"), BadRequestException);
});

test("radar query key is stable for reordered arrays", () => {
  assert.equal(
    radarQueryKey({ country: ["US", "PK"], sort: "relevance" }),
    radarQueryKey({ sort: "relevance", country: ["PK", "US"] })
  );
});
