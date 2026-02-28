import { useState, useRef } from 'react';
import { FolderOpen, Upload, FileText, Image, Film, File, ArrowRight } from 'lucide-react';
import { useDriveStore } from '../../store/driveStore';
import { useAppStore } from '../../store/appStore';
import type { DriveFile } from '../../types';

function FileIcon({ type }: { type: DriveFile['type'] }) {
  const props = { size: 14 };
  if (type === 'pdf') return <FileText {...props} color="#ef4444" />;
  if (type === 'image') return <Image {...props} color="#22c55e" />;
  if (type === 'video') return <Film {...props} color="#f59e0b" />;
  if (type === 'folder') return <FolderOpen {...props} color="#818cf8" />;
  return <File {...props} color="rgba(255,255,255,0.5)" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function DriveWidget() {
  const { getRecentFiles, addFile } = useDriveStore();
  const { setView } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = getRecentFiles(3);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      const type = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf'
        : file.type.startsWith('video/') ? 'video'
        : 'other';
      const url = URL.createObjectURL(file);
      addFile(file.name, type, null, url, file.size);
    });
  };

  return (
    <div className="glass-card p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} color="#818cf8" />
          <span className="text-sm font-semibold text-white">Drive</span>
        </div>
        <button
          onClick={() => setView('drive')}
          className="flex items-center gap-1 text-xs transition-opacity opacity-60 hover:opacity-100"
          style={{ color: '#818cf8' }}
        >
          Voir tout <ArrowRight size={12} />
        </button>
      </div>

      {/* Recent files */}
      <div className="flex flex-col gap-2">
        {recent.map(f => (
          <div
            key={f.id}
            className="flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.03)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
          >
            <FileIcon type={f.type} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{f.name}</p>
              {f.size && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatSize(f.size)}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-4 cursor-pointer transition-all"
        style={{
          borderColor: dragging ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.1)',
          background: dragging ? 'rgba(99,102,241,0.1)' : 'transparent',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={18} color="rgba(255,255,255,0.35)" />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Déposer ou cliquer pour uploader</p>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => {
          const files = Array.from(e.target.files || []);
          files.forEach(file => {
            const type = file.type.startsWith('image/') ? 'image'
              : file.type === 'application/pdf' ? 'pdf'
              : file.type.startsWith('video/') ? 'video' : 'other';
            addFile(file.name, type, null, URL.createObjectURL(file), file.size);
          });
        }} />
      </div>
    </div>
  );
}
