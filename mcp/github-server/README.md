# github-server

> **MCP server for GitHub — 14 focused tools for repos, code, issues, pull requests, and Actions.**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-purple)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Overview

`github-server` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that gives AI assistants (Cline, Claude Code, etc.) a **minimal, focused** set of the most commonly needed GitHub operations — not a full API wrapper. It prioritises read/discovery, with a small set of clearly-marked **write** tools.

**Read-only** tools have no side effects. **Write** tools (⚠️) mutate the repository: `create_issue`, `add_issue_comment`, `create_pull_request`.

| Category | Tools |
|---|---|
| 📦 Repository & code | `list_repos`, `get_repo`, `list_branches`, `list_commits`, `search_code`, `get_file_contents` |
| 🐛 Issues | `list_issues`, `get_issue`, `create_issue` ⚠️, `add_issue_comment` ⚠️ |
| 🔀 Pull requests | `list_pull_requests`, `get_pull_request`, `create_pull_request` ⚠️ |
| ⚙️ Actions | `get_workflow_runs` |

---

## Prerequisites

- **Node.js ≥ 18** (`node --version`)
- **GitHub personal access token** (`GITHUB_TOKEN`) — classic or fine-grained. Scopes: `repo` for private repos + issues/PRs, `read:org` for org repositories.
- *(optional)* **GitHub API base URL** (`GITHUB_API_URL`) — defaults to `https://api.github.com`. For GitHub Enterprise Server use `https://<host>/api/v3`. Must be HTTPS.

---

## Installation & Build

```bash
# Clone or copy the server directory
cd github-server

# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Verify the binary starts (will exit with error if env vars are missing)
node dist/index.js
```

Expected output when env vars are missing:
```
[github-server] ERROR: Missing required environment variable: GITHUB_TOKEN
```

Expected output when correctly configured:
```
[github-server] Starting v1.0.0 — api=https://api.github.com — 14 tools registered
[github-server] Connected via stdio transport. Ready.
```

---

## Running

```bash
# Direct run
GITHUB_TOKEN=ghp_xxx node dist/index.js

# Against GitHub Enterprise
GITHUB_TOKEN=ghp_xxx GITHUB_API_URL=https://ghe.example.com/api/v3 node dist/index.js

# Or with npm start
GITHUB_TOKEN=ghp_xxx npm start
```

---

## MCP Client Configuration

### Cline (VS Code Extension)

Add to your Cline MCP settings (`cline_mcp_settings.json`):

```json
{
  "github-server": {
    "autoApprove": [],
    "disabled": false,
    "timeout": 60,
    "type": "stdio",
    "command": "node",
    "args": [
      "${MCP_SERVERS_DIR}/github-server/dist/index.js"
    ],
    "env": {
      "GITHUB_TOKEN": "your_github_token_here",
      "GITHUB_API_URL": "https://api.github.com"
    }
  }
}
```

### Claude Code

Add to your Claude Code MCP configuration (`~/.claude/claude.json`):

```json
{
  "mcpServers": {
    "github-server": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${MCP_SERVERS_DIR}/github-server/dist/index.js"
      ],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "GITHUB_API_URL": "https://api.github.com"
      }
    }
  }
}
```

---

## All 14 Tools

### Repository & Code (read-only)

| Tool | Description |
|------|-------------|
| `list_repos` | List repositories for the authenticated user, or for a given `org`/`user`. |
| `get_repo` | Repository metadata: description, default branch, stars, forks, language, topics, visibility. |
| `list_branches` | List branches with head commit SHA and protection status. |
| `list_commits` | Commit history for a branch, optionally filtered by `path` or `author`. |
| `search_code` | Search code, optionally scoped to a repo/org/user. Returns matching file paths. |
| `get_file_contents` | Read a file (base64-decoded to text) or list a directory at a given `ref`. |

### Issues (read + write)

| Tool | Description |
|------|-------------|
| `list_issues` | List/filter issues by `state`, `labels`, `assignee`. Pull requests are excluded. |
| `get_issue` | Full issue details together with its comments (parallel fan-out). |
| `create_issue` ⚠️ | **WRITE** — create a new issue (title, body, labels, assignees). |
| `add_issue_comment` ⚠️ | **WRITE** — comment on an issue or pull request. |

### Pull Requests (read + write)

| Tool | Description |
|------|-------------|
| `list_pull_requests` | List/filter PRs by `state` and `base` branch. |
| `get_pull_request` | PR details, diff summary (additions/deletions/changed files), merge & review status. |
| `create_pull_request` ⚠️ | **WRITE** — open a PR (title, head, base, body, draft). |

### Actions (read-only)

| Tool | Description |
|------|-------------|
| `get_workflow_runs` | Recent GitHub Actions runs, filterable by `branch` and `status`. |

---

## Example Prompts

### Read / discovery

