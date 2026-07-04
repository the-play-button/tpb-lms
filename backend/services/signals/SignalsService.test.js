import { describe, it, expect } from 'vitest';
import { fetchCourseSignals } from './SignalsService.js';

// Capture the prepared SQL + serve lesson rows for the steps query. SECTION rows
// must never reach the steps list (they are folders, not steps).
const makeEnv = (lessonRows) => {
    const prepared = [];
    return {
        prepared,
        DB: {
            prepare(sqlText) {
                prepared.push(sqlText);
                return {
                    bind() {
                        return {
                            async all() {
                                return sqlText.includes('FROM lms_class c')
                                    ? { results: lessonRows }
                                    : { results: [] };
                            },
                            async first() { return null; },
                            async run() { return {}; },
                        };
                    },
                };
            },
        },
    };
};

// 2 lessons only — a real DB would exclude the course's SECTION folders via the
// node_kind filter (asserted below).
const lessonRows = [
    { class_id: 'les1', name: 'L1', sys_order_index: 1, media_json: '[]', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
    { class_id: 'les2', name: 'L2', sys_order_index: 2, media_json: '[]', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
];

describe('fetchCourseSignals — SECTION rows excluded from steps', () => {
    it("filters the steps query to node_kind = 'LESSON'", async () => {
        const env = makeEnv(lessonRows);
        await fetchCourseSignals(env, 'user1', 'c1');
        const stepsSql = env.prepared.find((s) => s.includes('FROM lms_class c'));
        expect(stepsSql).toBeDefined();
        expect(stepsSql).toContain("node_kind = 'LESSON'");
    });

    it('counts only lessons as steps', async () => {
        const env = makeEnv(lessonRows);
        const { body } = await fetchCourseSignals(env, 'user1', 'c1');
        expect(body.total_steps).toBe(2);
        expect(body.steps).toHaveLength(2);
        expect(body.steps.every((s) => s.class_id.startsWith('les'))).toBe(true);
    });
});
