/**
 * Cloudflare Resources Handlers
 * Dashboard UI and JSON API for viewing CF resources (Access, Workers, Pages)
 * Filtered by organization for multi-tenant support
 */

import { json, error, success } from '../utils/response.js';
import { getCfResourcesService } from '../services/cfResources.js';

// Shared styles from ui.js
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
    max-width: 1200px;
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
  
  .mt-4 {
    margin-top: 1rem;
  }
  
  .mb-4 {
    margin-bottom: 1rem;
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
  
  .badge-info {
    background: rgba(0, 87, 255, 0.2);
    color: var(--brand-blue);
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
    align-items: center;
  }
  
  .nav-links a {
    color: var(--muted);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }
  
  .nav-links a:hover,
  .nav-links a.active {
    color: var(--foreground);
    background: var(--card);
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
  
  /* New components for CF dashboard */
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .stat-card {
    text-align: center;
    padding: 1.5rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.625rem;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 600;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--accent);
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: var(--muted);
    margin-top: 0.5rem;
  }
  
  .resource-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .resource-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 0.625rem;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .resource-card:hover {
    border-color: var(--brand-blue);
    transform: translateY(-2px);
  }
  
  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 0.75rem;
  }
  
  .resource-title {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }
  
  .resource-url {
    font-size: 0.75rem;
    color: var(--muted);
    font-family: 'JetBrains Mono', monospace;
  }
  
  .resource-meta {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  
  .resource-details {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    display: none;
  }
  
  .resource-card.expanded .resource-details {
    display: block;
  }
  
  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 2rem 0 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2rem;
    color: var(--muted);
  }
  
  .error-state {
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    color: var(--destructive);
    margin-bottom: 1rem;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--muted);
  }
  
  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }
  
  .detail-row:last-child {
    border-bottom: none;
  }
  
  .detail-label {
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .detail-value {
    font-size: 0.875rem;
    color: var(--muted);
    font-family: 'JetBrains Mono', monospace;
  }
  
  .bindings-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .binding-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--background);
    border-radius: 0.375rem;
    font-size: 0.75rem;
  }
  
  .binding-type {
    background: var(--brand-blue);
    color: white;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
    text-transform: uppercase;
  }
