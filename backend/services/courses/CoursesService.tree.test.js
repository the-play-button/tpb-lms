import { describe, it, expect } from 'vitest';
import { getCourseForUser } from './CoursesService.js';

// Minimal env.DB mock: prepare(sql).bind(...).all()/.first() routes by SQL text.
const makeEnv = (rows, course) => ({
    DB: {
        prepare(sqlText) {
            return {
                bind() {
                    return {
                        async first() {
                            if (sqlText.includes('FROM lms_course')) return course;
                            return null;
                        },
                        async all() {
                            if (sqlText.includes('FROM lms_class c')) return { results: rows };
                            // translations query
                            return { results: [] };
                        },
                    };
                },
            };
        },
    },
});

// Tree: course c1
//   SECTION "Month 1" (sec1)
//     SECTION "Week 1" (sec1a)
//       LESSON "L1" (les1)
//     LESSON "L2" (les2)
//   LESSON "L3" (les3, top-level)
const ROWS = [
    { id: 'sec1', course_id: 'c1', name: 'Month 1', description: null, media_json: null, sys_order_index: 0, raw_json: null, parent_class_id: null, node_kind: 'SECTION', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
    { id: 'sec1a', course_id: 'c1', name: 'Week 1', description: null, media_json: null, sys_order_index: 0, raw_json: null, parent_class_id: 'sec1', node_kind: 'SECTION', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
    { id: 'les1', course_id: 'c1', name: 'L1', description: null, media_json: '[{"url":"https://youtu.be/x","type":"VIDEO","name":"v"}]', sys_order_index: 0, raw_json: null, parent_class_id: 'sec1a', node_kind: 'LESSON', video_completed: 1, quiz_passed: 0, video_max_position_sec: 100, video_duration_sec: 100 },
    { id: 'les2', course_id: 'c1', name: 'L2', description: null, media_json: '[]', sys_order_index: 1, raw_json: null, parent_class_id: 'sec1', node_kind: 'LESSON', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
    { id: 'les3', course_id: 'c1', name: 'L3', description: null, media_json: '[]', sys_order_index: 1, raw_json: null, parent_class_id: null, node_kind: 'LESSON', video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null },
];

const COURSE = { id: 'c1', name: 'Test Course', description: 'd', categories_json: null, is_active: 1 };

describe('getCourseForUser — nested sections (adjacency-list tree)', () => {
    it('builds a nested nodes[] tree with SECTION folders and LESSON leaves', async () => {
        const env = makeEnv(ROWS, COURSE);
        const { body } = await getCourseForUser(env, 'u1', 'c1', null);

        expect(body.nodes).toHaveLength(2); // sec1 + les3 at top level
        const [sec1, les3] = body.nodes;
        expect(sec1.node_kind).toBe('SECTION');
        expect(sec1.name).toBe('Month 1');
        expect(les3.node_kind).toBe('LESSON');
        expect(les3.name).toBe('L3');

        // sec1 children: sec1a (SECTION) then les2 (LESSON), ordered by sys_order_index
        expect(sec1.children).toHaveLength(2);
        expect(sec1.children[0].id).toBe('sec1a');
        expect(sec1.children[0].node_kind).toBe('SECTION');
        expect(sec1.children[1].id).toBe('les2');

        // deep lesson under Week 1
        expect(sec1.children[0].children).toHaveLength(1);
        expect(sec1.children[0].children[0].id).toBe('les1');
        expect(sec1.children[0].children[0].node_kind).toBe('LESSON');
    });

    it('flattens LESSON leaves in DFS order for sequential progress', async () => {
        const env = makeEnv(ROWS, COURSE);
        const { body } = await getCourseForUser(env, 'u1', 'c1', null);

        // DFS order: les1 (deep) → les2 → les3
        expect(body.classes.map((c) => c.id)).toEqual(['les1', 'les2', 'les3']);
        // global step index reassigned by position
        expect(body.classes.map((c) => c.order_index)).toEqual([0, 1, 2]);
        expect(body.progress.total_steps).toBe(3);
    });

    it('does not leak SECTION nodes into the flat classes list', async () => {
        const env = makeEnv(ROWS, COURSE);
        const { body } = await getCourseForUser(env, 'u1', 'c1', null);
        expect(body.classes.every((c) => c.node_kind !== 'SECTION')).toBe(true);
    });

    it('returns 404-shape when course missing', async () => {
        const env = makeEnv([], null);
        const res = await getCourseForUser(env, 'u1', 'missing', null);
        expect(res.notFound).toBe(true);
    });
});

describe('getCourseForUser — progression mode', () => {
    it('defaults to linear (can_access_step gated) with no raw_json', async () => {
        const { body } = await getCourseForUser(makeEnv(ROWS, COURSE), 'u1', 'c1', null);
        expect(body.progression_mode).toBe('linear');
        // les1 is completed in the fixture → currentStepIndex 1 → gate = min(2, 3).
        expect(body.progress.can_access_step).toBe(2);
        expect(body.progress.can_access_step).toBeLessThan(body.progress.total_steps);
    });

    it('free: can_access_step = total (all reachable)', async () => {
        const freeCourse = { ...COURSE, raw_json: '{"tpb_progression_mode":"free"}' };
        const { body } = await getCourseForUser(makeEnv(ROWS, freeCourse), 'u1', 'c1', null);
        expect(body.progression_mode).toBe('free');
        expect(body.progress.can_access_step).toBe(body.progress.total_steps);
        expect(body.progress.can_access_step).toBe(3);
    });
});
