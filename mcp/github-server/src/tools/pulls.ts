/**
 * Pull request tools: list_pull_requests, get_pull_request (read-only); create_pull_request (WRITE)
 */

import { z } from "zod";
import { ghClient } from "../client.js";
import { mcpError, normaliseGithubError } from "../utils/errors.js";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const ListPullRequestsInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  base: z.string().max(300).optional().describe("Filter by base branch name"),
  head: z.string().max(300).optional().describe('Filter by head, e.g. "user:branch"'),
  sort: z.enum(["created", "updated", "popularity", "long-running"]).optional().default("created"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
});

const GetPullRequestInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  pull_number: z.number().int().min(1).describe("Pull request number"),
});

const CreatePullRequestInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  title: z.string().min(1).max(1000).describe("Pull request title"),
  head: z.string().min(1).max(300).describe('Head branch (or "owner:branch" for a fork)'),
  base: z.string().min(1).max(300).describe("Base branch to merge into"),
  body: z.string().max(65_536).optional().describe("Pull request body (Markdown)"),
  draft: z.boolean().optional().default(false).describe("Open as a draft PR"),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const listPullRequestsToolDef = {
  name: "list_pull_requests",
  description: "List and filter pull requests in a repository by state and base branch. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      state: { type: "string", enum: ["open", "closed", "all"], description: "PR state. Default: open" },
      base: { type: "string", description: "Filter by base branch name" },
      head: { type: "string", description: 'Filter by head, e.g. "user:branch"' },
      sort: {
        type: "string",
        enum: ["created", "updated", "popularity", "long-running"],
        description: "Sort order. Default: created",
      },
      per_page: { type: "number", description: "Max PRs to return (1–100). Default: 30" },
    },
    required: ["owner", "repo"],
  },
};

export const getPullRequestToolDef = {
  name: "get_pull_request",
  description:
    "Get pull request details including a diff summary (additions/deletions/changed files), merge status, and review decisions. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      pull_number: { type: "number", description: "Pull request number" },
    },
    required: ["owner", "repo", "pull_number"],
  },
};

export const createPullRequestToolDef = {
  name: "create_pull_request",
  description:
    "WRITE: open a new pull request (title, head, base, body, draft). This mutates the repository.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      title: { type: "string", description: "Pull request title" },
      head: { type: "string", description: 'Head branch (or "owner:branch" for a fork)' },
      base: { type: "string", description: "Base branch to merge into" },
      body: { type: "string", description: "Pull request body (Markdown)" },
      draft: { type: "boolean", description: "Open as a draft PR. Default: false" },
    },
    required: ["owner", "repo", "title", "head", "base"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export async function listPullRequests(rawInput: unknown) {
  const parse = ListPullRequestsInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, state, base, head, sort, per_page } = parse.data;

  try {
    process.stderr.write(`[list_pull_requests] ${owner}/${repo} state=${state}\n`);

    const params: Record<string, unknown> = { state, sort, per_page };
    if (base) params.base = base;
    if (head) params.head = head;

    const result = await ghClient.get<unknown[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      params
    );

    const pulls = (result ?? []).map((p: unknown) => {
      const pr = p as Record<string, unknown>;
      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        user: (pr.user as Record<string, unknown> | null)?.login,
        base: (pr.base as Record<string, unknown> | null)?.ref,
        head: (pr.head as Record<string, unknown> | null)?.ref,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
      };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(pulls, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function getPullRequest(rawInput: unknown) {
  const parse = GetPullRequestInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, pull_number } = parse.data;

  try {
    process.stderr.write(`[get_pull_request] ${owner}/${repo}#${pull_number}\n`);

    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pull_number}`;

    // Parallel fan-out: PR detail + reviews.
    const [prRes, reviewsRes] = await Promise.all([
      ghClient.get<Record<string, unknown>>(base),
      ghClient
        .get<unknown[]>(`${base}/reviews`, { per_page: 100 })
        .catch((err) => ({ error: normaliseGithubError(err).message } as Record<string, unknown>)),
    ]);

    const reviews = Array.isArray(reviewsRes)
      ? reviewsRes.map((r) => {
          const review = r as Record<string, unknown>;
          return {
            user: (review.user as Record<string, unknown> | null)?.login,
            state: review.state,
            submitted_at: review.submitted_at,
          };
        })
      : reviewsRes;

    const output = {
      number: prRes.number,
      title: prRes.title,
      state: prRes.state,
      draft: prRes.draft,
      user: (prRes.user as Record<string, unknown> | null)?.login,
      base: (prRes.base as Record<string, unknown> | null)?.ref,
      head: (prRes.head as Record<string, unknown> | null)?.ref,
      mergeable: prRes.mergeable,
      merged: prRes.merged,
      diff_summary: {
        additions: prRes.additions,
        deletions: prRes.deletions,
        changed_files: prRes.changed_files,
        commits: prRes.commits,
      },
      created_at: prRes.created_at,
      updated_at: prRes.updated_at,
      html_url: prRes.html_url,
      body: prRes.body,
      reviews,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function createPullRequest(rawInput: unknown) {
  const parse = CreatePullRequestInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, title, head, base, body, draft } = parse.data;

  try {
    process.stderr.write(`[create_pull_request] ${owner}/${repo} ${head} → ${base}\n`);

    const payload: Record<string, unknown> = { title, head, base, draft };
    if (body) payload.body = body;

    const r = await ghClient.post<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      payload
    );

    const output = {
      number: r.number,
      title: r.title,
      state: r.state,
      draft: r.draft,
      html_url: r.html_url,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}
