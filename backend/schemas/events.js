/**
 * Event Validation Schemas
 * GAPs: GAP-710, GAP-1210
 * 
 * Zod via ESM CDN - zero npm, zero node_modules
 */

import { z } from 'zod';

// VIDEO_PLAY / VIDEO_PAUSE - minimal payload
export const videoPlaySchema = z.object({
  type: z.enum(['VIDEO_PLAY', 'VIDEO_PAUSE']),
  course_id: z.string().min(1),
  class_id: z.string().min(1),
  payload: z.object({
    video_id: z.string().optional()
  }).optional().default({})
});

// VIDEO_PING - requires position and duration
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

// QUIZ_SUBMIT - requires score
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

// Map type -> schema
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
export const validateEvent = (body) => {
  if (!body?.type) {
    return { success: false, error: 'type is required' };
  }
  
  const schema = schemas[body.type];
  if (!schema) {
    return { success: false, error: `Unknown event type: ${body.type}` };
  }
  
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { 
    success: false, 
    error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
  };
};
