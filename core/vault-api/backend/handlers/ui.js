/**
 * UI Handlers for vault-api
 * Minimal frontend for zero-secret developer onboarding
 * 
 * TPB Design System:
 * - Background: #0A0A0A
 * - Foreground: #FAFAFA
 * - Card: #171717
 * - Border: #262626
 * - Accent: #FFD700 (gold)
 * - Brand Blue: #0057FF
 * - Brand Purple: #6A00F4
 */

// Shared styles
const TPB_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono&display=swap');
  
  :root {
    --background: #0A0A0A;
    --foreground: #FAFAFA;
    --card: #171717;
    --card-hover: #1f1f1f;
    --border: #262626;
    --muted: #A3A3A3;
    --accent: #FFD700;
    --brand-blue: #0057FF;
    --brand-purple: #6A00F4;
    --destructive: #EF4444;
    --success: #22C55E;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--background);
    color: var(--foreground);
    min-height: 100vh;
    line-height: 1.6;
  }
  
  h1, h2, h3 {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-weight: 600;
  }
  
  code, pre, .mono {
    font-family: 'JetBrains Mono', monospace;
  }
  
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    text-decoration: none;
  }
  
  .btn-primary {
    background: var(--foreground);
    color: var(--background);
  }
  
  .btn-primary:hover {
    background: #e5e5e5;
    transform: scale(1.02);
  }
  
  .btn-accent {
    background: var(--accent);
    color: var(--background);
  }
  
  .btn-accent:hover {
    background: #e6c200;
    transform: scale(1.02);
  }
  
  .btn-destructive {
    background: var(--destructive);
    color: white;
  }
  
  .btn-destructive:hover {
    background: #dc2626;
  }
  
  .btn-ghost {
    background: transparent;
    color: var(--foreground);
    border: 1px solid var(--border);
  }
  
  .btn-ghost:hover {
    background: var(--card);
  }
  
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  
  .code-block {
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 1rem;
    overflow-x: auto;
    position: relative;
  }
  
  .code-block pre {
    margin: 0;
    font-size: 0.875rem;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  .copy-btn {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
  
  .text-muted {
    color: var(--muted);
  }
  
  .text-accent {
    color: var(--accent);
  }
  
  .text-success {
    color: var(--success);
  }
  
  .text-destructive {
    color: var(--destructive);
  }
  
  .flex {
    display: flex;
  }
  
  .flex-col {
    flex-direction: column;
  }
  
  .items-center {
    align-items: center;
  }
  
  .justify-between {
    justify-content: space-between;
  }
  
  .gap-2 {
    gap: 0.5rem;
  }
  
  .gap-4 {
    gap: 1rem;
  }
  
  .mt-2 {
    margin-top: 0.5rem;
  }
  
  .mt-4 {
    margin-top: 1rem;
  }
  
  .mb-4 {
    margin-bottom: 1rem;
  }
  
  .mb-8 {
    margin-bottom: 2rem;
  }
  
  .logo {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    font-weight: 700;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .logo-icon {
    width: 32px;
    height: 32px;
    background: linear-gradient(135deg, var(--brand-blue), var(--brand-purple));
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .badge-success {
    background: rgba(34, 197, 94, 0.2);
    color: var(--success);
  }
  
  .badge-warning {
    background: rgba(255, 215, 0, 0.2);
    color: var(--accent);
  }
  
  .token-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
  }
  
  .token-item:hover {
    border-color: var(--muted);
  }
  
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--muted);
    border-top-color: var(--foreground);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .hero {
    text-align: center;
    padding: 4rem 2rem;
  }
  
  .hero h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  
  .hero p {
    color: var(--muted);
    font-size: 1.125rem;
    max-width: 500px;
    margin: 0 auto 2rem;
  }
  
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 3rem;
  }
  
  .feature {
    padding: 1.5rem;
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    text-align: left;
  }
  
  .feature h3 {
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .feature p {
    font-size: 0.875rem;
    color: var(--muted);
  }
  
  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--border);
  }
  
  .nav-links {
    display: flex;
    gap: 1rem;
  }
  
  .nav-links a {
    color: var(--muted);
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  .nav-links a:hover {
    color: var(--foreground);
  }
  
  .nav-links .logout-link {
    color: var(--destructive);
    margin-left: 0.5rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--destructive);
    border-radius: 0.375rem;
    transition: all 0.2s ease;
  }
  
  .nav-links .logout-link:hover {
    background: var(--destructive);
    color: white;
  }
  
  #generated-credentials {
    display: none;
  }
  
  #generated-credentials.show {
    display: block;
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .alert-success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: var(--success);
  }
  
  .alert-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--destructive);
  }
  
  .token-revoked {
    opacity: 0.5;
  }
  
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .badge-success {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success);
  }
  
  .badge-destructive {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
`;

/**
 * Landing Page (/)
 * Public - shows login button
 */
export function landingPage(request, env, ctx) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TPB Vault - IAM Console</title>
  <style>${TPB_STYLES}</style>
</head>
<body>
  <nav class="nav">
    <div class="logo">
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      TPB Vault
    </div>
    <div class="nav-links">
      <a href="/dashboard">Dashboard</a>
      <a href="/applications/dashboard">Applications</a>
      <a href="/health">Status</a>
      <a href="https://theplaybutton.cloudflareaccess.com/cdn-cgi/access/logout" class="logout-link">Déconnexion</a>
    </div>
  </nav>
  
  <div class="hero">
    <h1>Developer Access Portal</h1>
    <p>Authentifiez-vous via SSO pour générer vos credentials de développement. Aucun secret partagé.</p>
    
    <a href="/dashboard" class="btn btn-primary" style="font-size: 1rem; padding: 0.875rem 2rem;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
        <polyline points="10 17 15 12 10 7"></polyline>
        <line x1="15" y1="12" x2="3" y2="12"></line>
      </svg>
      Se connecter
    </a>
    
    <div class="features">
      <div class="feature">
        <h3>🔐 Zero-Secret</h3>
        <p>Aucun secret n'est partagé. Vous générez vos propres credentials après authentification SSO.</p>
      </div>
      <div class="feature">
        <h3>🔑 Service Tokens</h3>
        <p>Tokens personnels pour le Dev Container. Rotation et révocation en self-service.</p>
      </div>
      <div class="feature">
        <h3>📋 Copier-Coller</h3>
        <p>Credentials formatés pour .devcontainer/.env. Un clic pour copier.</p>
      </div>
    </div>
  </div>
  
  <footer style="text-align: center; padding: 2rem; color: var(--muted); font-size: 0.875rem;">
    <p>The Play Button &copy; 2025</p>
  </footer>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Dashboard (/dashboard)
 * Protected - requires CF Access auth
 */
export function dashboard(request, env, ctx) {
  // Get user info from CF Access JWT
  const userEmail = ctx.actor?.email || ctx.actor?.id || 'Utilisateur';
  
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - TPB Vault</title>
  <style>${TPB_STYLES}</style>
</head>
<body>
  <nav class="nav">
    <div class="logo">
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      TPB Vault
    </div>
    <div class="nav-links">
      <a href="/dashboard">Tokens</a>
      <a href="/applications/dashboard">Applications</a>
      <a href="/cloudflare/dashboard">Cloudflare</a>
      <span class="text-muted">${userEmail}</span>
      <a href="https://theplaybutton.cloudflareaccess.com/cdn-cgi/access/logout" class="logout-link">Déconnexion</a>
    </div>
  </nav>
  
  <div class="container" style="padding-top: 2rem;">
    <h1 class="mb-4">Mes Service Tokens</h1>
    <p class="text-muted mb-8">Générez un token pour votre Dev Container. Le token vous donne accès aux secrets d'infrastructure.</p>
    
    <!-- Alert container -->
    <div id="alert-container"></div>
    
    <!-- Generate Token Section -->
    <div class="card">
      <div class="flex justify-between items-center">
        <div>
          <h2 style="font-size: 1.125rem; margin-bottom: 0.25rem;">Générer un nouveau token</h2>
          <p class="text-muted" style="font-size: 0.875rem;">Le token sera automatiquement autorisé sur vault-api</p>
        </div>
        <button id="generate-btn" class="btn btn-accent" onclick="generateToken()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Générer
        </button>
      </div>
    </div>
    
    <!-- Generated Credentials (hidden by default) -->
    <div id="generated-credentials" class="card" style="border-color: var(--success);">
      <div class="flex justify-between items-center mb-4">
        <h2 style="font-size: 1.125rem;">
          <span class="text-success">✓</span> Token généré !
        </h2>
        <span class="badge badge-success">Nouveau</span>
      </div>
      
      <p class="text-muted mb-4" style="font-size: 0.875rem;">
        Copiez ce contenu dans <code>.devcontainer/.env</code> puis rebuild le container.
      </p>
      
      <div class="code-block">
        <button class="btn btn-ghost copy-btn" onclick="copyEnvFile()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copier
        </button>
        <pre id="env-content"></pre>
      </div>
      
      <p class="text-muted mt-4" style="font-size: 0.75rem;">
        ⚠️ Le secret ne sera plus jamais affiché. Gardez-le en sécurité.
      </p>
    </div>
    
    <!-- Existing Tokens -->
    <div class="card mt-4">
      <h2 style="font-size: 1.125rem; margin-bottom: 1rem;">Tokens actifs</h2>
      <div id="tokens-list">
        <div class="flex items-center justify-center gap-2 text-muted" style="padding: 2rem;">
          <div class="spinner"></div>
          Chargement...
        </div>
      </div>
    </div>
    
    <!-- Help Section -->
    <div class="card mt-4" style="background: transparent; border-color: var(--border);">
      <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">Besoin d'aide ?</h3>
      <ol class="text-muted" style="font-size: 0.875rem; padding-left: 1.25rem;">
        <li>Générez un token ci-dessus</li>
        <li>Copiez le contenu dans <code>.devcontainer/.env</code></li>
        <li>Dans VS Code: <kbd>Cmd+Shift+P</kbd> → "Dev Containers: Rebuild Container"</li>
        <li>Votre environnement aura accès aux secrets d'infrastructure</li>
      </ol>
    </div>
  </div>
  
  <script>
    const API_BASE = '';
    
    // Load tokens on page load
    document.addEventListener('DOMContentLoaded', loadTokens);
    
    async function loadTokens() {
      try {
        const resp = await fetch('/iam/service-tokens', { credentials: 'include' });
        const data = await resp.json();
        
        const container = document.getElementById('tokens-list');
        
        if (!data.tokens || data.tokens.length === 0) {
          container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">Aucun token actif</p>';
          return;
        }
        
        container.innerHTML = data.tokens.map(token => \`
          <div class="token-item \${!token.active ? 'token-revoked' : ''}">
            <div>
              <div style="font-weight: 500; display: flex; align-items: center; gap: 0.5rem;">
                \${token.name}
                <span class="badge \${token.active ? 'badge-success' : 'badge-destructive'}" style="font-size: 0.625rem;">
                  \${token.active ? 'Actif' : 'Révoqué'}
                </span>
              </div>
              <div class="text-muted" style="font-size: 0.75rem;">
                \${token.active 
                  ? \`Créé le \${new Date(token.created_at).toLocaleDateString('fr-FR')}\`
                  : \`Révoqué le \${new Date(token.revoked_at).toLocaleDateString('fr-FR')}\`
                }
              </div>
            </div>
            \${token.active ? \`
              <button class="btn btn-ghost btn-destructive" onclick="revokeToken('\${token.id}')" style="font-size: 0.75rem; padding: 0.375rem 0.75rem;">
                Révoquer
              </button>
            \` : ''}
          </div>
        \`).join('');
      } catch (err) {
        document.getElementById('tokens-list').innerHTML = 
          '<p class="text-destructive" style="text-align: center; padding: 1rem;">Erreur de chargement</p>';
      }
    }
    
    async function generateToken() {
      const btn = document.getElementById('generate-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div> Génération...';
      
      try {
        const resp = await fetch('/iam/service-tokens', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        const data = await resp.json();
        
        if (!resp.ok) {
          throw new Error(data.error || 'Erreur lors de la génération');
        }
        
        // Show credentials
        document.getElementById('env-content').textContent = data.env_file;
        document.getElementById('generated-credentials').classList.add('show');
        
        // Scroll to credentials
        document.getElementById('generated-credentials').scrollIntoView({ behavior: 'smooth' });
        
        // Reload tokens list
        loadTokens();
        
        showAlert('Token généré avec succès !', 'success');
      } catch (err) {
        showAlert(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = \`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Générer
        \`;
      }
    }
    
    async function revokeToken(tokenId) {
      if (!confirm('Êtes-vous sûr de vouloir révoquer ce token ?')) return;
      
      try {
        const resp = await fetch(\`/iam/service-tokens/\${tokenId}\`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.error || 'Erreur lors de la révocation');
        }
        
        showAlert('Token révoqué', 'success');
        loadTokens();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
    
    async function copyEnvFile() {
      const content = document.getElementById('env-content').textContent;
      try {
        await navigator.clipboard.writeText(content);
        showAlert('Copié dans le presse-papier !', 'success');
      } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showAlert('Copié !', 'success');
      }
    }
    
    function showAlert(message, type) {
      const container = document.getElementById('alert-container');
      const alert = document.createElement('div');
      alert.className = \`alert alert-\${type}\`;
      alert.textContent = message;
      container.appendChild(alert);
      
      setTimeout(() => {
        alert.remove();
      }, 3000);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/**
 * Applications Dashboard (/applications/dashboard)
 * Admin-only - Manage registered TPB applications
 */
export function applicationsDashboard(request, env, ctx) {
  // Guard: Only superadmin
  if (ctx.actor?.role !== 'superadmin') {
    return new Response('Forbidden - Superadmin required', { status: 403 });
  }
  
  const userEmail = ctx.actor?.id || 'Admin';
  
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Applications - TPB Vault</title>
  <style>${TPB_STYLES}
    .app-grid {
      display: grid;
      gap: 1rem;
    }
    
    .app-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.625rem;
      padding: 1.5rem;
      transition: border-color 0.2s;
    }
    
    .app-card:hover {
      border-color: var(--muted);
    }
    
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
    }
    
    .app-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, var(--brand-blue), var(--brand-purple));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
    }
    
    .app-meta {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
      font-size: 0.75rem;
      color: var(--muted);
    }
    
    .app-meta span {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    
    .scopes-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      margin-top: 0.5rem;
    }
    
    .scope-tag {
      background: rgba(255, 215, 0, 0.1);
      color: var(--accent);
      padding: 0.125rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.625rem;
      font-family: 'JetBrains Mono', monospace;
    }
    
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    
    .modal.show {
      display: flex;
    }
    
    .modal-content {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 2rem;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    .form-group label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.375rem;
    }
    
    .form-group input, .form-group textarea, .form-group select {
      width: 100%;
      background: var(--background);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.625rem;
      color: var(--foreground);
      font-size: 0.875rem;
    }
    
    .form-group input:focus, .form-group textarea:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .form-hint {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 0.25rem;
    }
    
    .checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: var(--background);
      padding: 0.375rem 0.625rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      cursor: pointer;
    }
    
    .checkbox-item:has(input:checked) {
      background: rgba(255, 215, 0, 0.1);
      color: var(--accent);
    }
    
    .checkbox-item input {
      width: auto;
    }
    
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--muted);
    }
    
    .stats-row {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1rem 1.5rem;
      flex: 1;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 600;
      font-family: 'Space Grotesk', sans-serif;
    }
    
    .stat-label {
      font-size: 0.75rem;
      color: var(--muted);
    }
    
    .badge-destructive {
      background: rgba(239, 68, 68, 0.2);
      color: var(--destructive);
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="logo">
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      </div>
      TPB Vault
    </div>
    <div class="nav-links">
      <a href="/dashboard">Tokens</a>
      <a href="/applications/dashboard" style="color: var(--foreground);">Applications</a>
      <a href="/cloudflare/dashboard">Cloudflare</a>
      <span class="text-muted">${userEmail}</span>
      <a href="https://theplaybutton.cloudflareaccess.com/cdn-cgi/access/logout" class="logout-link">Déconnexion</a>
    </div>
  </nav>
  
  <div class="container" style="padding-top: 2rem; max-width: 1000px;">
    <div class="flex justify-between items-center mb-4">
      <div>
        <h1>Applications TPB</h1>
        <p class="text-muted">Gérez les applications autorisées à utiliser leur propre IAM</p>
      </div>
      <button class="btn btn-accent" onclick="showCreateModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Nouvelle Application
      </button>
    </div>
    
    <!-- Alert container -->
    <div id="alert-container"></div>
    
    <!-- Stats -->
    <div class="stats-row" id="stats-row">
      <div class="stat-card">
        <div class="stat-value" id="stat-total">-</div>
        <div class="stat-label">Applications</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-active">-</div>
        <div class="stat-label">Actives</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="stat-resources">-</div>
        <div class="stat-label">Ressources IAM</div>
      </div>
    </div>
    
    <!-- Applications Grid -->
    <div class="app-grid" id="apps-grid">
      <div class="flex items-center justify-center gap-2 text-muted" style="padding: 4rem;">
        <div class="spinner"></div>
        Chargement...
      </div>
    </div>
  </div>
  
  <!-- Create Modal -->
  <div class="modal" id="create-modal">
    <div class="modal-content">
      <h2 style="margin-bottom: 1.5rem;">Nouvelle Application</h2>
      
      <form id="create-form" onsubmit="createApplication(event)">
        <div class="form-group">
          <label>Nom (namespace) *</label>
          <input type="text" name="name" placeholder="ex: lms" pattern="^[a-z][a-z0-9_]{2,20}$" required>
          <div class="form-hint">Minuscules, 3-20 caractères. Sera utilisé comme préfixe (lms_*)</div>
        </div>
        
        <div class="form-group">
          <label>Nom d'affichage</label>
          <input type="text" name="display_name" placeholder="ex: Learning Management System">
        </div>
        
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" rows="2" placeholder="Description de l'application..."></textarea>
        </div>
        
        <div class="form-group">
          <label>Scopes *</label>
          <div class="checkbox-group" id="scopes-checkboxes">
            <!-- Will be populated by JS based on namespace -->
          </div>
          <div class="form-hint">Permissions accordées à l'application</div>
        </div>
        
        <div class="form-group">
          <label>Email de contact</label>
          <input type="email" name="contact_email" placeholder="dev@example.com">
        </div>
        
        <div class="flex gap-2" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-ghost" onclick="hideModal('create-modal')">Annuler</button>
          <button type="submit" class="btn btn-accent" id="create-btn">Créer l'application</button>
        </div>
      </form>
    </div>
  </div>
  
  <!-- Credentials Modal -->
  <div class="modal" id="credentials-modal">
    <div class="modal-content">
      <h2 style="margin-bottom: 0.5rem;">
        <span class="text-success">✓</span> Application créée !
      </h2>
      <p class="text-muted mb-4" style="font-size: 0.875rem;">
        Copiez ces credentials. Ils ne seront plus jamais affichés.
      </p>
      
      <div class="code-block">
        <button class="btn btn-ghost copy-btn" onclick="copyCredentials()">Copier</button>
        <pre id="credentials-content"></pre>
      </div>
      
      <div class="alert alert-error mt-4" style="font-size: 0.75rem;">
        ⚠️ Stockez ces credentials de manière sécurisée. Le secret ne pourra pas être récupéré.
      </div>
      
      <button class="btn btn-primary mt-4" onclick="hideModal('credentials-modal')" style="width: 100%;">
        J'ai copié les credentials
      </button>
    </div>
  </div>
  
  <!-- Details Modal -->
  <div class="modal" id="details-modal">
    <div class="modal-content" style="max-width: 600px;">
      <div id="details-content">Loading...</div>
    </div>
  </div>
  
  <script>
    // Load applications on page load
    document.addEventListener('DOMContentLoaded', loadApplications);
    
    // Update scopes checkboxes when namespace changes
    document.querySelector('input[name="name"]').addEventListener('input', updateScopesCheckboxes);
    
    function updateScopesCheckboxes() {
      const namespace = document.querySelector('input[name="name"]').value || 'app';
      const container = document.getElementById('scopes-checkboxes');
      const scopeTypes = ['role', 'permission', 'group', 'user'];
      
      container.innerHTML = scopeTypes.map(type => \`
        <label class="checkbox-item">
          <input type="checkbox" name="scopes" value="\${namespace}:\${type}:*" checked>
          \${namespace}:\${type}:*
        </label>
      \`).join('') + \`
        <label class="checkbox-item">
          <input type="checkbox" name="scopes" value="\${namespace}:*">
          \${namespace}:* (all)
        </label>
      \`;
    }
    
    // Initialize with default
    updateScopesCheckboxes();
    
    async function loadApplications() {
      try {
        const resp = await fetch('/iam/applications', { credentials: 'include' });
        const data = await resp.json();
        
        if (!resp.ok) throw new Error(data.error);
        
        const apps = data.applications || [];
        
        // Update stats
        document.getElementById('stat-total').textContent = apps.length;
        document.getElementById('stat-active').textContent = apps.filter(a => a.status === 'active').length;
        document.getElementById('stat-resources').textContent = apps.reduce((sum, a) => 
          sum + (a.resources?.roles || 0) + (a.resources?.permissions || 0) + (a.resources?.groups || 0), 0);
        
        // Render grid
        const container = document.getElementById('apps-grid');
        
        if (!apps.length) {
          container.innerHTML = \`
            <div class="empty-state">
              <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
              <h3>Aucune application</h3>
              <p>Créez votre première application pour commencer</p>
            </div>
          \`;
          return;
        }
        
        container.innerHTML = apps.map(app => \`
          <div class="app-card">
            <div class="app-header">
              <div style="display: flex; gap: 1rem; align-items: center;">
                <div class="app-icon">\${app.display_name?.[0]?.toUpperCase() || '?'}</div>
                <div>
                  <h3 style="margin: 0; font-size: 1.125rem;">\${app.display_name || app.name}</h3>
                  <code class="text-muted" style="font-size: 0.75rem;">\${app.namespace}:*</code>
                </div>
              </div>
              <span class="badge \${app.status === 'active' ? 'badge-success' : 'badge-destructive'}">
                \${app.status}
              </span>
            </div>
            
            <p class="text-muted" style="font-size: 0.875rem; margin-bottom: 0.75rem;">
              \${app.description || 'Aucune description'}
            </p>
            
            <div class="scopes-list">
              \${(app.scopes || []).map(s => \`<span class="scope-tag">\${s}</span>\`).join('')}
            </div>
            
            <div class="app-meta">
              <span>📊 \${app.resources?.roles || 0} roles</span>
              <span>🔑 \${app.resources?.permissions || 0} permissions</span>
              <span>👥 \${app.resources?.groups || 0} groups</span>
            </div>
            
            <div class="flex gap-2 mt-4">
              <button class="btn btn-ghost" style="flex:1; font-size: 0.75rem;" onclick="showDetails('\${app.id}')">
                Détails
              </button>
              \${app.status === 'active' ? \`
                <button class="btn btn-ghost" style="font-size: 0.75rem;" onclick="rotateCredentials('\${app.id}')">
                  🔄 Rotation
                </button>
                <button class="btn btn-ghost text-destructive" style="font-size: 0.75rem;" onclick="revokeApp('\${app.id}')">
                  Révoquer
                </button>
              \` : ''}
            </div>
          </div>
        \`).join('');
        
      } catch (err) {
        document.getElementById('apps-grid').innerHTML = 
          '<p class="text-destructive" style="text-align: center; padding: 2rem;">Erreur de chargement</p>';
      }
    }
    
    function showCreateModal() {
      document.getElementById('create-modal').classList.add('show');
    }
    
    function hideModal(id) {
      document.getElementById(id).classList.remove('show');
    }
    
    async function createApplication(event) {
      event.preventDefault();
      const form = event.target;
      const btn = document.getElementById('create-btn');
      
      btn.disabled = true;
      btn.textContent = 'Création...';
      
      try {
        const formData = new FormData(form);
        const scopes = formData.getAll('scopes');
        
        const resp = await fetch('/iam/applications', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.get('name'),
            display_name: formData.get('display_name'),
            description: formData.get('description'),
            scopes,
            contact_email: formData.get('contact_email')
          })
        });
        
        const data = await resp.json();
        
        if (!resp.ok) throw new Error(data.error);
        
        // Show credentials modal
        document.getElementById('credentials-content').textContent = data.env_file;
        hideModal('create-modal');
        document.getElementById('credentials-modal').classList.add('show');
        
        // Reset form and reload
        form.reset();
        updateScopesCheckboxes();
        loadApplications();
        
        showAlert('Application créée avec succès !', 'success');
        
      } catch (err) {
        showAlert(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = "Créer l'application";
      }
    }
    
    async function rotateCredentials(appId) {
      if (!confirm('Êtes-vous sûr ? Les anciens credentials seront immédiatement révoqués.')) return;
      
      try {
        const resp = await fetch(\`/iam/applications/\${appId}/rotate-credentials\`, {
          method: 'POST',
          credentials: 'include'
        });
        
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
        
        // Show new credentials
        document.getElementById('credentials-content').textContent = 
          \`# Rotated credentials - \${data.rotated_at}\\nAPP_VAULT_CLIENT_ID=\${data.credentials.client_id}\\nAPP_VAULT_CLIENT_SECRET=\${data.credentials.client_secret}\`;
        document.getElementById('credentials-modal').classList.add('show');
        
        showAlert('Credentials rotated successfully', 'success');
        
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
    
    async function revokeApp(appId) {
      if (!confirm('Êtes-vous sûr de vouloir révoquer cette application ?')) return;
      
      try {
        const resp = await fetch(\`/iam/applications/\${appId}\`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (!resp.ok) {
          const data = await resp.json();
          throw new Error(data.error);
        }
        
        showAlert('Application révoquée', 'success');
        loadApplications();
        
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
    
    async function showDetails(appId) {
      document.getElementById('details-modal').classList.add('show');
      document.getElementById('details-content').innerHTML = '<div class="spinner"></div> Chargement...';
      
      try {
        const resp = await fetch(\`/iam/applications/\${appId}\`, { credentials: 'include' });
        const data = await resp.json();
        
        if (!resp.ok) throw new Error(data.error);
        
        const app = data.application;
        
        document.getElementById('details-content').innerHTML = \`
          <div class="flex justify-between items-center mb-4">
            <h2>\${app.display_name || app.name}</h2>
            <button class="btn btn-ghost" onclick="hideModal('details-modal')">✕</button>
          </div>
          
          <div class="mb-4">
            <div class="text-muted" style="font-size: 0.75rem;">Namespace</div>
            <code>\${app.namespace}</code>
          </div>
          
          <div class="mb-4">
            <div class="text-muted" style="font-size: 0.75rem;">Scopes</div>
            <div class="scopes-list">
              \${(app.scopes || []).map(s => \`<span class="scope-tag">\${s}</span>\`).join('')}
            </div>
          </div>
          
          <div class="mb-4">
            <div class="text-muted" style="font-size: 0.75rem;">Roles créés</div>
            \${app.resources.roles.length ? app.resources.roles.map(r => \`
              <div style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.25rem; margin-top: 0.25rem;">
                <code>\${r.id}</code>
                <div class="text-muted" style="font-size: 0.75rem;">\${r.description || '-'}</div>
              </div>
            \`).join('') : '<p class="text-muted">Aucun role</p>'}
          </div>
          
          <div class="mb-4">
            <div class="text-muted" style="font-size: 0.75rem;">Permissions créées</div>
            \${app.resources.permissions.length ? app.resources.permissions.map(p => \`
              <div style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.25rem; margin-top: 0.25rem;">
                <code>\${p.action}:\${p.resource}</code>
              </div>
            \`).join('') : '<p class="text-muted">Aucune permission</p>'}
          </div>
          
          <div class="text-muted" style="font-size: 0.75rem;">
            Créé le \${new Date(app.created_at).toLocaleDateString('fr-FR')} par \${app.created_by_name || 'Unknown'}
          </div>
        \`;
        
      } catch (err) {
        document.getElementById('details-content').innerHTML = '<p class="text-destructive">Erreur de chargement</p>';
      }
    }
    
    function copyCredentials() {
      const content = document.getElementById('credentials-content').textContent;
      navigator.clipboard.writeText(content);
      showAlert('Copié !', 'success');
    }
    
    function showAlert(message, type) {
      const container = document.getElementById('alert-container');
      const alert = document.createElement('div');
      alert.className = \`alert alert-\${type}\`;
      alert.textContent = message;
      container.appendChild(alert);
      setTimeout(() => alert.remove(), 3000);
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
