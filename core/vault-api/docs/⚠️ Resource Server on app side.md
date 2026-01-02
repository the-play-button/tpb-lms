Dans un vrai système OAuth, le Authorization Server (vault-api) gère :
Scopes : permissions demandées
Audiences : à qui le token est destiné
Roles : optionnellement dans les claims
Le Resource Server (l'app) vérifie le token et peut appliquer du fine-grained.
La bonne pratique est :
Coarse-grained (qui peut accéder à l'app, avec quels scopes généraux) → Authorization Server (vault-api)
Fine-grained (ReBAC sur les entités métier spécifiques) → Resource Server (l'app)
Pourquoi ? Parce que :
Le ReBAC nécessite la connaissance du graphe de relations métier (qui possède quoi, qui est dans quelle équipe métier)
Ce graphe est spécifique à chaque application
Le Authorization Server ne devrait pas connaître la structure métier de chaque app


flowchart LR
    subgraph AuthServer [Authorization Server - vault-api]
        Scopes[Scopes]
        Audiences[Audiences]
        CoarseRoles[Coarse Roles]
    end
    
    subgraph ResourceServer [Resource Server - App]
        FineGrained[Fine-grained Logic]
        ReBAC[ReBAC Graph]
        Overrides[Entity Overrides]
    end
    
    User --> AuthServer
    AuthServer -->|Token avec scopes| ResourceServer
    ResourceServer --> Data


Responsabilité	Authorization Server (vault-api)	Resource Server (App)
Qui es-tu ?	JWT avec identity claims	-
À quelle app peux-tu accéder ?	Audiences	-
Quels scopes généraux ?	lms:*, billing:read	-
Quel rôle coarse-grained ?	admin, instructor, buyer	-
Peux-tu éditer CE cours ?	-	ReBAC (user owns course)
Override sur CE client ?	-	DECK-style permissions


Pourquoi le fine-grained doit être côté app ?
Le graphe de relations est métier-spécifique
LMS : user → owns → course, user → enrolled_in → cohort
ERP : user → manages → entity, user → can_order_for → customer
Vault-api ne peut pas connaître tous ces schémas
Performance
Pour DECK avec 1000 entités × 25 permissions × 100 users = 2.5M relations potentielles
C'est de la data applicative, pas de l'IAM infrastructure
Séparation des préoccupations
Vault-api = "Tu as le droit d'utiliser cette app avec ce niveau d'accès"
App = "Voici ce que tu peux faire sur MES ressources"

Le modèle hybride recommandé
Vault-api peut stocker des relations de haut niveau qui sont transverses :
organization has tier (premium, starter, enterprise)
user belongs_to organization
user has persona (buyer, partner, worker...)
L'app stocke les relations métier fines et appelle /iam/can pour vérifier les permissions coarse-grained avant d'appliquer son propre ReBAC.