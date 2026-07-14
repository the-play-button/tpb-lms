/**
 * PAM Port - Interface for Privileged Access Management operations
 *
 * WHY THIS MATTERS:
 * - Decouples business logic from implementation
 * - Enables test mocking without network calls
 * - Allows future provider changes
 *
 * Provides secure delegated access to storage via owner's connection.
 * Owner's token is NEVER exposed - all access goes through PAM.
 */

import type { StorageFile } from '../types/StorageFile.js';

import type { PamVerifyResult } from './PamPort.types/PamVerifyResult';
import type { PamPort } from './PamPort.types/PamPort';
export type { PamVerifyResult };
export type { PamPort };



/**
 * PAM Port interface
 *
 * Provides:
 * - Guest access verification
 * - Delegated file content retrieval
 * - Delegated file listing
 * - Path resolution via owner's connection
 */
