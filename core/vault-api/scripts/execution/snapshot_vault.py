#!/usr/bin/env python3
"""
snapshot_vault.py - Export YAML snapshot of accessible TPB Vault secrets

Exports secrets from the vault with their metadata in YAML format.
Respects IAM access control - only exports secrets the current user can access.

Access Rules:
- Infra/integrations: Based on IAM permissions (read:secret)
- User secrets: Only owner + superadmin can access
- Service tokens: Read-only access to consented user secrets

Usage:
    python scripts/execution/snapshot_vault.py                    # Accessible secrets to stdout
    python scripts/execution/snapshot_vault.py --output vault.yaml # Save to file
    python scripts/execution/snapshot_vault.py --mask             # Mask secret values
    python scripts/execution/snapshot_vault.py --type infra       # Filter by type
"""

import argparse
import json
import sys
import yaml
from datetime import datetime
from pathlib import Path

# Add vault_client to path
VAULT_API_ROOT = Path(__file__).parent.parent.parent
LMS_ROOT = VAULT_API_ROOT.parent.parent
EXECUTION_ROOT = LMS_ROOT.parent
sys.path.insert(0, str(EXECUTION_ROOT))

from vault_client import VaultClient

def mask_secret_value(value: str) -> str:
    """Mask secret value showing only first 4 and last 4 chars."""
    if not value or len(value) <= 8:
        return "***"
    return f"{value[:4]}...{value[-4:]}"

def get_connections(client: VaultClient, connection_type: str = None) -> list:
    """Get all accessible connections, optionally filtered by type."""
    # Note: list_connections now respects access control automatically
    # Only returns connections the current user can access
    connections = client.list_connections()
    
    if connection_type:
        connections = [c for c in connections if c.get("integration_type") == connection_type]
    
    return connections

def get_connection_secrets(client: VaultClient, connection_id: str) -> dict:
    """Get all secrets for a connection with their values."""
    try:
        # Get secrets with full metadata
        secrets_raw = client.get_secrets_raw(connection_id)
        
        secrets = {}
        for name, secret_data in secrets_raw.items():
            secrets[name] = {
                "value": secret_data.get("value", ""),
                "type": secret_data.get("type", "api_key"),
                "description": secret_data.get("description", "")
            }
        
        return secrets
    except Exception as e:
        print(f"Warning: Could not retrieve secrets for {connection_id}: {e}", file=sys.stderr)
        return {}

def create_snapshot(client: VaultClient, mask_values: bool = False, connection_type: str = None) -> dict:
    """Create a complete vault snapshot."""
    connections = get_connections(client, connection_type)
    
    snapshot_data = {
        "snapshot": {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "vault": "tpb-vault-infra",
            "connection_count": len(connections),
            "secret_count": 0
        },
        "connections": {}
    }
    
    total_secrets = 0
    
    for conn in connections:
        conn_id = conn["id"]
        conn_data = {
            "integration_type": conn["integration_type"],
            "integration_name": conn.get("integration_name", ""),
            "categories": json.loads(conn.get("categories_json", "[]")),
            "secrets": {}
        }
        
        # Get secrets for this connection
        secrets = get_connection_secrets(client, conn_id)
        
        for name, secret_info in secrets.items():
            value = secret_info["value"]
            if mask_values:
                value = mask_secret_value(value)
            
            conn_data["secrets"][name] = {
                "value": value,
                "type": secret_info["type"],
                "description": secret_info["description"]
            }
        
        total_secrets += len(secrets)
        snapshot_data["connections"][conn_id] = conn_data
    
    snapshot_data["snapshot"]["secret_count"] = total_secrets
    return snapshot_data

def main():
    parser = argparse.ArgumentParser(description="Export TPB Vault snapshot")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    parser.add_argument("--mask", action="store_true", help="Mask secret values")
    parser.add_argument("--type", choices=["infra", "integrations", "user_settings"], 
                       help="Filter by integration type")
    args = parser.parse_args()
    
    # Get vault client
    try:
        client = VaultClient.from_devcontainer()
    except Exception as e:
        print(f"Error: Could not create vault client: {e}", file=sys.stderr)
        print("Set VAULT_CLIENT_ID and VAULT_CLIENT_SECRET in .devcontainer/.env", file=sys.stderr)
        sys.exit(1)
    
    # Create snapshot
    try:
        snapshot = create_snapshot(client, mask_values=args.mask, connection_type=args.type)
    except Exception as e:
        print(f"Error creating snapshot: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Output YAML
    yaml_output = yaml.dump(snapshot, default_flow_style=False, sort_keys=False, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(yaml_output)
        print(f"Snapshot saved to {args.output}", file=sys.stderr)
    else:
        print(yaml_output)

if __name__ == "__main__":
    main()