// Reads the text of a Drive file so Copilot can summarise it, make a revision sheet or a quiz.
// Loaded on demand: pdf.js and mammoth are only downloaded the first time a file is read.

import { useDrive, categoryOf } from '../store/drive';
import { blobStore } from '../lib/blobStore';
import { blobKey } from '../lib/userStorage';
// Only the worker's URL (a string): the worker itself is downloaded when a PDF is read.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export const MAX_FILE_CHARS = 30_000;

export interface FileText {
  name: string;
  text: string;
  pages?: number;
  truncated: boolean;
}

const TEXT_EXT = ['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'html', 'htm', 'xml', 'tex', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'css', 'sql', 'yaml', 'yml'];

async function pdfText(blob: Blob): Promise<{ text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const doc = await task.promise;
  const parts: string[] = [];
  let size = 0;
  for (let i = 1; i <= doc.numPages && size < MAX_FILE_CHARS; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map(it => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : ''))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim();
    parts.push(`[Page ${i}]\n${line}`);
    size += line.length;
  }
  const pages = doc.numPages;
  void task.destroy();
  return { text: parts.join('\n\n'), pages };
}

async function docxText(blob: Blob): Promise<string> {
  const mammoth = await import('mammoth');
  const res = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() });
  return res.value;
}

/** Text of a Drive file, or an error message the AI can relay. */
export async function readFileText(id: string): Promise<FileText | { error: string }> {
  const item = useDrive.getState().items.find(i => i.id === id && i.kind === 'file');
  if (!item) return { error: 'fichier introuvable (donne un id de fichier venant de search_site ou list_drive_folder)' };
  const cat = categoryOf(item);
  const ext = item.name.split('.').pop()?.toLowerCase() ?? '';
  const readable = cat === 'pdf' || cat === 'text' || ext === 'docx' || TEXT_EXT.includes(ext) || (item.mime ?? '').startsWith('text/');
  if (!readable) return { error: `je ne sais pas lire ce type de fichier (${ext || item.mime || 'inconnu'}) : seulement PDF, docx et fichiers texte` };
  const blob = await blobStore.get(blobKey(item.id));
  if (!blob) return { error: 'contenu du fichier indisponible' };
  let text: string;
  let pages: number | undefined;
  try {
    if (cat === 'pdf') ({ text, pages } = await pdfText(blob));
    else if (ext === 'docx') text = await docxText(blob);
    else text = await blob.text();
  } catch {
    return { error: 'impossible de lire ce fichier (protégé ou abîmé ?)' };
  }
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return { error: cat === 'pdf' ? 'ce PDF ne contient pas de texte sélectionnable (probablement un scan)' : 'le fichier est vide' };
  const truncated = text.length > MAX_FILE_CHARS;
  return { name: item.name, text: truncated ? `${text.slice(0, MAX_FILE_CHARS)}\n[… tronqué]` : text, pages, truncated };
}
