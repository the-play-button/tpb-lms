-- Migration 002: Multi-language support
-- Date: 2026-01-10
-- Description: Add translations table for dynamic content and glossary for business terms

-- ============================================
-- TRANSLATIONS: Dynamic content translations
-- ============================================
-- Stores translations for courses, classes, and media
-- content_type: 'course' | 'class' | 'media'
-- field: 'name' | 'description' | 'content_md'
-- source: 'ai' (auto-generated) | 'manual' (human edited)

CREATE TABLE IF NOT EXISTS translations (
    id TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    field TEXT NOT NULL,
    lang TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT DEFAULT 'ai',
    reviewed_at TEXT,
    reviewed_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(content_type, content_id, field, lang)
);

-- Index for fast lookups by content + language
CREATE INDEX IF NOT EXISTS idx_translations_lookup 
    ON translations(content_type, content_id, lang);

-- Index for finding all translations needing review
CREATE INDEX IF NOT EXISTS idx_translations_review 
    ON translations(source, reviewed_at);

-- ============================================
-- GLOSSARY: Business terminology per organization
-- ============================================
-- Ensures consistent translation of business terms
-- Applied as pre-processing before AI translation

CREATE TABLE IF NOT EXISTS glossary (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    source_term TEXT NOT NULL,
    target_term TEXT NOT NULL,
    context TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(org_id, source_lang, target_lang, source_term)
);

-- Index for fast glossary lookups during translation
CREATE INDEX IF NOT EXISTS idx_glossary_lookup 
    ON glossary(org_id, source_lang, target_lang);

-- ============================================
-- USER LANGUAGE PREFERENCES
-- ============================================
-- Add lang column to crm_contact for user preference
-- (Using ALTER TABLE since SQLite supports it)

-- Note: SQLite doesn't support IF NOT EXISTS for columns
-- This will fail silently if column exists (run via script)

-- ALTER TABLE crm_contact ADD COLUMN preferred_lang TEXT DEFAULT 'fr';

-- ============================================
-- SEED DATA: Default glossary for TPB
-- ============================================

INSERT OR IGNORE INTO glossary (id, org_id, source_lang, target_lang, source_term, target_term, context) VALUES
    ('tpb-fr-en-som', 'theplaybutton', 'fr', 'en', 'SOM', 'SOM', 'Standard Operating Model - keep as acronym'),
    ('tpb-fr-en-sop', 'theplaybutton', 'fr', 'en', 'SOP', 'SOP', 'Standard Operating Procedure - keep as acronym'),
    ('tpb-fr-en-lms', 'theplaybutton', 'fr', 'en', 'LMS', 'LMS', 'Learning Management System'),
    ('tpb-fr-en-kms', 'theplaybutton', 'fr', 'en', 'KMS', 'KMS', 'Knowledge Management System'),
    ('tpb-en-fr-som', 'theplaybutton', 'en', 'fr', 'SOM', 'SOM', 'Standard Operating Model - garder acronyme'),
    ('tpb-en-fr-sop', 'theplaybutton', 'en', 'fr', 'SOP', 'SOP', 'Standard Operating Procedure - garder acronyme');
