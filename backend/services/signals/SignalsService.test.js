import { describe, it, expect } from 'vitest';
import { fetchCourseSignals } from './SignalsService.js';

// Capture the prepared SQL + serve lesson rows for the steps query. SECTION rows
// must never reach the steps list (they are folders, not steps). `courseRaw` feeds
// the lms_course.raw_json read used to resolve the progression mode.
const makeEnv = (lessonRows, courseRaw = null) => {
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
                            async first() {
                                return sqlText.includes('FROM lms_course') ? { raw_json: courseRaw } : null;
                            },
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
    { class_id: 'les1', name: 'L1', sys_order_index: 1, media_json: '[{"type":"VIDEO"}]', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
    { class_id: 'les2', name: 'L2', sys_order_index: 2, media_json: '[{"type":"VIDEO"}]', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
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

describe('fetchCourseSignals — progression mode', () => {
    it('linear (default): fresh course only unlocks step 1', async () => {
        const { body } = await fetchCourseSignals(makeEnv(lessonRows, null), 'user1', 'c1');
        expect(body.progression_mode).toBe('linear');
        expect(body.can_access_step).toBe(1); // fresh: only step 1 reachable
        expect(body.steps[0].can_access).toBe(true);  // sys_order_index 1 <= 1
        expect(body.steps[1].can_access).toBe(false); // sys_order_index 2 > 1 → locked
    });

    it('free: every lesson reachable, can_access_step = total', async () => {
        const rows = [
            ...lessonRows,
            { class_id: 'les3', name: 'L3', sys_order_index: 3, media_json: '[{"type":"VIDEO"}]', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
        ];
        const env = makeEnv(rows, '{"tpb_progression_mode":"free"}');
        const { body } = await fetchCourseSignals(env, 'user1', 'c1');
        expect(body.progression_mode).toBe('free');
        expect(body.can_access_step).toBe(3); // = total
        expect(body.steps.every((s) => s.can_access === true)).toBe(true);
    });

    it('linear locks steps beyond the next one', async () => {
        const rows = [
            ...lessonRows,
            { class_id: 'les3', name: 'L3', sys_order_index: 3, media_json: '[{"type":"VIDEO"}]', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
        ];
        const { body } = await fetchCourseSignals(makeEnv(rows, null), 'user1', 'c1');
        expect(body.can_access_step).toBe(1);
        expect(body.steps[2].can_access).toBe(false); // step 3 locked (fresh)
    });
});
