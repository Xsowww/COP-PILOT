// Read-only previews of Word (.docx) and PowerPoint (.pptx) files, built in the browser.
// mammoth and jszip are imported on demand so they stay out of the main bundle.

import { safeImageBlob } from '../../lib/safeImage';

/** Keeps only harmless markup: no scripts, frames, styles, event handlers or javascript: links. */
export function sanitizeHtml(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button, textarea, select').forEach(n => n.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on') || name === 'style' || name === 'srcset') el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src') && !(value.startsWith('data:image/') || value.startsWith('http') || value.startsWith('#'))) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML;
}

export async function docxToHtml(blob: Blob) {
  const mammoth = await import('mammoth');
  // Word's « Titre » / « Sous-titre » styles are not mapped by default: show them as headings.
  const styleMap = [
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Titre'] => h1:fresh",
    "p[style-name='Subtitle'] => h2:fresh",
    "p[style-name='Sous-titre'] => h2:fresh",
  ];
  const res = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() }, { styleMap });
  return sanitizeHtml(res.value);
}

export interface Slide {
  title: string;
  paragraphs: { text: string; level: number }[];
  /** Object URLs: revoke them with `revokeSlides`. */
  images: string[];
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' };

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

/** "../media/image1.png" relative to "ppt/slides/" → "ppt/media/image1.png" */
function resolvePath(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/');
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/** Relationship id → target path, for a part's .rels file. */
function readRels(xml: string | undefined, baseDir: string) {
  const map = new Map<string, string>();
  if (!xml) return map;
  for (const rel of parseXml(xml).getElementsByTagName('Relationship')) {
    map.set(rel.getAttribute('Id') ?? '', resolvePath(baseDir, rel.getAttribute('Target') ?? ''));
  }
  return map;
}

/** Text and pictures of each slide, in presentation order. Layout and styling are not reproduced. */
export async function pptxSlides(blob: Blob): Promise<Slide[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const read = (path: string) => zip.file(path)?.async('string');

  // Slide order comes from presentation.xml; fall back to the file numbers.
  let paths: string[] = [];
  const pres = await read('ppt/presentation.xml');
  if (pres) {
    const rels = readRels(await read('ppt/_rels/presentation.xml.rels'), 'ppt');
    paths = [...parseXml(pres).getElementsByTagName('p:sldId')].map(s => rels.get(s.getAttribute('r:id') ?? '') ?? '').filter(p => zip.file(p));
  }
  if (!paths.length) {
    const num = (p: string) => Number(p.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
    paths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => num(a) - num(b));
  }

  const slides: Slide[] = [];
  for (const path of paths) {
    const xml = parseXml((await read(path)) ?? '');
    const name = path.split('/').pop()!;
    const rels = readRels(await read(`ppt/slides/_rels/${name}.rels`), 'ppt/slides');
    const slide: Slide = { title: '', paragraphs: [], images: [] };

    for (const shape of xml.getElementsByTagName('p:sp')) {
      const ph = shape.getElementsByTagName('p:ph')[0]?.getAttribute('type');
      const isTitle = ph === 'title' || ph === 'ctrTitle';
      for (const p of shape.getElementsByTagName('a:p')) {
        const text = [...p.getElementsByTagName('a:t')].map(t => t.textContent ?? '').join('').trim();
        if (!text) continue;
        if (isTitle && !slide.title) slide.title = text;
        else slide.paragraphs.push({ text, level: Number(p.getElementsByTagName('a:pPr')[0]?.getAttribute('lvl') ?? 0) });
      }
    }
    // Tables keep their text too, one paragraph per cell row.
    for (const row of xml.getElementsByTagName('a:tr')) {
      const cells = [...row.getElementsByTagName('a:tc')].map(c => [...c.getElementsByTagName('a:t')].map(t => t.textContent).join('').trim());
      if (cells.some(Boolean)) slide.paragraphs.push({ text: cells.join('  ·  '), level: 0 });
    }
    for (const blip of xml.getElementsByTagName('a:blip')) {
      const target = rels.get(blip.getAttribute('r:embed') ?? '');
      const file = target ? zip.file(target) : null;
      const ext = target?.split('.').pop()?.toLowerCase() ?? '';
      if (!file || !MIME[ext] || slide.images.length >= 4) continue;
      const img = await safeImageBlob(new Blob([await file.async('arraybuffer')], { type: MIME[ext] })).catch(() => null);
      if (img) slide.images.push(URL.createObjectURL(img));
    }
    slides.push(slide);
  }
  return slides;
}

export const revokeSlides = (slides: Slide[]) => slides.forEach(s => s.images.forEach(u => URL.revokeObjectURL(u)));
