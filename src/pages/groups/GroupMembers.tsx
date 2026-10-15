import { useState } from 'react';
import { Copy, LogOut, RefreshCw, Trash2, UserMinus } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useGroups } from '../../store/groups';
import { confirmAction, toast } from '../../store/ui';
import { copyCode, deleteGroup, groupError, leaveGroup, regenerateCode, removeMember, setMemberRights, type Group, type GroupMember, type GroupRole } from '../../lib/groups';
import { fmt } from '../../lib/dates';
import { MemberDot } from './shared';
import { useGroupWords } from './util';

export default function GroupMembers({ group, onLeft }: { group: Group; onLeft: () => void }) {
  const w = useGroupWords();
  const me = useAuth(s => s.user?.id);
  const members = useGroups(s => s.members[group.id]);
  const code = useGroups(s => s.codes[group.id]);
  const mine = members?.find(m => m.userId === me);
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
    if (!(await confirmAction('Créer un nouveau code ?', `L’ancien code ne fonctionnera plus. Les membres actuels restent dans ${w.the}.`, 'Nouveau code', false))) return;
    await run(async () => {
      await regenerateCode(group.id);
      await useGroups.getState().refresh(group.id, ['members']);
      toast('Nouveau code créé', 'success');
    });
  };

  const kick = async (m: GroupMember) => {
    if (!(await confirmAction(`Retirer ${m.name} ${w.of} ?`, `Ses notes partagées restent dans ${w.the}. Il pourra revenir seulement avec le code.`, 'Retirer'))) return;
    await run(async () => {
      await removeMember(group.id, m.userId);
      await useGroups.getState().refresh(group.id, ['members']);
    });
  };

  const setRights = (m: GroupMember, role: GroupRole, canInvite: boolean) =>
    run(async () => {
      await setMemberRights(group.id, m.userId, role, canInvite);
      await useGroups.getState().refresh(group.id, ['members']);
      const changed = role !== m.role ? `${m.name} est maintenant ${role === 'lecteur' ? 'lecteur' : 'éditeur'}` : `${m.name} ${canInvite ? 'peut maintenant' : 'ne peut plus'} inviter`;
      toast(changed, 'success');
    });

  const leave = async () => {
    const alone = (members?.length ?? 1) <= 1;
    const message = alone
      ? `Tu es le seul membre, donc tout sera supprimé : ${w.the}, ses notes et ses ${w.meet.many}.`
      : isOwner
        ? 'Le membre le plus ancien deviendra propriétaire. Tu pourras revenir avec le code.'
        : `Tes notes partagées restent dans ${w.the}. Tu pourras revenir avec le code.`;
    if (!(await confirmAction(`Quitter « ${group.name} » ?`, message, 'Quitter'))) return;
    await run(async () => {
      await leaveGroup(group.id, alone);
      await useGroups.getState().loadGroups();
      toast(`Tu as quitté ${w.the}`, 'success');
      onLeft();
    });
  };

  const destroy = async () => {
    if (!(await confirmAction(`Supprimer « ${group.name} » ?`, `${w.The}, ses notes partagées et ses ${w.meet.many} : tout sera supprimé pour tous les membres. Action définitive.`, `Supprimer ${w.the}`))) return;
    await run(async () => {
      await deleteGroup(group.id);
      await useGroups.getState().loadGroups();
      toast(w.deleted, 'success');
      onLeft();
    });
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      {code ? (
        <div className="card flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-[220px] flex-1">
            <p className="text-[14px] font-medium">Inviter quelqu’un</p>
            <p className="mt-0.5 text-[13px] text-stone-500">Donne ce code : il suffit de le saisir dans «&nbsp;Rejoindre {w.a}&nbsp;».</p>
          </div>
          <span className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-3 py-1.5 font-mono text-[20px] font-semibold tracking-[0.25em]">{code}</span>
          <div className="flex gap-1.5">
            <button className="btn-secondary h-8 px-3" onClick={() => void copyCode(code)}>
              <Copy size={14} /> Copier
            </button>
            {isOwner && (
              <button className="icon-btn" title="Nouveau code (l’ancien ne marchera plus)" aria-label="Nouveau code (l’ancien ne marchera plus)" disabled={busy} onClick={() => void newCode()}>
                <RefreshCw size={15} />
              </button>
            )}
          </div>
        </div>
      ) : (
        code === null && <p className="card px-4 py-3 text-[13px] text-stone-500">Seul le propriétaire peut inviter dans {w.this}.</p>
      )}
      {!isOwner && mine && (
        <p className="mt-3 text-[13px] text-stone-500">
          Tu es {mine.role === 'lecteur' ? `lecteur dans ${w.this} : tu peux tout lire et dire si tu viens aux ${w.meet.many}` : `éditeur dans ${w.this} : tu peux ajouter, modifier et supprimer notes, fichiers et ${w.meet.many}`}.
        </p>
      )}

      <p className="eyebrow mb-2 mt-6">{members ? `${members.length} membre${members.length > 1 ? 's' : ''}` : 'Membres'}</p>
      <div className="card divide-y divide-stone-100">
        {!members && <p className="p-4 text-[13px] text-stone-500">Chargement…</p>}
        {members?.map(m => (
          <div key={m.userId} className="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
            <MemberDot userId={m.userId} name={m.name} size={30} className="ring-0" />
            <div className="min-w-[150px] flex-1">
              <p className="truncate text-[13px] font-medium">
                {m.name}
                {m.userId === me && <span className="font-normal text-stone-500"> (toi)</span>}
              </p>
              <p className="text-[12px] text-stone-500">Depuis le {fmt(new Date(m.joinedAt), 'd MMMM yyyy')}</p>
            </div>
            {m.isOwner ? (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">Propriétaire</span>
            ) : isOwner ? (
              <div className="ml-auto flex shrink-0 items-center gap-3">
                <select
                  className="field h-8 py-0 text-[13px]"
                  aria-label={`Rôle de ${m.name}`}
                  value={m.role}
                  disabled={busy}
                  onChange={e => void setRights(m, e.target.value as GroupRole, m.canInvite)}
                >
                  <option value="lecteur">Lecteur</option>
                  <option value="editeur">Éditeur</option>
                </select>
                <label className="flex items-center gap-1.5 text-[12px] text-stone-600">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--color-ink)]" checked={m.canInvite} disabled={busy} onChange={e => void setRights(m, m.role, e.target.checked)} />
                  Peut inviter
                </label>
              </div>
            ) : null}
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
          <LogOut size={14} /> Quitter {w.the}
        </button>
        {isOwner && (
          <button className="btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700" disabled={busy} onClick={() => void destroy()}>
            <Trash2 size={14} /> Supprimer {w.the}
          </button>
        )}
      </div>
      <p className="mt-3 text-[12px] text-stone-500">Les membres voient seulement ton prénom, jamais ton adresse e-mail.</p>
    </div>
  );
}
