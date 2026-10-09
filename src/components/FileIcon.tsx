import { File, FileArchive, FileAudio, FileImage, FileSpreadsheet, FileText, FileVideo, Folder, Presentation, FileType2, FileCode } from 'lucide-react';
import type { FileCategory } from '../store/drive';

const MAP: Record<FileCategory, { icon: typeof File; color: string; bg: string }> = {
  folder: { icon: Folder, color: '#4f46e5', bg: '#e0e7ff' },
  image: { icon: FileImage, color: '#db2777', bg: '#fce7f3' },
  pdf: { icon: FileType2, color: '#dc2626', bg: '#fee2e2' },
  video: { icon: FileVideo, color: '#7c3aed', bg: '#ede9fe' },
  audio: { icon: FileAudio, color: '#0891b2', bg: '#cffafe' },
  text: { icon: FileCode, color: '#475569', bg: '#f1f5f9' },
  doc: { icon: FileText, color: '#2563eb', bg: '#dbeafe' },
  sheet: { icon: FileSpreadsheet, color: '#059669', bg: '#d1fae5' },
  slides: { icon: Presentation, color: '#ea580c', bg: '#ffedd5' },
  archive: { icon: FileArchive, color: '#a16207', bg: '#fef9c3' },
  other: { icon: File, color: '#64748b', bg: '#f1f5f9' },
};

export default function FileIcon({ category, size = 40 }: { category: FileCategory; size?: number }) {
  const { icon: Icon, color, bg } = MAP[category];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[30%]" style={{ width: size, height: size, background: bg, color }}>
      <Icon size={size * 0.5} fill={category === 'folder' ? color : 'none'} fillOpacity={category === 'folder' ? 0.18 : 0} />
    </span>
  );
}
