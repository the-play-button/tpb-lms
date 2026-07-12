/**
 * TranslationsService — DB access for the translations table.
 */

import { log } from '@the-play-button/tpb-sdk-js';
import type { Env } from "../../types/Env.js";

const translationId = (contentType, contentId: string, field, lang: string) =>
    `${contentType}:${contentId}:${field}:${lang}`;

export const listByContent = async (env: Env, contentType, contentId: string) => {
    const result = await env.DB.prepare(`
        SELECT field, lang, value, source, reviewed_at, reviewed_by, updated_at
        FROM translations
        WHERE content_type = ? AND content_id = ?
        ORDER BY lang, field
    `).bind(contentType, contentId).all();

    const byLang = {};
    for (const row of result.results) {
        if (!byLang[row.lang]) byLang[row.lang] = {};
        byLang[row.lang][row.field] = {
            value: row.value,
            source: row.source,
            reviewed_at: row.reviewed_at,
            reviewed_by: row.reviewed_by,
            updated_at: row.updated_at,
        };
    }
    return byLang;
};

export const upsertOne = async (env: Env, params) => {
    const { contentType, contentId, field, lang, value, source, userId } = params;
    const id = translationId(contentType, contentId, field, lang);
    await env.DB.prepare(`
        INSERT INTO translations (id, content_type, content_id, field, lang, value, source, reviewed_at, reviewed_by, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
        ON CONFLICT(content_type, content_id, field, lang)
        DO UPDATE SET value = ?, source = ?, reviewed_at = datetime('now'), reviewed_by = ?, updated_at = datetime('now')
    `).bind(id, contentType, contentId, field, lang, value, source, userId, value, source, userId).run();
    return id;
};

export const listForReview = async (env: Env, source, limit) => {
    const result = await env.DB.prepare(`
        SELECT id, content_type, content_id, field, lang, value, source, created_at
        FROM translations
        WHERE source = ? AND reviewed_at IS NULL
        ORDER BY created_at DESC
        LIMIT ?
    `).bind(source, limit).all();
    return result.results;
};

const upsertBatchOne = async (env: Env, payload, userId: string) => {
    const { content_type, content_id, field, lang, value, source = 'ai' } = payload;
    if (!content_type || !content_id || !field || !lang || value === undefined) {
        return false;
    }
    const id = translationId(content_type, content_id, field, lang);
    try {
        await env.DB.prepare(`
            INSERT INTO translations (id, content_type, content_id, field, lang, value, source, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(content_type, content_id, field, lang)
            DO UPDATE SET value = ?, source = ?, updated_at = datetime('now')
        `).bind(id, content_type, content_id, field, lang, value, source, value, source).run();
        return true;
    } catch (error) {
        log.error('translation upsert failed', error, { translationId: id });
        return false;
    }
};

export const bulkUpsert = async (env: Env, translations, userId: string) => {
    let successCount = 0;
    let errorCount = 0;
    for (const t of translations) {
        const ok = await upsertBatchOne(env, t, userId);
        if (ok) successCount += 1;
        else errorCount += 1;
    }
    return { successCount, errorCount };
};
