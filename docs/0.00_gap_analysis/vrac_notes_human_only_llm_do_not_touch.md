=== vault-api
crud complet vault
gestion de rotation des secrets
double check sécurité
documentation dans worker vault (qui est dans LMS)
directive cloudflare/ pour l'utiliser correctement
repasse dans tous les scripts pour taper dessus

Il est peut-être temps d'implémenter le IAMPAM enterprise-grade multi-tenant de folie. Typiquement je vais avoir besoin d'un OAuth pour un peu tout si on veut être vraiment totalement intégré à tout écosystème. OAuth est un must-have pour cela. Et a priori c'est complexe :

```
OAuth 2.0 complet c'est un gros morceau :
Authorization endpoint + consent UI
Token endpoint (access + refresh)
Client registration
Scopes management
Token storage/revocation
```

-> si notre IAMPAM est bien désigné, on devrait pouvoir ne faire la couche OAuth TPB qu'une fois. Tous les scopes et la complexité, c'est pas que "OAuth" c'est compliqué. C'est même totalement faux, c'est plutôt simple et très straightforward, avec plein de lib qui aide à le faire. C'est juste qu'il faut faire tout l'access control ! Et on a déjà prévu de le faire donc en intégrant les besoins d'OAuth, on devrait être vraiment enterprise grade.

=== a ajouter à l'audit

audit database et conformité au modèles RDD à 100% + listing metadata
nomenclature robuste (identifier les anti-patterns classiques, les variables confuses à un seul mot et semantique faible, les fonctions non auto-descriptives, etc.)
l'audit a même pas détecté que le code n'était pas sur github, c'est chaud !!
entropy -> faudrait ajouter un check d'anti collision. Typiquement on slug des emails matthieu_marielouise_at_wondergrip_com -> on a enlevé le point. Collision assuré en faisant des trucs pareils. Plus classiquement il faut couvrir cet écueil classique avec les id / unique id, génération de référence etc.

entropy -> faut regarder les champs en base dupliqué, ceux qui sont pas utilisé, etc.

