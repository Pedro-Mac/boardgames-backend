import * as assert from "node:assert";
import { test } from "node:test";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import Fastify from "fastify";
import { requirePermission } from "../../../../src/hooks/authorize";
import {
  AssignPermissionToUserBody,
  AssignPermissionToUserParams,
  RemovePermissionFromUserParams,
} from "../../../../src/types/permissions";
import { supabaseErrorCode } from "../../../../src/constants/supabase-errors";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

interface MockUserData {
  id: string;
}

interface MockPermissionData {
  id: string;
  name: string;
}

interface MockSupabaseOptions {
  userError?: { message: string; code?: string } | null;
  permissionName?: string;
  permissionError?: { message: string; code?: string } | null;
  insertError?: { message: string; code?: string } | null;
  deleteError?: { message: string; code?: string } | null;
}

function createMockSupabase(opts: MockSupabaseOptions = {}) {
  const {
    userError = null,
    permissionName = "game_view",
    permissionError = null,
    insertError = null,
    deleteError = null,
  } = opts;

  return {
    from: (table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              single: (): Promise<{ data: MockUserData | null; error: typeof userError }> =>
                Promise.resolve({
                  data: userError ? null : { id: "user-123" },
                  error: userError,
                }),
            }),
          }),
        };
      }

      if (table === "permissions") {
        return {
          select: () => ({
            eq: () => ({
              single: (): Promise<{ data: MockPermissionData | null; error: typeof permissionError }> =>
                Promise.resolve({
                  data: permissionError ? null : { id: "permission-1", name: permissionName },
                  error: permissionError,
                }),
            }),
          }),
        };
      }

      // user_permissions
      return {
        insert: () => ({
          select: () => ({
            single: (): Promise<{ data: { user_id: string } | null; error: typeof insertError }> =>
              Promise.resolve({
                data: insertError ? null : { user_id: "user-123" },
                error: insertError,
              }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: (): Promise<{ data: { user_id: string } | null; error: typeof deleteError }> =>
                  Promise.resolve({
                    data: deleteError ? null : { user_id: "user-123" },
                    error: deleteError,
                  }),
              }),
            }),
          }),
        }),
      };
    },
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

  const assignPermissionParamsSchema = Type.Object({
    userId: Type.String(),
  });

  const assignPermissionBodySchema = Type.Object({
    permission_id: Type.String({ minLength: 1 }),
  });

  const removePermissionParamsSchema = Type.Object({
    userId: Type.String(),
    permissionId: Type.String(),
  });

  app.post<{ Params: AssignPermissionToUserParams; Body: AssignPermissionToUserBody }>(
    "/api/v1/admin/users/:userId/permissions",
    {
      schema: {
        params: assignPermissionParamsSchema,
        body: assignPermissionBodySchema,
      },
      preHandler: [app.authenticate, requirePermission("permissions_manage")],
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { permission_id } = request.body;

      const userResponse = await mockSupabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userResponse.error) {
        if (userResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw app.httpErrors.notFound(`User with id ${userId} not found`);
        }
        throw app.httpErrors.badRequest(userResponse.error.message);
      }

      const permissionResponse = await mockSupabase
        .from("permissions")
        .select("id")
        .eq("id", permission_id)
        .single();

      if (permissionResponse.error) {
        if (permissionResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw app.httpErrors.notFound(
            `Permission with id ${permission_id} not found`,
          );
        }
        throw app.httpErrors.badRequest(permissionResponse.error.message);
      }

      const insertResponse = await mockSupabase
        .from("user_permissions")
        .insert({ user_id: userId, permission_id })
        .select("user_id")
        .single();

      if (insertResponse.error) {
        if (
          insertResponse.error.code === supabaseErrorCode.uniqueConstraintViolation
        ) {
          throw app.httpErrors.conflict(
            "Permission is already assigned to this user",
          );
        }
        throw app.httpErrors.badRequest(insertResponse.error.message);
      }

      reply.code(201).send();
    },
  );

  app.delete<{ Params: RemovePermissionFromUserParams }>(
    "/api/v1/admin/users/:userId/permissions/:permissionId",
    {
      schema: { params: removePermissionParamsSchema },
      preHandler: [app.authenticate, requirePermission("permissions_manage")],
    },
    async (request, reply) => {
      const { userId, permissionId } = request.params;

      const userResponse = await mockSupabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userResponse.error) {
        if (userResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw app.httpErrors.notFound(`User with id ${userId} not found`);
        }
        throw app.httpErrors.badRequest(userResponse.error.message);
      }

      const permissionResponse = await mockSupabase
        .from("permissions")
        .select("id, name")
        .eq("id", permissionId)
        .single();

      if (permissionResponse.error) {
        if (permissionResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw app.httpErrors.notFound(
            `Permission with id ${permissionId} not found`,
          );
        }
        throw app.httpErrors.badRequest(permissionResponse.error.message);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authenticatedUser = (request as any).user;
      if (
        userId === authenticatedUser.sub &&
        permissionResponse.data.name === "permissions_manage"
      ) {
        throw app.httpErrors.badRequest(
          "Cannot remove your own permissions_manage permission",
        );
      }

      const deleteResponse = await mockSupabase
        .from("user_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("permission_id", permissionId)
        .select("user_id")
        .single();

      if (deleteResponse.error) {
        if (deleteResponse.error.code === supabaseErrorCode.rowNotFound) {
          throw app.httpErrors.notFound(
            "Permission is not assigned to this user",
          );
        }
        throw app.httpErrors.badRequest(deleteResponse.error.message);
      }

      reply.code(204).send(undefined);
    },
  );

  await app.ready();

  const token = app.jwt.sign({
    sub: "admin-user",
    app_metadata: { permissions },
  });

  return { app, token };
}

