# 🚨 SECURITY BREACH - IMMEDIATE ACTION REQUIRED

> **Date**: 2026-01-10  
> **Status**: OPEN  
> **Priority**: HIGH  
> **Owner**: Matthieu

---

## LE PROBLEME

Le service account LMS (`tpb-lms-service-account`) a actuellement **acces a TOUS les secrets du vault** sans granularite.

Si ce service account est compromis et revoque :
- On NE SAIT PAS quels secrets il avait accedes
- Le token GitHub stocke dans le vault a acces a TOUS les repos TPB
- La revocation donne un **faux sentiment de securite**

---

## CE QUI EST EN PLACE (temporaire)

```
LMS Backend
  │
  ├── BASTION_CLIENT_ID = 387c91e47df84b6764f463ca3dfbdb9d.access
  ├── BASTION_CLIENT_SECRET = (dans Cloudflare Secrets)
  │
  └── Accede a: tpb/infra/github_pat_tpb_repos
        │
        └── Ce token GitHub a acces a TOUS les repos the-play-button
```

**Le token GitHub est stocke dans le vault** :
- Path: `tpb/infra/github_pat_tpb_repos`
- Description: "TEMPORAIRE - Token gh CLI avec full access"

---

## PREREQUIS POUR COLMATER

### 1. Refactoriser tpb-bastion (Applications & Tokens OAuth2)

Voir `Desk/CONTEXT.md` section "CHANTIER EN COURS : BASTION Applications & Tokens OAuth2"

**Modifications requises** :

| Fichier | Action |
|---------|--------|
| `handlers/applications/create.js` | Autoriser scopes cross-domain (`vault:*`) |
| `handlers/secrets.js` | Enforcer `hasVaultScope()` dans `readSecret()` |
| `handlers/applications/index.js` | Afficher scopes vault lors de la revocation |
| Frontend | Afficher les scopes vault dans la page application |

### 2. Configurer le scope LMS

Apres la refacto, ajouter le scope specifique au service token LMS :

```sql
UPDATE iam_service_token 
SET scopes = 'tpblms:*,vault:read:tpb/infra/github_pat_tpb_repos'
WHERE application_id = (SELECT id FROM iam_application WHERE namespace = 'tpblms')
  AND revoked_at IS NULL;
```

### 3. Verifier l'enforcement

Tester que le LMS ne peut acceder QU'A `tpb/infra/github_pat_tpb_repos` :

```bash
# Doit fonctionner
curl "https://tpb-bastion-backend.../secret/data/tpb/infra/github_pat_tpb_repos" \
  -H "CF-Access-Client-Id: $LMS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $LMS_CLIENT_SECRET"

# Doit retourner 403
curl "https://tpb-bastion-backend.../secret/data/infra/openai_api_key" \
  -H "CF-Access-Client-Id: $LMS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $LMS_CLIENT_SECRET"
```

---

## RESULTAT ATTENDU APRES FIX

A la revocation de `tpb-lms-service-account` :

```json
{
  "message": "Application 'tpblms' has been revoked",
  "vault_access_revoked": [
    "vault:read:tpb/infra/github_pat_tpb_repos"
  ],
  "recommendation": "Consider rotating: GitHub PAT (full repo access)"
}
```

---

## DOCUMENTATION

- Architecture OAuth2 : `Apps/the-play-button/tpb-bastion/backend/docs/2026-01-10_vault_access_via_scopes.md`
- Domain analysis : `Apps/external/vault-analysis/DOMAIN_ANALYSIS.md`
- Plan detaille : Voir historique conversation ou `.cursor/plans/`
- Context global : `Desk/CONTEXT.md`

---

## CHECKLIST DE CLOTURE

- [x] Refacto bastion backend (`validateScopes`, `hasVaultScope`, `deleteApplication`) - **DONE 2026-01-10**
- [x] Refacto bastion frontend (affichage scopes vault) - **DONE 2026-01-10**
- [x] Migration tokens existants (ajouter `vault:read:*` pour backward compat) - **016_oauth_scopes.sql**
- [x] Configurer scope LMS : `vault:read:tpb/infra/github_pat_tpb_repos` - **017_lms_vault_scope.sql**
- [x] Deploy tpb-bastion backend et frontend - **DONE 2026-01-10**
- [x] Run migrations 016 et 017 - **DONE 2026-01-10**
- [ ] Tester enforcement (403 sur autres secrets)
- [ ] Tester revocation (affichage warning secrets)
- [ ] Supprimer ce fichier

---

**NE PAS SUPPRIMER CE FICHIER** tant que la checklist n'est pas complete.
