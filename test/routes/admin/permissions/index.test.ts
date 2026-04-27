import * as assert from "node:assert";
import { test } from "node:test";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import Fastify from "fastify";
import { requirePermission } from "../../../../src/hooks/authorize";
import {
  CreatePermissionInput,
  CreatePermissionOutput,
} from "../../../../src/types/permissions";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

interface MockSupabaseOptions {
  insertData?: { id: string; name: string } | null;
  insertError?: { message: string; code?: string } | null;
}

function createMockSupabase(opts: MockSupabaseOptions = {}) {
  const { insertData = null, insertError = null } = opts;

  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: insertData,
              error: insertError,
            }),
        }),
      }),
    }),
  };
}

interface BuildOptions {
  permissions?: string[];
  supabase?: MockSupabaseOptions;
}

async function buildApp(opts: BuildOptions = {}) {
  const { permissions = ["permissions_manage"], supabase = {} } = opts;

  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authenticate = async (request: any) => {
    await request.jwtVerify();
  };
  app.decorate("authenticate", authenticate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockSupabase: any = createMockSupabase(supabase);
  app.decorate("supabase", mockSupabase);

  const createPermissionBodySchema = Type.Object({
    name: Type.String({ minLength: 1 }),
  });

  app.post<{ Body: CreatePermissionInput; Reply: CreatePermissionOutput }>(
    "/api/v1/admin/permissions",
    {
      schema: { body: createPermissionBodySchema },
      preHandler: [app.authenticate, requirePermission("permissions_manage")],
    },
    async (request, reply) => {
      const { name } = request.body;

      const response = await mockSupabase
        .from("permissions")
        .insert({ name })
        .select("id, name")
        .single();

      if (response.error) {
        if (response.error.code === "23505") {
          throw app.httpErrors.conflict(
            "A permission with that name already exists",
          );
        }

        throw app.httpErrors.badRequest(response.error.message);
      }

      reply.code(201).send({
        permission: {
          id: response.data.id,
          name: response.data.name,
        },
      });
    },
  );

  await app.ready();

  const token = app.jwt.sign({
    sub: "user-123",
    app_metadata: { permissions },
  });

  return { app, token };
}

test("create permission returns 201 when successful", async () => {
  const { app, token } = await buildApp({
    supabase: {
      insertData: {
        id: "permission-1",
        name: "permissions_manage",
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "permissions_manage" },
  });

  assert.strictEqual(res.statusCode, 201);
  assert.deepStrictEqual(JSON.parse(res.payload), {
    permission: {
      id: "permission-1",
      name: "permissions_manage",
    },
  });

  await app.close();
});

test("create permission returns 409 when permission already exists", async () => {
  const { app, token } = await buildApp({
    supabase: {
      insertError: {
        message: "duplicate key value violates unique constraint",
        code: "23505",
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "permissions_manage" },
  });

  assert.strictEqual(res.statusCode, 409);
  await app.close();
});

test("create permission returns 400 on database error", async () => {
  const { app, token } = await buildApp({
    supabase: {
      insertError: {
        message: "database error",
        code: "PGRST000",
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "permissions_manage" },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("create permission rejects request without permissions_manage", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_view"],
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "permissions_manage" },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("create permission rejects unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/permissions",
    payload: { name: "permissions_manage" },
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});
