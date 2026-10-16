/**
 * An SVG is a document that can hold scripts: shown in an <img> they never run, but opened on its own
 * (« Ouvrir l'image dans un nouvel onglet ») they would run inside Kompaly and could read the session.
 * So an SVG (a group member's file, or a file received and put in the Drive) is shown as a PNG drawing of it;
 * other images as they are.
 * Throws when the drawing can't be made (the preview then offers the download only).
 */
export async function safeImageBlob(blob: Blob, name = ''): Promise<Blob> {
  if (!/svg/i.test(blob.type) && !/\.svgz?$/i.test(name)) return blob;
  const src = URL.createObjectURL(new Blob([blob], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w0 = img.naturalWidth || 800;
    const h0 = img.naturalHeight || 600;
    // Sharp on a big screen, without making a huge picture of a huge drawing.
    const scale = Math.min(4, 2000 / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error('svg'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(src);
  }
}
