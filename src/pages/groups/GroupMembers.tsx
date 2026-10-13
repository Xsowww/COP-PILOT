import { useState } from 'react';
import { Copy, LogOut, RefreshCw, Trash2, UserMinus } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useGroups } from '../../store/groups';
import { confirmAction, toast } from '../../store/ui';
import { copyCode, deleteGroup, groupError, regenerateCode, removeMember, type Group, type GroupMember } from '../../lib/groups';
import { fmt } from '../../lib/dates';
import { MemberDot } from './shared';

export default function GroupMembers({ group, onLeft }: { group: Group; onLeft: () => void }) {
  const me = useAuth(s => s.user?.id);
  const members = useGroups(s => s.members[group.id]);
  const [busy, setBusy] = useState(false);
  const isOwner = group.ownerId === me;

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      toast(groupError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const newCode = async () => {
    if (!(await confirmAction('Créer un nouveau code ?', 'L’ancien code ne fonctionnera plus. Les membres actuels restent dans le groupe.', 'Nouveau code', false))) return;
    await run(async () => {
      await regenerateCode(group.id);
      await useGroups.getState().loadGroups();
      toast('Nouveau code créé', 'success');
    });
  };

  const kick = async (m: GroupMember) => {
    if (!(await confirmAction(`Retirer ${m.name} du groupe ?`, 'Ses notes partagées restent dans le groupe. Il pourra revenir seulement avec le code.', 'Retirer'))) return;
    await run(async () => {
      await removeMember(group.id, m.userId);
      await useGroups.getState().refresh(group.id, ['members']);
    });
  };

  const leave = async () => {
    const alone = (members?.length ?? 1) <= 1;
    const message = alone
      ? 'Tu es le seul membre : le groupe, ses notes et ses révisions seront supprimés.'
      : isOwner
        ? 'Le membre le plus ancien deviendra propriétaire. Tu pourras revenir avec le code.'
        : 'Tes notes partagées restent dans le groupe. Tu pourras revenir avec le code.';
    if (!(await confirmAction(`Quitter « ${group.name} » ?`, message, 'Quitter'))) return;
    await run(async () => {
      await removeMember(group.id, me!);
      await useGroups.getState().loadGroups();
      toast('Tu as quitté le groupe', 'success');
      onLeft();
    });
  };

  const destroy = async () => {
    if (!(await confirmAction(`Supprimer « ${group.name} » ?`, 'Le groupe, toutes ses notes partagées et ses révisions seront supprimés pour tous les membres. Action définitive.', 'Supprimer le groupe'))) return;
    await run(async () => {
      await deleteGroup(group.id);
      await useGroups.getState().loadGroups();
      toast('Groupe supprimé', 'success');
      onLeft();
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="card flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">Inviter quelqu’un</p>
          <p className="mt-0.5 text-[13px] text-stone-500">Donne ce code : il suffit de le saisir dans « Rejoindre un groupe ».</p>
        </div>
        <span className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-1.5 font-mono text-[20px] font-semibold tracking-[0.25em]">{group.inviteCode}</span>
        <div className="flex gap-1.5">
          <button className="btn-secondary h-8 px-3" onClick={() => void copyCode(group.inviteCode)}>
            <Copy size={14} /> Copier
          </button>
          {isOwner && (
            <button className="icon-btn" title="Nouveau code (l’ancien ne marchera plus)" aria-label="Nouveau code (l’ancien ne marchera plus)" disabled={busy} onClick={() => void newCode()}>
              <RefreshCw size={15} />
            </button>
          )}
        </div>
      </div>

      <p className="eyebrow mb-2 mt-6">{members ? `${members.length} membre${members.length > 1 ? 's' : ''}` : 'Membres'}</p>
      <div className="card divide-y divide-stone-100">
        {!members && <p className="p-4 text-[13px] text-stone-500">Chargement…</p>}
        {members?.map(m => (
          <div key={m.userId} className="group flex items-center gap-3 px-4 py-2.5">
            <MemberDot userId={m.userId} name={m.name} size={30} className="ring-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">
                {m.name}
                {m.userId === me && <span className="font-normal text-stone-500"> (toi)</span>}
              </p>
              <p className="text-[12px] text-stone-500">Depuis le {fmt(new Date(m.joinedAt), 'd MMMM yyyy')}</p>
            </div>
            {m.isOwner && <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">Propriétaire</span>}
            {isOwner && m.userId !== me && (
              <button className="icon-btn hover:text-red-600" title={`Retirer ${m.name}`} aria-label={`Retirer ${m.name}`} disabled={busy} onClick={() => void kick(m)}>
                <UserMinus size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy} onClick={() => void leave()}>
          <LogOut size={14} /> Quitter le groupe
        </button>
        {isOwner && (
          <button className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => void destroy()}>
            <Trash2 size={14} /> Supprimer le groupe
          </button>
        )}
      </div>
      <p className="mt-3 text-[12px] text-stone-500">Les membres voient seulement ton prénom, jamais ton adresse e-mail.</p>
    </div>
  );
}
