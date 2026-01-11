L'objectif initial était :
tpb-lms backend proxy → vault:read:infra/github_pat_tpb_repos → GitHub private repos
tpb-lms backend proxy → vault:read:infra/github_pat_tpb_repos → GitHub private repos
Étapes restantes pour LMS :
Configurer l'application tpblms avec le bon scope :
scopes_allowed: ["tpblms:*", "vault:read:infra/github_pat_tpb_repos"]
Configurer le token de service LMS avec :
scopes: ["vault:read:infra/github_pat_tpb_repos"]
Implémenter le proxy GitHub dans le backend LMS :
Récupérer le PAT depuis vault via IAMPAM
Proxy les requêtes vers raw.githubusercontent.com
Tester : LMS accède au contenu .md privé via le proxy
