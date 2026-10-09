import { getFileUrl, type DriveItem } from '../../store/drive';

export function downloadItem(item: DriveItem) {
  void getFileUrl(item.id).then(url => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}
