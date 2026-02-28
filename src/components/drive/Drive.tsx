import { useState, useRef } from 'react';
import {
  FolderOpen, Folder, FileText, Image, Film, File, Upload,
  ChevronRight, Plus, Trash2, Eye, Home, LayoutGrid, List, FolderPlus,
} from 'lucide-react';
import { useDriveStore } from '../../store/driveStore';
import type { DriveFile } from '../../types';
import PreviewModal from './PreviewModal';
import { useCopStore } from '../../store/copStore';
import { useNotesStore } from '../../store/notesStore';

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function FileTypeIcon({ type, size = 18 }: { type: DriveFile['type']; size?: number }) {
  if (type === 'folder') return <FolderOpen size={size} color="#818cf8" />;
  if (type === 'pdf')    return <FileText  size={size} color="#ef4444" />;
  if (type === 'image')  return <Image     size={size} color="#22c55e" />;
  if (type === 'video')  return <Film      size={size} color="#f59e0b" />;
  return <File size={size} color="rgba(255,255,255,0.4)" />;
}

const TYPE_BG: Record<string, string> = {
  folder: 'rgba(99,102,241,0.12)',
  pdf:    'rgba(239,68,68,0.1)',
  image:  'rgba(34,197,94,0.1)',
  video:  'rgba(245,158,11,0.1)',
  other:  'rgba(255,255,255,0.06)',
};

