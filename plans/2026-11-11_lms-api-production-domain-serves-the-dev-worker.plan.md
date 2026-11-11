# lms-api.theplaybutton.ai is served by the dev Worker, on the dev bastion and the dev database

**Opened** : 2026-11-11 08:20 UTC, AGENT DEVOPS 2, from « endpoint agent attribution » (5d53870f) after the delivery of
go-live-tpb-lms-v0.1.1 : the production Worker carries the new code, but the production domain does not reach it.

## Measured (2026-11-11 08:15 UTC, Cloudflare API, account `79d621c1d8e20c3c85009b30099b96e0`, read-only)

| Domain | Worker | BASTION_URL | D1 | Deployed commit |
|---|---|---|---|---|
| `lms-api.theplaybutton.ai` | `lms-api` (dev) | `bastion-backend.theplaybutton.dev` | `597a891e-09c0-4ff8-a9be-ec4faac9f395` | `a4e9fa6b56d83d0be6c2f63e249c961d3358de3e` (23/10) |
| `lms-api.theplaybutton.dev` | `lms-api` (dev) | same | same | same |
| none | `lms-api-production` | `bastion-backend.theplaybutton.ai` | `a634901b-b6c2-433c-8932-53a701a44382` | `ee75280f77a5d7ab56fe9d42358c8619de3615c9` |
| none | `lms-api-staging` | `bastion-backend-staging.theplaybutton.dev` | `94ae4205-c6bb-4a80-8a43-9cd9c300f511` | `ee75280f…` |

- The IaC says so : `tpb-devops/terraform/cloudflare-fleet/main_worker_domains.tf`, `cloudflare_worker_domain.lms_api_theplaybutton_ai`
  has `service = "lms-api"`. Every other split app binds `<app>.theplaybutton.ai` to its `-production` Worker (tpb-accounting,
  tpb-approval, tpb-business-intelligence…).
- The data lives in the dev database : 21 tables, 2 081 rows (lms_course 57, lms_class 1 596, lms_event 241, crm_event 26,
  crm_contact 20, kms_page 36, hris_employee 8, api_key 7, gamification 16…) against 32 rows in production (translations 25,
  glossary 6, crm_contact 1). Last `lms_event` : 2026-09-28 09:33:45, six weeks without activity.
- The dev database lacks migrations `012_cursor_covering_index.sql` and `013_crm_event_table_and_cursor_index.sql` ; production has
  all 8.

## Why not just move the domain

Pointing `lms-api.theplaybutton.ai` at `lms-api-production` changes the bastion (dev → production) and the database (2 081 rows →
32) at once : every course, class and API key disappears for its users. The rows were written against the dev bastion : their
organization, user and employee ids must be checked against the production bastion before any copy.

## Steps (recommended : migrate, then switch, in one window ; no activity since 2026-09-28)

1. Map the ids the dev rows carry (organization, user, employee, API key owner) onto the production bastion ; a missing one stops
   here and is named.
2. Copy the dev database into `lms-api-production`'s (export, id mapping, import), the time-travel bookmark of the production
   database recorded before ; prove row counts per table.
3. IaC : `lms_api_theplaybutton_ai` → `service = "lms-api-production"` (the `.dev` domain stays on `lms-api`), `tofu` plan then apply
   through `tpb-devops/scripts/tofu_fleet.py`.
4. Prove : `lms-api.theplaybutton.ai` answers from `COMMIT_SHA` ee75280f or later, bundle with `configureCaller({` ; one read of a course
   returns the migrated data.
5. Then the dev database is dev again : apply 012 and 013 there, or rebuild it from fixtures.

Owner of steps 1-2 : the tpb-lms work (data and ids) ; steps 3-4 : AGENT DEVOPS. Who decides the window : Matthieu (production data
moves between environments).

## Step 1, measured 2026-11-11 08:20 UTC (dev database, read-only)

The rows carry no bastion organization id : `glossary.org_id` is the literal `theplaybutton`. Their user ids are LMS contacts :
`contact_<epoch>_<random>` (three learners : `contact_1766799203473_s11pxmp07`, `contact_1767083393289_2jjxbs03p`,
`contact_1767628844409_pt32efp21`), `test_contact_1`, and `contact_usr_<id>` built on bastion user ids (`usr_86dab4bf`,
`usr_902f95c7`, `usr_9b5bf855`, `usr_a0dd01f1`, `usr_cb488f50`, `usr_f819caf5`, the API keys' owners). What remains to map is
those six `usr_` ids : do they exist on the production bastion, and as the same people ? `test_contact_1` rows are test data.
