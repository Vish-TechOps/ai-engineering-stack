# My Custom MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server built with the official Python SDK (`mcp[cli]`, v2). It exposes
one tool, one resource, and one prompt, and includes both the
high-level (`MCPServer`) and low-level (`Server`) implementation
styles.

## Features

| Primitive | Name | What it does |
|---|---|---|
| Tool | `fetch_user_data` | Returns details for a given `user_id`. Called by the model when it decides it needs that data. |
| Resource | `archive://logs/today` | Provides today's system log snippet as passive context. |
| Prompt | `summarize` | A reusable template that asks for a one-sentence summary of a given `text`. |

## Prerequisites

- Python 3.10+
- `pip`

## Installation

```bash
git clone <this-repo-url>
cd # My Custom MCP Server

A local [Model Context Protocol](https://modelcontextprotocol.io) (MCP)
server built with the official Python SDK (`mcp[cli]`, v2). It exposes
one tool, one resource, and one prompt, and includes both the
high-level (`MCPServer`) and low-level (`Server`) implementation
styles.

## Features

| Primitive | Name | What it does |
|---|---|---|
| Tool | `fetch_user_data` | Returns details for a given `user_id`. Called by the model when it decides it needs that data. |
| Resource | `archive://logs/today` | Provides today's system log snippet as passive context. |
| Prompt | `summarize` | A reusable template that asks for a one-sentence summary of a given `text`. |

## Prerequisites

- Python 3.10+
- `pip`

## Installation

```bash
git clone <this-repo-url>
cd custom-mcp-servers
python3 -m venv venv
source venv/bin/activate      # Windows: .\venv\Scripts\activate
pip install "mcp[cli]"
```

## Project structure

```
custom-mcp-servers/
├── server.py            # High-level implementation (MCPServer, decorators)
├── server_lowlevel.py   # Low-level implementation (Server, manual schemas)
├── venv/
└── README.md
```

## Running locally

The default transport is **stdio** — no port, no URL. A host (Claude
Code, Claude Desktop, the Inspector) launches the script and talks to
it over its stdin/stdout:

```bash
python3 server.py
```

It will print nothing and appear to hang — that's correct. It's
waiting for a host to connect.

## Testing with the MCP Inspector

```bash
mcp dev server.py
```

Opens a browser UI with three tabs — **Tools**, **Resources**, and
**Prompts** — so you can call each primitive by hand before wiring it
into a real host.

## Connecting to Claude Code

Register it with the CLI:

```bash
claude mcp add my-custom-server -- python3 /absolute/path/to/server.py
```

...or add it directly to `.mcp.json`:

```json
{
  "mcpServers": {
    "my-custom-server": {
      "type": "stdio",
      "command": "python3",
      "args": ["/absolute/path/to/server.py"]
    }
  }
}
```

Then inside a Claude Code session, run:

```
/mcp
```

You should see `my-custom-server` listed as connected, with
`fetch_user_data`, `archive://logs/today`, and `summarize` all
available.

> **Always use an absolute path.** Claude Code may launch the process
> from a different working directory than you expect.
>
> **Point at the interpreter that actually has `mcp` installed.**
> Claude Code does not inherit your activated shell — if you installed
> `mcp` inside `venv/`, use `venv/bin/python3` as the `command` instead
> of a bare `python3`.

## Hosting remotely (Streamable HTTP)

To serve this over the network instead of spawning it locally, change
the last line of `server.py`:

```python
if __name__ == "__main__":
    mcp.run(transport="streamable-http", port=3001)
```

Clients then connect to `http://127.0.0.1:3001/mcp` instead of a host
launching a subprocess. (The older `sse` transport is deprecated —
use `streamable-http` for anything new.)

## Low-level variant

`server_lowlevel.py` implements the same `fetch_user_data` tool using
the raw `Server` class instead of `MCPServer` — a hand-written JSON
Schema and a manually built result, with no decorators. Use this style
only when you need an exact schema the SDK can't derive from type
hints, or full control over the result object (`_meta`, error
handling, etc.). Run it the same way:

