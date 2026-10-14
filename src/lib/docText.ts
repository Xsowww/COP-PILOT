// Text inside PDF and Word files, read in the browser (Drive search and Kompa).
// pdf.js and mammoth are heavy: downloaded the first time a document is read.

// Only the worker's URL (a string): the worker itself is downloaded when a PDF is read.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Text of each page, until about `maxChars` characters; `total` is the document's page count. */
export async function pdfPages(blob: Blob, maxChars: number, maxPages = 400): Promise<{ pages: string[]; total: number }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    let size = 0;
    for (let i = 1; i <= Math.min(doc.numPages, maxPages) && size < maxChars; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      const text = content.items.map(it => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join('');
      pages.push(text);
      size += text.length;
    }
    return { pages, total: doc.numPages };
  } finally {
    void task.destroy();
  }
}

export async function docxText(blob: Blob): Promise<string> {
  const mammoth = await import('mammoth');
  return (await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })).value;
}
