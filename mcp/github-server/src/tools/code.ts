/**
 * Code tools: search_code, get_file_contents (read-only)
 */

import { z } from "zod";
import { ghClient } from "../client.js";
import { mcpError, normaliseGithubError } from "../utils/errors.js";

// Files larger than this are not decoded inline — metadata is returned instead.
const MAX_DECODE_BYTES = 512 * 1024;

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const SearchCodeInput = z.object({
  query: z.string().min(1).max(1000).describe('Code search query, e.g. "addClass function"'),
  owner: z.string().max(200).optional().describe("Scope search to this owner (adds user:<owner>)"),
  repo: z.string().max(200).optional().describe('Scope search to "owner/repo" (adds repo:); requires owner'),
  org: z.string().max(200).optional().describe("Scope search to this org (adds org:<org>)"),
  per_page: z.number().int().min(1).max(100).optional().default(30),
});

const GetFileContentsInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  path: z.string().max(1000).describe("File or directory path within the repository"),
  ref: z.string().max(300).optional().describe("Branch, tag, or commit SHA. Default: repo default branch"),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const searchCodeToolDef = {
  name: "search_code",
  description:
    "Search code across GitHub, optionally scoped to a repo/org/user. Returns matching file paths and repos. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: 'Code search query, e.g. "addClass function"' },
      owner: { type: "string", description: "Scope search to this owner (adds user:<owner>)" },
      repo: { type: "string", description: 'Scope search to a repo (adds repo:<owner>/<repo>); requires owner' },
      org: { type: "string", description: "Scope search to this org (adds org:<org>)" },
      per_page: { type: "number", description: "Max results to return (1–100). Default: 30" },
    },
    required: ["query"],
  },
};

export const getFileContentsToolDef = {
  name: "get_file_contents",
  description:
    "Read a file (base64-decoded to text) or list a directory from a repository at a given ref. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      path: { type: "string", description: "File or directory path within the repository" },
      ref: { type: "string", description: "Branch, tag, or commit SHA. Default: repo default branch" },
    },
    required: ["owner", "repo", "path"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export async function searchCode(rawInput: unknown) {
  const parse = SearchCodeInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { query, owner, repo, org, per_page } = parse.data;

  try {
    let q = query;
    if (owner && repo) q += ` repo:${owner}/${repo}`;
    else if (org) q += ` org:${org}`;
    else if (owner) q += ` user:${owner}`;

    process.stderr.write(`[search_code] q="${q}"\n`);

    const result = await ghClient.get<{ total_count: number; items: unknown[] }>("/search/code", {
      q,
      per_page,
    });

    const items = (result.items ?? []).map((i: unknown) => {
      const item = i as Record<string, unknown>;
      const repository = (item.repository ?? {}) as Record<string, unknown>;
      return {
        name: item.name,
        path: item.path,
        repository: repository.full_name,
        html_url: item.html_url,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ total_count: result.total_count, items }, null, 2),
        },
      ],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}

export async function getFileContents(rawInput: unknown) {
  const parse = GetFileContentsInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, path, ref } = parse.data;

  try {
    process.stderr.write(`[get_file_contents] ${owner}/${repo}:${path} ref=${ref ?? "default"}\n`);

    const params: Record<string, unknown> = {};
    if (ref) params.ref = ref;

    // The path segments must be encoded but "/" separators preserved.
    const encodedPath = path
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");

    const result = await ghClient.get<unknown>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`,
      params
    );

    // Directory listing → array of entries.
    if (Array.isArray(result)) {
      const entries = result.map((e: unknown) => {
        const entry = e as Record<string, unknown>;
        return { name: entry.name, path: entry.path, type: entry.type, size: entry.size };
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ type: "directory", entries }, null, 2) }],
      };
    }

    // Single file.
    const file = result as Record<string, unknown>;
    const size = typeof file.size === "number" ? file.size : 0;
    const encoding = file.encoding as string | undefined;
    const rawContent = file.content as string | undefined;

    let decoded: string | null = null;
    let note: string | undefined;

    if (encoding === "base64" && typeof rawContent === "string" && size <= MAX_DECODE_BYTES) {
      decoded = Buffer.from(rawContent, "base64").toString("utf-8");
    } else if (size > MAX_DECODE_BYTES) {
      note = `File is ${size} bytes (> ${MAX_DECODE_BYTES}); content not decoded. Use html_url to view.`;
    } else if (!rawContent) {
      note = "No inline content returned (file may be too large or a submodule/symlink).";
    }

    const output = {
      type: "file",
      name: file.name,
      path: file.path,
      size,
      sha: file.sha,
      html_url: file.html_url,
      ...(decoded !== null ? { content: decoded } : {}),
      ...(note ? { note } : {}),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}
