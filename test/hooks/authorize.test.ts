import { test } from "node:test";
import * as assert from "node:assert";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { requirePermission } from "../../src/hooks/authorize";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

async function buildApp(permissions: string[]) {
  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  app.get(
    "/protected",
    {
      preHandler: [
        async (request) => {
          await request.jwtVerify();
        },
        requirePermission("add_games"),
      ],
    },
    async () => {
      return { ok: true };
    },
  );

  await app.ready();

  const token = app.jwt.sign({
    sub: "user-123",
    app_metadata: { permissions },
  });

  return { app, token };
}

test("requirePermission allows request with correct permission", async () => {
  const { app, token } = await buildApp(["add_games"]);

  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(res.payload), { ok: true });
  await app.close();
});

test("requirePermission rejects request without permission", async () => {
  const { app, token } = await buildApp(["backoffice_view"]);

  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("requirePermission rejects request with empty permissions", async () => {
  const { app, token } = await buildApp([]);

  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("requirePermission rejects request with no app_metadata", async () => {
  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  app.get(
    "/protected",
    {
      preHandler: [
        async (request) => {
          await request.jwtVerify();
        },
        requirePermission("add_games"),
      ],
    },
    async () => {
      return { ok: true };
    },
  );

  await app.ready();

  const token = app.jwt.sign({ sub: "user-123" });

  const res = await app.inject({
    method: "GET",
    url: "/protected",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});
