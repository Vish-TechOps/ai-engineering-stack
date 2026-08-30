from mcp.server import MCPServer

mcp = MCPServer("My Custom Server")

@mcp.tool()
def fetch_user_data(user_id: int) -> str:
    """Fetch details for a specific user ID."""
    return f"User data payload for ID: {user_id}"

@mcp.resource("archive://logs/today")
def get_today_logs() -> str:
    """Provide real-time system logs to the AI context."""
    return "[INFO] System operating within normal parameters."

@mcp.prompt()
def summarize(text: str) -> str:
    """Summarize a piece of text in one sentence."""
    return f"Summarize the following text in one sentence:\n\n{text}"

if __name__ == "__main__":
    mcp.run()

