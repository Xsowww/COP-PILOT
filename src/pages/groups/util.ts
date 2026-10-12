import { useAuth } from '../../store/auth';
import { useGroups } from '../../store/groups';
import { GROUP_COLORS, type Group } from '../../lib/groups';

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