```bash
python3 server_lowlevel.py
```

(It won't appear in `mcp dev` — the Inspector only launches
`MCPServer` instances. Test it with Claude Code directly, or with the
SDK's in-memory `Client`.)

## Troubleshooting

- **Server doesn't appear in `/mcp`** — run the exact launch command
  by hand first (`python3 /absolute/path/to/server.py`). A traceback
  tells you the real problem immediately.
- **`ModuleNotFoundError: mcp`** — the interpreter Claude Code is
  using doesn't have the package installed. Point `command` at your
  venv's Python directly.
- **Never `print()` in a stdio server.** stdout *is* the protocol
  channel; any stray print corrupts it. Use the `logging` module
  (stderr by default) for debug output instead.
python3 -m venv venv
source venv/bin/activate      # Windows: .\venv\Scripts\activate
pip install "mcp[cli]"
```

## Project structure

```
custom-mcp-servers/
├── server.py            # High-level implementation (MCPServer, decorators)
├── server_lowlevel.py   # Low-level implementation (Server, manual schemas)
├── venv/
└── README.md
```

## Running locally

The default transport is **stdio** — no port, no URL. A host (Claude
Code, Claude Desktop, the Inspector) launches the script and talks to
it over its stdin/stdout:

```bash
python3 server.py
```

It will print nothing and appear to hang — that's correct. It's
waiting for a host to connect.

## Testing with the MCP Inspector

```bash
mcp dev server.py
```

Opens a browser UI with three tabs — **Tools**, **Resources**, and
**Prompts** — so you can call each primitive by hand before wiring it
into a real host.

## Connecting to Claude Code

Register it with the CLI:

```bash
claude mcp add my-custom-server -- python3 /absolute/path/to/server.py
```

...or add it directly to `.mcp.json`:

```json
{
  "mcpServers": {
    "my-custom-server": {
      "type": "stdio",
      "command": "python3",
      "args": ["/absolute/path/to/server.py"]
    }
  }
}
```

Then inside a Claude Code session, run:

```
/mcp
```

You should see `my-custom-server` listed as connected, with
`fetch_user_data`, `archive://logs/today`, and `summarize` all
available.

> **Always use an absolute path.** Claude Code may launch the process
> from a different working directory than you expect.
>
> **Point at the interpreter that actually has `mcp` installed.**
> Claude Code does not inherit your activated shell — if you installed
> `mcp` inside `venv/`, use `venv/bin/python3` as the `command` instead
> of a bare `python3`.

## Hosting remotely (Streamable HTTP)

To serve this over the network instead of spawning it locally, change
the last line of `server.py`:

```python
if __name__ == "__main__":
    mcp.run(transport="streamable-http", port=3001)
```

Clients then connect to `http://127.0.0.1:3001/mcp` instead of a host
launching a subprocess. (The older `sse` transport is deprecated —
use `streamable-http` for anything new.)

## Low-level variant

`server_lowlevel.py` implements the same `fetch_user_data` tool using
the raw `Server` class instead of `MCPServer` — a hand-written JSON
Schema and a manually built result, with no decorators. Use this style
only when you need an exact schema the SDK can't derive from type
hints, or full control over the result object (`_meta`, error
handling, etc.). Run it the same way:

```bash
python3 server_lowlevel.py
```

(It won't appear in `mcp dev` — the Inspector only launches
`MCPServer` instances. Test it with Claude Code directly, or with the
SDK's in-memory `Client`.)

## Troubleshooting

- **Server doesn't appear in `/mcp`** — run the exact launch command
  by hand first (`python3 /absolute/path/to/server.py`). A traceback
  tells you the real problem immediately.
- **`ModuleNotFoundError: mcp`** — the interpreter Claude Code is
  using doesn't have the package installed. Point `command` at your
  venv's Python directly.
- **Never `print()` in a stdio server.** stdout *is* the protocol
  channel; any stray print corrupts it. Use the `logging` module
  (stderr by default) for debug output instead.