import { useState, useRef } from 'react';
import { FolderOpen, Upload, FileText, Image, Film, File, ArrowRight, CloudUpload } from 'lucide-react';
import { useDriveStore } from '../../store/driveStore';
import { useAppStore } from '../../store/appStore';
import type { DriveFile } from '../../types';

function FileTypeIcon({ type }: { type: DriveFile['type'] }) {
  const s = 13;
  if (type === 'pdf')    return <FileText size={s} color="#ef4444" />;
  if (type === 'image')  return <Image    size={s} color="#22c55e" />;
  if (type === 'video')  return <Film     size={s} color="#f59e0b" />;
  if (type === 'folder') return <FolderOpen size={s} color="#818cf8" />;
  return <File size={s} color="rgba(255,255,255,0.45)" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

export default function DriveWidget() {
  const { getRecentFiles, addFile } = useDriveStore();
  const { setView } = useAppStore();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = getRecentFiles(3);

  const handleFiles = (fileList: File[]) => {
    fileList.forEach(file => {
      const type = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf'
        : file.type.startsWith('video/') ? 'video' : 'other';
      addFile(file.name, type, null, URL.createObjectURL(file), file.size);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="card" style={{ padding: '18px 0', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderOpen size={14} color="#818cf8" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Fichiers récents</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Derniers ajouts</p>
          </div>
        </div>
        <button
          onClick={() => setView('drive')}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: '#818cf8', background: 'none',
            border: 'none', cursor: 'pointer', opacity: 0.7,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          Voir tout <ArrowRight size={11} />
        </button>
      </div>

      {/* Recent files */}
      <div style={{ padding: '8px 8px 6px', flex: 1 }}>
        {recent.length === 0 ? (
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>
            Aucun fichier récent
          </p>
        ) : (
          recent.map(f => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', borderRadius: 8,
                cursor: 'pointer', transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <FileTypeIcon type={f.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 500, color: '#f1f5f9',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {f.name}
                </p>
              </div>
              {f.size && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                  {formatSize(f.size)}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Drop zone */}
      <div style={{ padding: '6px 12px 6px' }}>
        <div
          style={{
            borderRadius: 8,
            border: `1.5px dashed ${dragging ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.12)'}`,
            background: dragging ? 'rgba(99,102,241,0.08)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onMouseEnter={e => {
            if (!dragging) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.22)';
          }}
          onMouseLeave={e => {
            if (!dragging) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
          }}
        >
          <CloudUpload size={14} color="rgba(255,255,255,0.4)" />
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Déposer ou cliquer pour uploader
          </p>
          <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
            onChange={e => handleFiles(Array.from(e.target.files || []))}
          />
        </div>
      </div>
    </div>
  );
}
