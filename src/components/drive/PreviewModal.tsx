import { X, Download, FileText, Image, Film, File } from 'lucide-react';
import { useDriveStore } from '../../store/driveStore';

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function PreviewModal() {
  const { previewFile, setPreviewFile } = useDriveStore();

  if (!previewFile) return null;

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setPreviewFile(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={handleBackdrop}
    >
      <div
        className="animate-fadeIn rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(18,18,32,0.95)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.7)',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '85vh',
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              {previewFile.type === 'pdf' && <FileText size={16} color="#ef4444" />}
              {previewFile.type === 'image' && <Image size={16} color="#22c55e" />}
              {previewFile.type === 'video' && <Film size={16} color="#f59e0b" />}
              {!['pdf','image','video'].includes(previewFile.type) && <File size={16} color="#818cf8" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{previewFile.name}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {previewFile.type.toUpperCase()} {previewFile.size ? `· ${formatSize(previewFile.size)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {previewFile.url && (
              <a
                href={previewFile.url}
                download={previewFile.name}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Download size={15} color="rgba(255,255,255,0.7)" />
              </a>
            )}
            <button
              onClick={() => setPreviewFile(null)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <X size={15} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 min-h-64">
          {previewFile.type === 'image' && previewFile.url ? (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          ) : previewFile.type === 'pdf' && previewFile.url ? (
            <iframe
              src={previewFile.url}
              className="w-full rounded-xl"
              style={{ height: '500px' }}
              title={previewFile.name}
            />
          ) : previewFile.type === 'video' && previewFile.url ? (
            <video
              src={previewFile.url}
              controls
              className="max-w-full rounded-xl"
              style={{ maxHeight: '400px' }}
            />
          ) : (
            <div className="text-center">
              <File size={48} color="rgba(255,255,255,0.2)" className="mx-auto mb-3" />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Prévisualisation non disponible
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {previewFile.name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
