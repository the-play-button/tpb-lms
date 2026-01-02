#!/usr/bin/env python3
"""
TPB Vault Client

Usage:
    from vault_client import VaultClient
    
    client = VaultClient.from_env()
    secrets = client.get_secrets("conn_infra")
    openai_key = secrets["OPENAI_API_KEY"]

Connections:
    - conn_infra: CLOUDFLARE_*, OPENAI_*, MODAL_*
    - conn_integrations: UNIFIEDTO_*, TALLY_*
    - conn_user_<email_slug>: USER_TRIGRAM, MHO_CALENDAR_EMAIL
"""

import os
import httpx
from pathlib import Path
from typing import Dict, Optional, Any, List


def slugify_email(email: str) -> str:
    """Convert email to connection ID slug."""
    return email.replace("@", "_at_").replace(".", "_")


def get_user_connection_id(email: str) -> str:
    """Get connection ID for a user email."""
    return f"conn_user_{slugify_email(email)}"


class VaultClient:
    """Client for TPB Vault API."""
    
    DEFAULT_URL = "https://tpb-vault-infra.matthieu-marielouise.workers.dev"
    ENV_FILE = Path(__file__).parent / "lms/core/vault-api/.env"
    
    def __init__(self, client_id: str, client_secret: str, base_url: str = None):
        self.base_url = (base_url or self.DEFAULT_URL).rstrip("/")
        self.headers = {
            "CF-Access-Client-Id": client_id,
            "CF-Access-Client-Secret": client_secret,
        }
    
    @classmethod
    def from_env(cls, env_path: str = None) -> "VaultClient":
        """Create client from .env file or environment.
        
        Accepts two naming conventions for env vars:
        - VAULT_CLIENT_ID / VAULT_CLIENT_SECRET (preferred, semantic)
        - CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID / _SECRET (legacy)
        """
        # Try both naming conventions (VAULT_* preferred)
        client_id = os.getenv("VAULT_CLIENT_ID") or os.getenv("CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID")
        client_secret = os.getenv("VAULT_CLIENT_SECRET") or os.getenv("CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_SECRET")
        
        if not client_id or not client_secret:
            env_file = Path(env_path) if env_path else cls.ENV_FILE
            if env_file.exists():
                with open(env_file) as f:
                    for line in f:
                        line = line.strip()
                        if "=" in line and not line.startswith("#"):
                            key, value = line.split("=", 1)
                            key = key.strip()
                            value = value.strip().strip('"').strip("'")
                            # Accept both naming conventions
                            if key in ("VAULT_CLIENT_ID", "CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_ID"):
                                client_id = client_id or value
                            elif key in ("VAULT_CLIENT_SECRET", "CLOUDFLARE_SERVICE_ACCOUNT_ACCESS_CLIENT_SECRET"):
                                client_secret = client_secret or value
        
        if not client_id or not client_secret:
            raise ValueError(
                f"Missing vault credentials. Set VAULT_CLIENT_ID/VAULT_CLIENT_SECRET env vars or check {cls.ENV_FILE}"
            )
        
        return cls(client_id, client_secret)
    
    def health(self) -> Dict[str, Any]:
        """Health check (public)."""
        resp = httpx.get(f"{self.base_url}/health", timeout=10)
        resp.raise_for_status()
        return resp.json()
    
    def list_connections(self) -> List[Dict[str, Any]]:
        """List all connections."""
        resp = httpx.get(
            f"{self.base_url}/vault/connections",
            headers=self.headers,
            timeout=10
        )
        resp.raise_for_status()
        return resp.json().get("connections", [])
    
    def get_connection(self, connection_id: str) -> Dict[str, Any]:
        """Get connection with secrets."""
        resp = httpx.get(
            f"{self.base_url}/vault/connections/{connection_id}",
            headers=self.headers,
            timeout=10
        )
        resp.raise_for_status()
        return resp.json().get("connection", {})
    
    def get_secrets_raw(self, connection_id: str) -> Dict[str, Dict[str, Any]]:
        """Get all secrets with full metadata (value, type, description)."""
        conn = self.get_connection(connection_id)
        return conn.get("auth", {}).get("secrets", {})
    
    def get_secrets(self, connection_id: str) -> Dict[str, str]:
        """Get all secret values for a connection (backwards compatible)."""
        raw = self.get_secrets_raw(connection_id)
        return {name: data["value"] for name, data in raw.items()}
    
    def get_secret(self, connection_id: str, secret_name: str) -> Optional[str]:
        """Get a single secret value."""
        raw = self.get_secrets_raw(connection_id)
        secret = raw.get(secret_name)
        return secret["value"] if secret else None
    
    def get_secret_with_metadata(self, connection_id: str, secret_name: str) -> Optional[Dict[str, Any]]:
        """Get a secret with full metadata (value, type, description)."""
        raw = self.get_secrets_raw(connection_id)
        return raw.get(secret_name)
    
    def list_secret_refs(self, connection_id: str) -> List[Dict[str, Any]]:
        """List secret refs (metadata only)."""
        resp = httpx.get(
            f"{self.base_url}/vault/connections/{connection_id}/secrets",
            headers=self.headers,
            timeout=10
        )
        resp.raise_for_status()
        return resp.json().get("secrets", [])


# Singleton
_client: Optional[VaultClient] = None

def get_client() -> VaultClient:
    global _client
    if _client is None:
        _client = VaultClient.from_env()
    return _client

def get_secret(connection_id: str, secret_name: str) -> Optional[str]:
    """Convenience: get a secret value."""
    return get_client().get_secret(connection_id, secret_name)

def get_secrets(connection_id: str) -> Dict[str, str]:
    """Convenience: get all secrets for a connection."""
    return get_client().get_secrets(connection_id)


if __name__ == "__main__":
    import sys
    
    client = VaultClient.from_env()
    print(f"TPB Vault Client")
    print(f"URL: {client.base_url}\n")
    
    # Health
    health = client.health()
    print(f"Status: {health['status']}")
    print(f"Connections: {health['stats']['connections']}")
    print(f"Secrets: {health['stats']['secrets']}\n")
    
    # List connections
    connections = client.list_connections()
    for conn in connections:
        print(f"- {conn['id']}: {conn['integration_name']} ({conn['secret_count']} secrets)")
    
    # Get specific connection if arg provided
    if len(sys.argv) > 1:
        conn_id = sys.argv[1]
        print(f"\n--- {conn_id} ---")
        secrets = client.get_secrets_raw(conn_id)
        for name, data in secrets.items():
            value = data.get("value", "")
            desc = data.get("description", "")
            masked = value[:4] + "..." + value[-4:] if len(value) > 8 else "****"
            desc_str = f" ({desc})" if desc else ""
            print(f"  {name}: {masked}{desc_str}")

