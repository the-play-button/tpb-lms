-- Migration 003: Seed translations for existing courses
-- Date: 2026-01-10
-- pw05-2: French → English
-- pa06-2: English → French

-- ============================================
-- PW05-2: French course → English translations
-- ============================================

-- Course name
INSERT OR REPLACE INTO translations (id, content_type, content_id, field, lang, value, source) VALUES
('course:pw05-2:name:en', 'course', 'pw05-2', 'name', 'en', 'WGE Integration Program', 'ai');

-- Course description
INSERT OR REPLACE INTO translations (id, content_type, content_id, field, lang, value, source) VALUES
('course:pw05-2:description:en', 'course', 'pw05-2', 'description', 'en', 'Integration program for new Wonder Grip Europe employees. Discover company values, meet the team, learn processes and tools.', 'ai');

-- Class names (pw05-2)
INSERT OR REPLACE INTO translations (id, content_type, content_id, field, lang, value, source) VALUES
('class:step01-valeurs-wge:name:en', 'class', 'step01-valeurs-wge', 'name', 'en', 'STEP 01: WGE Values', 'ai'),
('class:step02-vie-entreprise:name:en', 'class', 'step02-vie-entreprise', 'name', 'en', 'STEP 02: Life at the Company', 'ai'),
('class:step03-process-operations:name:en', 'class', 'step03-process-operations', 'name', 'en', 'STEP 03: Process & Operations', 'ai'),
('class:step04-it-system:name:en', 'class', 'step04-it-system', 'name', 'en', 'STEP 04: IT & Systems', 'ai'),
('class:step05-presentation-entreprise:name:en', 'class', 'step05-presentation-entreprise', 'name', 'en', 'STEP 05: Company Presentation', 'ai'),
('class:step06-marche-francais:name:en', 'class', 'step06-marche-francais', 'name', 'en', 'STEP 06: The French Market', 'ai');

-- ============================================
-- PA06-2: English course → French translations
-- ============================================

-- Course name
INSERT OR REPLACE INTO translations (id, content_type, content_id, field, lang, value, source) VALUES
('course:pa06-2:name:fr', 'course', 'pa06-2', 'name', 'fr', 'Comment Rédiger des SOMs Numériques Complets', 'ai');

-- Course description
INSERT OR REPLACE INTO translations (id, content_type, content_id, field, lang, value, source) VALUES
('course:pa06-2:description:fr', 'course', 'pa06-2', 'description', 'fr', 'Méthodologie complète pour créer des SOMs numériques de haute qualité servant à la fois de KMS et de LMS avec vidéos, schémas et métadonnées.', 'ai');

-- Class names (pa06-2)
INSERT OR REPLACE INTO translations (id, content_type, content_id, field, lang, value, source) VALUES
('class:step01-preparation:name:fr', 'class', 'step01-preparation', 'name', 'fr', 'ÉTAPE 01 : Préparation (Avant la Rédaction)', 'ai'),
('class:step02-create-structure:name:fr', 'class', 'step02-create-structure', 'name', 'fr', 'ÉTAPE 02 : Créer la Structure', 'ai'),
('class:step03-fill-metadata:name:fr', 'class', 'step03-fill-metadata', 'name', 'fr', 'ÉTAPE 03 : Remplir les Métadonnées (En-tête YAML)', 'ai'),
('class:step04-write-why:name:fr', 'class', 'step04-write-why', 'name', 'fr', 'ÉTAPE 04 : Rédiger le POURQUOI (2+ Perspectives)', 'ai'),
('class:step05-clarify-what:name:fr', 'class', 'step05-clarify-what', 'name', 'fr', 'ÉTAPE 05 : Clarifier le QUOI (Par Contraste)', 'ai'),
('class:step06-define-who-when:name:fr', 'class', 'step06-define-who-when', 'name', 'fr', 'ÉTAPE 06 : Définir le QUI et le QUAND', 'ai'),
('class:step07-write-how:name:fr', 'class', 'step07-write-how', 'name', 'fr', 'ÉTAPE 07 : Rédiger le COMMENT (Cœur Opérationnel)', 'ai'),
('class:step08-1-video:name:fr', 'class', 'step08-1-video', 'name', 'fr', 'ÉTAPE 08.1 : Vidéo (Créer seulement si bénéfique)', 'ai'),
('class:step08-2-drawings:name:fr', 'class', 'step08-2-drawings', 'name', 'fr', 'ÉTAPE 08.2 : Schémas (Créer seulement pour les workflows complexes)', 'ai'),
('class:step08-3-references:name:fr', 'class', 'step08-3-references', 'name', 'fr', 'ÉTAPE 08.3 : Références', 'ai'),
('class:step09-validation-quizzes:name:fr', 'class', 'step09-validation-quizzes', 'name', 'fr', 'ÉTAPE 09 : Rédiger la Checklist de Validation et les Quiz', 'ai'),
('class:step10-notes-references:name:fr', 'class', 'step10-notes-references', 'name', 'fr', 'ÉTAPE 10 : Ajouter Notes et Références', 'ai'),
('class:step11-review-publish:name:fr', 'class', 'step11-review-publish', 'name', 'fr', 'ÉTAPE 11 : Relecture, Validation et Publication', 'ai'),
('class:step12-convert-distribute:name:fr', 'class', 'step12-convert-distribute', 'name', 'fr', 'ÉTAPE 12 : Convertir et Distribuer (Pour Utilisateurs Non-Techniques)', 'ai'),
('class:step13-pruning-archiving:name:fr', 'class', 'step13-pruning-archiving', 'name', 'fr', 'ÉTAPE 13 : Élagage et Maintenance (Hebdomadaire)', 'ai');
