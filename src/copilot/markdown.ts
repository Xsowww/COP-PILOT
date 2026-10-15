// A tiny Markdown reader for Kompaly's answers: bold, italics, inline code, code blocks,
// bullet / numbered lists, quotes, headings and line breaks. It produces plain data that
// Markdown.tsx turns into React elements — no HTML string is ever injected in the page.

export type Inline = { t: 'text'; v: string } | { t: 'code'; v: string } | { t: 'strong'; c: Inline[] } | { t: 'em'; c: Inline[] } | { t: 'br' };

export type MdBlock =
  | { t: 'p'; c: Inline[] }
  | { t: 'h'; c: Inline[] }
  | { t: 'quote'; c: Inline[] }
  | { t: 'code'; v: string; lang: string }
  | { t: 'ul' | 'ol'; items: Inline[][]; start: number };

// Order matters: code first (its content is literal), then bold before italics.
const INLINE = /(`+)([^`]+?)\1|\*\*(.+?)\*\*|__(.+?)__|\*(?!\s)(.+?)(?<!\s)\*|(?<![\p{L}\p{N}])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}])|\[([^\]]+)\]\(([^)\s]+)\)/u;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (v: string) => {
    const lines = v.split('\n');
    lines.forEach((l, i) => {
      if (i) out.push({ t: 'br' });
      if (l) out.push({ t: 'text', v: l });
    });
  };
  let rest = src;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      pushText(rest);
      break;
    }
    if (m.index) pushText(rest.slice(0, m.index));
    if (m[2] !== undefined) out.push({ t: 'code', v: m[2] });
    else if (m[3] !== undefined || m[4] !== undefined) out.push({ t: 'strong', c: parseInline(m[3] ?? m[4]) });
    else if (m[5] !== undefined || m[6] !== undefined) out.push({ t: 'em', c: parseInline(m[5] ?? m[6]) });
    else out.push({ t: 'text', v: m[7] }); // links: keep the label only
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const BULLET = /^\s*[-*•+]\s+(.*)$/;
const NUMBER = /^\s*(\d{1,3})[.)]\s+(.*)$/;

export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', c: parseInline(para.join('\n')) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ t: 'code', v: code.join('\n'), lang: fence[1] });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const h = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ t: 'h', c: parseInline(h[1].replace(/\s*#+\s*$/, '')) });
      continue;
    }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) {
      flush();
      const prev = blocks[blocks.length - 1];
      if (prev?.t === 'quote') prev.c.push({ t: 'br' }, ...parseInline(q[1]));
      else blocks.push({ t: 'quote', c: parseInline(q[1]) });
      continue;
    }
    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBER);
    if (b || n) {
      flush();
      const kind = b ? 'ul' : 'ol';
      const text = b ? b[1] : n![2];
      const prev = blocks[blocks.length - 1];
      // Same kind of list right before (even after a blank line, « loose » lists): same list.
      if (prev && prev.t === kind) prev.items.push(parseInline(text));
      else blocks.push({ t: kind, items: [parseInline(text)], start: n ? Number(n[1]) : 1 });
      continue;
    }
    // Indented line right after a list item: continuation of that item.
    const prev = blocks[blocks.length - 1];
    if (!para.length && prev && (prev.t === 'ul' || prev.t === 'ol') && /^\s{2,}\S/.test(line) && lines[i - 1]?.trim()) {
      prev.items[prev.items.length - 1].push({ t: 'br' }, ...parseInline(line.trim()));
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/**
 * French spacing for Kompaly's words, applied when they are shown (plain text only, never code):
 * a no-break space inside « » and before : ; ? !, so a quote mark or a colon never ends up alone on a line.
 */
export function frenchSpacing(text: string): string {
  return text
    .replace(/«[ \t\u00a0\u202f]*/g, '«\u00a0')
    .replace(/[ \t\u00a0\u202f]*»/g, '\u00a0»')
    .replace(/[ \t\u202f]+(?=[:;?!])/g, '\u00a0');
}

/** Plain text for speech synthesis and copying: no Markdown symbols left. */
export function stripMarkdown(src: string): string {
  return src
    .replace(/```[\w+-]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '$1$2')
    .replace(/(^|[^\p{L}\p{N}*])[*_](?!\s)(.+?)(?<!\s)[*_]/gu, '$1$2')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*•+]\s+/gm, '')
    .trim();
}