on a parlé des jobs de cleaning ? de l'archivage automatique des données ? des mécanismes de pruning d'utilisateur inactif ? (avec envoie d'email pour lui dire que le compte va être désactivé etc. ?). On utilise SQL et on valide le schéma unified.to, ok c'est cool ça permet d'éviter plein de connerie. Mais ça n'empêche pas que les données soient catastrophiques (liens morts, pbm de FK, trucs orphelins etc.), tous les apports que donne un ORM (on veut pas forcément en imposer un, mais on veut contrôler qu'en bdd tout soit toujours propre)

Sécurité / pentest :
faire passer tous les checks de sécurité de l'OWASP, fondamentaux du pentest (securisation des cookies, infos techniques non leakés, protection des secrets, passe crypto, protection injection (escaping et prepare), cloisonnement horizontal + vertical, bouton déconnexion, accept cookie, certificate pining, etc. etc.) + ce qui est spécifique aux technos utilisées + crisis test (impact d'une compromission, script de re-up si tout est chiffré par un ransomware ? SPOF ? Protection DDoS ?)

réduction des données techniques leakés, versions, lib utilisées etc. (avant l'IA c'était pas si important, maintenant c'est crucial faut rien lâcher !)

audit régulier des vulns des dépendances techniques ?

upgrade des versions automatisés et intégré à la CI/CD agentique de façon automatisé en cron agentique ?


contrôle entrée / sorties anti injection
gestion des données
côté sécurité il faudrait une vraie passe sur comment c'est géré. Les données perso (GDPR), les secrets techniques (non exposition, chiffrement at-rest, pas dans les get params, etc.). Si on se fait poutrer, comment les secrets sont impactés ? J'ai déjà une idée pour le vault : la clé c'est le .env du vault, la rotation des secrets et l'admin du vault (matthieu.marielouise) qui a accès à tout.

cloisonnement horizontale ?
cloisonnement verticale ?

Robustesse humaine : y'a que 1 admin ? qui est son backup ? il se passe quoi s'il a un accident ?
Robustesse technique : que 1 serveur ? cloudflare gère parfaitement le passage à l'échelle ? besoin de redondance ? platform ? serveur ? db ? ops ? tierce partie / presta ? backups ok ? cold backups needed ? durée de rétention ?

backend api -> ajouté swagger + openapi disponible comme ça les LLMs peuvent récupérer SANS avoir le code. Intégration simple et garantie. Si possible aussi pointer une full doc avec les pièges classiques pour faciliter les interdépendances (ex: un openapi expose les endpoints mais pas les call-chains)

DebugX -> demain il y aura un bug en prod. Et on n'aura rien pour le débugger à distance. Il faut mettre en place dès le début de quoi envoyer des infos de troubleshooting (stack trace, infos techniques, device fingerprint etc.). Il s'agit pas là de sentry. Il s'agit de mettre un composant "Share technical infos with TPB support" avec un gros bouton qui colle dans le presse papier le max d'info dont les devs auront besoin pour débug (stacktrace, breadcrumb, fingerprint, errors, etc.)

UX classic traps -> pas de bouton de déconnexion, etc.

monitoring est encore trop enfantin. Il faut ajouter le besoin d'analytics sérieux : sentry, fb pixel, google analytics, etc. Et certainement découper en type d'analytics (technique, performance, business, marketing, etc.)

le guide devrait mentionner clairement tout ce qui est nécessaire aux tests agentique (tests backend scripté, test e2e mcp browser en directive, test hitl en directive. Tests HITL avec tests sur plusieurs navigateurs, sur mobile, les trucs chiants à faire en agentique sur un PC go HITL)

les panels doivent être ouf : je veux toutes les features qu'un truc genre vercel / next.js apporte (lister les features et ajouter), je veux qu'on mette les liens vers les plateformes externes qui sont linker (ex: "lien vers sentry")

Zero error tolerance concept: se brancher en API sur toutes les infra qui récupère des erreurs. faire un job quotidien de triage. Objectif : 0 erreurs !

100% agentic capability : t'as sentry ? c'est cool... T'as fait toutes les directives et scripts pour que ton LLM puissent tout faire sans toi ? Sentry est bien 100% apifié ? Qu'est-ce que tu vas devoir forcément faire manuellement ? Qu'est-ce que tu AS fait manuellement : exemple le setup initial que j'ai fait à la main, il est où dans le projet ? pas de setup.md rien. Si on doit recommencer de 0 on fait comment ? Il faut que tout soit APIfié. Tout ! chaque partenaire, chaque lib externe.

use-case lms : j'ai un schema.erd.md à la racine du projet, mais le vrai est dans 1.05_erd.md. Il faudrait de la détection de proximité sémantique de fichier (ML ou code direct ?) + prise en compte de timestamp pour suggérer les fichiers quasi doublons (mais pas vraiment) et supprimer vraiment les docs legacy

cas problématique sur les scripts : le LLM peut les exécuter et pas moi. Mauvais gestion des versions, problème de capture d'erreur. Il faut une stratégie claire de captures d'erreurs dans TOUT le projet !

Et sur le même sujet j'ai dû ajouté un dev container tpb_system (je ne pouvais pas moi même exécuter les scripts mais le LLM si). Du coup toutes les apps TPB l'ont - pas sûr que ça soit un check si important à ajouter, mais pour l'exhaustivité si il faut l'ajouter à la méthodologie d'audit golive

gestions des ticks -> ça crée trop de souci de laisser n'importe quel type de tick. On peut mettre une règle type linting dans notre entropy checker pour que ça soit bien cleaner ??

je suis sûr que j'ai dû le mettre plus haut, mais faut ajouter multi-lingue, multi-locale, multi-currency partout quand c'est applicable

j'ai mis à plusieurs endroits le besoin de faire des checks de performance. Mais est-ce qu'on a une vraie belle couche d'alerting ? J'imagine qu'avec nos workers CF on a des limites ? (bundle size ? nombre de connexions simultanées ? bandwidth ? websockets ?). Quand est-ce que la bdd va exploser ? Il faudrait clairement qu'on ait du monitoring technique avancer. Pas en mode dashboard stylé -> en mode ALERT 80% de la limite atteinte !

CI/CD -> on a parlé des trucs agentiques. Mais 1. ça n'a pas détecté que le code était pas sur github 2. on veut une vraie CI/CD gold standard qui utilise github actions, branché sur des tests, avec du HITL pour valider, etc., la totale. Déploiement versionné ? timestampé ? taggé si nécessaire ? releases ? changelog ?

⚠️ Hyper important, ce que je viens de faire pour IAM. J'ai demandé une doc détaillé de l'UI, UX. Bien structurée etc. Mais surtout, après son premier jet, j'ai demandé : c'est quoi les limites des outils du marché ? comment les adresser pour faire un peu mieux et adresser les pain points encore non adressé ? Il m'a fait des propositions de fou. Il m'a filé "Opportunités de différenciation TPB Vault" en 7 idées -> BANGER (ex: "Explain Mode" - L'IAM qui s'explique, "Access Graph" - Visualisation interactive, "Drift Detection" - Sync proactive, "Audit Stories" - Logs narratifs, "What-If Simulator", "Policy as Natural Language")

concernant les meilleures pratiques de tracking d'erreur (objectif : voir les erreurs avant que les utilisateurs ne le remontent), je ne sais pas vraiment comment faire. Des recherches naïves m'envoient sur sentry et je crois que ça va résoudre mes problèmes, et en fait pas du tout. Il y a un sujet clair d'architecture de code pour collecter les erreurs. D'autres recherches naïves m'ont fait croire que Typescript était la solution : pas du tout ! mes conventions JS était déjà assez fortes pour que typescript n'apporte absolument rien de ce côté (jamais typescript ne m'a aidé à détecter des erreurs camouflées.). Une autre piste c'est les tests, mais c'est pas juste réaliste de tout tester tout le temps humainement. Et les tests automatisés ne testent que ce qu'ils testent... Côté backend j'ai résolu clairement ce souci (voir ubar-backend -> pipeline stricte pour exposer les endpoints, collectent d'erreurs centralisées dans chaque handlers et erreurs réseaux peuvent être capturées dans controllers). Côté frontend j'ai toujours le souci -> des erreurs non capturées et silencieuses qui cachent des gros soucis. 


j'ai dit plusieurs fois, à plein d'endroit qu'il fallait être enterprise-ready pour du multi-tenant, mais j'ai l'impression que ça a juste impacté très légèrement les ERD. C'est bien plus vaste le multi-tenant -> il faut penser à comment déployer une app qui existe déjà sur un tenant cloudflare (back, front, db, ops) qui nous appartient pas mais auquel on a accès (pour pouvoir màj). C'est normalement hyper compliqué, mais on a la main sur le code de notre vault. Si on gère ça intelligemment dès maintenant (devops / platform enterprise grade avec gestion TOP0,0001% des déploiements multi-tenants), alors ça peut le faire ! On n'a choisi cloudflare justement pour pouvoir faire ça. Par contre côté CI/CD c'est un beau bébé aussi, il faut des conventions claires, de la gestion de branches, de l'attribution aux organisations enterprise clientes etc. Ca a l'air complexe mais si on regarde nos briques devops et notre vault iam, je pense qu'on peut faire quelque chose de très puissant sans trop de maintenance overhead. Un gros focus devra être mis sur les scripts de routine, de cleaning, de sync, etc. en gros tout ce qui est "drift detection" et "drift prevention". Aussi comment ça marche la stratégie de fix ? Je le vois venir gros comme une maison ce souci, c'est un souci classique "multi point d'entrées, besoin de bi-sync -> entropie et dette crée" là concrètement on a x point d'entrées par branches, par orga etc. Comment on fait pour avoir un process hyper linéaire (ex: interdiction de toucher au code pour chaque orga, on leur fournit juste des tenants, versionnées s'ils le veulent, mais tout code custom doit être évité, et s'il y en a c'est mergé sur la branch master et pas "juste pour eux".) C'est un peu un mélange de "multi-clients" et "multi-tenants" et c'est de la grosse CI/CD. Mais il faut absolument figer les pratiques dès maintenant sinon on va se manger les pieds dans le tapis. Ce sujet doit être répercuté sur les db aussi, et surtout sur les db. Les enterprises veulent leurs infra mais aussi leurs db. COmment on fait si on n'y a pas accès ? comment les routines tournent ? comment on route etc. ? L'idée n'est pas de se dire "orf c'est compliqué". On veut un framework qui enlève toute entropie avec des compromis bien pensé pour que toute cette complexité disparaisse totalement by design !

cron stratégie doit être capitalisée. C'est souvent sans réfléchir à ça qu'on est couplé à une infra (voir vault on va faire ça bien): 
flowchart TB
    subgraph triggers [Schedulers - Infrastructure Layer]
        CFCron[CF Cron Trigger]
        NodeCron[node-cron VPS]
        ModalCron[Modal @cron - futur]
        ManualHTTP[Manual HTTP Call]
    end
    
    subgraph api [HTTP Layer - Universal Interface]
        JobEndpoint[POST /jobs/run/:jobName]
    end
    
    subgraph jobs [Business Layer - Pure Functions]
        DriftJob[driftDetectionJob]
        OrphanJob[orphanCleanupJob]
        RetryJob[syncRetryJob]
    end
    
    CFCron -->|"scheduled()"| JobEndpoint
    NodeCron -->|"HTTP call"| JobEndpoint
    ModalCron -->|"HTTP call"| JobEndpoint
    ManualHTTP -->|"HTTP call"| JobEndpoint
    
    JobEndpoint --> DriftJob
    JobEndpoint --> OrphanJob
    JobEndpoint --> RetryJob


- côté data on a parlé cleaning, routines de drift, d'observabilité etc, et il faut vraiment que ça soit complet. Mais on n'a pas parlé de requêtages -> on doit anticiper d'avances les besoins de requêtages, créer des index, sharder les db correctement, archiver etc. Il nous faudrait une logique de sharding opinionated pour pas avoir à faire le travail à chaque fois (ex: ça suffit pas dans 90% des cas de sharder par temporalité par hasard ? en fonction du volument 1 db par semaine / mois/ trimestre / année ? C'est quoi les compromis ? temps de requêtages ? A l'air de l'IA qui mets des secondes pour tout faire et le besoin de pagination qui arrive bien avant que la db explose, j'ai l'impression qu'on peut trouver une solution qui colle à 100% des cas tout en étant toujours hyper scalable, non ?)

- pour TDD j'ai assez souffert : aucun LLM n'est capable de faire ça (même Opus4.5 est un enfer). Ils passent toujours les tests rouges à verts pour avancer c'est pas du tout gérable. Ce qui prouve un truc : tout le monde en parle, personne ne le fait ! sinon un Opus4.5 qui fait le café saurait ne pas tomber dans ce piège !! J'ai vraiment tenté beaucoup de choses : mettre les directives "ça doit rester rouge" en commentaires et tout, rien n'y fait. Laissons tomber TDD totalement !


il faut un check qui détecte toute notion de "sync" et de "bisync" dans le projet pour adresser un sujet classique et structurant dans la réduction d'entropie / le framework TPB : on ne fait JAMAIS de sync. On veut que tout soit du push unidirectionnel. Ca force à se poser les questions : qui est maître, qui est esclave ? Qui est le SSOT ? Est-ce que les flux sont bien linéaires ? C'est quasiment la définition de l'entropie ces erreurs ! et l'IA ADORE faire des syncs donc il faut absolument adresser ce sujet systématiquement sur tous les front (dev, devops, process humain, flux UX etc.)


complétion des tests : il faudrait un guide pour compléter les tests. 1. lister les features 2. identifier les happy path 3. identifier les sad path 4. lister edge cases -> 5. lister une batterie de tests. Je suis sûr qu'en faisant ça on identifiera plein de tests qui cassent. 6. demander à Opus4.5 de faire une passe pour identifier les faux tests (qui se testent eux mêmes ou test des mocks ou pas bien branchés), les tests qui sont bypassés, les tests vides "documentés"

en faisant le endpoints vault/import/orphans, je réalise quelque chose qui est clé : scripts VS endpoints ça devrait être très cadré. On devrait mettre dans les scripts uniquement ce qui est bootstrap / chicken-egg. Exemple : l'appli qui se déploie elle-même, c'est du meta / chicken-egg. Par contre un script d'import qu'on veut laisser hors du backend (car risque de confusion sur l'aspect linéaire vault -> CF, et on veut pas CF -> vault) car on veut que les devops / humain le fasse, et bien... Ca devrait pas être un script car demain on devra migrer le script vers un dashboard dev si on veut une UI. Il faut vraiment penser API readyness 100%. Donc les scripts, ça devrait être uniquement du devops. Et on pourrait donc mettre dans chaque projet backend une route "tools/" pour les anciens "scripts" qui n'ont pas encore trouvé leur place dans la route api. Ainsi on a le meilleur de tout les mondes : on continue de capitaliser tout ce qu'on fait en historique scripté, mais en même temps on a un wrapper (bien protégé !!) qui permet de taper dessus par API. Pas mal, non ?

je réalise qu'un truc était pas clair -> le truc que teams a mis du temps à faire, c'est pas le multi tenant / multi orga mais vraiment le MULTI COMPTE !! faisons le automatiquement nous aussi !!!! on veut qu'un utilisateur puisse facilement switcher de compte sur toutes nos applis. Ca lui permettra d'avoir les profils qu'il veut et tout sans galère. par contre faut pas que ça nous ajoute de la maintenance. Comme tout ce qu'on fait, faut réfléchir dans notre framework d'app à ce que ça soit bien fait une fois et ensuite 0 galère.

dans le backend y'a des erreurs car html templating. Faut vraiment extraire TOUT ce que j'avais de bien dans mon backend (templating html avec je sais plus quelle lib mais ça marchait très bien). En gros faut passer sur les libs des projets déjà fait, voir pourquoi et comment elles sont utilisées, voir si c'est encore nécessaire (on a bougé pas mal en passant à TS, au vibe coding etc.), et si intéressant le garder dans notre squelette de front / back

Beaucoup de choses dans ma façon de coder ne sont pas vraiment du détail : bonne utilisation du spread operator, déconstruction ES6 nesté avancé qui facilite grandement la lecture, jamais de let, jamais de for (map, filter, reduece), les structures sont toujours des collections (array d'objet) -> tout ça fait du code propre et doit être utilisé systématiquement (il faut des entropy checks pour enforce ça)