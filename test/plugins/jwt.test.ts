import { test } from "node:test";
import * as assert from "node:assert";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

/**
 * These tests verify the authenticate preHandler pattern independently
 * using a simple HS256 secret, without hitting the real JWKS endpoint.
 */

function buildAuthenticateHook() {
  return async (request: { jwtVerify: () => Promise<void> }) => {
    try {
      await request.jwtVerify();
    } catch (_err) {
      const error = new Error("Invalid or expired token");
      (error as Error & { statusCode: number }).statusCode = 401;
      throw error;
    }
  };
}

test("authenticate rejects requests without token", async () => {
  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  const authenticate = buildAuthenticateHook();
  app.get("/protected", { preHandler: [authenticate] }, async () => {
    return { ok: true };
  });

  await app.ready();

  const res = await app.inject({
    method: "GET",
    url: "/protected",
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

test("authenticate rejects invalid token", async () => {
  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  const authenticate = buildAuthenticateHook();
  app.get("/protected", { preHandler: [authenticate] }, async () => {
    return { ok: true };
  });

  await app.ready();

  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: "Bearer invalid-token" },
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

test("authenticate allows valid token", async () => {
  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  const authenticate = buildAuthenticateHook();
  app.get("/protected", { preHandler: [authenticate] }, async (request) => {
    return { sub: (request.user as { sub: string }).sub };
  });

  await app.ready();

  const token = app.jwt.sign({ sub: "user-123", app_metadata: { permissions: [] } });

  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(res.payload), { sub: "user-123" });
  await app.close();
});
