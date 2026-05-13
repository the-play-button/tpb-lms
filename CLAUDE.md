# tpb-lms

Application TPB. Voir le code source pour l'architecture.

## Intent Ledger

Ce projet maintient un Intent Ledger.

- Storage : `tpb-cock/genai_platform/intent_ledger/intent_ledger.db` (SQLite SSOT, FTS5).
- Sources : `tpb-cock/genai_platform/intent_ledger/immutable_sources/{intent-compacts,research-snapshots,plans-references}/`.
- Query : `tpb-agents-management ledger query --project tpb-lms --view design-intent`.
- Export : `tpb-agents-management ledger export --project tpb-lms --view all --format markdown`.

Avant d'explorer le code par tool calls, consulte le ledger via la CLI.
