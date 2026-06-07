# CLAUDE.md

Guidance for Claude Code (and future AI sessions) working in this repository.

## Project overview

`whatsapp-mcp-server` is a TypeScript [Model Context Protocol](https://modelcontextprotocol.io)
server that exposes the **official Meta WhatsApp Cloud API** to MCP clients (Claude
Desktop, Claude Code, etc.). It speaks MCP over the **stdio transport** and registers
tools for sending messages (text/image/video/audio/document/reaction), templates, media
upload/download, and business-profile management. An **optional Express webhook server**
(enabled by setting `WEBHOOK_PORT`) receives incoming messages and delivery statuses and
keeps an in-memory conversation store; incoming requests are verified against the
`X-Hub-Signature-256` header when `WHATSAPP_APP_SECRET` is set. The package is ESM
(`"type": "module"`), compiled with `tsc` to `dist/`, and ships a `whatsapp-mcp-server`
bin.

## Layout

- `src/index.ts` — entry point: loads env, builds config, optionally starts the webhook, wires SIGINT/SIGTERM graceful shutdown, starts the MCP server.
- `src/server.ts` — MCP server: aggregates all tools and handles `tools/list` + `tools/call`.
- `src/whatsapp/client.ts` — Axios-based Cloud API client with retry/backoff.
- `src/whatsapp/webhook.ts` — Express webhook server, signature verification, in-memory store.
- `src/whatsapp/types.ts` — shared types and the `WhatsAppError` class.
- `src/tools/*.ts` — tool definitions; `shared.ts` holds `formatError` and `toInputSchema` (Zod → JSON Schema). Each tool's `inputSchema` is derived from its Zod schema — keep that single source of truth.
- `test/` — Vitest unit tests (not shipped; excluded from `dist`).

## Commands

```bash
npm install        # or: npm ci  (uses package-lock.json; what CI runs)
npm run build      # tsc -> dist/
npm run dev        # tsx watch src/index.ts
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src --ext .ts
npm test           # vitest run
npm run test:watch # vitest (watch mode)
```

Before committing, run the full gate the way CI does: `npm ci && npm run typecheck && npm run lint && npm run build && npm test`. CI (`.github/workflows/ci.yml`) runs this on Node 18 and 20.

## Dependencies — hard rule

**Any third-party import must be a DECLARED direct dependency in `package.json`.** Do not
rely on a package resolving transitively (via another dep's `node_modules`); npm hoisting
and pruning differ across installs and will break the published package for end users.

Cautionary precedents in this repo's history:
- `form-data` — imported by `client.ts` for media uploads but undeclared; added directly.
- `zod-to-json-schema` — imported by `tools/shared.ts` but only resolved transitively via
  `@modelcontextprotocol/sdk`; added directly (pinned `^3.25.0` to dedupe with the SDK).

After adding/touching imports, re-scan: `grep -rhoE 'from "[^.][^"]*"' src/` and confirm
every non-Node-builtin entry is in `dependencies`.

## Git / publishing

- **This repo is owned by the `FredShred7` GitHub account.** Before pushing, run
  `gh auth switch --user FredShred7`. A previous session got a silent **403** on push
  because a different account (`myaidvisor`/`terserv`) was the active `gh` account. The
  git remote is HTTPS and uses the `gh` credential helper, so the *active* `gh` account
  determines push permissions.
- Use English Conventional-Commit messages; commit in logical chunks.
- **Publishing is manual and irreversible — do not run it autonomously.** `npm publish`
  (needs npm login + 2FA) and any MCP Registry submission (`mcp-publisher`, needs
  GitHub/DNS auth) must be run by the maintainer. The `prepublishOnly` script runs the
  build. `files: ["dist"]` controls the tarball — verify with `npm publish --dry-run` /
  `npm pack` that only `dist/**`, `package.json`, `README.md`, and `LICENSE` are included.

## Environment variables

See `.env.example`. Required: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`.
Webhook: `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (+ `WEBHOOK_PORT` to enable, `WEBHOOK_PATH`).
Recommended in production: `WHATSAPP_APP_SECRET` (verifies `X-Hub-Signature-256`; if
unset, verification is skipped with a startup warning so local dev still works). Optional:
`WHATSAPP_BUSINESS_ACCOUNT_ID` (for listing phone numbers/templates), `WHATSAPP_API_VERSION`.
