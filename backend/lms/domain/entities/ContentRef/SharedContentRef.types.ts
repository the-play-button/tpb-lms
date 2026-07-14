import { fail, succeed, type Result } from '../../core/Result.js';
import type { ContentRefId, Email } from '../../value-objects/index.js';
import type { ContentRefProps } from './types.js';
import type { ActiveShare } from '../Share/ActiveShare.js';
import { BaseContentRef } from './BaseContentRef.js';

export type ShareRole = 'viewer' | 'editor';
