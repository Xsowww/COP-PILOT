import { useAuth } from '../../store/auth';
import { getSettings, useSettings } from '../../store/settings';
import { groupWords } from '../../lib/usage';
import { useGroups } from '../../store/groups';
import { toast } from '../../store/ui';
import { GROUP_COLORS, MAX_GROUP_FILE, groupError, uploadFile, type Group } from '../../lib/groups';

/** « groupe » / « équipe », « révisions » / « réunions » / « rendez-vous », selon l'usage du compte. */
export const useGroupWords = () => groupWords(useSettings(s => s.usage));
export const groupWordsNow = () => groupWords(getSettings().usage);

export const groupColor = (g: Pick<Group, 'color'>) => g.color ?? GROUP_COLORS[0];

/** Nom d'un membre tel qu'affiché (« toi » pour soi-même). */
export function useMemberName(groupId: string) {
  const me = useAuth(s => s.user?.id);
  const members = useGroups(s => s.members[groupId]);
  return (userId: string | null, self = 'toi') => {
    if (!userId) return 'un ancien membre';
    if (userId === me) return self;
    return members?.find(m => m.userId === userId)?.name ?? 'un ancien membre';
  };
}

/**
 * Mes droits dans le groupe, d'après la liste des membres (la base les vérifie de toute façon).
 * Tant que la liste n'est pas chargée, seul le propriétaire est sûr de pouvoir modifier.
 */
export function useRights(group: Pick<Group, 'id' | 'ownerId'>) {
  const me = useAuth(s => s.user?.id);
  const mine = useGroups(s => s.members[group.id]?.find(m => m.userId === me));
  const isOwner = !!me && group.ownerId === me;
  return { isOwner, canEdit: isOwner || mine?.role === 'editeur' };
}

/** Ajoute des fichiers au groupe, un par un ; dit ce qui est passé et ce qui a été refusé. */
export async function shareFiles(group: Group, files: { blob: Blob | (() => Promise<Blob | undefined>); name: string }[]): Promise<number> {
  let ok = 0;
  let error = '';
  for (const f of files) {
    try {
      const blob = typeof f.blob === 'function' ? await f.blob() : f.blob;
      if (!blob) throw new Error('Le contenu de « ' + f.name + ' » est introuvable.');
      if (blob.size > MAX_GROUP_FILE) throw new Error(`« ${f.name} » dépasse 50 Mo.`);
      await uploadFile(group.id, blob, f.name);
      ok++;
    } catch (e) {
      const m = String((e as Error)?.message ?? '');
      error = m.startsWith('«') || m.startsWith('Le contenu') ? m : groupError(e);
    }
  }
  if (ok) void useGroups.getState().refresh(group.id, ['files']);
  if (error) toast(ok ? `${ok} fichier${ok > 1 ? 's' : ''} partagé${ok > 1 ? 's' : ''}. ${error}` : error, 'error');
  else if (ok) toast(ok > 1 ? `${ok} fichiers partagés avec ${groupWordsNow().the}` : `Fichier partagé avec ${groupWordsNow().the}`, 'success');
  return ok;
}
