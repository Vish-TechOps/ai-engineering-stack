/**
 * github-server — MCP server entry point
 *
 * Provides 14 tools for GitHub:
 * repos, code, issues, pull requests, commits, and Actions.
 * Read/discovery tools are side-effect free; create_issue,
 * add_issue_comment, and create_pull_request are WRITE operations.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Startup Validation ───────────────────────────────────────────────────────
const REQUIRED_ENV = ["GITHUB_TOKEN"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    process.stderr.write(`[github-server] ERROR: Missing required environment variable: ${key}\n`);
    process.stderr.write(`[github-server] Set ${key} before starting the server.\n`);
    process.exit(1);
  }
}

// GITHUB_API_URL is optional; default to the public API. Validate it is HTTPS so
// the token is never sent in cleartext.
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
if (!apiUrl.startsWith("https://")) {
  process.stderr.write(
    `[github-server] ERROR: GITHUB_API_URL must be an HTTPS URL (e.g. https://api.github.com). Got: "${apiUrl}"\n`
  );
  process.exit(1);
}

// ─── Tool Imports ─────────────────────────────────────────────────────────────

// Repos
import {
  listReposToolDef,
  getRepoToolDef,
  listBranchesToolDef,
  listCommitsToolDef,
  listRepos,
  getRepo,
  listBranches,
  listCommits,
} from "./tools/repos.js";
// Code
import { searchCodeToolDef, getFileContentsToolDef, searchCode, getFileContents } from "./tools/code.js";
// Issues
import {
  listIssuesToolDef,
  getIssueToolDef,
  createIssueToolDef,
  addIssueCommentToolDef,
  listIssues,
  getIssue,
  createIssue,
  addIssueComment,
} from "./tools/issues.js";
// Pull requests
import {
  listPullRequestsToolDef,
  getPullRequestToolDef,
  createPullRequestToolDef,
  listPullRequests,
  getPullRequest,
  createPullRequest,
} from "./tools/pulls.js";
// Actions
import { getWorkflowRunsToolDef, getWorkflowRuns } from "./tools/actions.js";

// ─── All Tool Definitions (14 tools) ─────────────────────────────────────────

const ALL_TOOLS = [
  // Repository & code (read-only)
  listReposToolDef,
  getRepoToolDef,
  listBranchesToolDef,
  listCommitsToolDef,
  searchCodeToolDef,
  getFileContentsToolDef,
  // Issues (read + write)
  listIssuesToolDef,
  getIssueToolDef,
  createIssueToolDef,
  addIssueCommentToolDef,
  // Pull requests (read + write)
  listPullRequestsToolDef,
  getPullRequestToolDef,
  createPullRequestToolDef,
  // Actions (read-only)
  getWorkflowRunsToolDef,
];

// ─── Tool Router ──────────────────────────────────────────────────────────────

type ToolHandler = (input: unknown) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  list_repos: listRepos,
  get_repo: getRepo,
  list_branches: listBranches,
  list_commits: listCommits,
  search_code: searchCode,
  get_file_contents: getFileContents,
  list_issues: listIssues,
  get_issue: getIssue,
  create_issue: createIssue,
  add_issue_comment: addIssueComment,
  list_pull_requests: listPullRequests,
  get_pull_request: getPullRequest,
  create_pull_request: createPullRequest,
  get_workflow_runs: getWorkflowRuns,
};

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "github-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: ALL_TOOLS };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  process.stderr.write(`[github-server] Tool invoked: ${name}\n`);

  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return {
      content: [{ type: "text" as const, text: `Error: Unknown tool "${name}"` }],
      isError: true,
    };
  }

  try {
    return await handler(args ?? {});
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[github-server] Unhandled error in tool "${name}": ${message}\n`);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();

  process.stderr.write(
    `[github-server] Starting v1.0.0 — api=${apiUrl} — ${ALL_TOOLS.length} tools registered\n`
  );

  await server.connect(transport);

  process.stderr.write("[github-server] Connected via stdio transport. Ready.\n");
}

// Graceful shutdown
process.on("SIGINT", async () => {
  process.stderr.write("[github-server] Received SIGINT, shutting down...\n");
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  process.stderr.write("[github-server] Received SIGTERM, shutting down...\n");
  await server.close();
  process.exit(0);
});

main().catch((err) => {
  process.stderr.write(`[github-server] Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
