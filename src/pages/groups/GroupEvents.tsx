import { useState, type FormEvent } from 'react';
import { CalendarPlus, Check, Clock, MapPin, Plus, Trash2, Link2 } from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useGroups } from '../../store/groups';
import { useCalendar, guessCategory } from '../../store/calendar';
import { confirmAction, toast } from '../../store/ui';
import { createEvent, deleteEvent, groupError, setAttendance, type Group, type GroupEvent } from '../../lib/groups';
import { countdownLabel, fmt, fromKey, todayKey } from '../../lib/dates';
import { cx } from '../../lib/utils';
import { MemberDot } from './shared';
import { groupColor, useMemberName } from './util';

const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

function EventForm({ group, onDone }: { group: Group; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const badTime = !!start && !!end && end <= start;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || badTime) return;
    setBusy(true);
    try {
      await createEvent(group.id, { title: title.trim(), date, start: start || null, end: end || null, place: place.trim() || null });
      await useGroups.getState().refresh(group.id, ['events']);
      toast('Révision proposée au groupe', 'success');
      onDone();
    } catch (err) {
      toast(groupError(err), 'error');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card enter mb-4 p-4">
      <p className="text-[14px] font-semibold">Proposer une révision</p>
      <input autoFocus value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder="Ex. Révision partiel d’anatomie" className="field mt-3 w-full" />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
        <label className="col-span-2 sm:col-span-1">
          <span className="eyebrow">Date</span>
          <input type="date" required min={todayKey()} value={date} onChange={e => setDate(e.target.value)} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="eyebrow">Début</span>
          <input type="time" value={start} onChange={e => setStart(e.target.value)} className="field mt-1 w-full" />
        </label>
        <label>
          <span className="eyebrow">Fin</span>
          <input type="time" value={end} onChange={e => setEnd(e.target.value)} className={cx('field mt-1 w-full', badTime && 'border-red-300')} />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="eyebrow">Lieu ou lien de visio</span>
        <input value={place} maxLength={300} onChange={e => setPlace(e.target.value)} placeholder="BU, salle B204… ou https://…" className="field mt-1 w-full" />
      </label>
      {badTime && <p className="mt-2 text-[12px] text-red-600">L’heure de fin doit être après l’heure de début.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onDone}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={!title.trim() || !date || badTime || busy}>Proposer</button>
      </div>
    </form>
  );
}

