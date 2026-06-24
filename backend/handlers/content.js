/**
 * Content Handler
 *
 * Proxies content from private GitHub repositories using a vault-managed PAT.
 * Delegates to GithubContentService for all I/O. The handler keeps only HTTP-level
 * parsing + response formatting.
 */

import { jsonResponse, getCorsHeaders } from '../cors.js';
import { log } from '@the-play-button/tpb-sdk-js';
import {
    parseGitHubUrl,
    injectI18nIntoPath,
    fetchRawContent,
    fetchDirectoryListing,
} from '../services/content/GithubContentService.js';

const resolveGitHubParams = (url) => {
    const urlParam = url.searchParams.get('url');
    if (urlParam) {
        const parsed = parseGitHubUrl(decodeURIComponent(urlParam));
        if (!parsed) return { error: 'Invalid GitHub URL format' };
        return { params: parsed };
    }
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const branch = url.searchParams.get('branch') || 'main';
    const path = url.searchParams.get('path');
    return { params: { owner, repo, branch, path } };
};

const buildAuthErrorResponse = (request, response, errorBody, token, vaultDebug) => {
    const baseDebug = {
        gitHubStatus: response.status,
        gitHubError: errorBody,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 8) : null,
        vault: vaultDebug,
    };
    if (response.status === 404) {
        return jsonResponse({
            error: 'File not found',
            _debug: { apiUrl: response.url, ...baseDebug },
        }, 404, request);
    }
    return jsonResponse({
        error: 'GitHub authentication failed',
        hint: 'Check GITHUB_TOKEN configuration',
        _debug: baseDebug,
    }, 403, request);
};

/**
 * GET /api/content/github
 */
export const getGitHubContent = async (request, env, userContext) => {
    const url = new URL(request.url);
    const langParam = url.searchParams.get('lang');
    const resolved = resolveGitHubParams(url);
    if (resolved.error) return jsonResponse({ error: resolved.error }, 400, request);
    const params = { ...resolved.params };
    if (!params.owner || !params.repo || !params.path) {
        return jsonResponse({
            error: 'Missing required parameters',
            required: 'url OR (owner, repo, path)',
            optional: 'branch (defaults to main), lang (for i18n)',
        }, 400, request);
    }
    if (langParam) params.path = injectI18nIntoPath(params.path, langParam);

    try {
        const { response, tokenResult } = await fetchRawContent(env, params);
        if (!response.ok) {
            const errorBody = await response.text();
            if (response.status === 404 || response.status === 401 || response.status === 403) {
                return buildAuthErrorResponse(request, response, errorBody, tokenResult.token, tokenResult.debug);
            }
            return jsonResponse({
                error: `GitHub API error: ${response.status}`,
                message: errorBody,
            }, response.status, request);
        }
        const content = await response.text();
        return new Response(content, {
            status: 200,
            headers: {
                ...getCorsHeaders(request),
                'Content-Type': 'text/markdown; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
                'X-GitHub-Repo': `${params.owner}/${params.repo}`,
                'X-GitHub-Branch': params.branch,
                'X-GitHub-Path': params.path,
            },
        });
    } catch (error) {
        log.error('GitHub content fetch error:', error);
        return jsonResponse({ error: 'Failed to fetch content', message: error.message }, 500, request);
    }
};

const projectDirectoryItem = (item) => ({
    name: item.name,
    path: item.path,
    type: item.type,
    size: item.size,
    download_url: item.download_url,
});

/**
 * GET /api/content/github/tree
 */
export const listGitHubDirectory = async (request, env, userContext) => {
    const url = new URL(request.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const branch = url.searchParams.get('branch') || 'main';
    const path = url.searchParams.get('path') || '';
    if (!owner || !repo) return jsonResponse({ error: 'Missing owner or repo' }, 400, request);

    try {
        const response = await fetchDirectoryListing(env, { owner, repo, branch, path });
        if (!response.ok) {
            return jsonResponse({ error: `GitHub API error: ${response.status}` }, response.status, request);
        }
        const items = await response.json();
        return jsonResponse({
            owner,
            repo,
            branch,
            path: path || '/',
            files: items.map(projectDirectoryItem),
        }, 200, request);
    } catch (error) {
        return jsonResponse({ error: error.message }, 500, request);
    }
};