export default function Drive() {
  const {
    currentFolderId, setCurrentFolder, deleteFile, addFolder,
    addFile, getBreadcrumbs, getFilesInFolder, setPreviewFile,
  } = useDriveStore();
  const { addSuggestion } = useCopStore();
  const { createNote } = useNotesStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentItems = getFilesInFolder(currentFolderId);
  const breadcrumbs = getBreadcrumbs(currentFolderId);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const folder = addFolder(newFolderName.trim(), currentFolderId);
    setNewFolderName('');
    setShowNewFolder(false);
    addSuggestion(
      `Dossier "${folder.name}" créé. Voulez-vous créer une note associée ?`,
      [
        { label: 'Créer une note', handler: () => createNote(`Notes – ${folder.name}`) },
        { label: 'Non merci', handler: () => {} },
      ],
      { relatedEntityId: folder.id, relatedEntityType: 'file' }
    );
  };

  const handleFiles = (fileList: File[]) => {
    fileList.forEach(file => {
      const type = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf'
        : file.type.startsWith('video/') ? 'video' : 'other';
      addFile(file.name, type, currentFolderId, URL.createObjectURL(file), file.size);
    });
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileOpen = (f: DriveFile) => {
    if (f.type === 'folder') setCurrentFolder(f.id);
    else setPreviewFile(f);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 24px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
          <button
            onClick={() => setCurrentFolder(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
              color: currentFolderId ? 'rgba(255,255,255,0.4)' : '#818cf8',
              transition: 'color 0.15s',
            }}
          >
            <Home size={13} /> Racine
          </button>
          {breadcrumbs.map(bc => (
            <span key={bc.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ChevronRight size={11} color="rgba(255,255,255,0.2)" />
              <button
                onClick={() => setCurrentFolder(bc.id)}
                style={{
                  fontSize: 12, background: 'none', border: 'none', cursor: 'pointer',
                  color: bc.id === currentFolderId ? '#818cf8' : 'rgba(255,255,255,0.5)',
                  fontWeight: bc.id === currentFolderId ? 600 : 400,
                }}
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowNewFolder(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: 'rgba(99,102,241,0.12)', color: '#818cf8',
              border: '1px solid rgba(99,102,241,0.22)', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
          >
            <FolderPlus size={13} /> Nouveau dossier
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
              background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)',
              border: '1px solid rgba(255,255,255,0.09)', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          >
            <Upload size={13} /> Uploader
          </button>
          <input ref={inputRef} type="file" multiple style={{ display: 'none' }}
            onChange={e => handleFiles(Array.from(e.target.files || []))}
          />

          {/* View toggle */}
          <div style={{
            display: 'flex', borderRadius: 7, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.04)',
          }}>
            {(['grid', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', border: 'none',
                background: viewMode === v ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode === v ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}>
                {v === 'grid' ? <LayoutGrid size={13} /> : <List size={13} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── New folder input ──────────────────────────── */}
      {showNewFolder && (
        <div className="animate-fadeIn" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}>
          <FolderPlus size={14} color="rgba(255,255,255,0.4)" />
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            placeholder="Nom du dossier…"
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(99,102,241,0.4)', borderRadius: 7,
              padding: '7px 12px', fontSize: 13, color: '#f1f5f9', outline: 'none',
            }}
          />
          <button
            onClick={handleCreateFolder}
            style={{
              padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer',
            }}
          >
            Créer
          </button>
          <button
            onClick={() => setShowNewFolder(false)}
            style={{
              padding: '7px 10px', borderRadius: 7, fontSize: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* ── File area ────────────────────────────────── */}
      <div
        style={{
          flex: 1, overflowY: 'auto', padding: '20px 24px',
          background: dragging ? 'rgba(99,102,241,0.04)' : 'transparent',
          transition: 'background 0.2s',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleFileDrop}
      >
        {currentItems.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 260, gap: 12,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FolderOpen size={28} color="rgba(99,102,241,0.5)" />
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Dossier vide</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              Glissez des fichiers ici ou cliquez sur "Uploader"
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
            gap: 12,
          }}>
            {currentItems.map(f => (
              <FileCard key={f.id} file={f} onOpen={handleFileOpen} onDelete={deleteFile} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* List header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px',
              padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              {['Nom', 'Type', 'Taille'].map(h => (
                <p key={h} style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {h}
                </p>
              ))}
            </div>
            {currentItems.map(f => (
              <FileRow key={f.id} file={f} onOpen={handleFileOpen} onDelete={deleteFile} />
            ))}
          </div>
        )}
      </div>

      <PreviewModal />
    </div>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function FileCard({ file, onOpen, onDelete }: {
  file: DriveFile; onOpen: (f: DriveFile) => void; onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { setPreviewFile } = useDriveStore();

  return (
    <div
      className="card"
      style={{
        padding: '16px 12px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        cursor: 'pointer', position: 'relative', textAlign: 'center',
        transition: 'border-color 0.15s, transform 0.15s',
        transform: hovered ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(file)}
    >
      {/* Icon with type-colored bg */}
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: TYPE_BG[file.type] ?? TYPE_BG.other,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileTypeIcon type={file.type} size={22} />
      </div>

      <div style={{ width: '100%' }}>
        <p style={{
          fontSize: 12, fontWeight: 500, color: '#f1f5f9',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file.name}
        </p>
        {file.size && (
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            {formatSize(file.size)}
          </p>
        )}
      </div>

      {/* Hover actions */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          display: 'flex', gap: 4,
        }}>
          {file.type !== 'folder' && (
            <button
              onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
              style={{
                width: 24, height: 24, borderRadius: 6,
                background: 'rgba(99,102,241,0.3)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Eye size={11} color="#818cf8" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(file.id); }}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'rgba(239,68,68,0.2)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={11} color="#ef4444" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────
function FileRow({ file, onOpen, onDelete }: {
  file: DriveFile; onOpen: (f: DriveFile) => void; onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { setPreviewFile } = useDriveStore();

  const TYPE_LABELS: Record<string, string> = {
    folder: 'Dossier', pdf: 'PDF', image: 'Image', video: 'Vidéo', other: 'Fichier',
  };

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '1fr 80px 80px',
        alignItems: 'center', padding: '9px 12px', borderRadius: 8,
        cursor: 'pointer', transition: 'background 0.12s',
        background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        gap: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(file)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <FileTypeIcon type={file.type} size={15} />
        <p style={{
          fontSize: 13, fontWeight: 500, color: '#f1f5f9',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file.name}
        </p>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
        {TYPE_LABELS[file.type] ?? 'Fichier'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          {formatSize(file.size)}
        </p>
        {hovered && (
          <div style={{ display: 'flex', gap: 4 }}>
            {file.type !== 'folder' && (
              <button
                onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: 'rgba(99,102,241,0.2)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Eye size={12} color="#818cf8" />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onDelete(file.id); }}
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: 'rgba(239,68,68,0.15)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={12} color="#ef4444" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
