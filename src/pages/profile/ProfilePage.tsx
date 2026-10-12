import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addDays } from 'date-fns';
import {
  User, Palette, Sparkles, GraduationCap, Bell, Database, ShieldCheck, Camera, Check, Download, Upload, CalendarArrowDown, LogOut, Trash2, Keyboard, Flame,
  FolderClosed, NotebookText, CalendarCheck, Target, Timer, HardDrive, Smartphone,
} from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useSettings, ACCENTS, AVATAR_COLORS, applyAppearance, type AccentKey, type Chattiness, type PersonaKey } from '../../store/settings';
import { useCopilot } from '../../store/copilot';
import { useDrive } from '../../store/drive';
import { useNotes } from '../../store/notes';
import { useCalendar } from '../../store/calendar';
import { useFocus } from '../../store/focus';
import { loadUserData } from '../../store/session';
import { askText, confirmAction, toast } from '../../store/ui';
import { exportBackup, importBackup, exportIcs, wipeUserData, imageToAvatar } from '../../lib/backup';
import { requestNotificationPermission, notify, chime } from '../../lib/notify';
import { formatBytes, stripHtml, cx } from '../../lib/utils';
import { fmt, toKey, todayKey } from '../../lib/dates';
import Avatar from '../../components/Avatar';
import Character from '../../copilot/Character';
import { Section, Row, Toggle, Segmented, Stepper } from './controls';
import { cloudEnabled } from '../../lib/supabase';

const TABS = [
  { key: 'profil', label: 'Profil', icon: User },
  { key: 'apparence', label: 'Apparence', icon: Palette },
  { key: 'copilot', label: 'Copilot', icon: Sparkles },
  { key: 'etudes', label: 'Études', icon: GraduationCap },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'donnees', label: 'Données', icon: Database },
  { key: 'compte', label: 'Compte', icon: ShieldCheck },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const YEARS = ['', 'Lycée', 'L1', 'L2', 'L3', 'M1', 'M2', 'BTS / BUT', 'Prépa', 'École', 'Doctorat', 'Autre'];

// ── Profile ─────────────────────────────────────────────────────────────────

function useStats() {
  const items = useDrive(s => s.items);
  const notes = useNotes(s => s.notes);
  const events = useCalendar(s => s.events);
  const { focusSessions, focusTotalMinutes } = useSettings();
  const files = items.filter(i => i.kind === 'file');
  const today = todayKey();
  const doneDays = new Set(events.filter(e => e.done).map(e => e.date));
  let streak = 0;
  let d = doneDays.has(today) ? new Date() : addDays(new Date(), -1);
  while (doneDays.has(toKey(d))) {
    streak++;
    d = addDays(d, -1);
  }
  return {
    files: files.length,
    size: files.reduce((s, f) => s + (f.size ?? 0), 0),
    notes: notes.length,
    words: notes.reduce((s, n) => s + (stripHtml(n.content).match(/\S+/g)?.length ?? 0), 0),
    done: events.filter(e => e.done).length,
    exams: events.filter(e => e.category === 'examen' && (e.done || e.date < today)).length,
    focusSessions,
    focusHours: focusTotalMinutes / 60,
    streak,
  };
}

function Stat({ icon: Icon, color, value, label, sub }: { icon: typeof User; color: string; value: string | number; label: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200/80 p-3.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `color-mix(in srgb, ${color} 12%, white)`, color }}>
        <Icon size={15} />
      </span>
      <p className="tabular mt-3 text-[22px] font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[12px] text-stone-500">
        {label}
        {sub && <span className="text-stone-400"> · {sub}</span>}
      </p>
    </div>
  );
}