```
List my repositories, most recently updated first.
→ Uses: list_repos { sort: "updated" }

Show me the metadata for octocat/Hello-World.
→ Uses: get_repo { owner: "octocat", repo: "Hello-World" }

What branches exist on octocat/Hello-World?
→ Uses: list_branches { owner: "octocat", repo: "Hello-World" }

Show the last 10 commits on main that touched src/index.ts.
→ Uses: list_commits { owner: "octocat", repo: "Hello-World", sha: "main", path: "src/index.ts", per_page: 10 }

Find where "parseLookback" is used in octocat/Hello-World.
→ Uses: search_code { query: "parseLookback", owner: "octocat", repo: "Hello-World" }

Show me the README of octocat/Hello-World on the develop branch.
→ Uses: get_file_contents { owner: "octocat", repo: "Hello-World", path: "README.md", ref: "develop" }

List open bugs assigned to me.
→ Uses: list_issues { owner: "octocat", repo: "Hello-World", state: "open", labels: "bug", assignee: "octocat" }

Show issue #42 with its comments.
→ Uses: get_issue { owner: "octocat", repo: "Hello-World", issue_number: 42 }

What open PRs target the main branch?
→ Uses: list_pull_requests { owner: "octocat", repo: "Hello-World", state: "open", base: "main" }

Summarise PR #7 — size and review status.
→ Uses: get_pull_request { owner: "octocat", repo: "Hello-World", pull_number: 7 }

Did the latest CI run on main pass?
→ Uses: get_workflow_runs { owner: "octocat", repo: "Hello-World", branch: "main" }
```

### Write (mutating)

```
Open a bug report titled "Login button unresponsive on Safari".
→ Uses: create_issue { owner: "octocat", repo: "Hello-World", title: "Login button unresponsive on Safari", body: "...", labels: ["bug"] }

Comment on issue #42 that a fix is in progress.
→ Uses: add_issue_comment { owner: "octocat", repo: "Hello-World", issue_number: 42, body: "Fix in progress on branch fix/login." }

Open a PR from fix/login into main.
→ Uses: create_pull_request { owner: "octocat", repo: "Hello-World", title: "Fix login button", head: "fix/login", base: "main", body: "Closes #42" }
```

---

## Architecture

```
github-server/
├── src/
│   ├── index.ts            ← MCP server, startup validation, tool router
│   ├── client.ts           ← Singleton axios client (auth, retry, error handling)
│   ├── tools/
│   │   ├── repos.ts        ← list_repos, get_repo, list_branches, list_commits
│   │   ├── code.ts         ← search_code, get_file_contents
│   │   ├── issues.ts       ← list_issues, get_issue, create_issue, add_issue_comment
│   │   ├── pulls.ts        ← list_pull_requests, get_pull_request, create_pull_request
│   │   └── actions.ts      ← get_workflow_runs
│   └── utils/
│       └── errors.ts       ← GitHub API error normaliser + mcpError()
├── dist/                   ← Compiled JavaScript (after npm run build)
├── package.json
├── tsconfig.json
└── README.md
```

**Design principles:**
- **Single axios instance** — connection pooling, keep-alive across all tool calls
- **Bearer auth** — `Authorization: Bearer <GITHUB_TOKEN>`, `X-GitHub-Api-Version: 2022-11-28`
- **Retry logic** — 3 attempts, 500ms exponential backoff + jitter on HTTP 429/5xx and network errors
- **Zod validation** — every tool validates input before calling the GitHub API
- **stderr-only logging** — stdout is reserved for MCP protocol messages
- **Never crash** — all tool errors are caught and returned as structured MCP error responses
- **Read-first** — 11 read-only tools; the 3 write tools are labelled ⚠️ in their descriptions
- **Parallel fan-out** — `get_issue` and `get_pull_request` fetch detail + comments/reviews via `Promise.all`

---

## Troubleshooting

### Server exits immediately with "Missing required environment variable"

**Cause:** `GITHUB_TOKEN` is not set.

**Fix:** Set the token before starting:
```bash
export GITHUB_TOKEN="ghp_your_token"
node dist/index.js
```

---

### `[GH 401] Bad credentials`

**Cause:** The token is invalid, expired, or revoked.

**Fix:** Generate a fresh personal access token in GitHub → Settings → Developer settings → Personal access tokens, and update `GITHUB_TOKEN`.

---

### `[GH 403] Forbidden` / rate limit

**Cause:** The token lacks the required scope, or you hit the API rate limit. The server automatically retries 429/5xx up to 3 times.

**Fix:** Ensure the token has `repo` (and `read:org` for org repos). If rate-limited, reduce `per_page` or space out calls.

---

### `[GH 404] Not Found`

**Cause:** The owner/repo/number doesn't exist, or the token can't see a private resource.

**Fix:** Verify `owner`/`repo` with `get_repo` first, and confirm the token has access to private repositories.

---

### `[GH 422] Validation Failed`

**Cause:** A write call was rejected — e.g. `create_pull_request` with a `head`/`base` that don't differ, or a branch that doesn't exist.

**Fix:** Check that `head` and `base` branches exist and differ; the error message includes GitHub's field-level details.

---

### `GITHUB_API_URL must be an HTTPS URL`

**Cause:** `GITHUB_API_URL` is set without `https://` (or to plain HTTP).

**Fix:** Use the full HTTPS URL, e.g. `https://api.github.com` or `https://ghe.example.com/api/v3`.

---

### TypeScript compilation errors after `npm run build`

**Fix:** Ensure dependencies are installed:
```bash
npm install
npm run build
```

---

### MCP Inspector shows 0 tools

**Cause:** Build hasn't been run or `dist/index.js` doesn't exist.

**Fix:**
```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Development

```bash
# Run in dev mode (tsx, no build needed)
GITHUB_TOKEN=ghp_xxx npm run dev

# Build
npm run build

# Inspect with MCP Inspector
GITHUB_TOKEN=ghp_xxx npx @modelcontextprotocol/inspector node dist/index.js
```

---

## License

MIT
