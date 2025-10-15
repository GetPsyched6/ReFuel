"""
MCP Server - Model Context Protocol server for ReFuel data
Exposes fuel surcharge data as tools for AI agents
"""
import asyncio
import json
from typing import Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.database import db
from services.comparison_service import comparison_service


# Initialize MCP server
mcp = Server("refuel-mcp")


@mcp.list_tools()
async def list_tools() -> list[Tool]:
    """List available MCP tools"""
    return [
        Tool(
            name="get_current_rates",
            description="Get the latest fuel surcharge rates for all carriers or specific carrier",
            inputSchema={
                "type": "object",
                "properties": {
                    "carrier": {
                        "type": "string",
                        "description": "Optional carrier name: UPS, FedEx, or DHL. If not provided, returns all carriers.",
                        "enum": ["UPS", "FedEx", "DHL"]
                    }
                }
            }
        ),
        Tool(
            name="get_historical_rates",
            description="Get historical fuel surcharge rates for a date range",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in ISO format (YYYY-MM-DD)"
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in ISO format (YYYY-MM-DD)"
                    },
                    "carrier": {
                        "type": "string",
                        "description": "Optional carrier filter",
                        "enum": ["UPS", "FedEx", "DHL"]
                    }
                },
                "required": ["start_date", "end_date"]
            }
        ),
        Tool(
            name="compare_carriers",
            description="Compare fuel surcharge rates across carriers for a specific price range",
            inputSchema={
                "type": "object",
                "properties": {
                    "min_price": {
                        "type": "number",
                        "description": "Minimum price in USD"
                    },
                    "max_price": {
                        "type": "number",
                        "description": "Maximum price in USD"
                    },
                    "view_type": {
                        "type": "string",
                        "description": "Comparison view type",
                        "enum": ["normalized", "overlap", "complete"],
                        "default": "normalized"
                    }
                },
                "required": ["min_price", "max_price"]
            }
        ),
        Tool(
            name="get_trends",
            description="Get fuel surcharge rate trends over time",
            inputSchema={
                "type": "object",
                "properties": {
                    "days": {
                        "type": "number",
                        "description": "Number of days to look back (default 30)",
                        "default": 30
                    },
                    "carrier": {
                        "type": "string",
                        "description": "Optional carrier filter",
                        "enum": ["UPS", "FedEx", "DHL"]
                    }
                }
            }
        ),
        Tool(
            name="get_insights",
            description="Get AI-generated insights about fuel surcharge data",
            inputSchema={
                "type": "object",
                "properties": {
                    "session_id": {
                        "type": "number",
                        "description": "Optional session ID (defaults to latest)"
                    }
                }
            }
        )
    ]


@mcp.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """Handle tool calls"""
    
    if name == "get_current_rates":
        return await _get_current_rates(arguments.get("carrier"))
    
    elif name == "get_historical_rates":
        return await _get_historical_rates(
            arguments["start_date"],
            arguments["end_date"],
            arguments.get("carrier")
        )
    
    elif name == "compare_carriers":
        return await _compare_carriers(
            arguments["min_price"],
            arguments["max_price"],
            arguments.get("view_type", "normalized")
        )
    
    elif name == "get_trends":
        return await _get_trends(
            arguments.get("days", 30),
            arguments.get("carrier")
        )
    
    elif name == "get_insights":
        return await _get_insights(arguments.get("session_id"))
    
    else:
        return [TextContent(
            type="text",
            text=json.dumps({"error": f"Unknown tool: {name}"})
        )]


async def _get_current_rates(carrier: str = None) -> list[TextContent]:
    """Get latest fuel surcharge rates"""
    # Get latest session
    sessions = await db.execute_query(
        "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
    )
    
    if not sessions:
        return [TextContent(
            type="text",
            text=json.dumps({"error": "No data available"})
        )]
    
    session_id = sessions[0]['id']
    
    # Build query
    query = "SELECT * FROM fuel_surcharges WHERE session_id = ?"
    params = [session_id]
    
    if carrier:
        query += " AND carrier = ?"
        params.append(carrier)
    
    query += " ORDER BY carrier, at_least_usd"
    
    data = await db.execute_query(query, tuple(params))
    
    return [TextContent(
        type="text",
        text=json.dumps({
            "session_id": session_id,
            "carrier": carrier or "all",
            "rates": data
        }, indent=2)
    )]


