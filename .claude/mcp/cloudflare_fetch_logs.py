#!/usr/bin/env python3
"""
Simple Cloudflare Pages deployment logs fetcher
Usage: python3 cloudflare_fetch_logs.py <project_name> <deployment_id> [format]
"""

import os
import sys
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"
CLOUDFLARE_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")


def make_request(endpoint: str) -> Optional[Dict[str, Any]]:
    """Make a request to Cloudflare API"""
    url = f"{CLOUDFLARE_API_BASE}{endpoint}"

    headers = {
        "Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())
            return data
    except urllib.error.HTTPError as e:
        try:
            error_data = json.loads(e.read().decode())
            print(f"API Error ({e.code}): {error_data.get('errors', [{}])[0].get('message', 'Unknown')}")
        except:
            print(f"HTTP Error {e.code}: {e.reason}")
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None


def validate_config():
    """Validate configuration"""
    if not CLOUDFLARE_API_TOKEN:
        print("ERROR: CLOUDFLARE_API_TOKEN not set")
        return False
    if not CLOUDFLARE_ACCOUNT_ID:
        print("ERROR: CLOUDFLARE_ACCOUNT_ID not set")
        return False
    return True


def list_deployments(project_name: str, limit: int = 10):
    """List recent deployments for a project"""
    endpoint = f"/accounts/{CLOUDFLARE_ACCOUNT_ID}/pages/projects/{project_name}/deployments"

    result = make_request(endpoint)
    if not result or not result.get("success"):
        return None

    deployments = result.get("result", [])
    if not isinstance(deployments, list):
        deployments = [deployments]

    print(f"\n📦 Recent Deployments for '{project_name}':\n")
    for i, d in enumerate(deployments[:limit], 1):
        dep_id = d.get("id", "")
        status = d.get("status", "unknown")
        created = d.get("created_on", "")
        env = d.get("environment", "production")

        status_emoji = "✅" if status == "success" else "❌" if status == "failure" else "⏳"
        print(f"{i}. [{status_emoji}] ID: {dep_id}")
        print(f"   Status: {status} | Env: {env} | Created: {created}")
        print(f"   Copy ID above and run: python3 cloudflare_fetch_logs.py {project_name} <ID> detailed\n")

    return deployments


def get_deployment_logs(project_name: str, deployment_id: str, format_type: str = "concise"):
    """Fetch deployment logs"""
    endpoint = f"/accounts/{CLOUDFLARE_ACCOUNT_ID}/pages/projects/{project_name}/deployments/{deployment_id}/history/logs"

    result = make_request(endpoint)
    if not result or not result.get("success"):
        return None

    logs = result.get("result", {}).get("logs", [])

    if not logs:
        print(f"⚠️  No logs found for deployment {deployment_id}")
        return None

    print(f"\n📋 Deployment Logs for {deployment_id}:\n")
    print("=" * 80)

    # Format logs
    formatted_logs = []
    for log in logs:
        timestamp = log.get("timestamp", "")
        level = log.get("level", "info").upper()
        message = log.get("message", "")
        formatted_logs.append(f"[{timestamp}] {level}: {message}")

    if format_type == "detailed":
        # Show all logs
        for log_line in formatted_logs:
            print(log_line)
    else:
        # Show concise: errors, warnings, and last few lines
        errors = [l for l in formatted_logs if "ERROR" in l]
        warnings = [l for l in formatted_logs if "WARNING" in l]

        if errors:
            print("\n🔴 ERRORS:")
            for err in errors[:5]:
                print(f"  {err}")

        if warnings:
            print("\n🟡 WARNINGS:")
            for warn in warnings[:5]:
                print(f"  {warn}")

        print("\n📝 LAST 10 LOG LINES:")
        for log_line in formatted_logs[-10:]:
            print(f"  {log_line}")

    print("\n" + "=" * 80)
    print(f"\nTotal log lines: {len(formatted_logs)}")

    return logs


def main():
    if not validate_config():
        sys.exit(1)

    if len(sys.argv) < 2:
        print("Usage: python3 cloudflare_fetch_logs.py <project_name> [deployment_id] [format]")
        print("\nOptions:")
        print("  project_name    - Name of the Pages project")
        print("  deployment_id   - (optional) Specific deployment ID. If not provided, lists recent deployments")
        print("  format          - (optional) 'concise' (default) or 'detailed'")
        print("\nExample:")
        print("  # List recent deployments")
        print("  python3 cloudflare_fetch_logs.py audio-analyzer")
        print("\n  # Get logs for a deployment")
        print("  python3 cloudflare_fetch_logs.py audio-analyzer abc123def456 detailed")
        sys.exit(1)

    project_name = sys.argv[1]
    deployment_id = sys.argv[2] if len(sys.argv) > 2 else None
    format_type = sys.argv[3] if len(sys.argv) > 3 else "concise"

    if not deployment_id:
        # List deployments
        list_deployments(project_name, limit=5)
    else:
        # Get logs for specific deployment
        get_deployment_logs(project_name, deployment_id, format_type)


if __name__ == "__main__":
    main()
