/**
 * ConnectionResolver Port - Interface for multi-tenant connection routing
 *
 * WHY THIS MATTERS:
 * - Decouples business logic from implementation
 * - Enables test mocking without network calls
 * - Allows future provider changes
 *
 * Provides intelligent routing to find the right connection:
 * - Explicit connectionId (direct use)
 * - Provider-based routing with folder access check
 * - Fallback to default connection
 */

import type { ConnectionInfo } from '../types/ConnectionInfo.js';

import type { ResolveConnectionOptions } from './ConnectionResolverPort.types/ResolveConnectionOptions';
import type { ConnectionResolverConfig } from './ConnectionResolverPort.types/ConnectionResolverConfig';
import type { ConnectionResolverPort } from './ConnectionResolverPort.types/ConnectionResolverPort';
export type { ResolveConnectionOptions };
export type { ConnectionResolverConfig };
export type { ConnectionResolverPort };




