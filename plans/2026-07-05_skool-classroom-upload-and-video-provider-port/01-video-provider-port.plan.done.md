# Plan 01 — Port VideoProvider hexa + adapter Loom avec tracking — DONE

## Ce qui a été fait

Port hexagonal `VideoProvider` en place : la logique vidéo éparpillée (parseMediaUrl
if/else + videoSection branches + youtubeTracking isolé) est unifiée derrière une
interface, avec un adapter par host. Loom ajouté (embed + tracking player.js).

### Port + registry
- `app/video/providers/VideoProvider.js` — contrat (match / renderEmbed / initTracking).
- `app/video/providers/index.js` — registry `VIDEO_PROVIDERS` + `resolveProvider(media)`
  + `resolveProviderById(id)`.

### 4 adapters
- `youtubeProvider` — migré de la branche YouTube de videoSection + youtubeTracking
  (IFrame API). renderEmbed = iframe `youtube.com/embed?enablejsapi=1`, initTracking =
  onStateChange → onEvent/onPing.
- `loomProvider` (NOUVEAU) — renderEmbed = iframe `loom.com/embed/<id>`, initTracking =
  handshake **player.js** postMessage (subscribe timeupdate/play/pause/ended sur `ready`).
  Zéro dépendance npm (~40 LOC). Backend calcule la complétion depuis les pings → gating
  futur gratuit.
- `cloudflareProvider` — CF Stream SDK ; sync `trackingState.streamPlayer` + `isPlaying`
  pour préserver pause (tab hidden) + speed control.
- `mp4Provider` — `<video>` natif + timeupdate.

### Dispatchers thin + nettoyage
- `videoSection.js` → `resolveProviderById(ctx.videoProviderId).renderEmbed(...)`.
- `setupVideoTracking.js` → dispatch par `data-provider` → `provider.initTracking(el, hooks)`.
- `stopVideoTracking.js` → `activeTracker.destroy()`.
- `getVideoInfo` retourne la media brute ; `stepContext` résout le provider (évite un
  cycle d'import `_mediaHelpers` ↔ providers). `renderer`/`requirements` → `ctx.hasVideo`.
- `youtubeTracking.js` **supprimé** (migré). `parseMediaUrl` + source `loom`.
- Tests migrés en provider-based (youtube + loom match/renderEmbed + parseMediaUrl + getVideoInfo shape).

## Fichiers modifiés

- `app/video/providers/{VideoProvider,index,youtubeProvider,loomProvider,cloudflareProvider,mp4Provider}.js` (nouveaux)
- `app/video/tracking/{setupVideoTracking,stopVideoTracking,_shared}.js`
- `app/video/tracking/youtubeTracking.js` (SUPPRIMÉ)
- `app/course/renderer.functions/{videoSection,_mediaHelpers,stepContext,requirements}.js` + `renderer.js`
- `app/content/loader/parseMediaUrl.js` (+ loom)
- `app/init/globals.js` (commentaire)
- `app/course/renderer.functions/videoYoutube.test.js` (réécrit provider-based)

Commit : `de2e321`. Déploiement lms-viewer `04148ce7`.

## Résultat de validation

- ✅ **Loom live** : leçon seedée (Loom swap sur pw05-2 step01) → `.video-container` iframe
  `loom.com/embed/<id>`, `data-provider="loom"`, `data-loom-id` correct, non-locked. 0 erreur console.
- ✅ **Loom event surface** (tracking) : vérifié empiriquement que l'embed Loom parle
  player.js (`ready` liste `ready/play/pause/ended/timeupdate`) ; le provider subscribe au
  `ready` → timeupdate → onPing. Init sans erreur. (Le path user-play→complétion sera
  UAT au POC Plan 03 — un vrai clic déclenche la lecture.)
- ✅ **Non-régression CF Stream** : pw05-2 step02 → `iframe.cloudflarestream.com`,
  `data-provider="cloudflare"`, speed btn présent.
- ✅ Data de test **nettoyée** (§ LIVE TESTS auto-cleanup) : step01 restauré à l'identique
  (cloudflarestream présent, loom/[TEST] absents).
- ✅ `npx tsc --noEmit` 0 · `npm test` **187/187** (+3) · entropy `--last-status check` **RATCHET OK** (zéro ACK).
- ✅ tpb-browser : Loom rend + CF Stream inchangé, 0 erreur console (§ PLAN FRONTEND DONE).
