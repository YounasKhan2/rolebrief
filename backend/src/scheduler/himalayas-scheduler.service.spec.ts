import assert from "node:assert/strict";
import { test } from "node:test";
import { HimalayasSchedulerService } from "./himalayas-scheduler.service";

test("disabled Himalayas scheduler does not enqueue or schedule jobs", async () => {
  let scheduled = false;
  const service = new HimalayasSchedulerService(
    { himalayas: { enabled: false } } as never,
    {
      upsertJobScheduler: async () => {
        scheduled = true;
      }
    } as never
  );

  await service.syncSchedule();

  assert.equal(scheduled, false);
});
