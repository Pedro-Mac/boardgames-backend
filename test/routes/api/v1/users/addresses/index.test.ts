import { test } from "node:test";
import * as assert from "node:assert";
import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { Type } from "@sinclair/typebox";
import type { SupabaseJwtPayload } from "../../../../../../src/plugins/jwt";
import type {
  AddressOutput,
  CreateAddressInput,
} from "../../../../../../src/routes/api/v1/users/addresses/types";

const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

function makeFakeDbAddress(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "addr-1",
    user_id: "user-123",
    full_name: "John Doe",
    street_line_1: "123 Main St",
    street_line_2: null,
    city: "Lisbon",
    state: null,
    postal_code: "1000-001",
    country: "Portugal",
    phone: null,
    is_default: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

interface MockSupabaseOptions {
  countResult?: {
    count: number | null;
    error: { message: string } | null;
  };
  insertResult?: {
    data: unknown | null;
    error: { message: string } | null;
  };
}

function createMockSupabase(opts: MockSupabaseOptions = {}) {
  const {
    countResult = { count: 0, error: null },
    insertResult = { data: null, error: null },
  } = opts;

  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve(countResult),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve(insertResult),
        }),
      }),
    }),
  };
}

interface BuildOptions {
  supabase?: MockSupabaseOptions;
}

