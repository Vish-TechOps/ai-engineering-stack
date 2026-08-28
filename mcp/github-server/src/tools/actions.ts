/**
 * GitHub Actions tools: get_workflow_runs (read-only)
 */

import { z } from "zod";
import { ghClient } from "../client.js";
import { mcpError, normaliseGithubError } from "../utils/errors.js";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const GetWorkflowRunsInput = z.object({
  owner: z.string().max(200).describe("Repository owner (user or org)"),
  repo: z.string().max(200).describe("Repository name"),
  branch: z.string().max(300).optional().describe("Filter runs by head branch"),
  status: z
    .enum(["queued", "in_progress", "completed", "success", "failure", "cancelled"])
    .optional()
    .describe("Filter by run status or conclusion"),
  per_page: z.number().int().min(1).max(100).optional().default(20),
});

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const getWorkflowRunsToolDef = {
  name: "get_workflow_runs",
  description:
    "List recent GitHub Actions workflow runs for a repository, optionally filtered by branch and status. Read-only.",
  inputSchema: {
    type: "object",
    properties: {
      owner: { type: "string", description: "Repository owner (user or org)" },
      repo: { type: "string", description: "Repository name" },
      branch: { type: "string", description: "Filter runs by head branch" },
      status: {
        type: "string",
        enum: ["queued", "in_progress", "completed", "success", "failure", "cancelled"],
        description: "Filter by run status or conclusion",
      },
      per_page: { type: "number", description: "Max runs to return (1–100). Default: 20" },
    },
    required: ["owner", "repo"],
  },
};

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export async function getWorkflowRuns(rawInput: unknown) {
  const parse = GetWorkflowRunsInput.safeParse(rawInput);
  if (!parse.success) {
    return mcpError(`Invalid input: ${parse.error.message}`);
  }
  const { owner, repo, branch, status, per_page } = parse.data;

  try {
    process.stderr.write(`[get_workflow_runs] ${owner}/${repo} branch=${branch ?? "*"} status=${status ?? "*"}\n`);

    const params: Record<string, unknown> = { per_page };
    if (branch) params.branch = branch;
    if (status) params.status = status;

    const result = await ghClient.get<{ total_count: number; workflow_runs: unknown[] }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/runs`,
      params
    );

    const runs = (result.workflow_runs ?? []).map((r: unknown) => {
      const run = r as Record<string, unknown>;
      return {
        id: run.id,
        name: run.name,
        display_title: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        head_branch: run.head_branch,
        run_number: run.run_number,
        created_at: run.created_at,
        html_url: run.html_url,
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ total_count: result.total_count, workflow_runs: runs }, null, 2),
        },
      ],
    };
  } catch (err) {
    return mcpError(normaliseGithubError(err).message);
  }
}
