#!/usr/bin/env python3
"""
Reset LMS Database (Dev Mode)

Vide les tables de données utilisateur tout en conservant le schéma
et les données de référence (badges, cours).

Usage:
    python reset_db.py --confirm                    # Reset + vérification
    python reset_db.py --confirm --deploy           # Reset + deploy Worker
    python reset_db.py --confirm --full             # Reset complet (schema.sql)
    python reset_db.py --verify                     # Juste vérifier l'état

One-liner (in Dev Container):
    python tpb_system/04.Execution/lms/scripts/tests/reset_db.py --verify
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Tables à vider (ordre important pour les FK)
TABLES_TO_CLEAR = [
    "v_user_progress",      # Vue matérialisée (progression)
    "lms_signal",           # Signaux dérivés (used by v_leaderboard)
    "lms_event",            # Événements bruts (event sourcing)
    "gamification_award",   # Badges attribués
    "crm_event",            # TODO: Migrate to lms_event, then remove
]

# Tables à reset puis re-seeder
TABLES_TO_RESEED = [
    "lms_class",            # Classes/étapes (re-seeded from JSON)
    "lms_course",           # Cours (re-seeded from JSON)
]

# Tables de référence (conservées)
REFERENCE_TABLES = [
    "gamification_badge",   # Définitions badges
    "crm_contact",          # Utilisateurs
]

# Cours à re-seeder depuis 03.Orchestration/lms/courses/
COURSES_DIR = Path(__file__).parent.parent.parent / "03.Orchestration" / "lms" / "courses"

# Couleurs terminal
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# Project root (where wrangler.toml is)
PROJECT_ROOT = Path(__file__).parent.parent.parent  # scripts/tests/ -> scripts/ -> lms/

_WRANGLER_AUTH_TIMEOUT = 30
_NODE_MINIMUM_VERSION = 20
_CLI_SEPARATOR_WIDTH = 50
_CLI_WIDE_SEPARATOR_WIDTH = 60


def check_node_version() -> tuple[bool, str]:
    """Vérifie que Node.js >= 20 est disponible (requis par Wrangler)."""
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        if result.returncode != 0:
            return False, "Node.js non trouvé"
        version = result.stdout.strip()
        # Parse version (e.g., "v22.16.0" -> 22)
        major = int(version.lstrip("v").split(".")[0])
        if major < _NODE_MINIMUM_VERSION:
            return False, f"Node {version} < v20 (requis par Wrangler)"
        return True, version
    except Exception as e:
        return False, str(e)


def check_wrangler_auth() -> tuple[bool, str]:
    """Vérifie que Wrangler peut s'authentifier à Cloudflare."""
    # Check if CLOUDFLARE_API_TOKEN is set (for non-interactive envs like Docker/CI)
    if os.environ.get("CLOUDFLARE_API_TOKEN"):
        return True, "CLOUDFLARE_API_TOKEN set"
    
    # Try a simple wrangler whoami to check auth
    try:
        result = subprocess.run(
            ["npx", "wrangler", "whoami"],
            capture_output=True, text=True, cwd=PROJECT_ROOT, timeout=_WRANGLER_AUTH_TIMEOUT
        )
        output = result.stdout + result.stderr
        if result.returncode != 0:
            if "non-interactive" in output.lower():
                return False, "AUTH_NONINTERACTIVE"
            return False, output[:200]
        if "You are logged in" in output or "account" in output.lower():
            return True, "wrangler logged in"
        return True, "auth OK"
    except subprocess.TimeoutExpired:
        return False, "Timeout checking auth"
    except Exception as e:
        return False, str(e)


def run_d1_command(command: str, remote: bool = True) -> tuple[bool, str]:
    """Execute une commande D1 via wrangler.

    Args:
        command: SQL command string to execute.
        remote: If True, execute against remote D1 database.

    Returns:
        Tuple of (success, output_or_error).
    """
    cmd = ["npx", "wrangler", "d1", "execute", "lms-db", "--command", command]
    if remote:
        cmd.append("--remote")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_ROOT)
        if result.returncode != 0:
            error = result.stderr
            # Detect Node version error
            if "requires at least Node.js" in error or "v18" in error:
                return False, f"NODE_VERSION_ERROR: {error}"
            # Detect auth error in non-interactive (Docker/CI)
            if "non-interactive" in error or "CLOUDFLARE_API_TOKEN" in error:
                return False, f"AUTH_ERROR: {error}"
            return False, error
        return True, result.stdout
    except Exception as e:
        return False, str(e)


