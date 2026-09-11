import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServe } from "../.gemhog-build/serve.js";

// Offline surface of the serve contract: liveness, validation, empty states.
// The /check happy path needs the live chain and is exercised by hand and by
// the bot; CI stays deterministic.

let server;
let base;

before(async () => {
  server = await startServe(0); // 0 lets the OS pick a free port
  base = `http://127.0.0.1:${server.port}`;
});

after(() => server.close());

test("health answers without touching the network", async () => {
  const res = await fetch(`${base}/health`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.service, "gemhog-serve");
});

test("check validates the address before any read", async () => {
  const res = await fetch(`${base}/check/hogwash`);
  assert.equal(res.status, 400);
});

test("holders validates the address before any read", async () => {
  const res = await fetch(`${base}/holders/hogwash`);
  assert.equal(res.status, 400);
});

test("alerts since a future moment is an empty list", async () => {
  const res = await fetch(`${base}/alerts?since=2099-01-01T00:00:00Z`);
  const data = await res.json();
  assert.deepEqual(data.alerts, []);
});

test("unknown routes list the real ones", async () => {
  const res = await fetch(`${base}/nope`);
  const data = await res.json();
  assert.equal(res.status, 404);
  assert.ok(data.error.includes("/check/:token"));
});

test("non-GET is refused", async () => {
  const res = await fetch(`${base}/health`, { method: "POST" });
  assert.equal(res.status, 405);
});
