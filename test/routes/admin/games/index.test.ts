import { test } from "node:test";
import * as assert from "node:assert";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { requirePermission } from "../../../../src/hooks/authorize";
import { ListGamesQuery, ListGamesOutput, GetGameParams, GetGameOutput, UpdateGameInput, UpdateGameOutput } from "../../../../src/types/games";
import { Type } from "@sinclair/typebox";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

function makeFakeGame(index: number) {
  return {
    id: `game-${index}`,
    name: `Game ${index}`,
    description: `Description ${index}`,
    price: 1000 + index,
    min_players: 2,
    max_players: 4,
    min_play_time: 30,
    max_play_time: 60,
    age_recommendation: 10,
    publisher: "Test Publisher",
    year_published: 2024,
    image_url: "",
    created_by: "user-123",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

interface MockSupabaseOptions {
  selectData?: unknown[] | null;
  selectCount?: number;
  selectError?: { message: string } | null;
  singleData?: unknown | null;
  singleError?: { message: string; code?: string } | null;
  updateData?: unknown | null;
  updateError?: { message: string; code?: string } | null;
  deleteError?: { message: string; code?: string } | null;
}

function createMockSupabase(opts: MockSupabaseOptions = {}) {
  const {
    selectData = [],
    selectCount = 0,
    selectError = null,
    singleData = null,
    singleError = null,
    updateData = null,
    updateError = null,
    deleteError = null,
  } = opts;

  return {
    from: () => ({
      select: () => ({
        range: () =>
          Promise.resolve({
            data: selectData,
            count: selectCount,
            error: selectError,
          }),
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: singleData,
              error: singleError,
            }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: updateData,
                error: updateError,
              }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: deleteError,
              }),
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
  const { permissions = ["game_view"], supabase = {} } = opts;

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

  const listQuerySchema = Type.Object({
    page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
    size: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
  });

  const getGameParamsSchema = Type.Object({
    id: Type.String(),
  });

  app.get<{ Querystring: ListGamesQuery; Reply: ListGamesOutput }>(
    "/api/v1/admin/games",
    {
      schema: { querystring: listQuerySchema },
      preHandler: [app.authenticate, requirePermission("game_view")],
    },
    async (request) => {
      const page = request.query.page ?? 1;
      const size = request.query.size ?? 10;
      const from = (page - 1) * size;
      const to = from + size - 1;

      const response = await mockSupabase
        .from("games")
        .select("*", { count: "exact" })
        .range(from, to);

      if (response.error) {
        throw app.httpErrors.badRequest(response.error.message);
      }

      const total = response.count ?? 0;
      const totalPages = Math.ceil(total / size);

      return {
        games: response.data ?? [],
        pagination: { page, size, total, totalPages },
      };
    },
  );

  app.get<{ Params: GetGameParams; Reply: GetGameOutput }>(
    "/api/v1/admin/games/:id",
    {
      schema: { params: getGameParamsSchema },
      preHandler: [app.authenticate, requirePermission("game_view")],
    },
    async (request) => {
      const { id } = request.params;

      const response = await mockSupabase
        .from("games")
        .select("*")
        .eq("id", id)
        .single();

      if (response.error) {
        if (response.error.code === "PGRST116") {
          throw app.httpErrors.notFound(`Game with id ${id} not found`);
        }
        throw app.httpErrors.badRequest(response.error.message);
      }

      return { game: response.data };
    },
  );

  const updateBodySchema = Type.Object({
    name: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    price: Type.Optional(Type.Number()),
    min_players: Type.Optional(Type.Number()),
    max_players: Type.Optional(Type.Number()),
    min_play_time: Type.Optional(Type.Number()),
    max_play_time: Type.Optional(Type.Number()),
    age_recommendation: Type.Optional(Type.Number()),
    publisher: Type.Optional(Type.String()),
    year_published: Type.Optional(Type.Number()),
    image_url: Type.Optional(Type.String()),
  });

  app.put<{ Params: GetGameParams; Body: UpdateGameInput; Reply: UpdateGameOutput }>(
    "/api/v1/admin/games/:id",
    {
      schema: { params: getGameParamsSchema, body: updateBodySchema },
      preHandler: [app.authenticate, requirePermission("game_update")],
    },
    async (request) => {
      const { id } = request.params;

      if (Object.keys(request.body).length === 0) {
        throw app.httpErrors.badRequest("At least one field must be provided");
      }

      const response = await mockSupabase
        .from("games")
        .update(request.body)
        .eq("id", id)
        .select("*")
        .single();

      if (response.error) {
        if (response.error.code === "PGRST116") {
          throw app.httpErrors.notFound(`Game with id ${id} not found`);
        }
        throw app.httpErrors.badRequest(response.error.message);
      }

      return { game: response.data };
    },
  );

  app.delete<{ Params: GetGameParams }>(
    "/api/v1/admin/games/:id",
    {
      schema: { params: getGameParamsSchema },
      preHandler: [app.authenticate, requirePermission("game_delete")],
    },
    async (request, reply) => {
      const { id } = request.params;

      const response = await mockSupabase
        .from("games")
        .delete()
        .eq("id", id)
        .select("*")
        .single();

      if (response.error) {
        if (response.error.code === "PGRST116") {
          throw app.httpErrors.notFound(`Game with id ${id} not found`);
        }
        throw app.httpErrors.badRequest(response.error.message);
      }

      reply.code(204).send(undefined);
    },
  );

  await app.ready();

  const token = app.jwt.sign({
    sub: "user-123",
    app_metadata: { permissions },
  });

  return { app, token };
}

// --- List games tests ---

test("list games returns paginated results", async () => {
  const games = Array.from({ length: 3 }, (_, i) => makeFakeGame(i + 1));
  const { app, token } = await buildApp({
    supabase: { selectData: games, selectCount: 25 },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games?page=1&size=3",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.strictEqual(payload.games.length, 3);
  assert.deepStrictEqual(payload.pagination, {
    page: 1,
    size: 3,
    total: 25,
    totalPages: 9,
  });
  await app.close();
});

test("list games uses default page and size", async () => {
  const { app, token } = await buildApp({
    supabase: { selectData: [], selectCount: 0 },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.deepStrictEqual(payload.pagination, {
    page: 1,
    size: 10,
    total: 0,
    totalPages: 0,
  });
  await app.close();
});

test("list games rejects request without game_view permission", async () => {
  const { app, token } = await buildApp({
    permissions: ["other_permission"],
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("list games rejects unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games",
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

test("list games returns error when supabase fails", async () => {
  const { app, token } = await buildApp({
    supabase: { selectError: { message: "database error" } },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

// --- Get game by id tests ---

test("get game returns game when found", async () => {
  const game = makeFakeGame(1);
  const { app, token } = await buildApp({
    supabase: { singleData: game },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.deepStrictEqual(payload.game, game);
  await app.close();
});

test("get game returns 404 when game not found", async () => {
  const { app, token } = await buildApp({
    supabase: { singleError: { message: "not found", code: "PGRST116" } },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games/nonexistent-id",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 404);
  await app.close();
});

test("get game returns 400 on database error", async () => {
  const { app, token } = await buildApp({
    supabase: { singleError: { message: "database error", code: "PGRST000" } },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("get game rejects request without game_view permission", async () => {
  const { app, token } = await buildApp({
    permissions: ["other_permission"],
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("get game rejects unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games/game-1",
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

// --- Update game tests ---

test("update game returns updated game", async () => {
  const updatedGame = { ...makeFakeGame(1), name: "Updated Name" };
  const { app, token } = await buildApp({
    permissions: ["game_update"],
    supabase: { updateData: updatedGame },
  });

  const res = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Updated Name" },
  });

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.payload);
  assert.deepStrictEqual(payload.game, updatedGame);
  await app.close();
});

test("update game returns 400 when body is empty", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_update"],
  });

  const res = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
    payload: {},
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("update game returns 404 when game not found", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_update"],
    supabase: { updateError: { message: "not found", code: "PGRST116" } },
  });

  const res = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/games/nonexistent-id",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Updated Name" },
  });

  assert.strictEqual(res.statusCode, 404);
  await app.close();
});

test("update game returns 400 on database error", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_update"],
    supabase: { updateError: { message: "database error", code: "PGRST000" } },
  });

  const res = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Updated Name" },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("update game rejects request without game_update permission", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_view"],
  });

  const res = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Updated Name" },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("update game rejects unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "PUT",
    url: "/api/v1/admin/games/game-1",
    payload: { name: "Updated Name" },
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

// --- Delete game tests ---

test("delete game returns 204 on success", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_delete"],
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.payload, "");
  await app.close();
});

test("delete game returns 404 when game not found", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_delete"],
    supabase: { deleteError: { message: "not found", code: "PGRST116" } },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/games/nonexistent-id",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 404);
  await app.close();
});

test("delete game returns 400 on database error", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_delete"],
    supabase: { deleteError: { message: "database error", code: "PGRST000" } },
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("delete game rejects request without game_delete permission", async () => {
  const { app, token } = await buildApp({
    permissions: ["game_view"],
  });

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/games/game-1",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 403);
  await app.close();
});

test("delete game rejects unauthenticated request", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "DELETE",
    url: "/api/v1/admin/games/game-1",
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});
