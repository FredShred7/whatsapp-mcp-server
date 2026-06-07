# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0]

### Added

- **Webhook signature verification.** Incoming webhook requests are now
  validated against the `X-Hub-Signature-256` header using HMAC-SHA256 keyed
  with the Meta App Secret. Configure it via the new `WHATSAPP_APP_SECRET`
  environment variable. When unset, verification is skipped (with a startup
  warning) so local development keeps working.
- **Graceful shutdown.** SIGINT/SIGTERM now close the webhook HTTP server
  cleanly via a new `WhatsAppWebhook.stop()` method.
- **Test suite.** Added a Vitest unit-test suite covering schema generation,
  error formatting, webhook signature verification, and webhook text
  extraction, plus `test` and `test:watch` scripts.
- **Continuous integration.** Added a GitHub Actions workflow running install,
  typecheck, lint, build, and tests on Node 18 and 20.
- **Publish metadata.** `package.json` now declares `license`, `author`,
  `repository`, `homepage`, `bugs`, `keywords`, `engines`, `files`, and a
  `prepublishOnly` build hook. Added `.nvmrc` (Node 20).
- **ESLint.** Added ESLint 9 with a flat config and the
  `@typescript-eslint` parser/plugin so `npm run lint` runs.

### Changed

- Centralized error formatting into `src/tools/shared.ts` (`formatError`),
  removing four duplicated copies.
- Tool `inputSchema`s are now generated from their Zod schemas via
  `zod-to-json-schema`, so constraints (min/max/enum/default/format) survive
  into the schema advertised over MCP. Removed the hand-written JSON Schema
  literals that previously drifted from the Zod definitions.

### Fixed

- Declared the missing `form-data` runtime dependency (imported by the client
  for media uploads but previously undeclared).
- Fixed a temp-directory leak in the media upload tool: cleanup used
  `unlinkSync` on a directory (which throws and was silently ignored). It now
  uses `rmSync(tempDir, { recursive: true, force: true })`.

### Deprecated

- `whatsapp_get_contact` is marked **legacy**. The underlying
  `POST /{phone-number-id}/contacts` contact-check endpoint was an On-Premises
  API feature (sunset 2025-10-23) and has no WhatsApp Cloud API equivalent.
  The tool is retained for backwards compatibility but is not expected to work
  against the Cloud API. To check deliverability, send the message and inspect
  message-status webhooks / error codes instead.

## [1.0.0]

### Added

- Initial release of the WhatsApp MCP server built on the official Meta
  WhatsApp Cloud API: send text/image/video/audio/document/reaction messages,
  send and list templates, manage media, read/update the business profile, and
  receive incoming messages and delivery statuses via an optional webhook
  server with automatic retry/backoff.
