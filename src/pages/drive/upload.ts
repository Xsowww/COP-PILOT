import { useDrive } from '../../store/drive';

export interface PendingFile {
  file: File | null; // null = empty folder
  /** folder path relative to the drop target, e.g. ["Cours", "Maths"] */
  dirs: string[];
}

/** Collect files from a drop, walking into dropped folders when the browser allows it. */
export async function filesFromDrop(dt: DataTransfer): Promise<PendingFile[]> {
  const entries = Array.from(dt.items)
    .filter(i => i.kind === 'file')
    .map(i => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);

  if (entries.length === 0) return Array.from(dt.files).map(file => ({ file, dirs: [] }));

  const out: PendingFile[] = [];
  const walk = async (entry: FileSystemEntry, dirs: string[]): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ file, dirs });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const children: FileSystemEntry[] = [];
      // readEntries returns results in batches
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        children.push(...batch);
      }
      if (children.length === 0) out.push({ file: null, dirs: [...dirs, entry.name] });
      for (const c of children) await walk(c, [...dirs, entry.name]);
    }
  };
  for (const e of entries) await walk(e, []);
  return out;
}

export function filesFromInput(list: FileList): PendingFile[] {
  return Array.from(list).map(file => {
    const parts = (file.webkitRelativePath || file.name).split('/');
    return { file, dirs: parts.slice(0, -1) };
  });
}

/** Recreate the folder structure under `parentId` and upload every file. Returns the number of files. */
export async function uploadPending(pending: PendingFile[], parentId: string | null): Promise<number> {
  const drive = useDrive.getState();
  const folderIds = new Map<string, string | null>([['', parentId]]);

  const ensure = (dirs: string[]): string | null => {
    let key = '';
    let current = parentId;
    for (const d of dirs) {
      key += `/${d}`;
      if (!folderIds.has(key)) {
        const existing = useDrive.getState().items.find(i => i.kind === 'folder' && i.parentId === current && i.name === d);
        folderIds.set(key, existing ? existing.id : drive.createFolder(d, current).id);
      }
      current = folderIds.get(key)!;
    }
    return current;
  };

  let count = 0;
  const byFolder = new Map<string | null, File[]>();
  for (const p of pending) {
    const target = ensure(p.dirs);
    if (!p.file) continue;
    byFolder.set(target, [...(byFolder.get(target) ?? []), p.file]);
  }
  for (const [target, files] of byFolder) {
    await drive.uploadFiles(files, target);
    count += files.length;
  }
  return count;
}
