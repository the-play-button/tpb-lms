import { describe, it, expect } from 'vitest';
import { getCourseForUser } from './CoursesService.js';

// Video-hosting capability (Plan 04): media_json of type VIDEO accepts ANY url —
// including a private-YouTube watch/embed url — and the backend returns it verbatim.
// This is what lets us host the classroom's 400 Loom MP4s on a private YouTube
// channel (no R2, no storage cost) and reference them from media_json[].url.

const makeEnv = (rows, course) => ({
  DB: {
    prepare(sqlText) {
      return {
        bind() {
          return {
            async first() { return sqlText.includes('FROM lms_course') ? course : null; },
            async all() { return sqlText.includes('FROM lms_class c') ? { results: rows } : { results: [] }; },
          };
        },
      };
    },
  },
});

const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const ROWS = [
  {
    id: 'les1', course_id: 'c1', parent_class_id: null, node_kind: 'LESSON',
    name: 'Intro', description: null,
    media_json: JSON.stringify([{ url: YT_URL, type: 'VIDEO', name: 'Intro video' }]),
    sys_order_index: 0, raw_json: null,
    video_completed: 0, quiz_passed: 0, video_max_position_sec: null, video_duration_sec: null,
  },
];
const COURSE = { id: 'c1', name: 'C', description: null, categories_json: null, is_active: 1 };

describe('video hosting — YouTube url passthrough', () => {
  it('returns a VIDEO media youtube url verbatim (no rewrite, no loom dependency)', async () => {
    const env = makeEnv(ROWS, COURSE);
    const { body } = await getCourseForUser(env, 'u1', 'c1', null);
    const media = body.classes[0].media;
    expect(media).toHaveLength(1);
    expect(media[0].type).toBe('VIDEO');
    expect(media[0].url).toBe(YT_URL); // preserved exactly
  });
});
