#!/usr/bin/env python3
"""Copy the LMS content that production users read on the dev database into lms-api-production's database.

Plan tpb-lms/plans/2026-11-11_lms-api-production-domain-serves-the-dev-worker.plan.md, step 2. lms-api.theplaybutton.ai is
served by the dev Worker `lms-api` (D1 597a891e…) ; its production Worker `lms-api-production` (D1 a634901b…) holds nearly nothing.
Carried : every row of every table both databases hold, on the columns both declare, except the rows the plan drops
(`test_contact_1`, and `api_key`, whose owners exist on no bastion). Inserted with INSERT OR IGNORE : a row production already
holds (translations, glossary, its one crm_contact) stays as it is.

Default is a dry run : read both databases, print what would be copied per table, write nothing. `--apply` records the production
database's time-travel bookmark first (printed, the restore point), copies, then prints the counts again on both sides.
The token is the fleet IaC's (`tpb/infra/cloudflare_api_token`), in process memory only.
Usage: python3 migrate_lms_dev_database_into_production.py [--apply]
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

from tpb_cli.bastion_transport import build_bastion_client

ACCOUNT = "79d621c1d8e20c3c85009b30099b96e0"
DEV = "597a891e-09c0-4ff8-a9be-ec4faac9f395"
PRODUCTION = "a634901b-b6c2-433c-8932-53a701a44382"
DROPPED_TABLES = {"api_key"}
TEST_USER = "test_contact_1"
ROWS_PER_STATEMENT = 40


class D1:
    def __init__(self, token: str, database: str) -> None:
        self.token, self.database = token, database

    def query(self, sql: str, params: list | None = None) -> list[dict]:
        body = {"sql": sql, **({"params": params} if params else {})}
        request = urllib.request.Request(
            f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{self.database}/query",
            data=json.dumps(body).encode(), method="POST",
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)["result"][0]["results"]
        except urllib.error.HTTPError as error:
            raise SystemExit(f"D1 {self.database} refused {sql[:80]!r}: HTTP {error.code} {error.read()[:300]!r}")

    def tables(self) -> list[str]:
        rows = self.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
                          "AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'")
        return [row["name"] for row in rows]

    def columns(self, table: str) -> list[str]:
        return [row["name"] for row in self.query(f'PRAGMA table_info("{table}")')]

    def count(self, table: str) -> int:
        return self.query(f'SELECT COUNT(*) AS n FROM "{table}"')[0]["n"]


def carried_rows(dev: D1, table: str, columns: list[str]) -> list[dict]:
    selected = ", ".join(f'"{column}"' for column in columns)
    where = f' WHERE "user_id" IS NOT \'{TEST_USER}\'' if "user_id" in columns else ""
    return dev.query(f'SELECT {selected} FROM "{table}"{where}')


def main() -> int:
    apply = "--apply" in sys.argv[1:]
    token = build_bastion_client({**os.environ, "TPB_BASTION_ACTIVE_ORG_ID": "org_tpb"}, target="dev").get_secret(
        "tpb/infra/cloudflare_api_token")
    dev, production = D1(token, DEV), D1(token, PRODUCTION)
    target_tables = set(production.tables())
    plan: list[tuple[str, list[str], list[dict]]] = []
    for table in dev.tables():
        if table in DROPPED_TABLES:
            print(f"{table}: dropped ({dev.count(table)} rows), by the plan")
            continue
        if table not in target_tables:
            print(f"{table}: absent from production, not carried ({dev.count(table)} rows)")
            continue
        shared = [column for column in dev.columns(table) if column in set(production.columns(table))]
        rows = carried_rows(dev, table, shared)
        plan.append((table, shared, rows))
        print(f"{table}: {len(rows)} rows to carry on {len(shared)} columns (production holds {production.count(table)})")
    if not apply:
        print("dry run : nothing written. --apply --bookmark=<time-travel bookmark of production> copies.")
        return 0
    # The restore point is read just before, by `wrangler d1 time-travel info` on lms-api-production's database (the wrangler of
    # tpb-lms/backend behind ~/bin/wrangler), and named here : no copy runs without the bookmark it can be undone to.
    bookmark = next((argument.split("=", 1)[1] for argument in sys.argv[1:] if argument.startswith("--bookmark=")), "")
    if not bookmark:
        raise SystemExit("--apply needs --bookmark=<the production database's time-travel bookmark, read just before>")
    print(f"restore point : bookmark {bookmark}")
    for table, columns, rows in plan:
        names = ", ".join(f'"{column}"' for column in columns)
        for start in range(0, len(rows), ROWS_PER_STATEMENT):
            chunk = rows[start:start + ROWS_PER_STATEMENT]
            values = ", ".join("(" + ", ".join("?" for _ in columns) + ")" for _ in chunk)
            params = [row[column] for row in chunk for column in columns]
            production.query(f'INSERT OR IGNORE INTO "{table}" ({names}) VALUES {values}', params)
        print(f"{table}: production now holds {production.count(table)} (dev {dev.count(table)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
