import { useEffect, useState } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import { categoryOf, getFileUrl, type DriveItem } from '../../store/drive';
import { downloadItem } from './download';
import { formatBytes, relativeTime } from '../../lib/utils';
import FileIcon from '../../components/FileIcon';

export default function PreviewModal({ item, onClose }: { item: DriveItem; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const cat = categoryOf(item);

  useEffect(() => {
    let revoked = false;
    let current: string | null = null;
    void getFileUrl(item.id).then(async u => {
      if (revoked) return u && URL.revokeObjectURL(u);
      if (!u) return setMissing(true);
      current = u;
      setUrl(u);
      if (cat === 'text') setText((await (await fetch(u)).text()).slice(0, 200_000));
    });
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [item.id, cat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/80 backdrop-blur-md" onMouseDown={onClose}>
      <header className="flex items-center gap-3 px-5 py-3 text-white" onMouseDown={e => e.stopPropagation()}>
        <FileIcon category={cat} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{item.name}</p>
          <p className="text-xs text-white/50">
            {formatBytes(item.size)} · modifié {relativeTime(item.updatedAt)}
          </p>
        </div>
        <button onClick={() => downloadItem(item)} className="btn bg-white/10 text-white hover:bg-white/20">
          <Download size={15} /> Télécharger
        </button>
        <button onClick={onClose} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Fermer (Échap)">
          <X size={18} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-8">
        <div className="flex max-h-full max-w-full items-center justify-center" onMouseDown={e => e.stopPropagation()}>
          {missing ? (
            <p className="text-white/70">Le contenu de ce fichier est introuvable dans ce navigateur.</p>
          ) : !url ? (
            <Loader2 className="animate-spin text-white/70" />
          ) : cat === 'image' ? (
            <img src={url} alt={item.name} className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl" />
          ) : cat === 'pdf' ? (
            <iframe src={url} title={item.name} className="h-[82vh] w-[min(1000px,92vw)] rounded-xl bg-white" />
          ) : cat === 'video' ? (
            <video src={url} controls autoPlay className="max-h-[80vh] max-w-full rounded-xl" />
          ) : cat === 'audio' ? (
            <audio src={url} controls autoPlay />
          ) : cat === 'text' ? (
            <pre className="max-h-[80vh] w-[min(900px,92vw)] overflow-auto rounded-xl bg-white p-5 text-xs text-slate-800">{text}</pre>
          ) : (
            <div className="rounded-3xl bg-white p-10 text-center">
              <FileIcon category={cat} size={72} />
              <p className="mt-4 font-semibold text-slate-800">Pas d'aperçu pour ce type de fichier</p>
              <button onClick={() => downloadItem(item)} className="btn-primary mt-4">
                <Download size={15} /> Télécharger
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
