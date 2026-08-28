/**
 * GitHub API error normaliser.
 * Extracts the message and errors[] array from GitHub API responses and formats them.
 */

import { AxiosError } from "axios";

export interface GithubErrorItem {
  resource?: string;
  field?: string;
  code?: string;
  message?: string;
}

export interface GithubErrorBody {
  message?: string;
  errors?: GithubErrorItem[];
  documentation_url?: string;
}

/**
 * Normalises an Axios error into a clean Error with a GitHub-flavoured message.
 */
export function normaliseGithubError(err: unknown): Error {
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 0;
    const data = err.response?.data as GithubErrorBody | undefined;

    let message: string;

    if (data?.message) {
      message = data.message;
      // Append field-level validation errors when GitHub provides them.
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        const details = data.errors
          .map((e) => e.message ?? [e.resource, e.field, e.code].filter(Boolean).join("."))
          .filter(Boolean)
          .join(", ");
        if (details) message = `${message} (${details})`;
      }
    } else if (err.message) {
      message = err.message;
    } else {
      message = "Unknown GitHub API error";
    }

    return new Error(`[GH ${status}] ${message}`);
  }

  if (err instanceof Error) {
    return err;
  }

  return new Error(`[GH 0] ${String(err)}`);
}

/**
 * Returns a standardised MCP error response object.
 */
export function mcpError(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
