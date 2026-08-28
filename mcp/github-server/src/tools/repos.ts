/**
 * Repository tools: list_repos, get_repo, list_branches, list_commits (read-only)
 */

import { z } from "zod";
import { ghClient } from "../client.js";
import { mcpError, normaliseGithubError } from "../utils/errors.js";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const ListReposInput = z.object({
  org: z.string().max(200).optional().describe("List repos for this organization instead of the authenticated user"),
  user: z.string().max(200).optional().describe("List public repos for this user instead of the authenticated user"),
  type: z.enum(["all", "owner", "member", "public", "private"]).optional().default("all"),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().default("updated"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
});

const GetRepoInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
});

const ListBranchesInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  per_page: z.number().int().min(1).max(100).optional().default(50),
});

const ListCommitsInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  sha: z.string().max(300).optional().describe("Branch name or commit SHA to start listing from"),
  path: z.string().max(500).optional().describe("Only commits touching this file path"),
  author: z.string().max(200).optional().describe("Filter by commit author (GitHub login or email)"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const listReposToolDef = {
  name: "list_repos",
  description:
    "List repositories for the authenticated user, or for a given org/user. Read-only. Use to discover available repositories.",
  inputSchema: {
    type: "object",
    properties: {
      org: { type: "string", description: "List repos for this organization instead of the authenticated user" },
      user: { type: "string", description: "List public repos for this user instead of the authenticated user" },
      type: {
        type: "string",
        enum: ["all", "owner", "member", "public", "private"],
        description: "Repository type filter. Default: all",
      },
      sort: {
        type: "string",
        enum: ["created", "updated", "pushed", "full_name"],
        description: "Sort order. Default: updated",
      },
      per_page: { type: "number", description: "Max repos to return (1–100). Default: 30" },
    },
    required: [],
  },
};

export const getRepoToolDef = {
  name: "get_repo",
  description:
    "Get metadata for a single repository: description, default branch, stars, forks, language, topics, visibility. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
    },
    required: ["owner", "repo"],
  },
};

export const listBranchesToolDef = {
  name: "list_branches",
  description: "List branches for a repository, including each branch's head commit SHA and protection status. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      per_page: { type: "number", description: "Max branches to return (1–100). Default: 50" },
    },
    required: ["owner", "repo"],
  },
};

export const listCommitsToolDef = {
  name: "list_commits",
  description:
    "List commit history for a repository branch, optionally filtered by file path or author. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      sha: { type: "string", description: "Branch name or commit SHA to start from. Default: repo default branch" },
      path: { type: "string", description: "Only commits touching this file path" },
      author: { type: "string", description: "Filter by commit author (GitHub login or email)" },
      per_page: { type: "number", description: "Max commits to return (1–100). Default: 30" },
    },
    required: ["owner", "repo"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export async function listRepos(rawInput: unknown) {
  const parse = ListReposInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { org, user, type, sort, per_page } = parse.data;

  try {
    process.stderr.write(`[list_repos] org="${org ?? ""}" user="${user ?? ""}" type=${type}\n`);

    let path: string;
    const params: Record<string, unknown> = { sort, per_page };
    if (org) {
      path = `/orgs/${encodeURIComponent(org)}/repos`;
      params.type = type;
    } else if (user) {
      path = `/users/${encodeURIComponent(user)}/repos`;
      // /users/{user}/repos only accepts all|owner|member
      params.type = type === "public" || type === "private" ? "all" : type;
    } else {
      path = "/user/repos";
      params.type = type;
    }

    const result = await ghClient.get<unknown[]>(path, params);

    const repos = (result ?? []).map((r: unknown) => {
      const repo = r as Record<string, unknown>;
      return {
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        default_branch: repo.default_branch,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        open_issues: repo.open_issues_count,
        language: repo.language,
        updated_at: repo.updated_at,
        html_url: repo.html_url,
      };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(repos, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function getRepo(rawInput: unknown) {
  const parse = GetRepoInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo } = parse.data;

  try {
    process.stderr.write(`[get_repo] ${owner}/${repo}\n`);

    const r = await ghClient.get<Record<string, unknown>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
    );

    const info = {
      full_name: r.full_name,
      description: r.description,
      private: r.private,
      default_branch: r.default_branch,
      stars: r.stargazers_count,
      forks: r.forks_count,
      watchers: r.subscribers_count,
      open_issues: r.open_issues_count,
      language: r.language,
      topics: r.topics,
      license: (r.license as Record<string, unknown> | null)?.spdx_id ?? null,
      archived: r.archived,
      visibility: r.visibility,
      created_at: r.created_at,
      updated_at: r.updated_at,
      pushed_at: r.pushed_at,
      html_url: r.html_url,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function listBranches(rawInput: unknown) {
  const parse = ListBranchesInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, per_page } = parse.data;

  try {
    process.stderr.write(`[list_branches] ${owner}/${repo}\n`);

    const result = await ghClient.get<unknown[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
      { per_page }
    );

    const branches = (result ?? []).map((b: unknown) => {
      const branch = b as Record<string, unknown>;
      const commit = (branch.commit ?? {}) as Record<string, unknown>;
      return {
        name: branch.name,
        commit_sha: commit.sha,
        protected: branch.protected,
      };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(branches, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function listCommits(rawInput: unknown) {
  const parse = ListCommitsInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, sha, path, author, per_page } = parse.data;

  try {
    process.stderr.write(`[list_commits] ${owner}/${repo} sha=${sha ?? "default"}\n`);

    const params: Record<string, unknown> = { per_page };
    if (sha) params.sha = sha;
    if (path) params.path = path;
    if (author) params.author = author;

    const result = await ghClient.get<unknown[]>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits`,
      params
    );

    const commits = (result ?? []).map((c: unknown) => {
      const item = c as Record<string, unknown>;
      const commit = (item.commit ?? {}) as Record<string, unknown>;
      const commitAuthor = (commit.author ?? {}) as Record<string, unknown>;
      const login = (item.author ?? {}) as Record<string, unknown> | null;
      return {
        sha: item.sha,
        author: commitAuthor.name,
        login: login?.login,
        date: commitAuthor.date,
        message: commit.message,
        html_url: item.html_url,
      };
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify(commits, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}
