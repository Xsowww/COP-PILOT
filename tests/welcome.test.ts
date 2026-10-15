import { beforeEach, describe, expect, it } from 'vitest';

const memory = new Map<string, string>();
const session = new Map<string, string>();
const store = (m: Map<string, string>) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) });
Object.assign(globalThis, { location: new URL('http://localhost/'), localStorage: store(memory), sessionStorage: store(session) });
const { loadWelcomeDraft, saveWelcomeDraft, finishWelcome } = await import('../src/store/session');
const { useSettings } = await import('../src/store/settings');
const { useAuth } = await import('../src/store/auth');

const DEFAULTS = { usage: 'etudes', year: '', school: '', program: '', needs: [], persona: 'pote', revisionTime: '18:00' } as const;
const answers = (patch = {}) => ({ ...DEFAULTS, needs: [] as string[], ...patch });

beforeEach(() => {
  session.clear();
  useSettings.getState().reset();
});

describe('welcome questionnaire draft', () => {
  it('comes back after a reload with the question and the answers', () => {
    saveWelcomeDraft('u1', { step: 2, answers: answers({ year: 'L2', school: 'Université de Lyon' }) });
    expect(loadWelcomeDraft('u1', answers(), 6)).toEqual({ step: 2, answers: answers({ year: 'L2', school: 'Université de Lyon' }) });
  });

  it('is per account', () => {
    saveWelcomeDraft('u1', { step: 3, answers: answers() });
    expect(loadWelcomeDraft('u2', answers(), 6)).toBeNull();
  });

  it('ignores broken or out-of-range values', () => {
    session.set('cop:u1:welcome-draft', JSON.stringify({ step: 42, answers: { usage: 'pirate', year: 3, needs: 'ia', school: 'IUT' } }));
    expect(loadWelcomeDraft('u1', answers(), 6)).toEqual({ step: 5, answers: answers({ school: 'IUT' }) });
    session.set('cop:u1:welcome-draft', '{oops');
    expect(loadWelcomeDraft('u1', answers(), 6)).toBeNull();
  });
});

describe('finishWelcome', () => {
  beforeEach(() => useAuth.setState({ user: { id: 'u1', name: 'Lina', email: 'lina@example.com', createdAt: '2026-10-15T10:00:00Z' } } as never));

  it('makes Kompaly speak up for someone who asked for help from the AI', async () => {
    await finishWelcome(answers({ needs: ['agenda', 'ia'] }));
    expect(useSettings.getState().chattiness).toBe('normal');
  });

  it('keeps him quiet otherwise', async () => {
    await finishWelcome(answers({ needs: ['agenda'] }));
    expect(useSettings.getState().chattiness).toBe('calme');
  });

  it('forgets the draft once done', async () => {
    saveWelcomeDraft('u1', { step: 4, answers: answers() });
    await finishWelcome(answers());
    expect(loadWelcomeDraft('u1', answers(), 6)).toBeNull();
  });
});
