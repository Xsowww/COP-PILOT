import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, CloudOff, Copy, LogIn, NotebookText, Plus, Settings2, Users } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useGroups, watchFocus } from '../../store/groups';
import { toast } from '../../store/ui';
import { Modal } from '../../components/Overlays';
import { cloudEnabled } from '../../lib/supabase';
import { GROUP_COLORS, copyCode, createGroup, groupError, joinGroup, updateGroup, type Group } from '../../lib/groups';
import { cx } from '../../lib/utils';
import { ColorPicker, GroupBadge } from './shared';
import { groupColor } from './util';
import GroupNotes from './GroupNotes';
import GroupEvents from './GroupEvents';
import GroupMembers from './GroupMembers';

type Tab = 'notes' | 'revisions' | 'membres';
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'notes', label: 'Notes', icon: NotebookText },
  { id: 'revisions', label: 'Révisions', icon: CalendarClock },
  { id: 'membres', label: 'Membres', icon: Users },
];

function GroupForm({ group, onDone }: { group?: Group; onDone: (g?: Group) => void }) {
  const [name, setName] = useState(group?.name ?? '');
  const [color, setColor] = useState<string>(group?.color ?? GROUP_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (group) {
        await updateGroup(group.id, { name: name.trim(), color });
        await useGroups.getState().loadGroups();
        onDone(group);
      } else {
        const g = await createGroup(name.trim(), color);
        await useGroups.getState().loadGroups();
        toast('Groupe créé', 'success');
        onDone(g);
      }
    } catch (err) {
      toast(groupError(err), 'error');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <h3 className="text-[15px] font-semibold">{group ? 'Paramètres du groupe' : 'Créer un groupe'}</h3>
      {!group && <p className="mt-1 text-[13px] text-stone-500">Tu recevras un code à donner à tes camarades pour qu’ils te rejoignent.</p>}
      <label className="eyebrow mt-4 block" htmlFor="group-name">Nom</label>
      <input id="group-name" autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ex. L2 Bio — TD 3" className="field mt-1.5 w-full" />
      <p className="eyebrow mt-4">Couleur</p>
      <div className="mt-2">
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => onDone()}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={!name.trim() || busy}>{group ? 'Enregistrer' : 'Créer le groupe'}</button>
      </div>
    </form>
  );
}

