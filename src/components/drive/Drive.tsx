import { useState, useRef } from 'react';
import {
  FolderOpen, Folder, FileText, Image, Film, File, Upload,
  ChevronRight, Plus, Trash2, Eye, Home, LayoutGrid, List,
} from 'lucide-react';
import { useDriveStore } from '../../store/driveStore';
import type { DriveFile } from '../../types';
import PreviewModal from './PreviewModal';
import { useCopStore } from '../../store/copStore';
import { useNotesStore } from '../../store/notesStore';

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function FileIcon({ type, size = 18 }: { type: DriveFile['type']; size?: number }) {
  if (type === 'folder') return <Folder size={size} color="#818cf8" />;
  if (type === 'pdf') return <FileText size={size} color="#ef4444" />;
  if (type === 'image') return <Image size={size} color="#22c55e" />;
  if (type === 'video') return <Film size={size} color="#f59e0b" />;
  return <File size={size} color="rgba(255,255,255,0.5)" />;
}

export default function Drive() {
  const {
    currentFolderId, setCurrentFolder, deleteFile, addFolder,
    addFile, getBreadcrumbs, getFilesInFolder, setPreviewFile,
  } = useDriveStore();
  const { addSuggestion } = useCopStore();
  const { createNote } = useNotesStore();
  const [view, setView] = useState<'grid' | 'list'>('grid');
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

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(file => {
      const type = file.type.startsWith('image/') ? 'image'
        : file.type === 'application/pdf' ? 'pdf'
        : file.type.startsWith('video/') ? 'video' : 'other';
      addFile(file.name, type, currentFolderId, URL.createObjectURL(file), file.size);
    });
  };

  const handleFileOpen = (f: DriveFile) => {
    if (f.type === 'folder') {
      setCurrentFolder(f.id);
    } else {
      setPreviewFile(f);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() => setCurrentFolder(null)}
            className="flex items-center gap-1 text-xs transition-opacity"
            style={{ color: currentFolderId ? 'rgba(255,255,255,0.4)' : '#818cf8' }}
          >
            <Home size={13} /> Racine
          </button>
          {breadcrumbs.map(bc => (
            <span key={bc.id} className="flex items-center gap-1">
              <ChevronRight size={12} color="rgba(255,255,255,0.2)" />
              <button
                onClick={() => setCurrentFolder(bc.id)}
                className="text-xs transition-opacity hover:opacity-100"
                style={{ color: bc.id === currentFolderId ? '#818cf8' : 'rgba(255,255,255,0.5)' }}
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}
          >
            <Plus size={13} /> Nouveau dossier
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <Upload size={13} /> Uploader
          </button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={e => {
            Array.from(e.target.files || []).forEach(file => {
              const type = file.type.startsWith('image/') ? 'image'
                : file.type === 'application/pdf' ? 'pdf'
                : file.type.startsWith('video/') ? 'video' : 'other';
              addFile(file.name, type, currentFolderId, URL.createObjectURL(file), file.size);
            });
          }} />
          <button
            onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {view === 'grid' ? <List size={14} color="rgba(255,255,255,0.6)" /> : <LayoutGrid size={14} color="rgba(255,255,255,0.6)" />}
          </button>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="px-6 py-2 flex items-center gap-2 animate-fadeIn shrink-0">
          <input
            autoFocus
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
            placeholder="Nom du dossier…"
            className="px-3 py-2 rounded-xl text-sm outline-none flex-1"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(99,102,241,0.4)',
              color: 'white',
            }}
          />
          <button onClick={handleCreateFolder} className="px-3 py-2 rounded-xl text-xs font-medium text-white"
            style={{ background: '#6366f1' }}>Créer</button>
          <button onClick={() => setShowNewFolder(false)} className="px-3 py-2 rounded-xl text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Annuler</button>
        </div>
      )}

      {/* Drop zone + file grid */}
      <div
        className="flex-1 overflow-y-auto p-6"
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleFileDrop}
        style={dragging ? { background: 'rgba(99,102,241,0.05)' } : {}}
      >
        {currentItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <FolderOpen size={40} color="rgba(255,255,255,0.1)" />
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>Dossier vide</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Glissez des fichiers ici ou cliquez sur "Uploader"</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {currentItems.map(f => (
              <FileCard key={f.id} file={f} onOpen={handleFileOpen} onDelete={deleteFile} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
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

function FileCard({ file, onOpen, onDelete }: { file: DriveFile; onOpen: (f: DriveFile) => void; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const { setPreviewFile } = useDriveStore();

  return (
    <div
      className="glass-card p-4 flex flex-col items-center gap-2 cursor-pointer relative"
      style={{ aspectRatio: '1', justifyContent: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={() => onOpen(file)}
      onClick={() => onOpen(file)}
    >
      <FileIcon type={file.type} size={28} />
      <p className="text-xs text-center font-medium text-white truncate w-full text-center">{file.name}</p>
      {file.size && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatSize(file.size)}</p>}

      {hovered && (
        <div className="absolute top-2 right-2 flex gap-1">
          {file.type !== 'folder' && (
            <button
              onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
              style={{ background: 'rgba(99,102,241,0.3)' }}
            >
              <Eye size={11} color="#818cf8" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(file.id); }}
            className="w-6 h-6 rounded-md flex items-center justify-center transition-all"
            style={{ background: 'rgba(239,68,68,0.2)' }}
          >
            <Trash2 size={11} color="#ef4444" />
          </button>
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onOpen, onDelete }: { file: DriveFile; onOpen: (f: DriveFile) => void; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const { setPreviewFile } = useDriveStore();

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all"
      style={{ background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(file)}
    >
      <FileIcon type={file.type} size={16} />
      <p className="flex-1 text-sm text-white truncate">{file.name}</p>
      <p className="text-xs w-20 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>{formatSize(file.size)}</p>
      {hovered && (
        <div className="flex gap-1">
          {file.type !== 'folder' && (
            <button
              onClick={e => { e.stopPropagation(); setPreviewFile(file); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.2)' }}
            >
              <Eye size={13} color="#818cf8" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete(file.id); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.15)' }}
          >
            <Trash2 size={13} color="#ef4444" />
          </button>
        </div>
      )}
    </div>
  );
}
