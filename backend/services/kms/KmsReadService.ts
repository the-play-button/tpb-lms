import type { Env } from "../../types/Env.js";

/**
 * KmsReadService — read-only access to KMS spaces + pages.
 */

const queryActiveSpaces = (env: Env) =>
    env.DB.prepare(`
        SELECT id, name, description, parent_space_id, is_active, created_at, updated_at
        FROM kms_space
        WHERE is_active = 1
        ORDER BY name
    `).all();

const querySpaceById = (env: Env, spaceId: string) =>
    env.DB.prepare(`
        SELECT id, name, description, parent_space_id, is_active, created_at, updated_at
        FROM kms_space
        WHERE id = ? AND is_active = 1
    `).bind(spaceId).first();

const querySpacePages = (env: Env, spaceId: string) =>
    env.DB.prepare(`
        SELECT id, title, type, metadata_json, created_at, updated_at
        FROM kms_page
        WHERE space_id = ? AND is_active = 1
        ORDER BY title
    `).bind(spaceId).all();

const queryPageById = (env: Env, pageId: string) =>
    env.DB.prepare(`
        SELECT p.id, p.title, p.type, p.space_id, p.metadata_json, p.raw_json,
               p.download_url, p.web_url, p.created_at, p.updated_at,
               s.name as space_name
        FROM kms_page p
        LEFT JOIN kms_space s ON p.space_id = s.id
        WHERE p.id = ? AND p.is_active = 1
    `).bind(pageId).first();

const projectPage = (row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
});

export const listSpaces = async (env: Env) => {
    const result = await queryActiveSpaces(env);
    return { spaces: result.results || [] };
};

export const getSpace = async (env: Env, spaceId: string) => {
    const space = await querySpaceById(env, spaceId);
    if (!space) return null;
    const pagesResult = await querySpacePages(env, spaceId);
    return {
        ...space,
        pages: (pagesResult.results || []).map(projectPage),
    };
};

export const getPage = async (env: Env, pageId: string) => {
    const page = await queryPageById(env, pageId);
    if (!page) return null;
    const metadata = page.metadata_json ? JSON.parse(page.metadata_json) : {};
    const rawData = page.raw_json ? JSON.parse(page.raw_json) : {};
    return {
        id: page.id,
        title: page.title,
        type: page.type,
        space_id: page.space_id,
        space_name: page.space_name,
        content_md: rawData.content_md || '',
        metadata,
        download_url: page.download_url,
        web_url: page.web_url,
        created_at: page.created_at,
        updated_at: page.updated_at,
    };
};
