import type { Env } from "../../types/Env.js";

/**
 * GithubContentService — proxy GitHub content fetch with bastion-managed PAT.
 *
 * Handlers stay thin : parse params + delegate + format response.
 */

const GITHUB_API_BASE = 'https://api.github.com';
const TOKEN_TTL_MS = 5 * 60 * 1000;
// Canonical bastion vault read endpoint (§ VAULT). `/secret/data/*` is not a
// live route and 404s for every caller (incl. admin) — the by-path endpoint is
// the one the SDK + all Workers consume.
const GITHUB_PAT_VAULT_PATH = 'tpb/infra/github_pat_tpb_repos';

interface TokenDebug {
    cached: boolean;
    hasBastionUrl: boolean;
    hasVaultToken: boolean;
    vaultTokenPrefix: string | null;
    vaultStatus: number | null;
    vaultError: string | null;
}

interface GitHubUrlParts {
    owner?: string;
    repo?: string;
    branch?: string;
    path?: string;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;

const fetchVaultToken = async (env: Env, debug: TokenDebug): Promise<string> => {
    if (!env.BASTION_URL || !env.BASTION_TOKEN) {
        throw new Error('BASTION_URL and BASTION_TOKEN are required to fetch GitHub PAT from vault');
    }
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.BASTION_TOKEN}`,
    };
    const response = await fetch(
        `${env.BASTION_URL}/vault/secrets/by-path/${GITHUB_PAT_VAULT_PATH}`,
        { headers },
    );
    debug.vaultStatus = response.status;
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Vault fetch failed (${response.status}): ${body}`);
    }
    const result = await response.json() as { value?: string; data?: { value?: string } };
    const token = result.value ?? result.data?.value ?? null;
    if (!token) {
        throw new Error(`Vault response missing value for ${GITHUB_PAT_VAULT_PATH}`);
    }
    return token;
};

const getTokenDebug = (env: Env): TokenDebug => ({
    cached: false,
    hasBastionUrl: !!env.BASTION_URL,
    hasVaultToken: !!env.BASTION_TOKEN,
    vaultTokenPrefix: env.BASTION_TOKEN ? env.BASTION_TOKEN.substring(0, 12) : null,
    vaultStatus: null,
    vaultError: null,
});

export const getGitHubTokenWithDebug = async (env: Env) => {
    const debug = getTokenDebug(env);
    if (cachedToken && Date.now() < tokenExpiry) {
        debug.cached = true;
        return { token: cachedToken, debug };
    }
    const token = await fetchVaultToken(env, debug);
    cachedToken = token;
    tokenExpiry = Date.now() + TOKEN_TTL_MS;
    return { token, debug };
};

export const getGitHubToken = async (env: Env) => (await getGitHubTokenWithDebug(env)).token;

export const injectI18nIntoPath = (path: string, lang: string): string => {
    if (!lang) return path;
    if (path.includes('/STEPS/')) return path.replace('/STEPS/', `/i18n/${lang}/STEPS/`);
    const match = path.match(/^(.+\/SOM_[^/]+\/)(.+)$/);
    if (match) return `${match[1]}i18n/${lang}/${match[2]}`;
    return path;
};

const RAW_PATTERN = /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/;
const BLOB_PATTERN = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;
const SIMPLE_PATTERN = /^([^/]+)\/([^/]+)\/(.+)$/;

export const parseGitHubUrl = (url: string): GitHubUrlParts | null => {
    const raw = url.match(RAW_PATTERN);
    if (raw) return { owner: raw[1], repo: raw[2], branch: raw[3], path: raw[4] };
    const blob = url.match(BLOB_PATTERN);
    if (blob) return { owner: blob[1], repo: blob[2], branch: blob[3], path: blob[4] };
    const simple = url.match(SIMPLE_PATTERN);
    if (simple) return { owner: simple[1], repo: simple[2], branch: 'main', path: simple[3] };
    return null;
};

export const buildGitHubApiUrl = ({ owner, repo, branch, path }: GitHubUrlParts = {}) =>
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

export const fetchRawContent = async (env: Env, params: GitHubUrlParts) => {
    const tokenResult = await getGitHubTokenWithDebug(env);
    const apiUrl = buildGitHubApiUrl(params);
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'TPB-LMS/1.0',
    };
    if (tokenResult.token) headers['Authorization'] = `Bearer ${tokenResult.token}`;
    const response = await fetch(apiUrl, { headers });
    return { response, tokenResult, apiUrl };
};

export const fetchDirectoryListing = async (env: Env, params: GitHubUrlParts) => {
    const token = await getGitHubToken(env);
    const apiUrl = buildGitHubApiUrl(params);
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TPB-LMS/1.0',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(apiUrl, { headers });
};
