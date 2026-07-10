/**
 * Plan 11b.b — PamStorageClientAdapter (lms) maps the PamPort onto the tpb-storage SDK StorageClient.
 * verifyAccess : 200 → allowed, 403 → not-allowed, other → rethrow (fail-loud). getContent decodes the
 * downloaded ArrayBuffer. listFiles normalizes FOLDER → the canonical folder mime.
 */
import { describe, it, expect, vi } from 'vitest';
import { PamStorageClientAdapter } from './PamStorageClientAdapter.js';

const makeStorage = (over: Record<string, unknown> = {}) =>
  ({
    getFile: vi.fn(async () => ({ id: 'f1', name: 'f', type: 'FILE' })),
    downloadFile: vi.fn(async () => ({ content: new TextEncoder().encode('hello deck').buffer, mimeType: 'text/plain' })),
    listFiles: vi.fn(async () => [
      { id: 'd1', name: 'sub', type: 'FOLDER' },
      { id: 'f2', name: 'a.txt', type: 'FILE', mime_type: 'text/plain', parent_id: 'd1' },
    ]),
    ...over,
  }) as never;

describe('PamStorageClientAdapter (lms, Plan 11b.b)', () => {
  it('verifyAccess : getFile succeeds → allowed', async () => {
    const a = new PamStorageClientAdapter(makeStorage());
    expect(await a.verifyAccess('c', 'f1', 'g@x.test')).toEqual({ allowed: true });
  });

  it('verifyAccess : 403 → not allowed (no throw)', async () => {
    const a = new PamStorageClientAdapter(makeStorage({
      getFile: vi.fn(async () => { throw new Error('StorageClient /api/storage/file/f1: 403 — forbidden'); }),
    }));
    expect(await a.verifyAccess('c', 'f1', 'g@x.test')).toEqual({ allowed: false });
  });

  it('verifyAccess : non-403 error → rethrow (fail-loud)', async () => {
    const a = new PamStorageClientAdapter(makeStorage({
      getFile: vi.fn(async () => { throw new Error('StorageClient /api/storage/file/f1: 500 — boom'); }),
    }));
    await expect(a.verifyAccess('c', 'f1', 'g@x.test')).rejects.toThrow(/500/);
  });

  it('getContent : decodes the downloaded ArrayBuffer to a string', async () => {
    const a = new PamStorageClientAdapter(makeStorage());
    expect(await a.getContent('c', 'f1', 'g@x.test')).toEqual({ content: 'hello deck' });
  });

  it('listFiles : normalizes FOLDER → the canonical folder mime + camelCase', async () => {
    const a = new PamStorageClientAdapter(makeStorage());
    const files = await a.listFiles('c', 'root', 'g@x.test');
    expect(files[0]).toMatchObject({ id: 'd1', name: 'sub', mimeType: 'application/vnd.folder' });
    expect(files[1]).toMatchObject({ id: 'f2', name: 'a.txt', mimeType: 'text/plain', parentId: 'd1' });
  });

  it('resolveRelativePath : walks folder segments to the terminal file', async () => {
    const a = new PamStorageClientAdapter(makeStorage({
      listFiles: vi.fn(async (_c: string, parentId: string) =>
        parentId === 'root'
          ? [{ id: 'd1', name: 'sub', type: 'FOLDER' }]
          : [{ id: 'f9', name: 'deck.md', type: 'FILE', mime_type: 'text/markdown' }]),
    }));
    const f = await a.resolveRelativePath('c', 'root', 'sub/deck.md', 'g@x.test');
    expect(f).toMatchObject({ id: 'f9', name: 'deck.md' });
  });
});
