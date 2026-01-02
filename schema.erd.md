# LMS Schema - Entity Relationship Diagram

Schema aligné sur Unified.to avec extension minimale pour la gamification.

## Diagramme

```mermaid
erDiagram
    %% ========================================
    %% CRM (Contacts & Events)
    %% ========================================
    
    crm_contact {
        TEXT id PK
        TEXT name
        TEXT first_name
        TEXT last_name
        JSON emails_json
        JSON company_ids_json
        JSON deal_ids_json
        JSON address_json
        JSON telephones_json
        TEXT user_id
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    crm_event {
        TEXT id PK
        TEXT type "PAGE_VIEW|VIDEO_VIEW|FORM|BADGE_EARNED"
        JSON contact_ids_json
        JSON company_ids_json
        JSON deal_ids_json
        JSON lead_ids_json
        TEXT user_id FK
        JSON page_view_json
        JSON form_json
        JSON call_json
        JSON email_json
        JSON meeting_json
        JSON note_json
        JSON task_json
        JSON marketing_email_json
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    %% ========================================
    %% KMS (Knowledge Management)
    %% ========================================
    
    kms_space {
        TEXT id PK
        TEXT name
        TEXT description
        TEXT parent_space_id FK
        INT is_active
        TEXT user_id
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    kms_page {
        TEXT id PK
        TEXT title
        TEXT type "MARKDOWN|HTML|TEXT"
        TEXT space_id FK
        TEXT parent_page_id FK
        TEXT download_url
        INT has_children
        INT is_active
        JSON metadata_json
        TEXT user_id
        TEXT web_url
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    %% ========================================
    %% LMS (Learning Management)
    %% ========================================
    
    lms_course {
        TEXT id PK
        TEXT name
        TEXT description
        JSON categories_json
        JSON media_json
        JSON instructor_ids_json
        JSON student_ids_json
        TEXT currency
        REAL price_amount
        INT is_active
        INT is_private
        JSON languages_json
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    lms_class {
        TEXT id PK
        TEXT course_id FK
        TEXT name
        TEXT description
        JSON media_json "VIDEO|QUIZ objects"
        JSON instructor_ids_json
        JSON student_ids_json
        INT order_index
        JSON languages_json
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    %% ========================================
    %% HRIS (HR/Employees)
    %% ========================================
    
    hris_employee {
        TEXT id PK
        TEXT name
        TEXT first_name
        TEXT last_name
        JSON emails_json
        TEXT title
        TEXT department
        TEXT division
        TEXT manager_id FK
        TEXT company_id
        JSON groups_json
        JSON employee_roles_json
        TEXT employment_status "ACTIVE|INACTIVE"
        TEXT employment_type "FULL_TIME|PART_TIME"
        TEXT image_url
        JSON metadata_json
        JSON raw_json
        TEXT created_at
        TEXT updated_at
        TEXT hired_at
        TEXT terminated_at
    }
    
    hris_group {
        TEXT id PK
        TEXT name
        TEXT type "TEAM|DEPARTMENT|DIVISION"
        TEXT description
        TEXT company_id
        TEXT parent_id FK
        JSON manager_ids_json
        JSON user_ids_json
        INT is_active
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    %% ========================================
    %% GAMIFICATION (Extension)
    %% ========================================
    
    gamification_badge {
        TEXT id PK
        TEXT name
        TEXT description
        TEXT icon_url
        TEXT type "COMPLETION|STREAK|POINTS|ACHIEVEMENT|SKILL"
        TEXT category
        TEXT rarity "COMMON|RARE|EPIC|LEGENDARY"
        INT points_reward
        JSON criteria_json
        INT is_active
        JSON metadata_json
        JSON raw_json
        TEXT created_at
        TEXT updated_at
    }
    
    gamification_award {
        TEXT id PK
        TEXT badge_id FK
        TEXT user_id FK
        TEXT user_type "contact|employee"
        TEXT course_id FK
        TEXT class_id FK
        TEXT awarded_at
        JSON context_json
        JSON raw_json
        TEXT created_at
    }
    
    %% ========================================
    %% VIEWS (Calculated - not tables)
    %% ========================================
    
    v_leaderboard {
        TEXT user_id
        TEXT user_type
        INT total_points
        INT videos_completed
        INT quizzes_completed
        INT badges_earned
    }
    
    v_user_stats {
        TEXT user_id
        INT total_activities
        INT video_views
        INT form_submissions
        TEXT last_activity
    }
    
    %% ========================================
    %% RELATIONSHIPS
    %% ========================================
    
    crm_contact ||--o{ crm_event : "tracked by"
    crm_contact ||--o{ gamification_award : "earns"
    
    hris_employee ||--o{ crm_event : "tracked by"
    hris_employee ||--o{ gamification_award : "earns"
    hris_employee ||--o| hris_employee : "managed by"
    
    hris_group ||--o| hris_group : "parent"
    
    kms_space ||--o{ kms_page : "contains"
    kms_space ||--o| kms_space : "parent"
    kms_page ||--o| kms_page : "parent"
    
    lms_course ||--o{ lms_class : "contains"
    
    gamification_badge ||--o{ gamification_award : "awarded as"
    
    lms_course ||--o{ gamification_award : "context"
    lms_class ||--o{ gamification_award : "context"
    
    crm_event }o--|| v_leaderboard : "aggregates to"
    gamification_award }o--|| v_leaderboard : "aggregates to"
    crm_event }o--|| v_user_stats : "aggregates to"
```

## Modules

| Module | Tables | Description |
|--------|--------|-------------|
| **CRM** | `crm_contact`, `crm_event` | Contacts externes et tracking d'événements |
| **KMS** | `kms_space`, `kms_page` | Gestion de contenu Markdown |
| **LMS** | `lms_course`, `lms_class` | Cours et leçons avec médias |
| **HRIS** | `hris_employee`, `hris_group` | Employés internes et groupes |
| **Gamification** | `gamification_badge`, `gamification_award` | Badges et récompenses |
| **Views** | `v_leaderboard`, `v_user_stats` | Projections calculées |

## Points clés

1. **Alignement Unified.to** : Toutes les tables suivent les modèles Unified.to (champs, types, JSON)
2. **Extension minimale** : Seulement 2 tables ajoutées pour la gamification
3. **Pas de duplication** : Les stats sont des vues, pas des tables
4. **Flexibilité** : Champs `*_json` pour les données complexes et `raw_json` pour les données brutes