function EventCard({ group, ev }: { group: Group; ev: GroupEvent }) {
  const me = useAuth(s => s.user?.id ?? '');
  const nameOf = useMemberName(group.id);
  const attendance = useGroups(s => s.attendance[group.id]);
  const inCalendar = useCalendar(s => s.events.some(e => e.externalId === `groupe:${ev.id}`));
  const [busy, setBusy] = useState(false);
  // Soi-même en dernier : « Hugo, Inès et toi viennent ».
  const coming = (attendance ?? []).filter(a => a.eventId === ev.id).map(a => a.userId).sort((a, b) => Number(a === me) - Number(b === me));
  const iCome = coming.includes(me);
  const canDelete = ev.createdBy === me || group.ownerId === me;

  const toggle = async () => {
    setBusy(true);
    try {
      await setAttendance(group.id, ev.id, !iCome);
      await useGroups.getState().refresh(group.id, ['events']);
    } catch (e) {
      toast(groupError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addToCalendar = () => {
    const c = guessCategory(ev.title);
    useCalendar.getState().add({
      title: ev.title,
      date: ev.date,
      start: ev.start ?? undefined,
      end: ev.end ?? undefined,
      category: c === 'cours' ? 'cours' : 'devoir',
      details: [`Révision du groupe « ${group.name} »`, ev.place].filter(Boolean).join('\n'),
      externalId: `groupe:${ev.id}`,
    });
    toast('Ajouté à ton calendrier', 'success');
  };

  const remove = async () => {
    if (!(await confirmAction(`Annuler « ${ev.title} » ?`, 'La révision disparaît pour tous les membres du groupe.', 'Annuler la révision'))) return;
    try {
      await deleteEvent(ev.id);
      await useGroups.getState().refresh(group.id, ['events']);
    } catch (e) {
      toast(groupError(e), 'error');
    }
  };

  const names = coming.map(id => nameOf(id));
  const who =
    coming.length === 0
      ? 'Personne n’a encore répondu'
      : coming.length === 1 && iCome
        ? 'Tu viens'
        : coming.length <= 3
          ? `${names.join(', ').replace(/, ([^,]*)$/, ' et $1')} ${coming.length > 1 ? 'viennent' : 'vient'}`
          : `${names.slice(0, 2).join(', ')} et ${coming.length - 2} autres viennent`;

  return (
    <div className="card group flex flex-wrap items-start gap-3 p-4 sm:flex-nowrap sm:items-center">
      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 text-center" style={{ background: `${groupColor(group)}14`, color: groupColor(group) }}>
        <span className="text-[11px] font-medium uppercase">{fmt(fromKey(ev.date), 'MMM')}</span>
        <span className="tabular text-[20px] leading-tight font-semibold">{fmt(fromKey(ev.date), 'd')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span className="truncate text-[14px] font-medium">{ev.title}</span>
          <span className="shrink-0 text-[11px] font-medium text-stone-500">{countdownLabel(ev.date)}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-stone-500">
          <span className="flex items-center gap-1 capitalize">
            <Clock size={12} /> {fmt(fromKey(ev.date), 'EEEE')}
            {ev.start ? ` · ${ev.start}${ev.end ? `–${ev.end}` : ''}` : ''}
          </span>
          {ev.place &&
            (isUrl(ev.place) ? (
              <a href={ev.place.trim()} target="_blank" rel="noreferrer noopener" className="flex min-w-0 items-center gap-1 text-ink underline decoration-stone-300 underline-offset-2">
                <Link2 size={12} /> <span className="truncate">Lien de la visio</span>
              </a>
            ) : (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin size={12} /> <span className="truncate">{ev.place}</span>
              </span>
            ))}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {coming.length > 0 && (
            <span className="flex -space-x-1.5">
              {coming.slice(0, 5).map(id => (
                <MemberDot key={id} userId={id} name={nameOf(id, 'Toi')} size={20} />
              ))}
            </span>
          )}
          <span className="truncate text-[12px] text-stone-500">{who.charAt(0).toUpperCase() + who.slice(1)}</span>
        </div>
        <p className="mt-1 text-[11px] text-stone-500">Proposée par {nameOf(ev.createdBy)}</p>
      </div>
      <div className="flex shrink-0 basis-full items-center gap-1.5 pl-[68px] sm:basis-auto sm:pl-0">
        <button
          className={cx('btn h-8 px-3', iCome ? 'border border-transparent text-white' : 'btn-secondary')}
          style={iCome ? { background: groupColor(group) } : undefined}
          disabled={busy}
          aria-pressed={iCome}
          onClick={() => void toggle()}
        >
          {iCome && <Check size={14} />} Je viens
        </button>
        <button className="icon-btn" title={inCalendar ? 'Déjà dans ton calendrier' : 'Ajouter à mon calendrier'} aria-label={inCalendar ? 'Déjà dans ton calendrier' : 'Ajouter à mon calendrier'} disabled={inCalendar} onClick={addToCalendar}>
          {inCalendar ? <Check size={15} className="text-emerald-600" /> : <CalendarPlus size={15} />}
        </button>
        {canDelete && (
          <button className="icon-btn hover:text-red-600" title="Annuler la révision" aria-label="Annuler la révision" onClick={() => void remove()}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function GroupEvents({ group }: { group: Group }) {
  const events = useGroups(s => s.events[group.id]);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 pb-3">
        <p className="eyebrow mr-auto">Révisions à venir</p>
        {!adding && (
          <button className="btn-primary h-8 px-3" onClick={() => setAdding(true)}>
            <Plus size={14} /> Proposer une révision
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {adding && <EventForm group={group} onDone={() => setAdding(false)} />}
        {!events && <p className="text-[13px] text-stone-500">Chargement…</p>}
        {events && events.length === 0 && !adding && (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <CalendarPlus size={26} strokeWidth={1.5} className="text-stone-300" />
            <p className="mt-3 text-[14px] font-medium">Aucune révision prévue</p>
            <p className="mt-1 max-w-[380px] text-[13px] text-stone-500">
              Propose une séance à la BU ou en visio : chaque membre indique s’il vient et peut l’ajouter à son calendrier.
            </p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {events?.map(ev => <EventCard key={ev.id} group={group} ev={ev} />)}
        </div>
      </div>
    </div>
  );
}
