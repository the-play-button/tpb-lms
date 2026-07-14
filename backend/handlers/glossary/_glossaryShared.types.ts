export interface GlossaryTermPayload {
    source_lang?: string;
    target_lang?: string;
    source_term?: string;
    target_term?: string;
    context?: string;
    [key: string]: unknown;
}
