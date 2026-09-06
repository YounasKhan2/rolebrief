import assert from "node:assert/strict";
import { test, beforeEach, afterEach } from "node:test";
import {
  refresh,
  me,
  resetRefreshMutexForTesting,
  getInFlightRefreshPromise,
  type AuthUser
} from "./auth-api";
import { ApiError } from "./api";

const originalFetch = globalThis.fetch;

const mockUser: AuthUser = {
  id: "usr-1",
  name: "Jane Doe",
  email: "jane@example.com",
  initials: "JD",
  role: "USER",
  status: "ACTIVE",
  isAdmin: false
};

beforeEach(() => {
  resetRefreshMutexForTesting();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetRefreshMutexForTesting();
});

test("refresh concurrency: 2 concurrent 401 responses trigger exactly 1 POST /auth/refresh", async () => {
  let refreshCount = 0;
  let meCount = 0;

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/auth/refresh")) {
      refreshCount++;
      await new Promise((r) => setTimeout(r, 20));
      return new Response(JSON.stringify({ user: mockUser }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("/auth/me")) {
      meCount++;
      // Initial call returns 401; retry returns 200
      if (refreshCount === 0) {
        return new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ user: mockUser }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const [res1, res2] = await Promise.all([me(), me()]);

  assert.equal(refreshCount, 1, "Exactly 1 refresh request must be sent for 2 concurrent 401s");
  assert.equal(res1.user.id, "usr-1");
  assert.equal(res2.user.id, "usr-1");
  assert.equal(getInFlightRefreshPromise(), null, "Mutex promise must be cleared after completion");
});

test("refresh concurrency: 10 concurrent 401 requests share 1 single refresh promise", async () => {
  let refreshCount = 0;

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/auth/refresh")) {
      refreshCount++;
      await new Promise((r) => setTimeout(r, 25));
      return new Response(JSON.stringify({ user: mockUser }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("/auth/me")) {
      if (refreshCount === 0) {
        return new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ user: mockUser }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const results = await Promise.all(Array.from({ length: 10 }, () => me()));

  assert.equal(refreshCount, 1, "Exactly 1 refresh request must be made across 10 concurrent requests");
  assert.equal(results.length, 10);
  for (const r of results) {
    assert.equal(r.user.email, "jane@example.com");
  }
  assert.equal(getInFlightRefreshPromise(), null);
});

test("refresh failure: rejected refresh propagates 401 error and does not loop", async () => {
  let refreshCount = 0;

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/auth/refresh")) {
      refreshCount++;
      return new Response(JSON.stringify({ message: "Refresh token revoked" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (urlStr.includes("/auth/me")) {
      return new Response(JSON.stringify({ message: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await me();
    },
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal((err as ApiError).status, 401);
      return true;
    }
  );

  assert.equal(refreshCount, 1, "Refresh must execute only once on failure without loop");
  assert.equal(getInFlightRefreshPromise(), null, "Promise must be cleared in finally");
});

test("403 Forbidden: never triggers refresh", async () => {
  let refreshCalled = false;

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/auth/refresh")) {
      refreshCalled = true;
      return new Response(JSON.stringify({ user: mockUser }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await me();
    },
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal((err as ApiError).status, 403);
      return true;
    }
  );

  assert.equal(refreshCalled, false, "403 Forbidden must never trigger a refresh attempt");
});

test("refresh endpoint 401: does not trigger recursive refresh", async () => {
  let refreshCallCount = 0;

  globalThis.fetch = (async (url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/auth/refresh")) {
      refreshCallCount++;
      return new Response(JSON.stringify({ message: "Refresh token expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  await assert.rejects(
    async () => {
      await refresh();
    },
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal((err as ApiError).status, 401);
      return true;
    }
  );

  assert.equal(refreshCallCount, 1, "Refresh endpoint must not call itself recursively");
});
