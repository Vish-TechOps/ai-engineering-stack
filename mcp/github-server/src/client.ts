/**
 * GitHub API client — singleton axios instance with auth, retry, and error normalisation.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { normaliseGithubError } from "./utils/errors.js";

const DEFAULT_API_URL = "https://api.github.com";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err: AxiosError): boolean {
  if (!err.response) return true; // network error
  const status = err.response.status;
  return status === 429 || status >= 500;
}

class GithubClient {
  private readonly http: AxiosInstance;

  constructor() {
    const baseURL = (process.env.GITHUB_API_URL || DEFAULT_API_URL).replace(/\/$/, "");
    const token = process.env.GITHUB_TOKEN ?? "";

    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      // GitHub uses 3xx redirects for moved repos and raw content. Disable to
      // prevent open-redirect attacks that could exfiltrate the auth token to a
      // third-party host.
      maxRedirects: 0,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
    });

    // Request logger (stderr only)
    this.http.interceptors.request.use((config) => {
      process.stderr.write(
        `[github-client] ${config.method?.toUpperCase()} ${config.url}\n`
      );
      return config;
    });
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      const axiosErr = err instanceof AxiosError ? err : null;

      if (axiosErr && isRetryable(axiosErr) && attempt < MAX_RETRIES) {
        const base = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        // Add ±20% jitter to avoid thundering herd when multiple tools hit 429 simultaneously
        const jitter = Math.floor(Math.random() * base * 0.2);
        const delay = base + jitter;
        process.stderr.write(
          `[github-client] Retry ${attempt}/${MAX_RETRIES - 1} after ${delay}ms (${axiosErr.message})\n`
        );
        await sleep(delay);
        return this.executeWithRetry(fn, attempt + 1);
      }

      throw normaliseGithubError(err);
    }
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      const config: AxiosRequestConfig = {};
      if (params) config.params = params;
      const res = await this.http.get<T>(path, config);
      return res.data;
    });
  }

  async post<T = unknown>(
    path: string,
    body?: unknown
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      const res = await this.http.post<T>(path, body);
      return res.data;
    });
  }
}

// Singleton export
export const ghClient = new GithubClient();