// BOA-19: assign permission to user

test("assign permission returns 201 when successful", async () => {
  const { app, token } = await buildApp();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users/user-123/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permission_id: "permission-1" },
  });

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.payload, "");

  await app.close();
});

test("assign permission returns 401 for unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users/user-123/permissions",
    payload: { permission_id: "permission-1" },
  });

  assert.strictEqual(res.statusCode, 401);

  await app.close();
});

test("assign permission returns 403 when missing permissions_manage", async () => {
  const { app, token } = await buildApp({ permissions: ["game_view"] });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users/user-123/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permission_id: "permission-1" },
  });

  assert.strictEqual(res.statusCode, 403);

  await app.close();
});

test("assign permission returns 404 when user does not exist", async () => {
  const { app, token } = await buildApp({
    supabase: {
      userError: {
        message: "not found",
        code: supabaseErrorCode.rowNotFound,
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users/nonexistent-user/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permission_id: "permission-1" },
  });

  assert.strictEqual(res.statusCode, 404);

  await app.close();
});

test("assign permission returns 404 when permission does not exist", async () => {
  const { app, token } = await buildApp({
    supabase: {
      permissionError: {
        message: "not found",
        code: supabaseErrorCode.rowNotFound,
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users/user-123/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permission_id: "nonexistent-permission" },
  });

  assert.strictEqual(res.statusCode, 404);

  await app.close();
});

test("assign permission returns 409 when permission is already assigned", async () => {
  const { app, token } = await buildApp({
    supabase: {
      insertError: {
        message: "duplicate key value violates unique constraint",
        code: supabaseErrorCode.uniqueConstraintViolation,
      },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/admin/users/user-123/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permission_id: "permission-1" },
  });

  assert.strictEqual(res.statusCode, 409);

  await app.close();
});

test("assign permission returns 400 on database error", async () => {
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
    url: "/api/v1/admin/users/user-123/permissions",
    headers: { authorization: `Bearer ${token}` },
    payload: { permission_id: "permission-1" },
  });

  assert.strictEqual(res.statusCode, 400);

  await app.close();
});

// BOA-20: remove permission from user

test("remove permission returns 204 when successful", async () => {
  const { app, token } = await buildApp();

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/user-123/permissions/permission-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.payload, "");

  await app.close();
});

test("remove permission returns 401 for unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/user-123/permissions/permission-1",
  });

  assert.strictEqual(res.statusCode, 401);

  await app.close();
});

test("remove permission returns 403 when missing permissions_manage", async () => {
  const { app, token } = await buildApp({ permissions: ["game_view"] });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/user-123/permissions/permission-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);

  await app.close();
});

test("remove permission returns 404 when user does not exist", async () => {
  const { app, token } = await buildApp({
    supabase: {
      userError: {
        message: "not found",
        code: supabaseErrorCode.rowNotFound,
      },
    },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/nonexistent-user/permissions/permission-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 404);

  await app.close();
});

test("remove permission returns 404 when permission does not exist", async () => {
  const { app, token } = await buildApp({
    supabase: {
      permissionError: {
        message: "not found",
        code: supabaseErrorCode.rowNotFound,
      },
    },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/user-123/permissions/nonexistent-permission",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 404);

  await app.close();
});

test("remove permission returns 404 when permission is not assigned to user", async () => {
  const { app, token } = await buildApp({
    supabase: {
      deleteError: {
        message: "not found",
        code: supabaseErrorCode.rowNotFound,
      },
    },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/user-123/permissions/permission-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 404);

  await app.close();
});

test("remove permission returns 400 when removing own permissions_manage", async () => {
  // token sub is "admin-user" — using the same id in the URL triggers the guard
  const { app, token } = await buildApp({
    supabase: { permissionName: "permissions_manage" },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/admin-user/permissions/permission-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 400);

  await app.close();
});

test("remove permission returns 400 on database error", async () => {
  const { app, token } = await buildApp({
    supabase: {
      deleteError: {
        message: "database error",
        code: "PGRST000",
      },
    },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/users/user-123/permissions/permission-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 400);

  await app.close();
});