`;

/**
 * Get user's organization and cf_account_id
 */
async function getUserOrganization(env, ctx) {
  const actor = ctx.actor;
  
  if (!actor) {
    throw new Error('Authentication required');
  }
  
  // Service tokens use default org
  if (actor.type === 'service_token') {
    const org = await env.DB.prepare(`
      SELECT * FROM iam_organization WHERE id = ?
    `).bind('org_tpb').first();
    return org;
  }
  
  // Users: get their organization
  if (actor.type === 'user') {
    const org = await env.DB.prepare(`
      SELECT o.* FROM iam_organization o
      JOIN iam_user u ON u.organization_id = o.id
      WHERE u.email = ?
    `).bind(actor.id).first();
    return org;
  }
  
  throw new Error('Invalid actor type');
}

/**
 * Dashboard HTML page
 * GET /cloudflare/dashboard
 */
export async function dashboard(request, env, ctx) {
  try {
    const userEmail = ctx.actor?.email || ctx.actor?.id || 'Utilisateur';
    const organization = await getUserOrganization(env, ctx);
    
    if (!organization) {
      return error('Organization not found', 404, 'NOT_FOUND');
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare Resources - TPB Vault</title>
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
      <a href="/cloudflare/dashboard" class="active">Cloudflare</a>
      <span class="text-muted">${userEmail}</span>
    </div>
  </nav>
  
  <div class="container">
    <div class="flex justify-between items-center mb-4">
      <div>
        <h1>Cloudflare Resources</h1>
        <p class="text-muted">Organisation: ${organization.name}</p>
      </div>
      <button class="btn btn-ghost" onclick="refreshData()" id="refresh-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
        </svg>
        Actualiser
      </button>
    </div>
    
    <!-- Stats Overview -->
    <div id="stats-container">
      <div class="loading-state">
        <div class="spinner"></div>
        Chargement des statistiques...
      </div>
    </div>
    
    <!-- Cloudflare Access -->
    <div class="section-title">
      🔐 Cloudflare Access
      <span id="access-count" class="badge badge-info">0</span>
    </div>
    <div id="access-container">
      <div class="loading-state">
        <div class="spinner"></div>
        Chargement des applications Access...
      </div>
    </div>
    
    <!-- Workers -->
    <div class="section-title">
      ⚡ Workers
      <span id="workers-count" class="badge badge-info">0</span>
    </div>
    <div id="workers-container">
      <div class="loading-state">
        <div class="spinner"></div>
        Chargement des Workers...
      </div>
    </div>
    
    <!-- Pages -->
    <div class="section-title">
      📄 Pages
      <span id="pages-count" class="badge badge-info">0</span>
    </div>
    <div id="pages-container">
      <div class="loading-state">
        <div class="spinner"></div>
        Chargement des projets Pages...
      </div>
    </div>
  </div>
  
  <script>
    const API_BASE = '';
    let resourcesData = null;
    
    // Load data on page load
    document.addEventListener('DOMContentLoaded', loadAllData);
    
    async function loadAllData() {
      try {
        const resp = await fetch('/cloudflare/resources', { credentials: 'include' });
        const data = await resp.json();
        
        if (!resp.ok) {
          throw new Error(data.error || 'Failed to load resources');
        }
        
        resourcesData = data;
        renderStats(data.summary);
        renderAccessApps(data.resources.access);
        renderWorkers(data.resources.workers);
        renderPages(data.resources.pages);
      } catch (err) {
        showError('Erreur de chargement: ' + err.message);
      }
    }
    
    function renderStats(summary) {
      const container = document.getElementById('stats-container');
      container.innerHTML = \`
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">\${summary.access_apps}</div>
            <div class="stat-label">Applications Access</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${summary.workers}</div>
            <div class="stat-label">Workers</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${summary.pages}</div>
            <div class="stat-label">Pages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">\${summary.total_deployments_today}</div>
            <div class="stat-label">Déploiements (24h)</div>
          </div>
        </div>
      \`;
    }
    
    function renderAccessApps(apps) {
      const container = document.getElementById('access-container');
      const countBadge = document.getElementById('access-count');
      countBadge.textContent = apps.length;
      
      if (apps.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune application Access trouvée</div>';
        return;
      }
      
      container.innerHTML = \`
        <div class="resource-grid">
          \${apps.map(app => \`
            <div class="resource-card" onclick="toggleDetails(this, 'access', '\${app.id}')">
              <div class="resource-header">
                <div>
                  <div class="resource-title">\${app.name}</div>
                  <div class="resource-url">\${app.domain}</div>
                </div>
                <span class="badge badge-success">Active</span>
              </div>
              <div class="resource-meta">
                <span class="badge badge-info">Access App</span>
              </div>
              <div class="resource-details">
                <div class="loading-state">
                  <div class="spinner"></div>
                  Chargement des détails...
                </div>
              </div>
            </div>
          \`).join('')}
        </div>
      \`;
    }
    
    function renderWorkers(workers) {
      const container = document.getElementById('workers-container');
      const countBadge = document.getElementById('workers-count');
      countBadge.textContent = workers.length;
      
      if (workers.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucun Worker trouvé</div>';
        return;
      }
      
      container.innerHTML = \`
        <div class="resource-grid">
          \${workers.map(worker => \`
            <div class="resource-card" onclick="toggleDetails(this, 'workers', '\${worker.name}')">
              <div class="resource-header">
                <div>
                  <div class="resource-title">\${worker.name}</div>
                  <div class="resource-url">\${worker.url}</div>
                </div>
                <span class="badge badge-success">Active</span>
              </div>
              <div class="resource-meta">
                <span class="badge badge-warning">Worker</span>
                <span class="text-muted" style="font-size: 0.75rem;">
                  Modifié: \${formatDate(worker.modified_at)}
                </span>
              </div>
              <div class="resource-details">
                <div class="loading-state">
                  <div class="spinner"></div>
                  Chargement des détails...
                </div>
              </div>
            </div>
          \`).join('')}
        </div>
      \`;
    }
    
    function renderPages(pages) {
      const container = document.getElementById('pages-container');
      const countBadge = document.getElementById('pages-count');
      countBadge.textContent = pages.length;
      
      if (pages.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucun projet Pages trouvé</div>';
        return;
      }
      
      container.innerHTML = \`
        <div class="resource-grid">
          \${pages.map(page => \`
            <div class="resource-card" onclick="toggleDetails(this, 'pages', '\${page.name}')">
              <div class="resource-header">
                <div>
                  <div class="resource-title">\${page.name}</div>
                  <div class="resource-url">\${page.url}</div>
                </div>
                <span class="badge \${page.latest_deployment?.status === 'success' ? 'badge-success' : 'badge-warning'}">
                  \${page.latest_deployment?.status || 'Unknown'}
                </span>
              </div>
              <div class="resource-meta">
                <span class="badge badge-info">Pages</span>
                <span class="text-muted" style="font-size: 0.75rem;">
                  Branch: \${page.production_branch}
                </span>
              </div>
              <div class="resource-details">
                <div class="loading-state">
                  <div class="spinner"></div>
                  Chargement des détails...
                </div>
              </div>
            </div>
          \`).join('')}
        </div>
      \`;
    }
    
    async function toggleDetails(cardElement, type, id) {
      const isExpanded = cardElement.classList.contains('expanded');
      
      // Close all other expanded cards
      document.querySelectorAll('.resource-card.expanded').forEach(card => {
        if (card !== cardElement) {
          card.classList.remove('expanded');
        }
      });
      
      if (isExpanded) {
        cardElement.classList.remove('expanded');
        return;
      }
      
      cardElement.classList.add('expanded');
      const detailsContainer = cardElement.querySelector('.resource-details');
      
      try {
        const resp = await fetch(\`/cloudflare/resources/\${type}/\${id}\`, { credentials: 'include' });
        const data = await resp.json();
        
        if (!resp.ok) {
          throw new Error(data.error || 'Failed to load details');
        }
        
        renderResourceDetails(detailsContainer, type, data);
      } catch (err) {
        detailsContainer.innerHTML = \`<div class="error-state">Erreur: \${err.message}</div>\`;
      }
    }
    
    function renderResourceDetails(container, type, data) {
      switch (type) {
        case 'access':
          container.innerHTML = \`
            <div class="detail-row">
              <span class="detail-label">AUD</span>
              <span class="detail-value">\${data.app.aud}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Policies</span>
              <span class="detail-value">\${data.stats.total_policies}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email Policies</span>
              <span class="detail-value">\${data.stats.email_policies}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Service Tokens</span>
              <span class="detail-value">\${data.stats.token_policies}</span>
            </div>
            <div style="margin-top: 1rem;">
              <div class="detail-label" style="margin-bottom: 0.5rem;">Policies:</div>
              \${data.policies.map(policy => \`
                <div class="binding-item">
                  <span>\${policy.name}</span>
                  <span class="binding-type">\${policy.decision}</span>
                </div>
              \`).join('')}
            </div>
          \`;
          break;
          
        case 'workers':
          container.innerHTML = \`
            <div class="detail-row">
              <span class="detail-label">Bindings</span>
              <span class="detail-value">\${data.stats.bindings_count}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Secrets</span>
              <span class="detail-value">\${data.stats.secrets_count}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">D1 Databases</span>
              <span class="detail-value">\${data.stats.d1_count}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Routes</span>
              <span class="detail-value">\${data.stats.routes_count}</span>
            </div>
            \${data.bindings.length > 0 ? \`
              <div style="margin-top: 1rem;">
                <div class="detail-label" style="margin-bottom: 0.5rem;">Bindings:</div>
                <div class="bindings-list">
                  \${data.bindings.map(binding => \`
                    <div class="binding-item">
                      <span>\${binding.name}</span>
                      <span class="binding-type">\${binding.type}</span>
                    </div>
                  \`).join('')}
                </div>
              </div>
            \` : ''}
          \`;
          break;
          
        case 'pages':
          container.innerHTML = \`
            <div class="detail-row">
              <span class="detail-label">Total Deployments</span>
              <span class="detail-value">\${data.stats.total_deployments}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Success Rate</span>
              <span class="detail-value">\${data.stats.success_rate}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Production Branch</span>
              <span class="detail-value">\${data.project.production_branch}</span>
            </div>
            \${data.deployments.length > 0 ? \`
              <div style="margin-top: 1rem;">
                <div class="detail-label" style="margin-bottom: 0.5rem;">Recent Deployments:</div>
                <div class="bindings-list">
                  \${data.deployments.slice(0, 5).map(deployment => \`
                    <div class="binding-item">
                      <span>\${formatDate(deployment.created_at)}</span>
                      <span class="binding-type \${deployment.status === 'success' ? 'badge-success' : 'badge-warning'}">\${deployment.status}</span>
                    </div>
                  \`).join('')}
                </div>
              </div>
            \` : ''}
          \`;
          break;
      }
    }
    
    async function refreshData() {
      const btn = document.getElementById('refresh-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner"></div> Actualisation...';
      
      try {
        await loadAllData();
      } finally {
        btn.disabled = false;
        btn.innerHTML = \`
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Actualiser
        \`;
      }
    }
    
    function formatDate(dateStr) {
      if (!dateStr) return 'N/A';
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) return "Il y a moins d'1h";
      if (diffHours < 24) return \`Il y a \${diffHours}h\`;
      if (diffDays < 7) return \`Il y a \${diffDays}j\`;
      return date.toLocaleDateString('fr-FR');
    }
    
    function showError(message) {
      const containers = ['stats-container', 'access-container', 'workers-container', 'pages-container'];
      containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
          container.innerHTML = \`<div class="error-state">\${message}</div>\`;
        }
      });
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return error(`Failed to load dashboard: ${err.message}`, 500);
  }
}

/**
 * List all resources (JSON API)
 * GET /cloudflare/resources
 */
export async function listResources(request, env, ctx) {
  try {
    const organization = await getUserOrganization(env, ctx);
    
    if (!organization) {
      return error('Organization not found', 404, 'NOT_FOUND');
    }
    
    if (!organization.cf_account_id) {
      return error('Organization has no Cloudflare account configured', 400, 'NO_CF_ACCOUNT');
    }
    
    // Override the account ID for this request
    const originalAccountId = env.CLOUDFLARE_ACCOUNT_ID;
    env.CLOUDFLARE_ACCOUNT_ID = organization.cf_account_id;
    
    const cfService = getCfResourcesService(env);
    const data = await cfService.getAllResources();
    
    // Restore original account ID
    env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    
    return success({
      organization: {
        id: organization.id,
        name: organization.name,
        cf_account_id: organization.cf_account_id
      },
      ...data
    });
  } catch (err) {
    console.error('List resources error:', err);
    return error(`Failed to list resources: ${err.message}`, 500);
  }
}

/**
 * List resources by type
 * GET /cloudflare/resources/:type
 */
export async function listByType(request, env, ctx) {
  const { type } = ctx.params;
  
  if (!['access', 'workers', 'pages'].includes(type)) {
    return error('Invalid resource type. Must be: access, workers, pages', 400, 'INVALID_TYPE');
  }
  
  try {
    const organization = await getUserOrganization(env, ctx);
    
    if (!organization?.cf_account_id) {
      return error('Organization has no Cloudflare account configured', 400, 'NO_CF_ACCOUNT');
    }
    
    // Override the account ID for this request
    const originalAccountId = env.CLOUDFLARE_ACCOUNT_ID;
    env.CLOUDFLARE_ACCOUNT_ID = organization.cf_account_id;
    
    const cfService = getCfResourcesService(env);
    let resources;
    
    switch (type) {
      case 'access':
        resources = await cfService.listAccessApps();
        break;
      case 'workers':
        resources = await cfService.listWorkers();
        break;
      case 'pages':
        resources = await cfService.listPagesProjects();
        break;
    }
    
    // Restore original account ID
    env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    
    return success({ [type]: resources });
  } catch (err) {
    console.error(`List ${type} error:`, err);
    return error(`Failed to list ${type}: ${err.message}`, 500);
  }
}

/**
 * Get resource details
 * GET /cloudflare/resources/:type/:id
 */
export async function getDetails(request, env, ctx) {
  const { type, id } = ctx.params;
  
  if (!['access', 'workers', 'pages'].includes(type)) {
    return error('Invalid resource type. Must be: access, workers, pages', 400, 'INVALID_TYPE');
  }
  
  try {
    const organization = await getUserOrganization(env, ctx);
    
    if (!organization?.cf_account_id) {
      return error('Organization has no Cloudflare account configured', 400, 'NO_CF_ACCOUNT');
    }
    
    // Override the account ID for this request
    const originalAccountId = env.CLOUDFLARE_ACCOUNT_ID;
    env.CLOUDFLARE_ACCOUNT_ID = organization.cf_account_id;
    
    const cfService = getCfResourcesService(env);
    let details;
    
    switch (type) {
      case 'access':
        details = await cfService.getAccessAppDetails(id);
        break;
      case 'workers':
        details = await cfService.getWorkerDetails(id);
        break;
      case 'pages':
        details = await cfService.getPagesProjectDetails(id);
        break;
    }
    
    // Restore original account ID
    env.CLOUDFLARE_ACCOUNT_ID = originalAccountId;
    
    return success(details);
  } catch (err) {
    console.error(`Get ${type} details error:`, err);
    return error(`Failed to get ${type} details: ${err.message}`, 500);
  }
}
