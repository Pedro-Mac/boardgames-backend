import { test } from "node:test";
import * as assert from "node:assert";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { requirePermission } from "../../../../src/hooks/authorize";
import { ListGamesQuery, ListGamesOutput } from "../../../../src/types/games";
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

interface BuildOptions {
  permissions?: string[];
  supabaseData?: unknown[];
  supabaseCount?: number;
  supabaseError?: { message: string } | null;
}

async function buildApp(opts: BuildOptions = {}) {
  const {
    permissions = ["game_view"],
    supabaseData = [],
    supabaseCount = 0,
    supabaseError = null,
  } = opts;

  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authenticate = async (request: any) => {
    await request.jwtVerify();
  };
  app.decorate("authenticate", authenticate);

  // Mock supabase client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockSupabase: any = {
    from: () => ({
      select: () => ({
        range: () =>
          Promise.resolve({
            data: supabaseData,
            count: supabaseCount,
            error: supabaseError,
          }),
      }),
    }),
  };
  app.decorate("supabase", mockSupabase);

  const listQuerySchema = Type.Object({
    page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
    size: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 10 })),
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

  await app.ready();

  const token = app.jwt.sign({
    sub: "user-123",
    app_metadata: { permissions },
  });

  return { app, token };
}

test("list games returns paginated results", async () => {
  const games = Array.from({ length: 3 }, (_, i) => makeFakeGame(i + 1));
  const { app, token } = await buildApp({
    supabaseData: games,
    supabaseCount: 25,
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
    supabaseData: [],
    supabaseCount: 0,
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
    supabaseError: { message: "database error" },
  });

  const res = await app.inject({
    method: "GET",
    url: "/api/v1/admin/games",
    headers: { authorization: `Bearer ${token}` },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});
