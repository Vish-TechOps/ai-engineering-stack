import asyncio

from mcp.server import Server, ServerRequestContext
from mcp.server.stdio import stdio_server
from mcp.types import (
    CallToolRequestParams,
    CallToolResult,
    ListToolsResult,
    PaginatedRequestParams,
    TextContent,
    Tool,
)

FETCH_USER_DATA = Tool(
    name="fetch_user_data",
    description="Fetch details for a specific user ID.",
    input_schema={
        "type": "object",
        "properties": {"user_id": {"type": "integer"}},
        "required": ["user_id"],
    },
)

async def list_tools(ctx: ServerRequestContext, params: PaginatedRequestParams | None) -> ListToolsResult:
    return ListToolsResult(tools=[FETCH_USER_DATA])

async def call_tool(ctx: ServerRequestContext, params: CallToolRequestParams) -> CallToolResult:
    user_id = params.arguments["user_id"]
    text = f"User data payload for ID: {user_id}"
    return CallToolResult(content=[TextContent(type="text", text=text)])

server = Server("advanced-mcp-server", on_list_tools=list_tools, on_call_tool=call_tool)

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )

if __name__ == "__main__":
    asyncio.run(main())


