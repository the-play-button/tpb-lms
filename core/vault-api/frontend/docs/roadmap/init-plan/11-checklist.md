# Checklist & Estimation

## Checklist Roadmap Enterprise

### Phase 0 : Extraction Existant
- [ ] Creer `_to_refacto/`
- [ ] Extraire tokens (ui.js:dashboard)
- [ ] Extraire applications (ui.js:applicationsDashboard)
- [ ] Extraire cloudflare (cloudflareResources.js:dashboard)
- [ ] Extraire TPB_STYLES.css
- [ ] Creer README.md mapping

### Phase 1 : Convention + Setup
- [ ] Creer `04_Convention_Frontend_TPB.md`
- [ ] Init Next.js 15 + TypeScript + Tailwind 4
- [ ] Installer deps (next-intl, shadcn, lucide, sonner)
- [ ] Setup CF Worker (wrangler.toml + worker.ts)

### Phase 2 : Infrastructure Multi-tout
- [ ] Setup i18n (next-intl)
- [ ] Setup themes (CSS variables TPB)
- [ ] Setup formatters (Intl API)
- [ ] Contexts : Auth, Tenant, Theme, Locale, Account
- [ ] Services layer (client.ts)

### Phase 3 : Shell Enterprise
- [ ] Header (Logo, OrgSwitcher, UserMenu, AccountSwitcher)
- [ ] Sidebar (navigation complete)
- [ ] Breadcrumbs
- [ ] Layout assemblage
- [ ] DebugX

### Phase 4 : Vues Fondation (3 existantes)
- [ ] Tokens (porter + enrichir)
- [ ] Applications (porter + enrichir)
- [ ] Cloudflare/Infrastructure (porter)

### Phase 5 : IAM Core (5 vues)
- [ ] Dashboard : 4 MetricCards + DriftAlerts + QuickActions + ActivityList
- [ ] Users : DataTable + DetailSidePanel + EffectivePerms + CreateModal
- [ ] Groups : DataTable + DetailSidePanel + MembersList + DriftBadge + SyncButton
- [ ] Roles : MasterDetail layout + PermissionsCheckbox + NL description (future)
- [ ] Organizations : DataTable + DetailPanel + Stats (superadmin only)

### Phase 6 : Features Differenciantes (5)
- [ ] Matrix : Grid User x Scope + CellPopup (path/fix) + Filtres
- [ ] Explain Mode : Global search + FixOptions + ImpactPreview + Execute fix
- [ ] Drift Detection : AudiencesList + DriftDetail + SyncActions + HeaderBadge
- [ ] Access Graph : D3/Cytoscape graph + Modes (User/Scope/Group) + Highlight path
- [ ] What-If : ActionSelector + Preview (gained/lost/affected) + Warnings + Apply

### Phase 7 : Polish Enterprise
- [ ] Audit Stories : Logs narratifs human-readable
- [ ] Performance : Pagination, virtualisation listes > 100 items, cache
- [ ] Security : CSP headers, rate limiting frontend
- [ ] Accessibility : WCAG AA compliance
- [ ] Documentation in-app : Tooltips, help links
- [ ] Monitoring : Sentry integration, error boundaries reporting

---

## Estimation Temporelle (indicative)

| Phase | Effort | Livrables cles |
|-------|--------|----------------|
| Phase 0 | 1j | `_to_refacto/` complet avec mapping |
| Phase 1 | 2j | Next.js init + Convention 04 + CF Worker setup |
| Phase 2 | 3j | 5 Contexts + i18n + themes + services layer |
| Phase 3 | 3j | Shell complet (Header, Sidebar, DebugX, Layout) |
| Phase 4 | 5j | 3 vues existantes portees (Tokens, Apps, CF) |
| Phase 5 | 8j | 5 vues IAM Core |
| Phase 6 | 10j | 5 features differenciantes |
| Phase 7 | 5j | Polish enterprise |
| **Total** | **~37j** | Frontend enterprise-ready complet |

**Note** : Ces estimations supposent un focus LLM + human review, pas de blocages externes.

