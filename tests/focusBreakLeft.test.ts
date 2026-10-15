import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();
Object.assign(globalThis, {
  location: new URL('http://localhost/'),
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { useFocus, settleFocus } = await import('../src/store/focus');
const { useFocusLog } = await import('../src/store/focusLog');
const { useSettings } = await import('../src/store/settings');
const { useCopilot } = await import('../src/store/copilot');

const MIN = 60_000;
const lastSaid = () => useCopilot.getState().messages.at(-1)?.text ?? '';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T10:00:00'));
  useFocusLog.setState({ sessions: [] });
  useCopilot.setState({ messages: [] });
  useFocus.setState({ phase: null, pausedLeft: null, label: '', endsAt: 0, minutes: 0 });
  useSettings.getState().set({ focusMinutes: 25, breakMinutes: 5, focusSound: false });
});

describe('end of a focus session', () => {
  it('announces the full break when the session ends with the tab open', () => {
    useFocus.getState().start('Chimie');
    vi.setSystemTime(Date.now() + 25 * MIN + 500);
    useFocus.getState().tick();
    expect(useFocus.getState().phase).toBe('break');
    expect(lastSaid()).toMatch(/5\u00a0min/);
    expect(lastSaid()).not.toMatch(/reste/);
  });

  it('gives the break time left when coming back during the break', () => {
    useFocus.getState().start('Chimie');
    vi.setSystemTime(Date.now() + 27 * MIN);
    settleFocus();
    expect(useFocus.getState().phase).toBe('break');
    expect(lastSaid()).toContain('Il te reste 3\u00a0min de pause');
    expect(lastSaid()).not.toMatch(/Pause de 5/);
  });
});