function JoinForm({ onDone }: { onDone: (id?: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = await joinGroup(clean);
      if (!id) {
        setError('Aucun groupe avec ce code. Vérifie-le auprès de la personne qui te l’a donné.');
        setBusy(false);
        return;
      }
      await useGroups.getState().loadGroups();
      toast('Tu as rejoint le groupe', 'success');
      onDone(id);
    } catch (err) {
      setError(groupError(err));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <h3 className="text-[15px] font-semibold">Rejoindre un groupe</h3>
      <p className="mt-1 text-[13px] text-stone-500">Saisis le code à 6 caractères qu’un membre du groupe t’a donné.</p>
      <input
        autoFocus
        value={code}
        maxLength={8}
        onChange={e => setCode(e.target.value)}
        placeholder="ABC234"
        aria-label="Code d’invitation"
        autoCapitalize="characters"
        spellCheck={false}
        className="field mt-4 h-11 w-full text-center font-mono text-[18px] tracking-[0.3em] uppercase"
      />
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={() => onDone()}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={clean.length !== 6 || busy}>Rejoindre</button>
      </div>
    </form>
  );
}

function Intro({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const points = [
    { icon: NotebookText, title: 'Des notes à plusieurs', text: 'Fiches, corrections de TD, résumés de cours : chacun complète, tout le monde voit la dernière version.' },
    { icon: CalendarClock, title: 'Des révisions en commun', text: 'Propose une séance, les autres indiquent s’ils viennent, et chacun l’ajoute à son calendrier.' },
    { icon: Users, title: 'Juste ton groupe', text: 'On entre seulement avec le code d’invitation. Les autres membres voient ton prénom, jamais ton adresse e-mail.' },
  ];
  return (
    <div className="mx-auto flex max-w-[560px] flex-col py-10 md:py-16">
      <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Travaille avec ta promo</h2>
      <p className="mt-1.5 text-[14px] text-stone-500">Crée un groupe pour ton TD, ton binôme ou ton équipe de projet, puis partage son code.</p>
      <div className="mt-7 flex flex-col gap-5">
        {points.map(p => (
          <div key={p.title} className="flex gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <p.icon size={17} strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-[14px] font-medium">{p.title}</p>
              <p className="mt-0.5 text-[13px] text-stone-500">{p.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={onCreate}><Plus size={15} /> Créer un groupe</button>
        <button className="btn-secondary" onClick={onJoin}><LogIn size={15} /> J’ai un code</button>
      </div>
    </div>
  );
}

function OfflineNotice() {
  return (
    <div className="flex h-full items-center justify-center px-4 pb-10">
      <div className="card max-w-[440px] p-7 text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
          <CloudOff size={20} strokeWidth={1.8} />
        </span>
        <h1 className="mt-4 text-[17px] font-semibold">Les groupes nécessitent la version en ligne</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-stone-500">
          Cette copie de COP-PILOT garde tes données uniquement dans ce navigateur. Pour partager des notes et organiser des révisions avec d’autres étudiants, connecte-toi à la version en ligne avec ton compte.
        </p>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  if (!cloudEnabled) return <OfflineNotice />;
  return <Groups />;
}

function Groups() {
  const [params, setParams] = useSearchParams();
  const userId = useAuth(s => s.user?.id);
  const { groups, loaded, failed } = useGroups();
  const [dialog, setDialog] = useState<'create' | 'join' | 'settings' | null>(null);

  const gid = params.get('g');
  const tab = (TABS.find(t => t.id === params.get('onglet'))?.id ?? 'notes') as Tab;
  const active = groups.find(g => g.id === gid) ?? null;

  useEffect(() => {
    useGroups.getState().reset();
    void useGroups.getState().loadGroups();
    return () => useGroups.getState().reset();
  }, [userId]);
  useEffect(() => watchFocus(), []);

  useEffect(() => {
    useGroups.getState().open(active?.id ?? null);
  }, [active?.id]);

  // Groupe quitté / supprimé par quelqu'un d'autre : retour à la liste.
  useEffect(() => {
    if (loaded && gid && !active) {
      setParams({}, { replace: true });
    }
  }, [loaded, gid, active, setParams]);

  const go = (id: string | null, t: Tab = 'notes') => setParams(id ? (t === 'notes' ? { g: id } : { g: id, onglet: t }) : {});

  const sorted = [...groups].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  return (
    <div className="flex h-full gap-4 px-4 pb-4 md:px-8">
      {/* Liste des groupes */}
      <aside className={cx('w-full shrink-0 flex-col md:flex md:w-[248px]', active ? 'hidden' : 'flex')}>
        <div className="flex items-center gap-1.5 pb-4 pt-2">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Groupes</h1>
          <button className="icon-btn ml-auto" title="Rejoindre avec un code" onClick={() => setDialog('join')}>
            <LogIn size={16} />
          </button>
          <button className="btn-primary h-8 px-3" onClick={() => setDialog('create')}>
            <Plus size={14} /> Créer
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!loaded && <p className="p-4 text-[13px] text-stone-400">Chargement…</p>}
          {loaded && failed && (
            <div className="p-4 text-[13px] text-stone-500">
              Impossible de charger tes groupes.{' '}
              <button className="font-medium text-ink underline underline-offset-2" onClick={() => void useGroups.getState().loadGroups()}>Réessayer</button>
            </div>
          )}
          {sorted.map(g => (
            <button
              key={g.id}
              onClick={() => go(g.id)}
              className={cx(
                'flex w-full items-center gap-2.5 rounded-lg border px-2 py-2 text-left transition-colors',
                g.id === active?.id ? 'border-stone-200 bg-surface shadow-card' : 'border-transparent hover:bg-stone-100',
              )}
            >
              <GroupBadge group={g} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{g.name}</span>
                <span className="block text-[11px] text-stone-400">{g.ownerId === userId ? 'Tu l’as créé' : 'Membre'}</span>
              </span>
            </button>
          ))}
          {loaded && !failed && groups.length === 0 && (
            <>
              <p className="hidden px-2 py-3 text-[13px] text-stone-400 md:block">Aucun groupe pour l’instant.</p>
              <div className="card px-5 md:hidden">
                <Intro onCreate={() => setDialog('create')} onJoin={() => setDialog('join')} />
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Groupe ouvert */}
      <section className={cx('min-w-0 flex-1 flex-col md:mt-2', active ? 'flex' : 'hidden md:flex')}>
        {active ? (
          <>
            <div className="flex items-center gap-3 pb-3">
              <button className="icon-btn md:hidden" onClick={() => go(null)} title="Retour">
                <ArrowLeft size={17} />
              </button>
              <GroupBadge group={active} size={34} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[18px] font-semibold tracking-[-0.01em]">{active.name}</h2>
                <button
                  className="group/code flex items-center gap-1.5 text-[12px] text-stone-500 hover:text-ink"
                  title="Copier le code d’invitation"
                  onClick={() => void copyCode(active.inviteCode)}
                >
                  Code <span className="font-mono font-medium tracking-wider text-stone-700">{active.inviteCode}</span>
                  <Copy size={12} className="text-stone-400 group-hover/code:text-ink" />
                </button>
              </div>
              {active.ownerId === userId && (
                <button className="icon-btn" title="Paramètres du groupe" onClick={() => setDialog('settings')}>
                  <Settings2 size={16} />
                </button>
              )}
            </div>
            <div className="flex gap-1 border-b border-stone-200" role="tablist">
              {TABS.map(t => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => go(active.id, t.id)}
                  className={cx(
                    '-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-[color]',
                    tab === t.id ? 'text-ink' : 'border-transparent text-stone-500 hover:text-ink',
                  )}
                  style={tab === t.id ? { borderColor: groupColor(active) } : undefined}
                >
                  <t.icon size={15} strokeWidth={1.9} />
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex min-h-0 flex-1 flex-col pt-4">
              {tab === 'notes' && <GroupNotes key={active.id} group={active} />}
              {tab === 'revisions' && <GroupEvents key={active.id} group={active} />}
              {tab === 'membres' && <GroupMembers key={active.id} group={active} onLeft={() => go(null)} />}
            </div>
          </>
        ) : loaded && groups.length === 0 && !failed ? (
          <div className="card flex-1 overflow-y-auto px-6">
            <Intro onCreate={() => setDialog('create')} onJoin={() => setDialog('join')} />
          </div>
        ) : (
          <div className="card flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Users size={28} strokeWidth={1.5} className="text-stone-300" />
            <p className="mt-3 text-[14px] font-medium">Choisis un groupe</p>
            <p className="mt-1 text-[13px] text-stone-500">Ses notes partagées, ses révisions et ses membres s’affichent ici.</p>
          </div>
        )}
      </section>

      <Modal open={dialog === 'create' || dialog === 'settings'} onClose={() => setDialog(null)}>
        {(dialog === 'create' || dialog === 'settings') && (
          <GroupForm
            group={dialog === 'settings' ? (active ?? undefined) : undefined}
            onDone={g => {
              setDialog(null);
              if (g && dialog === 'create') go(g.id);
            }}
          />
        )}
      </Modal>
      <Modal open={dialog === 'join'} onClose={() => setDialog(null)}>
        {dialog === 'join' && (
          <JoinForm
            onDone={id => {
              setDialog(null);
              if (id) go(id);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
