/**
 * Event Validation Schemas
 * GAPs: GAP-710, GAP-1210
 * 
 * Zod via ESM CDN - zero npm, zero node_modules
 */

import { z } from 'zod';

export const videoPlaySchema = z.object({
  type: z.enum(['VIDEO_PLAY', 'VIDEO_PAUSE']),
  course_id: z.string().min(1),
  class_id: z.string().min(1),
  payload: z.object({
    video_id: z.string().optional()
  }).optional().default({})
});

export const videoPingSchema = z.object({
  type: z.literal('VIDEO_PING'),
  course_id: z.string().min(1),
  class_id: z.string().min(1),
  payload: z.object({
    video_id: z.string().optional(),
    position_sec: z.number().min(0),
    duration_sec: z.number().positive()
  })
});

export const quizSubmitSchema = z.object({
  type: z.literal('QUIZ_SUBMIT'),
  course_id: z.string().min(1),
  class_id: z.string().min(1),
  payload: z.object({
    quiz_id: z.string().optional(),
    score: z.number().min(0),
    max_score: z.number().positive()
  })
});

const schemas = {
  VIDEO_PLAY: videoPlaySchema,
  VIDEO_PAUSE: videoPlaySchema,
  VIDEO_PING: videoPingSchema,
  QUIZ_SUBMIT: quizSubmitSchema
};

/**
 * Validate an event body
 * @param {object} body - Raw request body
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export const validateEvent = (body: unknown): {
    success: false;
    error: string;
    data?: undefined;
} | {
    success: true;
    data: {
        type: "VIDEO_PLAY" | "VIDEO_PAUSE";
        payload: {
            video_id?: string | undefined;
        };
        course_id: string;
        class_id: string;
    } | {
        type: "VIDEO_PING";
        payload: {
            position_sec: number;
            duration_sec: number;
            video_id?: string | undefined;
        };
        course_id: string;
        class_id: string;
    } | {
        type: "QUIZ_SUBMIT";
        payload: {
            score: number;
            max_score: number;
            quiz_id?: string | undefined;
        };
        course_id: string;
        class_id: string;
    };
    error?: undefined;
}  => {
  const typed = body as { type?: string } | null;
  if (!typed?.type) {
    return { success: false as const, error: 'type is required' };
  }

  const schema = schemas[typed.type as keyof typeof schemas];
  if (!schema) {
    return { success: false as const, error: `Unknown event type: ${typed.type}` };
  }

  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true as const, data: result.data };
  }

  return {
    success: false as const,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
  };
};
