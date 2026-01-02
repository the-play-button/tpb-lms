#!/usr/bin/env python3
"""
Cloudflare Access JWT Decoder

Decodes a Cloudflare Access JWT token to extract user information.
Does NOT verify signature (for local debugging/testing only).

Usage:
    python cloudflare_access_jwt_decode.py <JWT_TOKEN>
    
Output:
    - user_id (sub claim)
    - email
    - issued_at / expires_at
"""

import sys
import json
import base64
from datetime import datetime


def decode_jwt_payload(token: str) -> dict:
    """
    Decode JWT payload without signature verification.
    For debugging/testing purposes only.
    """
    try:
        # JWT format: header.payload.signature
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT format: expected 3 parts separated by '.'")
        
        # Decode payload (second part)
        payload_b64 = parts[1]
        
        # Add padding if needed (base64url requires padding)
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        
        # Decode base64url (replace URL-safe chars)
        payload_json = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_json)
    
    except Exception as e:
        raise ValueError(f"Failed to decode JWT: {e}")


def format_timestamp(ts: int) -> str:
    """Convert Unix timestamp to human-readable format."""
    return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")


def main():
    if len(sys.argv) < 2:
        print("Usage: python cloudflare_access_jwt_decode.py <JWT_TOKEN>")
        print("\nReads a Cloudflare Access JWT and extracts user info.")
        sys.exit(1)
    
    token = sys.argv[1]
    
    try:
        payload = decode_jwt_payload(token)
        
        # Extract key fields
        user_id = payload.get("sub", "N/A")
        email = payload.get("email", "N/A")
        iat = payload.get("iat")
        exp = payload.get("exp")
        issuer = payload.get("iss", "N/A")
        
        print("\n" + "=" * 50)
        print("  CLOUDFLARE ACCESS JWT DECODED")
        print("=" * 50)
        print(f"\n  user_id (sub):  {user_id}")
        print(f"  email:          {email}")
        print(f"  issuer:         {issuer}")
        if iat:
            print(f"  issued_at:      {format_timestamp(iat)}")
        if exp:
            print(f"  expires_at:     {format_timestamp(exp)}")
        print("\n" + "=" * 50)
        
        # Output just user_id for piping
        print(f"\n→ Use this user_id: {user_id}\n")
        
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

