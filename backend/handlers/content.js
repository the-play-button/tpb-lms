// entropy-single-export-ok: 2 tightly-coupled content handlers (get file, list directory) sharing GitHub auth and URL parsing
// entropy-handler-service-pattern-ok: simple handler, business logic is minimal
// entropy-legacy-marker-ok: debt — legacy fallback to GITHUB_PAT_TPB_REPOS env var when vault token unavailable
// entropy-long-function-ok: getGitHubContent is a sequential handler — URL parsing + i18n path injection + vault token fetch + GitHub API call + error mapping; splitting would scatter the linear request flow
/**
 * Content Handler
 *
 * Proxies content from private GitHub repositories using API token.
 * Enables frontend to fetch markdown from private repos without exposing tokens.
 */

import { jsonResponse } from '../cors.js';
import { log } from '../lib/log.js';

// GitHub API base URL
const GITHUB_API_BASE = 'https://api.github.com'; // entropy-hardcoded-url-ok: external API endpoint

// Cache for GitHub token (avoid repeated vault calls)
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Get GitHub token from vault via native Bearer token
 * 
 * The LMS uses a native Bearer token (iampam_xxx) to authenticate 
 * to TPB Bastion and fetch the GitHub PAT.
 * 
 * Token path in vault: infra/github_pat_tpb_repos
 * 
 * Required env vars:
 * - BASTION_URL: Bastion API endpoint (https://iampam.tunnels.digital)
 * - VAULT_TOKEN: Native Bearer token (iampam_xxx)
 */
// #region agent debug wrapper
async function getGitHubTokenWithDebug(env) {
    const debug = {
        cached: false,
        hasBastionUrl: !!env.BASTION_URL,
        hasVaultToken: !!env.VAULT_TOKEN,
        vaultTokenPrefix: env.VAULT_TOKEN ? env.VAULT_TOKEN.substring(0, 12) : null,
        vaultStatus: null,
        vaultError: null
    };

    // Check cache first
    if (cachedToken && Date.now() < tokenExpiry) {
        debug.cached = true;
        return { token: cachedToken, debug };
    }

    if (env.BASTION_URL && env.VAULT_TOKEN) {
        try {
            const secretPath = '/secret/data/infra/github_pat_tpb_repos';

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.VAULT_TOKEN}`,
            };

            const response = await fetch(`${env.BASTION_URL}${secretPath}`, { headers });
            
            debug.vaultStatus = response.status;
            
            if (response.ok) {
                const result = await response.json();
                cachedToken = result.data?.value || null;
                if (cachedToken) {
                    tokenExpiry = Date.now() + 5 * 60 * 1000;
                    return { token: cachedToken, debug };
                } else {
                    debug.vaultError = 'Response missing data.value';
                }
            } else {
                debug.vaultError = await response.text();
            }
        } catch (e) {
            debug.vaultError = e.message;
        }
    }
    
    // entropy-legacy-marker-ok: documented technical debt
    // Legacy fallback
    if (env.GITHUB_PAT_TPB_REPOS) {
        cachedToken = env.GITHUB_PAT_TPB_REPOS;
        tokenExpiry = Date.now() + 5 * 60 * 1000;
        debug.fallback = true;
        return { token: cachedToken, debug };
    }
    
    return { token: null, debug };
}
// #endregion

async function getGitHubToken(env) {
    const result = await getGitHubTokenWithDebug(env);
    return result.token;
}

/**
 * Inject i18n language into GitHub path.
 * Transforms: outputs/SOM_xxx/STEPS/STEP01.md -> outputs/SOM_xxx/i18n/{lang}/STEPS/STEP01.md
 * 
 * @param {string} path - Original file path
 * @param {string} lang - Target language code
 * @returns {string} - Localized path
 */
function injectI18nIntoPath(path, lang) {
    if (!lang) return path;
    
    // For paths with /STEPS/ - insert i18n before STEPS
    if (path.includes('/STEPS/')) {
        return path.replace('/STEPS/', `/i18n/${lang}/STEPS/`);
    }
    
    // For main SOM file - insert i18n before the filename
    const match = path.match(/^(.+\/SOM_[^/]+\/)(.+)$/);
    if (match) {
        return `${match[1]}i18n/${lang}/${match[2]}`;
    }
    
    return path;
}

/**
 * Parse GitHub URL to extract owner, repo, branch, and path
 * Supports formats:
 * - https://raw.githubusercontent.com/owner/repo/branch/path
 * - https://github.com/owner/repo/blob/branch/path
 * - owner/repo/path (assumes main branch)
 */
function parseGitHubUrl(url) {
    // Raw URL format
    const rawMatch = url.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);
    if (rawMatch) {
        return {
            owner: rawMatch[1],
            repo: rawMatch[2],
            branch: rawMatch[3],
            path: rawMatch[4]
        };
    }
    
    // Blob URL format
    const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/);
    if (blobMatch) {
        return {
            owner: blobMatch[1],
            repo: blobMatch[2],
            branch: blobMatch[3],
            path: blobMatch[4]
        };
    }
    
    // Simple format: owner/repo/path (assumes main branch)
    const simpleMatch = url.match(/^([^/]+)\/([^/]+)\/(.+)$/);
    if (simpleMatch) {
        return {
            owner: simpleMatch[1],
            repo: simpleMatch[2],
            branch: 'main',
            path: simpleMatch[3]
        };
    }
    
    return null;
}

/**
 * GET /api/content/github
 * Fetch content from a GitHub repository
 * 
 * Query params:
 * - url: Full GitHub raw URL or owner/repo/path format
 * - owner, repo, branch, path: Alternative to url
 * - lang: Optional language code to inject i18n path (e.g., ?lang=en)
 */
// entropy-long-function-ok: sequential URL parsing and fetch logic
export async function getGitHubContent(request, env, userContext) {
    const url = new URL(request.url);
    
    let owner, repo, branch, path;
    
    // Parse URL parameter
    const urlParam = url.searchParams.get('url');
    const langParam = url.searchParams.get('lang');
    // #region agent log H3
    log.debug('[DEBUG H3] urlParam:', urlParam, 'lang:', langParam);
    // #endregion
    if (urlParam) {
        const parsed = parseGitHubUrl(decodeURIComponent(urlParam));
        // #region agent log H3
        log.debug('[DEBUG H3] parsed:', JSON.stringify(parsed));
        // #endregion
        if (!parsed) {
            return jsonResponse({ error: 'Invalid GitHub URL format' }, 400, request);
        }
        ({ owner, repo, branch, path } = parsed);
    } else {
        // Use individual params
        owner = url.searchParams.get('owner');
        repo = url.searchParams.get('repo');
        branch = url.searchParams.get('branch') || 'main';
        path = url.searchParams.get('path');
    }
    
    if (!owner || !repo || !path) {
        return jsonResponse({ 
            error: 'Missing required parameters',
            required: 'url OR (owner, repo, path)',
            optional: 'branch (defaults to main), lang (for i18n)'
        }, 400, request);
    }
    
    // Inject i18n into path if lang parameter is provided
    if (langParam) {
        path = injectI18nIntoPath(path, langParam);
        log.debug('[DEBUG] i18n path:', path);
    }
    
    // Get GitHub token
    const tokenResult = await getGitHubTokenWithDebug(env);
    const token = tokenResult.token;
    // #region agent log H1
    log.debug('[DEBUG H1] token fetched:', token ? `yes (${token.substring(0,8)}...)` : 'NO TOKEN');
    // #endregion
    
    // Build API URL
    const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    // #region agent log H3
    log.debug('[DEBUG H3] apiUrl:', apiUrl);
    // #endregion
    
    try {
        const headers = {
            'Accept': 'application/vnd.github.v3.raw',  // Get raw content directly
            'User-Agent': 'TPB-LMS/1.0'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(apiUrl, { headers });
        // #region agent log H2 H4
        log.debug('[DEBUG H2/H4] GitHub response:', response.status, response.statusText);
        // #endregion
        
        if (!response.ok) {
            // #region agent log H2 H4
            const errorBody = await response.text();
            log.debug('[DEBUG H2/H4] GitHub error body:', errorBody);
            // #endregion
            if (response.status === 404) {
                return jsonResponse({ 
                    error: 'File not found',
                    path: `${owner}/${repo}/${branch}/${path}`,
                    // #region agent debug
                    _debug: {
                        apiUrl: apiUrl,
                        hasToken: !!token,
                        tokenPrefix: token ? token.substring(0,8) : null,
                        gitHubError: errorBody,
                        vault: tokenResult.debug
                    }
                    // #endregion
                }, 404, request);
            }
            if (response.status === 401 || response.status === 403) {
                return jsonResponse({ 
                    error: 'GitHub authentication failed',
                    hint: 'Check GITHUB_TOKEN configuration',
                    // #region agent debug - expose full context for debugging
                    _debug: {
                        gitHubStatus: response.status,
                        gitHubError: errorBody,
                        hasToken: !!token,
                        tokenPrefix: token ? token.substring(0,8) : null,
                        vault: tokenResult.debug
                    }
                    // #endregion
                }, 403, request);
            }
            return jsonResponse({ 
                error: `GitHub API error: ${response.status}`,
                message: await response.text()
            }, response.status, request);
        }
        
        const content = await response.text();
        
        // Return raw content with appropriate headers
        return new Response(content, {
            status: 200,
            headers: {
                'Content-Type': 'text/markdown; charset=utf-8',
                'Cache-Control': 'public, max-age=300',  // 5 min cache
                'Access-Control-Allow-Origin': '*',
                'X-GitHub-Repo': `${owner}/${repo}`,
                'X-GitHub-Branch': branch,
                'X-GitHub-Path': path
            }
        });
        
    } catch (error) {
        log.error('GitHub content fetch error:', error);
        return jsonResponse({ 
            error: 'Failed to fetch content',
            message: error.message
        }, 500, request);
    }
}

/**
 * GET /api/content/github/tree
 * List files in a GitHub directory
 */
export async function listGitHubDirectory(request, env, userContext) {
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const branch = url.searchParams.get('branch') || 'main';
    const path = url.searchParams.get('path') || '';
    
    if (!owner || !repo) {
        return jsonResponse({ error: 'Missing owner or repo' }, 400, request);
    }
    
    const token = await getGitHubToken(env);
    
    const apiUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    
    try {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'TPB-LMS/1.0'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(apiUrl, { headers });
        
        if (!response.ok) {
            return jsonResponse({ 
                error: `GitHub API error: ${response.status}` 
            }, response.status, request);
        }
        
        const items = await response.json();
        
        // Simplify response
        const files = items.map(item => ({
            name: item.name,
            path: item.path,
            type: item.type,  // 'file' or 'dir'
            size: item.size,
            download_url: item.download_url
        }));
        
        return jsonResponse({ 
            owner, 
            repo, 
            branch, 
            path: path || '/',
            files 
        }, 200, request);
        
    } catch (error) {
        return jsonResponse({ error: error.message }, 500, request);
    }
}
