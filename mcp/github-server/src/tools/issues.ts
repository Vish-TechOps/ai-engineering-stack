/**
 * Issue tools: list_issues, get_issue (read-only); create_issue, add_issue_comment (WRITE)
 */

import { z } from "zod";
import { ghClient } from "../client.js";
import { mcpError, normaliseGithubError } from "../utils/errors.js";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const ListIssuesInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
  labels: z.string().max(500).optional().describe('Comma-separated label names, e.g. "bug,help wanted"'),
  assignee: z.string().max(200).optional().describe('Filter by assignee login, or "none" / "*"'),
  per_page: z.number().int().min(1).max(100).optional().default(30),
});

const GetIssueInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  issue_number: z.number().int().min(1).describe("Issue number"),
});

const CreateIssueInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  title: z.string().min(1).max(1000).describe("Issue title"),
  body: z.string().max(65_536).optional().describe("Issue body (Markdown)"),
  labels: z.array(z.string().max(200)).max(50).optional().describe("Label names to apply"),
  assignees: z.array(z.string().max(200)).max(20).optional().describe("Logins to assign"),
});

const AddIssueCommentInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  issue_number: z.number().int().min(1).describe("Issue or pull request number"),
  body: z.string().min(1).max(65_536).describe("Comment body (Markdown)"),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const listIssuesToolDef = {
  name: "list_issues",
  description:
    "List and filter issues in a repository by state, labels, and assignee. Pull requests are excluded. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      state: { type: "string", enum: ["open", "closed", "all"], description: "Issue state. Default: open" },
      labels: { type: "string", description: 'Comma-separated label names, e.g. "bug,help wanted"' },
      assignee: { type: "string", description: 'Filter by assignee login, or "none" / "*"' },
      per_page: { type: "number", description: "Max issues to return (1–100). Default: 30" },
    },
    required: ["owner", "repo"],
  },
};

export const getIssueToolDef = {
  name: "get_issue",
  description: "Get full details of a single issue together with its comments. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      issue_number: { type: "number", description: "Issue number" },
    },
    required: ["owner", "repo", "issue_number"],
  },
};

export const createIssueToolDef = {
  name: "create_issue",
  description:
    "WRITE: create a new issue in a repository (title, body, labels, assignees). This mutates the repository.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      title: { type: "string", description: "Issue title" },
      body: { type: "string", description: "Issue body (Markdown)" },
      labels: { type: "array", items: { type: "string" }, description: "Label names to apply" },
      assignees: { type: "array", items: { type: "string" }, description: "Logins to assign" },
    },
    required: ["owner", "repo", "title"],
  },
};

export const addIssueCommentToolDef = {
  name: "add_issue_comment",
  description:
    "WRITE: add a comment to an issue or pull request (PRs are issues, so pass the PR number). This mutates the repository.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      issue_number: { type: "number", description: "Issue or pull request number" },
      body: { type: "string", description: "Comment body (Markdown)" },
    },
    required: ["owner", "repo", "issue_number", "body"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export async function listIssues(rawInput: unknown) {
  const parse = ListIssuesInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, state, labels, assignee, per_page } = parse.data;

  try {
    process.stderr.write(`[list_issues] ${owner}/${repo} state=${state}\n`);

    const params: Record<string, unknown> = { state, per_page };
    if (labels) params.labels = labels;
    if (assignee) params.assignee = assignee;

    const result = await ghClient.get<unknown[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      params
    );

    // The issues endpoint also returns PRs; drop anything with a pull_request key.
    const issues = (result ?? [])
      .map((i) => i as Record<string, unknown>)
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        user: (i.user as Record<string, unknown> | null)?.login,
        labels: (i.labels as unknown[] | undefined)?.map((l) => (l as Record<string, unknown>).name),
        assignees: (i.assignees as unknown[] | undefined)?.map((a) => (a as Record<string, unknown>).login),
        comments: i.comments,
        created_at: i.created_at,
        updated_at: i.updated_at,
        html_url: i.html_url,
      }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(issues, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function getIssue(rawInput: unknown) {
  const parse = GetIssueInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, issue_number } = parse.data;

  try {
    process.stderr.write(`[get_issue] ${owner}/${repo}#${issue_number}\n`);

    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue_number}`;

    // Parallel fan-out: issue detail + comments.
    const [issueRes, commentsRes] = await Promise.all([
      ghClient.get<Record<string, unknown>>(base),
      ghClient
        .get<unknown[]>(`${base}/comments`, { per_page: 100 })
        .catch((err) => ({ error: normaliseGithubError(err).message } as Record<string, unknown>)),
    ]);

    const comments = Array.isArray(commentsRes)
      ? commentsRes.map((c) => {
          const comment = c as Record<string, unknown>;
          return {
            user: (comment.user as Record<string, unknown> | null)?.login,
            created_at: comment.created_at,
            body: comment.body,
          };
        })
      : commentsRes;

    const output = {
      number: issueRes.number,
      title: issueRes.title,
      state: issueRes.state,
      user: (issueRes.user as Record<string, unknown> | null)?.login,
      labels: (issueRes.labels as unknown[] | undefined)?.map((l) => (l as Record<string, unknown>).name),
      assignees: (issueRes.assignees as unknown[] | undefined)?.map((a) => (a as Record<string, unknown>).login),
      created_at: issueRes.created_at,
      updated_at: issueRes.updated_at,
      html_url: issueRes.html_url,
      body: issueRes.body,
      comments,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function createIssue(rawInput: unknown) {
  const parse = CreateIssueInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, title, body, labels, assignees } = parse.data;

  try {
    process.stderr.write(`[create_issue] ${owner}/${repo} title="${title}"\n`);

    const payload: Record<string, unknown> = { title };
    if (body) payload.body = body;
    if (labels) payload.labels = labels;
    if (assignees) payload.assignees = assignees;

    const r = await ghClient.post<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      payload
    );

    const output = {
      number: r.number,
      title: r.title,
      state: r.state,
      html_url: r.html_url,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function addIssueComment(rawInput: unknown) {
  const parse = AddIssueCommentInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, issue_number, body } = parse.data;

  try {
    process.stderr.write(`[add_issue_comment] ${owner}/${repo}#${issue_number}\n`);

    const r = await ghClient.post<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue_number}/comments`,
      { body }
    );

    const output = {
      id: r.id,
      user: (r.user as Record<string, unknown> | null)?.login,
      created_at: r.created_at,
      html_url: r.html_url,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}
