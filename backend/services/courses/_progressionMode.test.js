import { describe, it, expect, vi } from 'vitest';
import { resolveProgressionMode } from './_progressionMode.js';
import { PROGRESSION_MODES } from '../../lms/domain/ProgressionMode.js';

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

  it('resolves exactly the canonical domain mode set (SSOT lms/domain/ProgressionMode)', () => {
    expect(PROGRESSION_MODES).toEqual(['linear', 'free']);
    for (const mode of PROGRESSION_MODES) {
      expect(resolveProgressionMode({ tpb_progression_mode: mode })).toBe(mode);
    }
  });
});
