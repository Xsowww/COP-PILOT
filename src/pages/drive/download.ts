import { getFileUrl, type DriveItem } from '../../store/drive';

/** `getUrl` : d'où vient le contenu (par défaut, le Drive personnel). */
export function downloadItem(item: Pick<DriveItem, 'id' | 'name'>, getUrl: (id: string) => Promise<string | null> = getFileUrl) {
  void getUrl(item.id).then(url => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}
