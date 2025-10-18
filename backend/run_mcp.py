#!/usr/bin/env python3
"""
ReFuel MCP Server Runner
Start the Model Context Protocol server
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from backend.mcp.server import main

if __name__ == "__main__":
    print("Starting ReFuel MCP Server")
    print("Mode: stdio (for agent integration)")
    asyncio.run(main())

