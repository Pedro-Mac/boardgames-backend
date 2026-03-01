# AGENTS.md

Guidelines for AI coding agents working in the `backend-boardgames` repository.

## Project Overview

Fastify v5 backend for a boardgames application, written in TypeScript. Uses Supabase
for auth/database and postgres.js for direct PostgreSQL access. Bootstrapped with
`fastify-cli`. Package manager is **npm**.

## Project Structure

```
src/                    # TypeScript source
  app.ts                # Main Fastify app entry point (registers plugins + routes)
  db.ts                 # Database connection (postgres.js)
  plugins/              # Fastify plugins (auto-loaded by @fastify/autoload)
  routes/               # Route handlers (auto-loaded by @fastify/autoload)
test/                   # Tests (mirrors src/ structure)
  helper.ts             # Shared test utilities (app builder/teardown)
  plugins/              # Plugin tests
  routes/               # Route tests
dist/                   # Compiled JS output (do not edit)
tsconfig.json           # Root TypeScript config (extends fastify-tsconfig)
test/tsconfig.json      # Test-specific TypeScript config
```

## Build Commands

```bash
npm run build:ts          # Compile TypeScript (tsc) -> dist/
npm run watch:ts          # Watch mode compilation
npm run dev               # Development: concurrent TS watcher + Fastify with auto-restart
npm start                 # Production: build then run with fastify start
```

## Test Commands

```bash
# Run all tests with coverage
npm test

# Run a single test file directly
node --test -r ts-node/register test/routes/root.test.ts

# Run tests matching a name pattern
node --test -r ts-node/register --test-name-pattern="root route" "test/**/*.ts"

# Build before running tests (full pipeline as in npm test)
npm run build:ts && tsc -p test/tsconfig.json && c8 node --test -r ts-node/register "test/**/*.ts"
```

- **Test runner:** Node.js built-in test runner (`node:test`)
- **Assertions:** Node.js built-in (`node:assert`)
- **Coverage:** c8 (V8-based)
- **Test file pattern:** `test/**/*.test.ts`
- **HTTP testing:** `app.inject()` (Fastify lightweight injection, no real server needed)

## Lint / Format

No ESLint or Prettier is currently configured. There are legacy `eslint-disable-next-line`
comments in scaffold code. When writing new code, follow the style conventions below.

## TypeScript Configuration

Extends `fastify-tsconfig`. Key effective settings:

- `strict: true` (all strict checks enabled)
- `target: ES2023`, `module: NodeNext`, `moduleResolution: NodeNext`
- `noUnusedLocals: true` -- unused variables/imports cause build errors
- `noFallthroughCasesInSwitch: true`
- `isolatedModules: true`
- `sourceMap: true`
- Output to `dist/` directory (CommonJS)

## Code Style Conventions

### Imports
- Use `node:` prefix for Node.js built-ins: `import { join } from "node:path"`
- Use named imports when importing specific items: `import { FastifyPluginAsync } from "fastify"`
- Use default imports where the module exports a default: `import AutoLoad from "@fastify/autoload"`
- Group imports: Node.js built-ins first, then external packages, then local modules

### Formatting
- **Quotes:** Double quotes (`"`) for imports and strings in application code (`src/`)
- **Semicolons:** Use semicolons in application code
- **Trailing commas:** Use trailing commas in multiline structures
- **Indentation:** 2 spaces
- **Line endings:** LF (enforced by tsconfig `newLine: "lf"`)

### Naming
- `camelCase` for variables, functions, parameters
- `PascalCase` for types, interfaces, classes
- Interfaces describing plugin options: `<Name>PluginOptions` (e.g., `SupportPluginOptions`)
- Constants: `camelCase` (not UPPER_SNAKE_CASE)
- Test descriptions: lowercase sentence fragments (`'default root route'`)

### Types
- Use Fastify's typed plugin pattern: `FastifyPluginAsync<OptionsType>`
- Always annotate return type `Promise<void>` on plugin/route async functions
- Use `declare module 'fastify'` for declaration merging when adding decorators
- Define interfaces for plugin options even if initially empty (for future extension)
- Prefer explicit types over `any`

### Error Handling
- Use `@fastify/sensible` for HTTP errors (provides `fastify.httpErrors`)
- Let Fastify's built-in error handling manage uncaught errors in route handlers
- Use `reply.code()` and return objects for custom error responses

### Plugins
- Wrap reusable plugins with `fastify-plugin` (`fp`) to expose decorators to outer scope
- Place reusable plugins in `src/plugins/`
- Place route-specific plugins in their route directory
- Export plugins as `export default`

### Routes
- Place routes in `src/routes/` -- they are auto-loaded by `@fastify/autoload`
- File structure maps to URL path: `src/routes/example/index.ts` -> `/example`
- Export route plugin as `export default`
- Use `app.inject()` for testing routes (not supertest or HTTP calls)

### Tests
- One test file per route/plugin: `test/routes/<name>.test.ts`, `test/plugins/<name>.test.ts`
- Use the shared `build()` helper from `test/helper.ts` to create app instances
- Always pass the test context `t` to `build(t)` for automatic teardown
- Use `assert.deepStrictEqual` for object comparisons, `assert.strictEqual` for primitives
- Parse JSON responses: `JSON.parse(res.payload)`

```typescript
// Example test structure
import { test } from "node:test";
import * as assert from "node:assert";
import { build } from "../helper";

test("description of what is being tested", async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: "GET",
    url: "/your-route",
  });

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(JSON.parse(res.payload), { expected: "response" });
});
```

## Environment Variables

- `DATABASE_URL` -- PostgreSQL connection string (Supabase)
- Supabase credentials (URL and anon key) are used in `src/app.ts`
- Do NOT commit `.env` files or secrets to the repository

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `fastify` v5 | Web framework |
| `@fastify/autoload` | Auto-load plugins and routes from directories |
| `@fastify/sensible` | HTTP error utilities, reply decorators |
| `@fastify/jwt` | JWT authentication (available, not yet wired up) |
| `@supabase/supabase-js` | Supabase client for auth and database |
| `postgres` (postgres.js) | Direct PostgreSQL client |
| `fastify-plugin` (`fp`) | Plugin encapsulation helper |
| `fastify-cli` | CLI for starting/scaffolding the app |
