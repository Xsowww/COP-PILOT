import './upsertPolyfill';

let worker: Worker | null = null;

/** pdf.js, downloaded the first time a PDF is read, with its worker started once for the whole app. */
export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!worker) {
    worker = new Worker(new URL('./pdfWorker.ts', import.meta.url), { type: 'module' });
    pdfjs.GlobalWorkerOptions.workerPort = worker;
  }
  return pdfjs;
}