def run_d1_file(file_path: str, remote: bool = True) -> tuple[bool, str]:
    """Execute un fichier SQL via wrangler.

    Args:
        file_path: Path to the SQL file to execute.
        remote: If True, execute against remote D1 database.

    Returns:
        Tuple of (success, output_or_error).
    """
    cmd = ["npx", "wrangler", "d1", "execute", "lms-db", "--file", file_path]
    if remote:
        cmd.append("--remote")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_ROOT)
        if result.returncode != 0:
            return False, result.stderr
        return True, result.stdout
    except Exception as e:
        return False, str(e)


def run_wrangler_deploy() -> tuple[bool, str]:
    """Déploie le Worker via wrangler."""
    cmd = ["npx", "wrangler", "deploy"]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_ROOT)
        if result.returncode != 0:
            return False, result.stderr
        return True, result.stdout
    except Exception as e:
        return False, str(e)


def run_frontend_deploy() -> tuple[bool, str]:
    """Déploie le frontend via deploy_workers.py."""
    script_path = Path(__file__).parent.parent / "cloudflare" / "deploy_workers.py"
    frontend_dir = Path(__file__).parent / "frontend"
    
    cmd = [
        "python3", str(script_path), "deploy",
        "--name", "lms-viewer",
        "--directory", str(frontend_dir)
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=Path(__file__).parent.parent)
        if result.returncode != 0:
            return False, result.stderr
        return True, result.stdout
    except Exception as e:
        return False, str(e)


def parse_wrangler_json(output: str) -> dict:
    """Parse la sortie JSON de wrangler d1 execute.

    Args:
        output: Raw stdout from wrangler command.

    Returns:
        Parsed result dict or empty dict on failure.
    """
    try:
        # Chercher le bloc JSON dans la sortie
        lines = output.split('\n')
        json_start = None
        for i, line in enumerate(lines):
            if line.strip().startswith('['):
                json_start = i
                break
        
        if json_start is not None:
            json_str = '\n'.join(lines[json_start:])
            data = json.loads(json_str)
            if data and len(data) > 0:
                return data[0]
    except (json.JSONDecodeError, IndexError):
        pass
    return {}


def get_table_count(table: str, remote: bool = True) -> tuple[int, str]:
    """Récupère le nombre de lignes dans une table.

    Args:
        table: Database table name.
        remote: If True, query remote D1 database.

    Returns:
        Tuple of (count, error_msg). Count is -1 on error.
    """
    success, output = run_d1_command(f"SELECT COUNT(*) as c FROM {table};", remote)
    if success:
        data = parse_wrangler_json(output)
        results = data.get("results", [])
        if results:
            return results[0].get("c", 0), ""
    # Return error info
    if "NODE_VERSION_ERROR" in output:
        return -1, "Node.js < 20 (voir ci-dessus)"
    return -1, output[:100] if output else "Unknown error"


def clear_table(table: str, remote: bool = True) -> tuple[bool, int]:
    """Vide une table et retourne le nombre de lignes supprimées.

    Args:
        table: Database table name to clear.
        remote: If True, execute against remote D1 database.

    Returns:
        Tuple of (success, deleted_count).
    """
    count_before, _ = get_table_count(table, remote)
    success, output = run_d1_command(f"DELETE FROM {table};", remote)
    if not success:
        return False, 0
    
    # Récupérer le nombre de changes depuis la réponse
    data = parse_wrangler_json(output)
    changes = data.get("meta", {}).get("changes", count_before if count_before >= 0 else 0)
    return True, changes


