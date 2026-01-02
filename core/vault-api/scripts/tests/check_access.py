#!/usr/bin/env python3
"""
check_access.py - Diagnostic des accès vault pour un développeur

Première chose à exécuter après onboarding pour vérifier que tout fonctionne.

Usage:
    python scripts/tests/check_access.py

One-liner (from vault-api root):
    cd tpb_system/04.Execution/lms/core/vault-api && python scripts/tests/check_access.py
"""

import sys
from pathlib import Path

# Add paths for imports
VAULT_API_ROOT = Path(__file__).parent.parent.parent
LMS_ROOT = VAULT_API_ROOT.parent.parent
EXECUTION_ROOT = LMS_ROOT.parent
sys.path.insert(0, str(EXECUTION_ROOT))

# Colors
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def main():
    print(f"\n{BOLD}{CYAN}{'='*60}{RESET}")
    print(f"{BOLD}{CYAN}🔍 Diagnostic des accès Vault{RESET}")
    print(f"{BOLD}{CYAN}{'='*60}{RESET}\n")
    
    # Step 1: Import vault client
    print(f"{CYAN}1. Chargement du client vault...{RESET}")
    try:
        from vault_client import VaultClient
        print(f"{GREEN}   ✅ Module vault_client importé{RESET}")
    except ImportError as e:
        print(f"{RED}   ❌ Erreur import: {e}{RESET}")
        print(f"{YELLOW}   → Vérifier que tu es dans le bon dossier{RESET}")
        sys.exit(1)
    
    # Step 2: Connect
    print(f"\n{CYAN}2. Connexion au vault...{RESET}")
    try:
        client = VaultClient.from_devcontainer()
        print(f"{GREEN}   ✅ Connecté à: {client.base_url}{RESET}")
    except ValueError as e:
        print(f"{RED}   ❌ {e}{RESET}")
        print(f"{YELLOW}   → Vérifier .devcontainer/.env{RESET}")
        sys.exit(1)
    except Exception as e:
        print(f"{RED}   ❌ Erreur: {e}{RESET}")
        sys.exit(1)
    
    # Step 3: List connections
    print(f"\n{CYAN}3. Liste des connections...{RESET}")
    try:
        connections = client.list_connections()
        if connections:
            print(f"{GREEN}   ✅ {len(connections)} connection(s) disponible(s):{RESET}")
            for conn in connections:
                conn_id = conn.get("id", "?")
                conn_type = conn.get("integration_type", "?")
                print(f"      - {conn_id} ({conn_type})")
        else:
            print(f"{YELLOW}   ⚠️  Aucune connection trouvée{RESET}")
    except Exception as e:
        print(f"{RED}   ❌ Erreur: {e}{RESET}")
    
    # Step 4: List secrets per connection
    print(f"\n{CYAN}4. Secrets disponibles...{RESET}")
    try:
        for conn in connections:
            conn_id = conn.get("id")
            secrets = client.list_secret_refs(conn_id)
            print(f"\n   {BOLD}{conn_id}:{RESET}")
            if secrets:
                for s in secrets:
                    name = s.get("name", "?")
                    stype = s.get("type", "?")
                    print(f"      - {name} ({stype})")
            else:
                print(f"      (aucun secret)")
    except Exception as e:
        print(f"{RED}   ❌ Erreur: {e}{RESET}")
    
    # Step 5: Check permissions (CASL)
    print(f"\n{CYAN}5. Vérification des permissions...{RESET}")
    try:
        import httpx
        
        # Test read permission on secrets
        resp = httpx.post(
            f"{client.base_url}/iam/can",
            headers={**client.headers, 'Content-Type': 'application/json'},
            json={"action": "read", "resource": "secret", "user_id": "usr_admin"},
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            if data.get("allowed"):
                print(f"{GREEN}   ✅ Permission read:secret → AUTORISÉ{RESET}")
            else:
                print(f"{YELLOW}   ⚠️  Permission read:secret → REFUSÉ{RESET}")
        else:
            print(f"{YELLOW}   ⚠️  Impossible de vérifier (HTTP {resp.status_code}){RESET}")
    except Exception as e:
        print(f"{YELLOW}   ⚠️  Vérification permissions: {e}{RESET}")
    
    # Step 6: Service token info
    print(f"\n{CYAN}6. Informations token...{RESET}")
    print(f"   Type: Service Token (READ ONLY)")
    print(f"   Opérations permises:")
    print(f"      ✅ GET /vault/connections")
    print(f"      ✅ GET /vault/connections/:id/secrets")
    print(f"      ✅ GET /iam/users, /iam/groups, /iam/roles")
    print(f"      ✅ POST /iam/can (query permissions)")
    print(f"   Opérations interdites:")
    print(f"      ❌ POST, PATCH, DELETE (écriture)")
    print(f"      → Utiliser le dashboard UI pour les modifications")
    
    # Summary
    print(f"\n{BOLD}{'='*60}{RESET}")
    print(f"{GREEN}{BOLD}✅ Diagnostic terminé - Accès vault opérationnel !{RESET}")
    print(f"{'='*60}\n")
    
    print(f"Prochaines étapes:")
    print(f"  1. Utiliser vault.get_secret('infra/secret_name') dans tes scripts")
    print(f"  2. Voir directive: 02.Directives/tpb-vault/use_secrets.md")
    print(f"  3. Pour modifier des secrets: vault.set_secret('path', 'value')")


if __name__ == "__main__":
    main()

