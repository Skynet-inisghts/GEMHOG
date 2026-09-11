import { test } from "node:test";
import assert from "node:assert/strict";
import { certTtlMs, coalesce, RateLimiter, TtlCache } from "../.gemhog-build/web.js";

test("coalesce runs the work once for concurrent callers", async () => {
  let runs = 0;
  const work = () => {
    runs++;
    return new Promise((r) => setTimeout(() => r(runs), 30));
  };
  const [a, b, c] = await Promise.all([coalesce("k", work), coalesce("k", work), coalesce("k", work)]);
  assert.equal(runs, 1);
  assert.equal(a, 1);
  assert.equal(b, 1);
  assert.equal(c, 1);
  // and runs again once the first flight has landed
  await coalesce("k", work);
  assert.equal(runs, 2);
});

test("coalesce does not cache failures", async () => {
  let runs = 0;
  const failing = () => {
    runs++;
    return Promise.reject(new Error("boom"));
  };
  await assert.rejects(() => coalesce("f", failing));
  await assert.rejects(() => coalesce("f", failing));
  assert.equal(runs, 2);
});

test("certTtlMs grows with the token's age", () => {
  assert.equal(certTtlMs(600), 60_000);
  assert.equal(certTtlMs(7_200), 5 * 60_000);
  assert.equal(certTtlMs(172_800), 15 * 60_000);
  assert.equal(certTtlMs(1_000_000), 60 * 60_000);
});

test("TtlCache expires by its own ttl and evicts oldest past the cap", () => {
  const cache = new TtlCache(4);
  cache.set("a", 1, 10_000);
  assert.equal(cache.get("a"), 1);
  cache.set("b", 2, -1); // already expired
  assert.equal(cache.get("b"), undefined);
  for (const k of ["c", "d", "e", "f"]) cache.set(k, 9, 10_000);
  assert.ok(cache.get("f") !== undefined); // newest survives the eviction sweep
});

test("RateLimiter allows the burst, then refuses, then refills", async () => {
  const limiter = new RateLimiter(3, 300);
  assert.ok(limiter.allow("ip"));
  assert.ok(limiter.allow("ip"));
  assert.ok(limiter.allow("ip"));
  assert.equal(limiter.allow("ip"), false);
  assert.ok(limiter.allow("other")); // buckets are per key
  await new Promise((r) => setTimeout(r, 320));
  assert.ok(limiter.allow("ip"));
});
