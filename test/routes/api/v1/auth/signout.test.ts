import { test } from "node:test";
import * as assert from "node:assert";
import { build } from "../../../../helper";

test("POST /api/v1/auth/signout - returns 401 without authorization header", async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/signout",
  });

  assert.strictEqual(res.statusCode, 401);
});

test("POST /api/v1/auth/signout - returns 401 with invalid token", async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/signout",
    headers: {
      authorization: "Bearer invalid.token.here",
    },
  });

  assert.strictEqual(res.statusCode, 401);
});