async def _get_historical_rates(start_date: str, end_date: str, carrier: str = None) -> list[TextContent]:
    """Get historical rates"""
    query = """
        SELECT 
            fs.*,
            ss.timestamp as session_timestamp
        FROM fuel_surcharges fs
        JOIN scrape_sessions ss ON fs.session_id = ss.id
        WHERE ss.timestamp BETWEEN ? AND ?
    """
    params = [start_date, end_date]
    
    if carrier:
        query += " AND fs.carrier = ?"
        params.append(carrier)
    
    query += " ORDER BY ss.timestamp DESC, fs.carrier, fs.at_least_usd"
    
    data = await db.execute_query(query, tuple(params))
    
    return [TextContent(
        type="text",
        text=json.dumps({
            "period": f"{start_date} to {end_date}",
            "carrier": carrier or "all",
            "historical_rates": data
        }, indent=2)
    )]


async def _compare_carriers(min_price: float, max_price: float, view_type: str) -> list[TextContent]:
    """Compare carriers"""
    from backend.models.schemas import ComparisonView
    
    view_enum = ComparisonView(view_type)
    comparison = await comparison_service.get_comparison(view_type=view_enum)
    
    # Filter to price range
    filtered_rows = [
        row for row in comparison['rows']
        if row['at_least_usd'] >= min_price and row['but_less_than_usd'] <= max_price
    ]
    
    return [TextContent(
        type="text",
        text=json.dumps({
            "price_range": f"${min_price:.2f}-${max_price:.2f}",
            "view_type": view_type,
            "comparison": filtered_rows
        }, indent=2)
    )]


async def _get_trends(days: int, carrier: str = None) -> list[TextContent]:
    """Get trends"""
    from datetime import datetime, timedelta
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    query = """
        SELECT 
            fs.carrier,
            DATE(ss.timestamp) as date,
            AVG(fs.surcharge_pct) as avg_surcharge,
            COUNT(*) as data_points
        FROM fuel_surcharges fs
        JOIN scrape_sessions ss ON fs.session_id = ss.id
        WHERE ss.timestamp >= ?
    """
    params = [start_date.isoformat()]
    
    if carrier:
        query += " AND fs.carrier = ?"
        params.append(carrier)
    
    query += " GROUP BY fs.carrier, DATE(ss.timestamp) ORDER BY date DESC"
    
    trends = await db.execute_query(query, tuple(params))
    
    return [TextContent(
        type="text",
        text=json.dumps({
            "period_days": days,
            "carrier": carrier or "all",
            "trends": trends
        }, indent=2)
    )]


async def _get_insights(session_id: int = None) -> list[TextContent]:
    """Get AI insights"""
    # Get latest session if not specified
    if session_id is None:
        sessions = await db.execute_query(
            "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
        )
        if sessions:
            session_id = sessions[0]['id']
    
    # Get insights
    insights = await db.execute_query(
        "SELECT * FROM ai_insights WHERE session_id = ?",
        (session_id,)
    )
    
    if not insights:
        return [TextContent(
            type="text",
            text=json.dumps({
                "message": "No insights available for this session",
                "session_id": session_id
            })
        )]
    
    result = []
    for insight in insights:
        result.append({
            "id": insight['id'],
            "type": insight['insight_type'],
            "content": json.loads(insight['content']),
            "generated_at": insight['generated_at']
        })
    
    return [TextContent(
        type="text",
        text=json.dumps({
            "session_id": session_id,
            "insights": result
        }, indent=2)
    )]


async def main():
    """Run MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await mcp.run(
            read_stream,
            write_stream,
            mcp.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())

