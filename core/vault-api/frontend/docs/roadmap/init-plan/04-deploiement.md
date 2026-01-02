# Deploiement CF Worker

Le frontend est deploye comme un Cloudflare **Worker** (pas Pages). Il est compile en static export et servi par le Worker.

---

## Configuration wrangler.toml

```toml
name = "vault-frontend"
main = "worker.ts"
compatibility_date = "2024-12-01"

[site]
bucket = "./out"  # Next.js static export

[vars]
VAULT_API_URL = "https://vault-api.tpb.workers.dev"
```

---

## Worker Entry (worker.ts)

```typescript
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await getAssetFromKV({ request, waitUntil: ctx.waitUntil.bind(ctx) }, env);
    } catch (e) {
      // SPA fallback - serve index.html for client-side routing
      const url = new URL(request.url);
      url.pathname = '/index.html';
      return await getAssetFromKV({ request: new Request(url, request), waitUntil: ctx.waitUntil.bind(ctx) }, env);
    }
  },
};
```

---

## next.config.ts

```typescript
const nextConfig = {
  output: 'export',  // Static export pour CF Worker
  images: { unoptimized: true },
};

export default nextConfig;
```

---

## Build & Deploy

```bash
# Build static
npm run build

# Deploy to Cloudflare
wrangler deploy
```

---

## Deploy Continu

Chaque phase est deployable independamment :

1. Build (`next build` avec output: 'export')
2. Deploy CF Worker (`wrangler deploy`)
3. Feature flags si necessaire pour rollout progressif

