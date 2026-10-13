import { describe, expect, it } from 'vitest';
// @ts-expect-error -- server module in plain JavaScript
import { fromOpenAiResponse, parseArgs, parseWait, toOpenAiMessages } from '../server/aiProviders.mjs';
// @ts-expect-error -- server module in plain JavaScript
import { trimHistory } from '../server/copilot.mjs';

describe('adaptateur OpenAI (Groq…)', () => {
  it('garde chaque résultat d’outil relié à son appel', () => {
    const out = toOpenAiMessages('sys', [
      { role: 'user', content: [{ type: 'text', text: 'Mes cours ?' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Je regarde.' }, { type: 'tool_use', id: 't1', name: 'search_site', input: { query: 'cours' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '[]' }] },
    ]);
    expect(out.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(out[2].tool_calls[0]).toMatchObject({ id: 't1', function: { name: 'search_site', arguments: '{"query":"cours"}' } });
    expect(out[3]).toMatchObject({ tool_call_id: 't1', content: '[]' });
  });

  it('transforme une réponse avec appel d’outil, et ignore les outils inconnus', () => {
    const res = fromOpenAiResponse(
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: { content: '<think>hmm</think>Ok', tool_calls: [{ id: 'c1', function: { name: 'add_event', arguments: '{"title":"TD",}' } }, { function: { name: 'pirate', arguments: '{}' } }] },
          },
        ],
      },
      new Set(['add_event']),
    );
    expect(res.stop_reason).toBe('tool_use');
    expect(res.content).toEqual([
      { type: 'text', text: 'Ok' },
      { type: 'tool_use', id: 'c1', name: 'add_event', input: { title: 'TD' } },
    ]);
  });

  it('lit les arguments abîmés quand c’est possible', () => {
    expect(parseArgs('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseArgs('')).toEqual({});
    expect(parseArgs('{oups')).toBeNull();
  });

  it.each([
    ['30', 30],
    ['2m59.5s', 180], // arrondi à la seconde supérieure
    ['7h3m', 25380],
    [null, undefined],
  ])('délai d’attente %s', (v, s) => {
    expect(parseWait(v)).toBe(s);
  });
});

describe('trimHistory', () => {
  const q = (t: string) => ({ role: 'user', content: [{ type: 'text', text: t }] });
  const call = { role: 'assistant', content: [{ type: 'tool_use', id: 'r', name: 'read_file', input: {} }] };
  const result = (n: number) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'r', content: 'x'.repeat(n) }] });

  it('commence toujours par une question, jamais entre un appel et son résultat', () => {
    const h = [q('1'), call, result(50), q('2'), call, result(50)];
    const out = trimHistory(h, { budget: 300, toolChars: 1000 });
    expect(out[0]).toEqual(q('2'));
    expect(out).toHaveLength(3);
  });

  it('coupe un long fichier dans l’échange en cours et raccourcit les anciens', () => {
    const out = trimHistory([q('1'), call, result(5000), q('2'), call, result(20000)], { budget: 100_000, toolChars: 6000 });
    expect(out[2].content[0].content.length).toBeLessThan(400);
    expect(out[5].content[0].content).toMatch(/^x{6000}\n\[… coupé/);
  });
});
