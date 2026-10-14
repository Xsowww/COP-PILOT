// pdf.js's worker, with the missing Map methods installed first (see upsertPolyfill).
import './upsertPolyfill';
import 'pdfjs-dist/build/pdf.worker.min.mjs';