async function buildApp(opts: BuildOptions = {}) {
  const { supabase = {} } = opts;

  const app = Fastify();
  await app.register(sensible);
  await app.register(fastifyJwt, { secret: TEST_SECRET });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate("authenticate", async (request: any) => {
    await request.jwtVerify();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockSupabase: any = createMockSupabase(supabase);
  app.decorate("supabase", mockSupabase);

  const bodySchema = Type.Object(
    {
      fullName: Type.String({ minLength: 1 }),
      streetLine1: Type.String({ minLength: 1 }),
      streetLine2: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      city: Type.String({ minLength: 1 }),
      state: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      postalCode: Type.String({ minLength: 1 }),
      country: Type.String({ minLength: 1 }),
      phone: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      isDefault: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  );

  app.post<{ Body: CreateAddressInput; Reply: { address: AddressOutput } }>(
    "/api/v1/users/addresses",
    {
      schema: { body: bodySchema },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const { sub } = request.user as SupabaseJwtPayload;
      const {
        fullName,
        streetLine1,
        streetLine2,
        city,
        state,
        postalCode,
        country,
        phone,
        isDefault,
      } = request.body;

      const { count, error: countError } = await mockSupabase
        .from("addresses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", sub);

      if (countError) {
        throw app.httpErrors.serviceUnavailable("Error creating address");
      }

      const isFirstAddress = (count ?? 0) === 0;
      const shouldBeDefault = isFirstAddress || isDefault === true;

      const { data, error } = await mockSupabase
        .from("addresses")
        .insert({
          user_id: sub,
          full_name: fullName,
          street_line_1: streetLine1,
          street_line_2: streetLine2 ?? null,
          city,
          state: state ?? null,
          postal_code: postalCode,
          country,
          phone: phone ?? null,
          is_default: shouldBeDefault,
        })
        .select("*")
        .single();

      if (error) {
        throw app.httpErrors.serviceUnavailable("Error creating address");
      }

      reply.code(201).send({
        address: {
          id: data.id,
          fullName: data.full_name,
          streetLine1: data.street_line_1,
          streetLine2: data.street_line_2,
          city: data.city,
          state: data.state,
          postalCode: data.postal_code,
          country: data.country,
          phone: data.phone,
          isDefault: data.is_default,
          createdAt: data.created_at,
        },
      });
    },
  );

  await app.ready();

  const token = app.jwt.sign({ sub: "user-123" });
  return { app, token };
}

const validBody = {
  fullName: "John Doe",
  streetLine1: "123 Main St",
  city: "Lisbon",
  postalCode: "1000-001",
  country: "Portugal",
};

// --- POST /api/v1/users/addresses ---

test("creates address and auto-sets default when no existing addresses", async () => {
  const dbAddress = makeFakeDbAddress({ is_default: true });
  const { app, token } = await buildApp({
    supabase: {
      countResult: { count: 0, error: null },
      insertResult: { data: dbAddress, error: null },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: validBody,
  });

  assert.strictEqual(res.statusCode, 201);
  const payload = JSON.parse(res.payload);
  assert.strictEqual(payload.address.id, "addr-1");
  assert.strictEqual(payload.address.fullName, "John Doe");
  assert.strictEqual(payload.address.streetLine1, "123 Main St");
  assert.strictEqual(payload.address.streetLine2, null);
  assert.strictEqual(payload.address.city, "Lisbon");
  assert.strictEqual(payload.address.state, null);
  assert.strictEqual(payload.address.postalCode, "1000-001");
  assert.strictEqual(payload.address.country, "Portugal");
  assert.strictEqual(payload.address.phone, null);
  assert.strictEqual(payload.address.isDefault, true);
  assert.strictEqual(payload.address.createdAt, "2024-01-01T00:00:00Z");
  await app.close();
});

test("creates address as non-default when user has existing addresses and isDefault is not set", async () => {
  const dbAddress = makeFakeDbAddress({ is_default: false });
  const { app, token } = await buildApp({
    supabase: {
      countResult: { count: 2, error: null },
      insertResult: { data: dbAddress, error: null },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: validBody,
  });

  assert.strictEqual(res.statusCode, 201);
  const payload = JSON.parse(res.payload);
  assert.strictEqual(payload.address.isDefault, false);
  await app.close();
});

test("creates address as default when isDefault is true and user has existing addresses", async () => {
  const dbAddress = makeFakeDbAddress({ is_default: true });
  const { app, token } = await buildApp({
    supabase: {
      countResult: { count: 2, error: null },
      insertResult: { data: dbAddress, error: null },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: { ...validBody, isDefault: true },
  });

  assert.strictEqual(res.statusCode, 201);
  const payload = JSON.parse(res.payload);
  assert.strictEqual(payload.address.isDefault, true);
  await app.close();
});

test("creates address with all optional fields populated", async () => {
  const dbAddress = makeFakeDbAddress({
    street_line_2: "Apt 4B",
    state: "Lisbon District",
    phone: "+351900000000",
    is_default: false,
  });
  const { app, token } = await buildApp({
    supabase: {
      countResult: { count: 1, error: null },
      insertResult: { data: dbAddress, error: null },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      ...validBody,
      streetLine2: "Apt 4B",
      state: "Lisbon District",
      phone: "+351900000000",
    },
  });

  assert.strictEqual(res.statusCode, 201);
  const payload = JSON.parse(res.payload);
  assert.strictEqual(payload.address.streetLine2, "Apt 4B");
  assert.strictEqual(payload.address.state, "Lisbon District");
  assert.strictEqual(payload.address.phone, "+351900000000");
  await app.close();
});

test("returns 400 when required field city is missing", async () => {
  const { app, token } = await buildApp();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      fullName: "John Doe",
      streetLine1: "123 Main St",
      postalCode: "1000-001",
      country: "Portugal",
    },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("returns 400 when required field fullName is missing", async () => {
  const { app, token } = await buildApp();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      streetLine1: "123 Main St",
      city: "Lisbon",
      postalCode: "1000-001",
      country: "Portugal",
    },
  });

  assert.strictEqual(res.statusCode, 400);
  await app.close();
});

test("returns 401 when no authorization header is provided", async () => {
  const { app } = await buildApp();

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    payload: validBody,
  });

  assert.strictEqual(res.statusCode, 401);
  await app.close();
});

test("returns 500 when count query fails", async () => {
  const { app, token } = await buildApp({
    supabase: {
      countResult: { count: null, error: { message: "database error" } },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: validBody,
  });

  assert.strictEqual(res.statusCode, 500);
  await app.close();
});

test("returns 500 when insert fails", async () => {
  const { app, token } = await buildApp({
    supabase: {
      countResult: { count: 0, error: null },
      insertResult: { data: null, error: { message: "database error" } },
    },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/users/addresses",
    headers: { authorization: `Bearer ${token}` },
    payload: validBody,
  });

  assert.strictEqual(res.statusCode, 500);
  await app.close();
});
