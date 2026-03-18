#!/usr/bin/env python3
"""
SRP Phase 1 - Security Reasoning Protocol
CLI entry point for Phase 1 functionality
"""

import argparse
from parser.parser import parse_project
from srg.graph import build_srg
from mcp.server import start_mcp_server

def audit_project(project_path):
    """Main audit function for SRP Phase 1"""
    print(f"=== SRP Phase 1 Audit ===")
    print(f"Parsing project: {project_path}")

    # Parse the project
    project_data = parse_project(project_path)
    print(f"✓ Parsed {len(project_data['contracts'])} contracts")

    # Build SRG
    srg = build_srg(project_data)
    print(f"✓ Built Security Reasoning Graph with {len(srg.nodes)} nodes")

    # Start MCP server
    print("\nStarting MCP server...")
    start_mcp_server()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='SRP Phase 1 Security Audit')
    parser.add_argument('project_path', help='Path to smart contract project')
    args = parser.parse_args()

    audit_project(args.project_path)