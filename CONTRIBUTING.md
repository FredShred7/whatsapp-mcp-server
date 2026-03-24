# Contributing to whatsapp-mcp-server

Thank you for your interest in contributing! This document outlines how to participate in the project effectively.

---

## Code of Conduct

This project follows a standard contributor code of conduct. By participating you agree to be respectful, constructive, and inclusive. Harassment, personal attacks, or discriminatory language will not be tolerated.

---

## How to Report Bugs

Before filing an issue, please search existing issues to avoid duplicates.

When opening a bug report, include:

1. **Description** — What went wrong? What did you expect to happen?
2. **Steps to reproduce** — Minimal steps that reliably trigger the issue
3. **Environment** — Node.js version, OS, package version
4. **Error output** — Full error message, stack trace, and/or MCP server logs (redact tokens)
5. **WhatsApp API response** — If applicable, the raw API response (redact tokens/IDs)

Use this template as a starting point:

```
**Describe the bug**
A clear and concise description.

**Steps to reproduce**
1. Configure environment with ...
2. Call tool `whatsapp_send_text` with ...
3. See error ...

**Expected behavior**
What you expected to happen.

**Actual behavior**
What actually happened.

**Environment**
- OS: macOS 14 / Ubuntu 22.04 / Windows 11
- Node.js: v20.x
- Package version: 1.0.0

**Logs / error output**
```
paste logs here
```
```

---

## How to Suggest Features

Open a GitHub Issue with the label `enhancement`. Include:

1. **Problem statement** — What limitation or gap does this address?
2. **Proposed solution** — How would you like it to work?
3. **Alternatives considered** — Any other approaches you thought about?
4. **Additional context** — Screenshots, API docs links, use cases

---

## Development Setup

### Prerequisites

- Node.js 20 or later
- npm 10 or later
- A [Meta Developer account](https://developers.facebook.com/) with a WhatsApp Business app
- A test WhatsApp phone number (Meta provides a free test number)

### Steps

```bash
# 1. Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/whatsapp-mcp-server.git
cd whatsapp-mcp-server

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your test credentials

# 4. Run in development mode (auto-recompiles on save)
npm run dev

# 5. Type-check without building
npm run typecheck
```

---

## Pull Request Process

### 1. Fork and branch

```bash
# Fork via GitHub UI, then:
git clone https://github.com/YOUR_USERNAME/whatsapp-mcp-server.git
cd whatsapp-mcp-server
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-number-short-description
```

### 2. Make your changes

- Write clean, well-typed TypeScript — no implicit `any`
- Add or update JSDoc comments for public APIs
- Keep functions small and focused
- Follow the existing file/module structure

### 3. Verify your work

```bash
npm run typecheck   # Must pass with 0 errors
npm run build       # Must compile successfully
npm run lint        # Fix any lint issues
```

### 4. Commit with conventional commits

See the **Commit Message Convention** section below.

### 5. Open a Pull Request

- Target the `main` branch
- Fill in the PR template completely
- Reference any related issues (e.g., `Closes #42`)
- Keep PRs focused — one feature or fix per PR

### 6. Review process

- A maintainer will review within a few days
- Address review comments with new commits (do not force-push during review)
- Once approved and CI passes, your PR will be merged

---

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short description>

[optional body]

[optional footer(s)]
```

**Types:**

| Type       | When to use                                            |
|------------|--------------------------------------------------------|
| `feat`     | A new feature or tool                                  |
| `fix`      | A bug fix                                              |
| `docs`     | Documentation changes only                            |
| `style`    | Formatting, whitespace (no logic change)               |
| `refactor` | Code change that is neither a fix nor a feature        |
| `perf`     | Performance improvement                                |
| `test`     | Adding or updating tests                               |
| `chore`    | Build process, dependency updates, tooling             |
| `ci`       | CI/CD configuration changes                           |

**Examples:**

```
feat(tools): add whatsapp_send_location tool
fix(client): handle rate limit 130429 with backoff
docs(readme): add ngrok webhook setup section
chore(deps): bump axios to 1.8.0
```

**Breaking changes:** Add `BREAKING CHANGE:` in the footer or append `!` after the type:
```
feat!: rename tool whatsapp_send_msg to whatsapp_send_text
```

---

## Code Style Guidelines

- **TypeScript strict mode** is enabled — do not disable it
- **No `any`** unless absolutely unavoidable; use `unknown` and type guards instead
- **Zod schemas** for all tool input validation
- **Named exports** preferred over default exports
- **Error handling**: all tool handlers must catch errors and return human-readable strings (never throw from a handler)
- **Imports**: use `.js` extension in all TypeScript imports (required for ESM Node16 module resolution)
- **Comments**: use JSDoc for public functions; inline comments for non-obvious logic only
- **File naming**: `camelCase.ts` for modules, no index barrel re-exports (import directly)

---

## Testing Guidance

There are currently no automated tests — contributions adding tests are especially welcome!

If you add a test suite, consider:

- **Unit tests** for Zod schema validation and helper functions
- **Integration tests** that mock the WhatsApp Cloud API (use `nock` or `msw`)
- **Type tests** using `tsd` or similar

To manually test your changes:

1. Configure `.env` with your Meta test credentials
2. Use the Meta test phone number provided in the developer dashboard
3. Point Claude Desktop or Claude Code at your local build (see README for config)
4. Run through each tool you changed

---

## Questions?

Open a [GitHub Discussion](https://github.com/FredShred7/whatsapp-mcp-server/discussions) for general questions, or a GitHub Issue for bugs and feature requests.