function ProfileTab() {
  const user = useAuth(s => s.user)!;
  const updateName = useAuth(s => s.updateName);
  const settings = useSettings();
  const stats = useStats();
  const [name, setName] = useState(user.name);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (f?: File) => {
    if (!f) return;
    try {
      settings.set({ avatarImage: await imageToAvatar(f) });
      toast('Photo mise à jour', 'success');
    } catch {
      toast("Impossible de lire cette image", 'error');
    }
  };

  return (
    <div className="space-y-5">
      <Section title="Profil" description="Ce que Copilot sait de toi.">
        <div className="flex flex-wrap items-center gap-5 px-5 py-5">
          <div className="relative">
            <Avatar size={72} />
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink text-white hover:bg-stone-700" title="Changer la photo">
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { void pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold tracking-tight">{user.name}</p>
            <p className="text-[13px] text-stone-500">
              {user.email} · inscrit le {fmt(new Date(user.createdAt), 'd MMMM yyyy')}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => settings.set({ avatarColor: c, avatarImage: null })}
                  className="flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110"
                  style={{ background: c, boxShadow: !settings.avatarImage && settings.avatarColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
                  title="Couleur de l'avatar"
                />
              ))}
              {settings.avatarImage && (
                <button className="ml-2 text-[12px] text-stone-500 underline underline-offset-2 hover:text-ink" onClick={() => settings.set({ avatarImage: null })}>
                  Retirer la photo
                </button>
              )}
            </div>
          </div>
        </div>
        <Row label="Prénom" hint="Utilisé par Copilot pour te parler.">
          <input
            className="field w-56"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => {
              if (name.trim().length >= 2 && name.trim() !== user.name) {
                updateName(name.trim()).then(
                  () => toast('Prénom enregistré', 'success'),
                  (e: Error) => {
                    toast(e.message, 'error');
                    setName(user.name);
                  },
                );
              } else setName(user.name);
            }}
          />
        </Row>
        <Row label="Établissement">
          <input className="field w-56" value={settings.school} placeholder="Université, école…" onChange={e => settings.set({ school: e.target.value })} />
        </Row>
        <Row label="Filière">
          <input className="field w-56" value={settings.program} placeholder="Droit, info, médecine…" onChange={e => settings.set({ program: e.target.value })} />
        </Row>
        <Row label="Année">
          <select className="field w-56" value={settings.year} onChange={e => settings.set({ year: e.target.value })}>
            {YEARS.map(y => (
              <option key={y} value={y}>
                {y || 'Non renseignée'}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Tes statistiques" description="Ton activité depuis ton inscription.">
        <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3">
          <Stat icon={Flame} color="var(--color-brand-500)" value={stats.streak} label={`jour${stats.streak > 1 ? 's' : ''} d'affilée`} sub="avec une tâche faite" />
          <Stat icon={CalendarCheck} color="#2f9e6b" value={stats.done} label="tâches terminées" />
          <Stat icon={Target} color="#d9483b" value={stats.exams} label="examens passés" />
          <Stat icon={Timer} color="#7a5ad6" value={stats.focusSessions} label="sessions focus" sub={`${stats.focusHours.toFixed(1)} h`} />
          <Stat icon={NotebookText} color="#d48a17" value={stats.notes} label="notes" sub={`${stats.words} mots`} />
          <Stat icon={FolderClosed} color="#3b6fd8" value={stats.files} label="fichiers" sub={formatBytes(stats.size)} />
        </div>
      </Section>
    </div>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────────

function AppearanceTab() {
  const settings = useSettings();
  const setAccent = (accent: AccentKey) => {
    settings.set({ accent });
    applyAppearance({ ...settings, accent });
  };
  return (
    <Section title="Apparence" description="Personnalise l'interface.">
      <Row label="Couleur d'accent" hint="Boutons, jour actuel, minuteur, et même le casque de Copilot.">
        <div className="flex gap-1.5">
          {(Object.keys(ACCENTS) as AccentKey[]).map(k => (
            <button
              key={k}
              onClick={() => setAccent(k)}
              title={ACCENTS[k].label}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: ACCENTS[k].shades[500], boxShadow: settings.accent === k ? `0 0 0 2px white, 0 0 0 4px ${ACCENTS[k].shades[500]}` : undefined }}
            >
              {settings.accent === k && <Check size={13} strokeWidth={3} className="text-white" />}
            </button>
          ))}
        </div>
      </Row>
      <div className="flex items-center gap-4 overflow-hidden bg-stone-50/70 px-5 py-4">
        <button className="btn-primary pointer-events-none">Bouton</button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-[13px] font-semibold text-white">{new Date().getDate()}</span>
        <span className="rounded-md bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-700">Sélection</span>
        <div className="relative ml-auto h-16 w-24 overflow-hidden">
          <div className="absolute -right-1 top-[-14px]">
            <Character pose="peek" mood="happy" size={80} />
          </div>
        </div>
      </div>
      <Row label="Réduire les animations" hint="Désactive les transitions et les mouvements de Copilot.">
        <Toggle
          label="Réduire les animations"
          checked={settings.reduceMotion}
          onChange={v => {
            settings.set({ reduceMotion: v });
            applyAppearance({ ...settings, reduceMotion: v });
          }}
        />
      </Row>
    </Section>
  );
}

// ── Copilot ─────────────────────────────────────────────────────────────────

const PERSONAS: { key: PersonaKey; label: string; description: string; example: string }[] = [
  { key: 'pote', label: 'Meilleur pote', description: 'Drôle et détendu, sérieux quand il le faut.', example: '« Partiel jeudi ? On cale trois séances et tu gères. »' },
  { key: 'coach', label: 'Coach motivant', description: 'Te pousse à passer à l’action, fête chaque progrès.', example: '« 25 minutes, une seule tâche. Go, je chronomètre. »' },
  { key: 'prof', label: 'Prof patient', description: 'Explique pas à pas et vérifie que c’est compris.', example: '« Reprenons depuis la définition, avec un exemple. »' },
  { key: 'zen', label: 'Zen', description: 'Calme, aide à prendre du recul quand ça déborde.', example: '« Une chose à la fois. Laquelle est la plus simple ? »' },
  { key: 'taquin', label: 'Taquin', description: 'Te charrie gentiment, jamais méchant.', example: '« Douze onglets ouverts et zéro fiche. Audacieux. »' },
];

function CopilotTab() {
  const s = useSettings();
  const aiEnabled = useCopilot(c => c.aiEnabled);
  const messages = useCopilot(c => c.messages.length);
  const [provider, setProvider] = useState('');
  useEffect(() => {
    void import('../../copilot/claudeBrain')
      .then(m => m.checkAiStatus())
      .then(st => setProvider(st.enabled ? (st.label ?? st.provider ?? '') : ''));
  }, []);
  return (
    <div className="space-y-5">
      <Section title="Copilot" description="Ton compagnon sur le bord de l'écran.">
        <div className="flex items-center gap-3 px-5 py-4">
          <span className={cx('h-2 w-2 rounded-full', aiEnabled ? 'bg-emerald-500' : 'bg-stone-400')} />
          <p className="text-[13px]">
            {aiEnabled ? (
              <>
                <span className="font-medium">Mode intelligent activé.</span>{' '}
                <span className="text-stone-500">Il répond à toutes tes questions et peut agir sur ton espace{provider ? ` (IA : ${provider})` : ''}.</span>
              </>
            ) : (
              <>
                <span className="font-medium">Mode simple.</span> <span className="text-stone-500">Il comprend les commandes courantes (chercher, planifier, créer…).</span>
              </>
            )}
          </p>
        </div>
        <Row label="Afficher Copilot" hint="Masqué, il ne se montre plus et ne fait plus de remarques.">
          <Toggle label="Afficher Copilot" checked={s.copilotVisible} onChange={v => s.set({ copilotVisible: v })} />
        </Row>
        <Row label="Initiatives" hint="Il propose spontanément de planifier des révisions, te rappelle les rendus…">
          <Toggle label="Initiatives" checked={s.proactive} onChange={v => s.set({ proactive: v })} />
        </Row>
        <Row label="Rappels avant un événement" hint="Un petit mot 20 minutes avant un cours ou un examen.">
          <Toggle label="Rappels" checked={s.eventReminders} onChange={v => s.set({ eventReminders: v })} />
        </Row>
        <Row label="Bavardage" hint="À quelle fréquence il peut te parler de lui-même.">
          <Segmented<Chattiness>
            value={s.chattiness}
            onChange={v => s.set({ chattiness: v })}
            options={[
              { value: 'calme', label: 'Discret' },
              { value: 'normal', label: 'Normal' },
              { value: 'bavard', label: 'Bavard' },
            ]}
          />
        </Row>
      </Section>

      <Section title="Personnalité" description="Sa façon de te parler. Ses règles de base (honnêteté, sécurité, confirmation avant de supprimer) ne changent pas.">
        <div className="grid gap-2 px-5 py-4 sm:grid-cols-2">
          {PERSONAS.map(p => (
            <button
              key={p.key}
              onClick={() => s.set({ persona: p.key })}
              aria-pressed={s.persona === p.key}
              className={cx(
                'rounded-lg border px-3.5 py-3 text-left transition-colors',
                s.persona === p.key ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{p.label}</span>
                {s.persona === p.key && <Check size={14} className="text-brand-600" />}
              </span>
              <span className="mt-0.5 block text-[12px] text-stone-500">{p.description}</span>
              <span className="mt-1.5 block text-[12px] italic text-stone-600">{p.example}</span>
            </button>
          ))}
        </div>
        <div className="px-5 py-4">
          <label htmlFor="persona-notes" className="text-[13px] font-medium">
            Tes instructions pour Copilot
          </label>
          <p className="mt-0.5 text-[12px] text-stone-500">Un surnom, tes centres d'intérêt, le ton que tu préfères… Exemple : « Appelle-moi Capitaine, parle-moi de foot ».</p>
          <textarea
            id="persona-notes"
            className="field mt-2.5 h-auto! min-h-[84px] w-full resize-y py-2 leading-relaxed"
            maxLength={600}
            value={s.personaNotes}
            onChange={e => s.set({ personaNotes: e.target.value.slice(0, 600) })}
            placeholder="Appelle-moi Capitaine, parle-moi de foot."
          />
          <p className={cx('mt-1 text-right text-[11px] tabular', s.personaNotes.length >= 560 ? 'text-amber-600' : 'text-stone-400')}>{s.personaNotes.length}/600</p>
        </div>
      </Section>

      <Section title="Rendez-vous et voix">
        <Row label="Point du matin" hint="À la première ouverture de la journée (avant midi) : ta journée en 3 lignes.">
          <Toggle label="Point du matin" checked={s.morningBrief} onChange={v => s.set({ morningBrief: v })} />
        </Row>
        <Row label="Bilan du dimanche" hint="Le dimanche à partir de 17 h : ce qui a été fait, ton temps de concentration, la semaine qui arrive.">
          <Toggle label="Bilan du dimanche" checked={s.weeklyReview} onChange={v => s.set({ weeklyReview: v })} />
        </Row>
        <Row label="Lire ses réponses à voix haute" hint="Utilise la voix française de ton appareil. Pour lui parler, utilise le micro dans la conversation.">
          <Toggle label="Réponses à voix haute" checked={s.voiceReplies} onChange={v => s.set({ voiceReplies: v })} />
        </Row>
      </Section>

      <Section title="Planification des révisions" description="Utilisé quand Copilot prépare tes révisions avant un examen.">
        <Row label="Nombre de séances">
          <Stepper value={s.revisionSessions} min={1} max={6} onChange={v => s.set({ revisionSessions: v })} />
        </Row>
        <Row label="Heure des séances" hint="Chaque séance dure 1 h 30.">
          <input type="time" className="field w-32" value={s.revisionTime} onChange={e => e.target.value && s.set({ revisionTime: e.target.value })} />
        </Row>
      </Section>

      <Section title="Mémoire">
        <Row label="Conversation" hint={`${messages} message${messages > 1 ? 's' : ''} enregistré${messages > 1 ? 's' : ''}.`}>
          <button
            className="btn-secondary h-8"
            onClick={() => {
              useCopilot.getState().clearHistory();
              void import('../../copilot/claudeBrain').then(m => m.resetClaudeHistory());
              toast('Conversation effacée', 'success');
            }}
          >
            Effacer
          </button>
        </Row>
        <Row label="Remarques déjà faites" hint="Il oublie ce qu'il t'a déjà signalé et pourra te le redire.">
          <button className="btn-secondary h-8" onClick={() => { useCopilot.setState({ memory: {} }); toast('Mémoire réinitialisée', 'success'); }}>
            Réinitialiser
          </button>
        </Row>
        <Row label="Position sur l'écran" hint="Tu peux aussi le faire glisser le long du bord.">
          <button className="btn-secondary h-8" onClick={() => { useCopilot.getState().setOffsetY(0.62); toast('Copilot est revenu à sa place'); }}>
            Replacer
          </button>
        </Row>
      </Section>
    </div>
  );
}

// ── Studies ─────────────────────────────────────────────────────────────────

const SHORTCUTS: [string, string][] = [
  ['Ctrl K', 'Rechercher partout'],
  ['Ctrl C · Ctrl X · Ctrl V', 'Copier, couper, coller dans le Drive'],
  ['Ctrl D', 'Dupliquer'],
  ['F2', 'Renommer'],
  ['Suppr', 'Supprimer la sélection'],
  ['Ctrl A', 'Tout sélectionner'],
  ['Entrée', 'Ouvrir'],
  ['Alt + glisser', 'Copier au lieu de déplacer'],
  ['Échap', 'Fermer, désélectionner'],
];

function StudiesTab() {
  const s = useSettings();
  const focus = useFocus();
  return (
    <div className="space-y-5">
      <Section title="Sessions focus" description="Minuteur de concentration (méthode Pomodoro), accessible en bas de la barre latérale.">
        <Row label="Durée de travail">
          <Segmented<number> value={s.focusMinutes} onChange={v => s.set({ focusMinutes: v })} options={[15, 25, 45, 50].map(v => ({ value: v, label: `${v} min` }))} />
        </Row>
        <Row label="Durée de pause">
          <Segmented<number> value={s.breakMinutes} onChange={v => s.set({ breakMinutes: v })} options={[5, 10, 15].map(v => ({ value: v, label: `${v} min` }))} />
        </Row>
        <Row label="Son de fin de session">
          <button className="btn-ghost h-8 text-[12px]" onClick={chime}>
            Écouter
          </button>
          <Toggle label="Son" checked={s.focusSound} onChange={v => s.set({ focusSound: v })} />
        </Row>
        <Row label="Lancer une session maintenant" hint={focus.phase ? 'Une session est déjà en cours.' : `${s.focusMinutes} min de travail, puis ${s.breakMinutes} min de pause.`}>
          <button
            className="btn-primary h-8"
            disabled={!!focus.phase}
            onClick={async () => {
              const label = await askText('Sur quoi tu travailles ?', '', 'Démarrer');
              if (label !== null) focus.start(label.trim());
            }}
          >
            <Timer size={14} /> Démarrer
          </button>
        </Row>
      </Section>

      <Section title="Raccourcis clavier">
        <div className="grid gap-x-6 px-5 py-3 sm:grid-cols-2">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-stone-100 py-2 text-[13px] last:border-0 sm:[&:nth-last-child(2)]:border-0">
              <span className="text-stone-600">{d}</span>
              <span className="kbd shrink-0">{k}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Notifications ───────────────────────────────────────────────────────────

function NotificationsTab() {
  const s = useSettings();
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied');

  const toggle = async (v: boolean) => {
    if (v) {
      const ok = await requestNotificationPermission();
      setPerm(supported ? Notification.permission : 'denied');
      if (!ok) return toast('Les notifications sont bloquées par ton navigateur', 'error');
    }
    s.set({ browserNotifications: v });
  };

  return (
    <Section title="Notifications" description="Pour ne rien rater quand COP-PILOT est dans un autre onglet.">
      <Row
        label="Notifications du navigateur"
        hint={
          !supported
            ? "Ton navigateur ne les prend pas en charge."
            : perm === 'denied'
              ? 'Bloquées : autorise-les dans les réglages du site de ton navigateur.'
              : 'Rappels de Copilot, fin des sessions focus.'
        }
      >
        <Toggle label="Notifications" checked={s.browserNotifications && perm === 'granted'} onChange={v => void toggle(v)} />
      </Row>
      <Row label="Tester" hint="Envoie une notification d'essai.">
        <button className="btn-secondary h-8" disabled={!s.browserNotifications || perm !== 'granted'} onClick={() => notify('COP-PILOT', 'Les notifications fonctionnent.', true)}>
          <Bell size={14} /> Essayer
        </button>
      </Row>
    </Section>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

function DataTab() {
  const importRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const events = useCalendar(s => s.events.length);

  useEffect(() => {
    void navigator.storage?.estimate?.().then(e => setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0 }));
  }, []);

  const onImport = async (f?: File) => {
    if (!f) return;
    if (!(await confirmAction('Restaurer cette sauvegarde ?', 'Tes notes, ton calendrier et tes réglages actuels seront remplacés.', 'Restaurer', false))) return;
    try {
      const r = await importBackup(f);
      toast(`${r.notes} notes et ${r.events} événements restaurés`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <Section title="Sauvegarde" description={cloudEnabled ? 'Tes données sont enregistrées dans ton compte en ligne. Tu peux aussi en garder une copie.' : 'Tes données sont enregistrées sur cet appareil. Garde une copie de temps en temps.'}>
        <Row label="Exporter mes données" hint="Notes, calendrier, dossiers et réglages dans un fichier .json (sans le contenu des fichiers du Drive).">
          <button className="btn-secondary h-8" onClick={exportBackup}>
            <Download size={14} /> Exporter
          </button>
        </Row>
        <Row label="Restaurer une sauvegarde">
          <button className="btn-secondary h-8" onClick={() => importRef.current?.click()}>
            <Upload size={14} /> Importer
          </button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </Row>
        <Row label="Exporter le calendrier" hint={`${events} événement${events > 1 ? 's' : ''} au format .ics, à importer dans Google Agenda, Apple Calendrier ou Outlook.`}>
          <button className="btn-secondary h-8" disabled={!events} onClick={() => exportIcs()}>
            <CalendarArrowDown size={14} /> Exporter
          </button>
        </Row>
      </Section>

      {!cloudEnabled && usage && usage.quota > 0 && (
        <Section title="Stockage">
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 text-[13px]">
              <HardDrive size={15} className="text-stone-400" />
              <span className="tabular font-medium">{formatBytes(usage.used)}</span>
              <span className="text-stone-500">utilisés sur {formatBytes(usage.quota)} disponibles dans ce navigateur</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-[#3b6fd8]" style={{ width: `${Math.max(1, (usage.used / usage.quota) * 100)}%` }} />
            </div>
          </div>
        </Section>
      )}

      <Section title="Zone sensible" danger>
        <Row label="Effacer toutes mes données" hint="Fichiers, notes et événements. Ton compte et tes réglages sont conservés.">
          <button
            className="btn-secondary h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={async () => {
              if (!(await confirmAction('Tout effacer ?', 'Tous tes fichiers, notes et événements seront supprimés définitivement.', 'Tout effacer'))) return;
              await wipeUserData();
              toast('Données effacées', 'success');
            }}
          >
            <Trash2 size={14} /> Effacer
          </button>
        </Row>
      </Section>
    </div>
  );
}

// ── Account ─────────────────────────────────────────────────────────────────

function AccountTab() {
  const navigate = useNavigate();
  const { changePassword, deleteAccount, verifyPassword, logout } = useAuth.getState();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [deletePw, setDeletePw] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast('Le nouveau mot de passe doit faire au moins 8 caractères', 'error');
    if (next !== confirmPw) return toast('Les deux mots de passe ne correspondent pas', 'error');
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirmPw('');
      toast('Mot de passe modifié', 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    sessionStorage.removeItem('cop:greeted');
    await loadUserData();
    navigate('/connexion');
  };

  return (
    <div className="space-y-5">
      {cloudEnabled && (
        <Section title="Double authentification" description="Un code de ton téléphone est demandé à chaque nouvelle connexion.">
          <Row label="Activée" hint="Ton compte est protégé par ton application d'authentification.">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <ShieldCheck size={15} /> Protégé
            </span>
          </Row>
          <Row label="Changer de téléphone" hint="Retire l'appareil actuel et affiche un nouveau QR code à scanner.">
            <button
              className="btn-secondary h-8"
              onClick={async () => {
                if (!(await confirmAction('Changer de téléphone ?', "L'ancien appareil ne pourra plus générer de codes. Tu scanneras un nouveau QR code juste après.", 'Continuer', false))) return;
                try {
                  await useAuth.getState().resetMfa();
                  navigate('/securite');
                } catch (e) {
                  toast((e as Error).message, 'error');
                }
              }}
            >
              <Smartphone size={14} /> Associer un autre téléphone
            </button>
          </Row>
        </Section>
      )}

      <Section title="Mot de passe">
        <form onSubmit={onChange} className="grid gap-3 px-5 py-4 sm:grid-cols-3">
          <input type="password" className="field" placeholder="Mot de passe actuel" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
          <input type="password" className="field" placeholder="Nouveau mot de passe" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
          <input type="password" className="field" placeholder="Confirmer" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
          <div className="sm:col-span-3">
            <button className="btn-primary h-8" disabled={busy || !current || !next}>
              Modifier le mot de passe
            </button>
          </div>
        </form>
      </Section>

      <Section title="Session">
        <Row label="Se déconnecter" hint={cloudEnabled ? 'Tes données restent en sécurité dans ton compte.' : 'Tes données restent sur cet appareil, tu les retrouveras en te reconnectant.'}>
          <button className="btn-secondary h-8" onClick={() => void logout().then(leave)}>
            <LogOut size={14} /> Se déconnecter
          </button>
        </Row>
      </Section>

      <Section title="Supprimer le compte" danger>
        <Row label="Supprimer définitivement mon compte" hint="Le compte, tes fichiers, notes et événements seront définitivement effacés. Pense à exporter une sauvegarde avant.">
          <input type="password" className="field w-44" placeholder="Mot de passe" value={deletePw} onChange={e => setDeletePw(e.target.value)} />
          <button
            className="btn-danger h-8"
            disabled={!deletePw}
            onClick={async () => {
              if (!(await confirmAction('Supprimer ton compte ?', 'Cette action est irréversible.', 'Supprimer'))) return;
              try {
                await verifyPassword(deletePw); // check first: never wipe data on a wrong password
                await wipeUserData();
                await deleteAccount(deletePw);
                await leave();
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }}
          >
            Supprimer
          </button>
        </Row>
      </Section>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(t => t.key === params.get('onglet'))?.key ?? 'profil') as TabKey;

  return (
    <div className="h-full overflow-y-auto px-4 pb-12 md:px-8">
      <div className="mx-auto max-w-[980px]">
        <div className="pb-5 pt-2">
          <h1 className="text-[24px] font-semibold tracking-[-0.02em]">Profil et réglages</h1>
        </div>
        <div className="flex flex-col gap-6 md:flex-row">
          <nav className="-mx-1 flex shrink-0 gap-0.5 overflow-x-auto md:mx-0 md:w-48 md:flex-col">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setParams(t.key === 'profil' ? {} : { onglet: t.key })}
                className={cx(
                  'flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                  tab === t.key ? 'bg-white text-ink shadow-card ring-1 ring-stone-200' : 'text-stone-600 hover:bg-stone-100 hover:text-ink',
                )}
              >
                <t.icon size={15} className={tab === t.key ? 'text-brand-600' : ''} />
                {t.label}
              </button>
            ))}
            <div className="mt-4 hidden rounded-lg border border-dashed border-stone-200 p-3 text-[12px] text-stone-500 md:block">
              <Keyboard size={14} className="mb-1.5 text-stone-400" />
              Astuce : <span className="kbd">Ctrl K</span> pour tout retrouver.
            </div>
          </nav>
          <div className="min-w-0 flex-1">
            {tab === 'profil' && <ProfileTab />}
            {tab === 'apparence' && <AppearanceTab />}
            {tab === 'copilot' && <CopilotTab />}
            {tab === 'etudes' && <StudiesTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'donnees' && <DataTab />}
            {tab === 'compte' && <AccountTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