def seed_courses(remote: bool = True) -> bool:
    """Re-seed courses from 03.Orchestration/lms/courses/*.json.

    Args:
        remote: If True, seed against remote D1 database.

    Returns:
        True if all courses were seeded successfully.
    """
    if not COURSES_DIR.exists():
        print(f"  {YELLOW}⚠ Dossier courses non trouvé: {COURSES_DIR}{RESET}")
        return False
    
    json_files = list(COURSES_DIR.glob("*.json"))
    if not json_files:
        print(f"  {YELLOW}⚠ Aucun fichier JSON trouvé dans {COURSES_DIR}{RESET}")
        return False
    
    print(f"\n  📚 Re-seeding {len(json_files)} cours...")
    
    upload_script = Path(__file__).parent / "upload_course.py"
    success_count = 0
    
    for json_file in sorted(json_files):
        print(f"     → {json_file.name}...", end=" ", flush=True)
        try:
            result = subprocess.run(
                ["python3", str(upload_script), "--config", str(json_file)],
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent
            )
            if result.returncode == 0:
                print(f"{GREEN}✓{RESET}")
                success_count += 1
            else:
                print(f"{RED}✗{RESET}")
                if result.stderr:
                    print(f"       {result.stderr[:100]}")
        except Exception as e:
            print(f"{RED}✗ {e}{RESET}")
    
    return success_count == len(json_files)


def verify_database_state(remote: bool = True) -> dict:
    """Vérifie l'état de la base de données.

    Args:
        remote: If True, query remote D1 database.

    Returns:
        State dict with cleared, seeded, reference, and errors keys.
    """
    state = {
        "cleared": {},
        "seeded": {},
        "reference": {},
        "errors": []
    }
    
    # Vérifier les tables vidées
    for table in TABLES_TO_CLEAR:
        count, error = get_table_count(table, remote)
        if count == -1:
            state["errors"].append(f"Erreur lecture {table}: {error}")
        else:
            state["cleared"][table] = count
    
    # Vérifier les tables re-seedées (cours)
    for table in TABLES_TO_RESEED:
        count, error = get_table_count(table, remote)
        if count == -1:
            state["errors"].append(f"Erreur lecture {table}: {error}")
        else:
            state["seeded"][table] = count
    
    # Vérifier les tables de référence
    for table in REFERENCE_TABLES:
        count, error = get_table_count(table, remote)
        if count == -1:
            state["errors"].append(f"Erreur lecture {table}: {error}")
        else:
            state["reference"][table] = count
    
    return state


