-- ============================================
-- Migration 004: Unified.to Conformity
-- ============================================
-- This migration aligns lms_class with unified.to schema.
-- 
-- Changes:
-- 1. Rename order_index → sys_order_index (technical column, not in unified.to)
-- 2. Create lms_enrollment table (TPB extension for enrollment tracking)
-- 
-- Note: step_type and content_md are kept for backward compatibility
-- but should be read from raw_json.tpb_step_type and media[].url going forward.
-- ============================================

-- ============================================
-- Step 1: Rename order_index to sys_order_index
-- ============================================
-- D1 SQLite supports ALTER TABLE RENAME COLUMN

ALTER TABLE lms_class RENAME COLUMN order_index TO sys_order_index;

-- Update indexes to use new column name
DROP INDEX IF EXISTS idx_lms_class_order;
CREATE INDEX IF NOT EXISTS idx_lms_class_order ON lms_class(course_id, sys_order_index);

-- ============================================
-- Step 2: Create lms_enrollment table
-- ============================================
-- TPB Extension: Tracks user enrollments with limit enforcement
-- Convention: Prefix with lms_ for domain, but not an exact unified.to entity

CREATE TABLE IF NOT EXISTS lms_enrollment (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    
    -- Status: active (learning), completed (finished), abandoned (dropped)
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    
    -- Progress tracking
    current_class_id TEXT,                    -- Last accessed class
    completed_classes_count INTEGER DEFAULT 0,
    
    -- Timestamps
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    abandoned_at TEXT,
    last_activity_at TEXT DEFAULT (datetime('now')),
    
    -- Standard timestamps
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Constraints
    UNIQUE(user_id, course_id),
    FOREIGN KEY (course_id) REFERENCES lms_course(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_user ON lms_enrollment(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_course ON lms_enrollment(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_enrollment_active ON lms_enrollment(status) WHERE status = 'active';

-- ============================================
-- Step 3: Add tpb_intro_url support to lms_course
-- ============================================
-- This is stored in raw_json but we document the expected structure here:
-- raw_json: { "tpb_intro_url": "https://raw.githubusercontent.com/.../SOM_XYZ.md" }

-- No schema change needed - raw_json already exists

-- ============================================
-- Documentation: New raw_json conventions
-- ============================================
-- lms_class.raw_json now contains:
--   - tpb_step_type: "VIDEO" | "QUIZ" | "CONTENT" | "MIXED"
--   - tpb_section: Optional section grouping
--   - tpb_content_md: Legacy inline markdown (deprecated)
--
-- lms_course.raw_json now contains:
--   - tpb_intro_url: URL to course overview markdown
--   - tpb_categories: Extended category metadata
-- ============================================
