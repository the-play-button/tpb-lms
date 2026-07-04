import { describe, it, expect, vi } from 'vitest';
import { resolveProgressionMode, PROGRESSION_MODES, DEFAULT_PROGRESSION_MODE } from './_progressionMode.js';

describe('resolveProgressionMode', () => {
  it('defaults to linear for null/empty/absent', () => {
    expect(resolveProgressionMode(null)).toBe('linear');
    expect(resolveProgressionMode(undefined)).toBe('linear');
    expect(resolveProgressionMode('')).toBe('linear');
    expect(resolveProgressionMode('{}')).toBe('linear');
    expect(resolveProgressionMode('{"tpb_step_type":"VIDEO"}')).toBe('linear');
  });

  it('reads free when set (string or parsed object)', () => {
    expect(resolveProgressionMode('{"tpb_progression_mode":"free"}')).toBe('free');
    expect(resolveProgressionMode({ tpb_progression_mode: 'free' })).toBe('free');
    expect(resolveProgressionMode('{"tpb_progression_mode":"linear"}')).toBe('linear');
  });

  it('defaults to linear + warns on an invalid explicit value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveProgressionMode('{"tpb_progression_mode":"skool"}')).toBe('linear');
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('defaults to linear on malformed json (no throw)', () => {
    expect(resolveProgressionMode('{not json')).toBe('linear');
  });

  it('exposes the canonical mode set + default', () => {
    expect(PROGRESSION_MODES).toEqual(['linear', 'free']);
    expect(DEFAULT_PROGRESSION_MODE).toBe('linear');
  });
});