def print_database_state(state: dict):
    """Affiche l'état de la base de données.

    Args:
        state: Database state dict from verify_database_state.

    Returns:
        True if database state is healthy.
    """
    print(f"\n{BOLD}📊 État de la base de données{RESET}")
    print("─" * _CLI_SEPARATOR_WIDTH)
    
    # Tables vidées
    print(f"\n{CYAN}Tables de données (doivent être vides) :{RESET}")
    all_empty = True
    for table, count in state["cleared"].items():
        if count == 0:
            status = f"{GREEN}✓ vide{RESET}"
        else:
            status = f"{YELLOW}{count} lignes{RESET}"
            all_empty = False
        print(f"  {table:25} {status}")
    
    # Tables re-seedées (cours)
    print(f"\n{CYAN}Tables cours (re-seedées) :{RESET}")
    seeded_ok = True
    for table, count in state.get("seeded", {}).items():
        if count > 0:
            status = f"{GREEN}✓ {count} lignes{RESET}"
        else:
            status = f"{YELLOW}vide (aucun cours ?){RESET}"
            seeded_ok = False
        print(f"  {table:25} {status}")
    
    # Tables de référence
    print(f"\n{CYAN}Tables de référence (conservées) :{RESET}")
    for table, count in state["reference"].items():
        if count > 0:
            status = f"{GREEN}{count} lignes{RESET}"
        else:
            status = f"{YELLOW}vide{RESET}"
        print(f"  {table:25} {status}")
    
    # Erreurs
    if state["errors"]:
        print(f"\n{RED}Erreurs :{RESET}")
        for error in state["errors"]:
            print(f"  ✗ {error}")
    
    # Résumé
    print()
    is_ok = all_empty and seeded_ok and not state["errors"]
    if is_ok:
        print(f"{GREEN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
        print(f"{GREEN}✓ Base de données prête pour les tests !{RESET}")
        print(f"{GREEN}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    elif state["errors"]:
        print(f"{RED}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
        print(f"{RED}✗ Des erreurs sont survenues{RESET}")
        print(f"{RED}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    else:
        print(f"{YELLOW}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
        print(f"{YELLOW}⚠ Vérifiez l'état des tables ci-dessus{RESET}")
        print(f"{YELLOW}{'=' * _CLI_SEPARATOR_WIDTH}{RESET}")
    
    return is_ok


def main():
    parser = argparse.ArgumentParser(description="Reset LMS Database (Dev Mode)")
    parser.add_argument("--confirm", action="store_true", help="Confirmer le reset")
    parser.add_argument("--deploy", action="store_true", help="Déployer le Worker API après reset")
    parser.add_argument("--frontend", action="store_true", help="Déployer aussi le frontend (Pages)")
    parser.add_argument("--all", action="store_true", help="Reset + deploy Worker + deploy Frontend")
    parser.add_argument("--dev", action="store_true", help="Mode dev complet: reset + deploy all + skip confirm (alias pour --confirm --all --yes)")
    parser.add_argument("--full", action="store_true", help="Reset complet (réapplique schema.sql)")
    parser.add_argument("--local", action="store_true", help="Reset local (pas --remote)")
    parser.add_argument("--verify", action="store_true", help="Juste vérifier l'état (pas de reset)")
    parser.add_argument("--yes", "-y", action="store_true", help="Skip la confirmation manuelle")
    
    args = parser.parse_args()
    
    # Check Node version first (Wrangler requires Node >= 20)
    node_ok, node_info = check_node_version()
    if not node_ok:
        print(f"\n{RED}{'=' * _CLI_WIDE_SEPARATOR_WIDTH}{RESET}")
        print(f"{RED}❌ ERREUR NODE.JS{RESET}")
        print(f"{RED}{'=' * _CLI_WIDE_SEPARATOR_WIDTH}{RESET}")
        print(f"\n{YELLOW}Wrangler requiert Node.js >= 20.0.0{RESET}")
        print(f"Version actuelle: {RED}{node_info}{RESET}")
        print(f"\n{CYAN}Solution:{RESET}")
        print(f"  source ~/.nvm/nvm.sh && nvm use 22")
        print(f"\nPuis relancer:")
        print(f"  python {sys.argv[0]} {' '.join(sys.argv[1:])}")
        print()
        sys.exit(1)
    
    # Check Wrangler auth (especially for Docker/CI)
    auth_ok, auth_info = check_wrangler_auth()
    if not auth_ok:
        print(f"\n{RED}{'=' * _CLI_WIDE_SEPARATOR_WIDTH}{RESET}")
        print(f"{RED}❌ ERREUR AUTHENTIFICATION WRANGLER{RESET}")
        print(f"{RED}{'=' * _CLI_WIDE_SEPARATOR_WIDTH}{RESET}")
        if auth_info == "AUTH_NONINTERACTIVE":
            print(f"\n{YELLOW}Environnement non-interactif détecté (Docker/CI){RESET}")
            print(f"\n{CYAN}Solution:{RESET}")
            print(f"  1. Créer un API Token sur https://dash.cloudflare.com/profile/api-tokens")
            print(f"     (Template: 'Edit Cloudflare Workers')")
            print(f"  2. Exporter la variable:")
            print(f"     export CLOUDFLARE_API_TOKEN='your-token-here'")
            print(f"\n  Ou ajouter au .devcontainer/devcontainer.json:")
            print(f'     "remoteEnv": {{ "CLOUDFLARE_API_TOKEN": "${{localEnv:CLOUDFLARE_API_TOKEN}}" }}')
        else:
            print(f"\n{YELLOW}Wrangler n'est pas authentifié{RESET}")
            print(f"Détail: {auth_info[:100]}")
            print(f"\n{CYAN}Solution:{RESET}")
            print(f"  npx wrangler login")
        print()
        sys.exit(1)
    
    remote = not args.local
    
    # Mode --dev = raccourci pour tout faire d'un coup
    if args.dev:
        args.confirm = True
        args.all = True
        args.yes = True
        print(f"{CYAN}🚀 Mode DEV activé: Reset + Deploy All{RESET}\n")
    
    # Mode vérification seule
    if args.verify:
        print(f"\n{CYAN}🔍 Vérification de l'état de la base de données...{RESET}")
        state = verify_database_state(remote)
        print_database_state(state)
        sys.exit(0 if not state["errors"] else 1)
    
    # Avertissement
    print(f"\n{YELLOW}{'=' * _CLI_WIDE_SEPARATOR_WIDTH}{RESET}")
    print(f"{YELLOW}⚠️  LMS DATABASE RESET - DEV MODE ONLY{RESET}")
    print(f"{YELLOW}{'=' * _CLI_WIDE_SEPARATOR_WIDTH}{RESET}\n")
    
    if args.full:
        print(f"{RED}Mode FULL : Va réappliquer schema.sql (perte totale){RESET}")
    else:
        print("Tables qui seront vidées :")
        for table in TABLES_TO_CLEAR + TABLES_TO_RESEED:
            count, _ = get_table_count(table, remote)
            color = CYAN if count > 0 else GREEN
            print(f"  - {table}: {color}{count}{RESET} lignes")
        
        print(f"\n{YELLOW}Note: Les cours seront re-seedés depuis 03.Orchestration/lms/courses/{RESET}")
    
    if args.deploy:
        print(f"\n{CYAN}Option --deploy : Le Worker sera redéployé après le reset.{RESET}")
    
    if not args.confirm:
        print(f"\n{RED}Ajoutez --confirm pour exécuter le reset.{RESET}")
        print(f"Ou --verify pour juste vérifier l'état.\n")
        sys.exit(1)
    
    # Confirmation manuelle (sauf si --yes)
    if not args.yes:
        print(f"\n{RED}ATTENTION : Cette action est irréversible !{RESET}")
        response = input(f"Tapez 'RESET' pour confirmer : ")
        
        if response != "RESET":
            print(f"{YELLOW}Annulé.{RESET}")
            sys.exit(0)
    
    print(f"\n{CYAN}Début du reset...{RESET}\n")
    
    total_deleted = 0
    
    if args.full:
        # Reset complet : réappliquer le schéma
        print(f"  📄 Réapplication de schema.sql...")
        success, output = run_d1_file("schema.sql", remote)
        if success:
            print(f"  {GREEN}✓ Schema réappliqué{RESET}")
        else:
            print(f"  {RED}✗ Erreur: {output}{RESET}")
            sys.exit(1)
    else:
        # Reset sélectif : vider les tables (données + cours)
        for table in TABLES_TO_CLEAR + TABLES_TO_RESEED:
            print(f"  🗑️  Vidage de {table}...", end=" ", flush=True)
            success, count = clear_table(table, remote)
            if success:
                print(f"{GREEN}✓ {count} lignes supprimées{RESET}")
                total_deleted += count
            else:
                print(f"{RED}✗ Erreur{RESET}")
    
    # Re-seed des cours depuis 03.Orchestration/lms/courses/
    seed_courses(remote)
    
    # Raccourci --all = --deploy + --frontend
    if args.all:
        args.deploy = True
        args.frontend = True
    
    # Déploiement Worker si demandé
    if args.deploy:
        print(f"\n  🚀 Déploiement du Worker API...", end=" ", flush=True)
        success, output = run_wrangler_deploy()
        if success:
            print(f"{GREEN}✓ Déployé{RESET}")
            # Extraire l'URL du déploiement
            for line in output.split('\n'):
                if 'https://' in line and 'workers.dev' in line:
                    url = line.strip()
                    print(f"     {CYAN}{url}{RESET}")
                    break
        else:
            print(f"{RED}✗ Erreur{RESET}")
            print(f"     {output}")
    
    # Déploiement Frontend si demandé
    if args.frontend:
        print(f"\n  🌐 Déploiement du Frontend...", end=" ", flush=True)
        success, output = run_frontend_deploy()
        if success:
            print(f"{GREEN}✓ Déployé{RESET}")
            print(f"     {CYAN}https://lms-viewer.matthieu-marielouise.workers.dev{RESET}")
        else:
            print(f"{RED}✗ Erreur{RESET}")
            print(f"     {output}")
    
    # Vérification finale
    print(f"\n{CYAN}🔍 Vérification post-reset...{RESET}")
    state = verify_database_state(remote)
    is_ok = print_database_state(state)
    
    if is_ok:
        print(f"\n{CYAN}Prochaines étapes :{RESET}")
        print("  1. Tester le flux LMS       # Vidéo → Quiz → Complétion")
        print("")
        print(f"{YELLOW}⚠️  RAPPEL : Pour tout prochain déploiement en dev :{RESET}")
        print(f"   {CYAN}python3 reset_db.py --dev{RESET}")
        print(f"   NE JAMAIS utiliser wrangler deploy ou deploy_workers.py seuls !")
        print()
    
    sys.exit(0 if is_ok else 1)


if __name__ == "__main__":
    main()
