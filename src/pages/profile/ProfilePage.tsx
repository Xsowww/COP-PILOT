import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Palette, Sparkles, GraduationCap, Bell, Database, ShieldCheck, Camera, Check, Download, Upload, CalendarArrowDown, LogOut, Trash2, ChevronRight,
  Timer, HardDrive, Smartphone, Keyboard,
} from 'lucide-react';
import { useAuth } from '../../store/auth';
import { useFocusLog } from '../../store/focusLog';
import { useSettings, ACCENTS, AVATAR_COLORS, applyAppearance, type AccentKey, type ThemeMode, type Chattiness, type PersonaKey } from '../../store/settings';
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
import { fmt, todayKey } from '../../lib/dates';
import Avatar from '../../components/Avatar';
import Character from '../../copilot/Character';
import { Section, Row, Toggle, Segmented, Stepper } from './controls';
import { cloudEnabled } from '../../lib/supabase';
import { currentStreak, useBadges } from '../../lib/badges';
import { checkAiStatus, resetClaudeHistory } from '../../copilot/claudeBrain';
import BadgeGrid from './BadgeGrid';
import { USAGES, WORDS, applyUsage, type Usage } from '../../lib/usage';

const TABS = [
  { key: 'profil', label: 'Profil', icon: User },
  { key: 'apparence', label: 'Apparence', icon: Palette },
  { key: 'copilot', label: 'Kompa', icon: Sparkles },
  { key: 'etudes', label: 'Études', icon: GraduationCap },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'donnees', label: 'Données', icon: Database },
  { key: 'raccourcis', label: 'Raccourcis', icon: Keyboard },
  { key: 'compte', label: 'Compte', icon: ShieldCheck },
] as const;
type TabKey = (typeof TABS)[number]['key'];


// ── Profile ─────────────────────────────────────────────────────────────────

function useStats() {
  const items = useDrive(s => s.items);
  const notes = useNotes(s => s.notes);
  const events = useCalendar(s => s.events);
  const { focusSessions, focusTotalMinutes } = useSettings();
  // The counters live in the settings, which a device left behind can overwrite with older values:
  // the session log (one row per session, never overwritten) is the floor.
  const log = useFocusLog(s => s.sessions);
  const files = items.filter(i => i.kind === 'file');
  const today = todayKey();
  const streak = currentStreak(events);
  return {
    files: files.length,
    size: files.reduce((s, f) => s + (f.size ?? 0), 0),
    notes: notes.length,
    words: notes.reduce((s, n) => s + (stripHtml(n.content).match(/\S+/g)?.length ?? 0), 0),
    done: events.filter(e => e.done).length,
    exams: events.filter(e => e.category === 'examen' && (e.done || e.date < today)).length,
    focusSessions: Math.max(focusSessions, log.length),
    focusHours: Math.max(focusTotalMinutes, log.reduce((s, x) => s + x.minutes, 0)) / 60,
    streak,
  };
}

function Stat({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="px-5 py-4">
      <p className="tabular text-[20px] font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1 text-[12px] text-stone-500">
        {label}
        {sub && <span className="text-stone-500"> · {sub}</span>}
      </p>
    </div>
  );
}

/** Badges: a quiet, collapsed section (open when reached through a « Voir mes badges » link). */
function BadgesSection() {
  const badges = useBadges();
  const location = useLocation();
  const [open, setOpen] = useState(location.hash === '#badges');
  const earned = badges.filter(b => b.earned).length;
  useEffect(() => {
    if (location.hash === '#badges') document.getElementById('badges')?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);
  return (
    <section id="badges" className="card enter scroll-mt-4">
      <h2>
        <button onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="badges-grille" className="flex w-full items-center gap-2 rounded-xl px-5 py-4 text-left">
          <ChevronRight size={15} className={cx('text-stone-400 transition-transform', open && 'rotate-90')} />
          <span className="text-[14px] font-semibold">Badges</span>
          <span className="tabular text-[13px] font-normal text-stone-500">
            · {earned} sur {badges.length}
          </span>
        </button>
      </h2>
      {open && (
        <div id="badges-grille" className="border-t border-stone-100 p-5">
          <BadgeGrid badges={badges} />
        </div>
      )}
    </section>
  );
}

function ProfileTab() {
  const user = useAuth(s => s.user)!;
  const updateName = useAuth(s => s.updateName);
  const settings = useSettings();
  const words = WORDS[settings.usage] ?? WORDS.etudes;
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
      <Section label="Profil">
        <div className="flex flex-wrap items-center gap-5 px-5 py-5">
          <div className="relative">
            <Avatar size={72} />
            <button onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-paper hover:bg-stone-700" title="Changer la photo" aria-label="Changer la photo">
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
              {AVATAR_COLORS.map((c, i) => (
                <button
                  key={c}
                  aria-label={`Couleur de l'avatar ${i + 1}`}
                  aria-pressed={!settings.avatarImage && settings.avatarColor === c}
                  onClick={() => settings.set({ avatarColor: c, avatarImage: null })}
                  className="flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 transition-transform hover:scale-110"
                  style={{ background: c, boxShadow: !settings.avatarImage && settings.avatarColor === c ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${c}` : undefined }}
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
        <Row label="Prénom">
          <input
            className="field w-56"
            aria-label="Prénom"
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
        <Row label="Kompa sert pour">
          <select className="field w-56" aria-label="Kompa sert pour" value={settings.usage} onChange={e => { const usage = e.target.value as Usage; settings.set({ usage }); applyUsage(usage); }}>
            {USAGES.map(u => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label={words.school}>
          <input className="field w-56" aria-label={words.school} value={settings.school} placeholder={words.schoolHint} onChange={e => settings.set({ school: e.target.value })} />
        </Row>
        <Row label={words.program}>
          <input className="field w-56" aria-label={words.program} value={settings.program} placeholder={words.programHint} onChange={e => settings.set({ program: e.target.value })} />
        </Row>
        <Row label={words.level}>
          <select className="field w-56" aria-label={words.level} value={settings.year} onChange={e => settings.set({ year: e.target.value })}>
            {(words.levels.includes(settings.year) ? words.levels : [...words.levels, settings.year]).map(y => (
              <option key={y} value={y}>
                {y || 'Non renseignée'}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Statistiques" description="Depuis ton inscription.">
        <div className="grid grid-cols-2 md:grid-cols-3">
          <Stat value={stats.streak} label={`jour${stats.streak > 1 ? 's' : ''} d'affilée`} />
          <Stat value={stats.done} label="éléments cochés" />
          <Stat value={stats.exams} label="examens passés" />
          <Stat value={stats.focusSessions} label="sessions focus" sub={stats.focusHours ? `${stats.focusHours.toFixed(1)} h` : undefined} />
          <Stat value={stats.notes} label="notes" sub={stats.words ? `${stats.words} mots` : undefined} />
          <Stat value={stats.files} label="fichiers" sub={stats.files ? formatBytes(stats.size) : undefined} />
        </div>
      </Section>

      <BadgesSection />
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
  const setTheme = (theme: ThemeMode) => {
    settings.set({ theme });
    applyAppearance({ ...settings, theme });
  };
  return (
    <Section label="Apparence">
      <Row label="Thème" hint="Automatique suit ton appareil.">
        <Segmented
          label="Thème"
          value={settings.theme}
          onChange={setTheme}
          options={[
            { value: 'clair', label: 'Clair' },
            { value: 'sombre', label: 'Sombre' },
            { value: 'auto', label: 'Automatique' },
          ]}
        />
      </Row>
      <Row label="Couleur d'accent">
        <div className="flex gap-1.5" role="group" aria-label="Couleur d'accent">
          {(Object.keys(ACCENTS) as AccentKey[]).map(k => (
            <button
              key={k}
              onClick={() => setAccent(k)}
              title={ACCENTS[k].label}
              aria-label={ACCENTS[k].label}
              aria-pressed={settings.accent === k}
              className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{ background: ACCENTS[k].shades[500], boxShadow: settings.accent === k ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${ACCENTS[k].shades[500]}` : undefined }}
            >
              {settings.accent === k && <Check size={13} strokeWidth={3} className="text-white" />}
            </button>
          ))}
        </div>
      </Row>
      <div className="flex items-center gap-4 overflow-hidden bg-stone-50/70 px-5 py-4">
        <button className="btn-primary pointer-events-none">Bouton</button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-solid text-[13px] font-semibold text-on-brand">{new Date().getDate()}</span>
        <span className="rounded-md bg-brand-50 px-2 py-1 text-[12px] font-medium text-brand-700">Sélection</span>
        <div className="relative ml-auto h-16 w-24 overflow-hidden">
          <div className="absolute -right-1 top-[-14px]">
            <Character pose="peek" mood="happy" size={80} />
          </div>
        </div>
      </div>
      <Row label="Réduire les animations">
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

// ── Kompa ─────────────────────────────────────────────────────────────────

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
    void checkAiStatus().then(st => setProvider(st.enabled ? (st.label ?? st.provider ?? '') : ''));
  }, []);
  return (
    <div className="space-y-5">
      <Section label="Kompa">
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
        <Row label="Afficher Kompa" hint="Masqué, il ne fait plus aucune remarque.">
          <Toggle label="Afficher Kompa" checked={s.copilotVisible} onChange={v => s.set({ copilotVisible: v })} />
        </Row>
        <Row label="Initiatives" hint="Propose de planifier des révisions, rappelle les rendus.">
          <Toggle label="Initiatives" checked={s.proactive} onChange={v => s.set({ proactive: v })} />
        </Row>
        <Row label="Rappels avant un événement" hint="20 minutes avant un cours ou un examen.">
          <Toggle label="Rappels" checked={s.eventReminders} onChange={v => s.set({ eventReminders: v })} />
        </Row>
        <Row label="Bavardage" hint="Il se tait toujours pendant une session focus.">
          <Segmented<Chattiness> label="Bavardage"
            value={s.chattiness}
            onChange={v => s.set({ chattiness: v })}
            options={[
              { value: 'calme', label: 'Discret' },
              { value: 'normal', label: 'Normal' },
              { value: 'bavard', label: 'Bavard' },
            ]}
          />
        </Row>
        <Row label="Annoncer les nouveaux badges">
          <Toggle label="Annoncer les nouveaux badges" checked={s.badgeAnnouncements} onChange={v => s.set({ badgeAnnouncements: v })} />
        </Row>
      </Section>

      <Section title="Personnalité" description="Sa façon de te parler.">
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
            Tes instructions pour Kompa
          </label>
          <p className="mt-0.5 text-[12px] text-stone-500">Un surnom, tes centres d'intérêt, le ton que tu préfères.</p>
          <textarea
            id="persona-notes"
            className="field mt-2.5 h-auto! min-h-[84px] w-full resize-y py-2 leading-relaxed"
            maxLength={600}
            value={s.personaNotes}
            onChange={e => s.set({ personaNotes: e.target.value.slice(0, 600) })}
            placeholder="Appelle-moi Capitaine, parle-moi de foot."
          />
          <p className={cx('mt-1 text-right text-[11px] tabular', s.personaNotes.length >= 560 ? 'text-amber-600' : 'text-stone-500')}>{s.personaNotes.length}/600</p>
        </div>
      </Section>

      <Section title="Rendez-vous et voix">
        <Row label="Point du matin" hint="Ta journée en 3 lignes, avant midi.">
          <Toggle label="Point du matin" checked={s.morningBrief} onChange={v => s.set({ morningBrief: v })} />
        </Row>
        <Row label="Bilan du dimanche" hint="Le dimanche à partir de 17 h.">
          <Toggle label="Bilan du dimanche" checked={s.weeklyReview} onChange={v => s.set({ weeklyReview: v })} />
        </Row>
        <Row label="Lire ses réponses à voix haute">
          <Toggle label="Réponses à voix haute" checked={s.voiceReplies} onChange={v => s.set({ voiceReplies: v })} />
        </Row>
      </Section>

      <Section title="Mémoire">
        <Row label="Conversation" hint={`${messages} message${messages > 1 ? 's' : ''} enregistré${messages > 1 ? 's' : ''}.`}>
          <button
            className="btn-secondary h-8"
            onClick={() => {
              useCopilot.getState().clearHistory();
              resetClaudeHistory();
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
        <Row label="Position sur l'écran">
          <button className="btn-secondary h-8" onClick={() => { useCopilot.getState().setOffsetY(0.62); toast('Kompa est revenu à sa place'); }}>
            Replacer
          </button>
        </Row>
      </Section>
    </div>
  );
}

// ── Studies ─────────────────────────────────────────────────────────────────

function StudiesTab() {
  const s = useSettings();
  const focus = useFocus();
  return (
    <div className="space-y-5">
      <Section title="Sessions focus" description="Minuteur Pomodoro, en bas de la barre latérale.">
        <Row label="Durée de travail">
          <Segmented<number> label="Durée de travail" value={s.focusMinutes} onChange={v => s.set({ focusMinutes: v })} options={[15, 25, 45, 50].map(v => ({ value: v, label: `${v} min` }))} />
        </Row>
        <Row label="Durée de pause">
          <Segmented<number> label="Durée de pause" value={s.breakMinutes} onChange={v => s.set({ breakMinutes: v })} options={[5, 10, 15].map(v => ({ value: v, label: `${v} min` }))} />
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

      <Section title="Planification des révisions" description="Quand Kompa prépare tes révisions avant un examen.">
        <Row label="Nombre de séances">
          <Stepper value={s.revisionSessions} min={1} max={6} onChange={v => s.set({ revisionSessions: v })} />
        </Row>
        <Row label="Heure des séances" hint="Chaque séance dure 1 h 30.">
          <input type="time" className="field w-32" aria-label="Heure des séances" value={s.revisionTime} onChange={e => e.target.value && s.set({ revisionTime: e.target.value })} />
        </Row>
      </Section>
    </div>
  );
}

// ── Keyboard shortcuts ──────────────────────────────────────────────────────

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const SHORTCUTS: { group: string; keys: [string, string][] }[] = [
  {
    group: 'Partout',
    keys: [
      ['Ctrl K', 'Rechercher'],
      ['↑ ↓ · Entrée', 'Choisir un résultat'],
      ['Échap', 'Fermer, désélectionner'],
      ['Maj F10', 'Menu contextuel'],
    ],
  },
  {
    group: 'Drive',
    keys: [
      ['Entrée', 'Ouvrir'],
      ['Espace', 'Sélectionner'],
      ['Ctrl A', 'Tout sélectionner'],
      ['Ctrl C · Ctrl X · Ctrl V', 'Copier, couper, coller'],
      ['Ctrl D', 'Dupliquer'],
      ['F2', 'Renommer'],
      ['Suppr', 'Mettre à la corbeille'],
      ['Retour arrière', 'Dossier parent'],
    ],
  },
  {
    group: 'Calendrier',
    keys: [
      ['← →', 'Jour précédent, suivant'],
      ['↑ ↓', 'Semaine précédente, suivante'],
      ['Échap', 'Annuler un déplacement'],
    ],
  },
  {
    group: 'Notes',
    keys: [
      ['Ctrl B · Ctrl I · Ctrl U', 'Gras, italique, souligné'],
      ['Ctrl Z', 'Annuler la frappe'],
      ['Entrée', 'Du titre au texte'],
      ['F2', 'Renommer un dossier'],
    ],
  },
  {
    group: 'Corbeille',
    keys: [
      ['Entrée', 'Aperçu'],
      ['↑ ↓', 'Élément précédent, suivant'],
      ['Ctrl A', 'Tout sélectionner'],
      ['Suppr', 'Supprimer définitivement'],
    ],
  },
  {
    group: 'Souris',
    keys: [
      ['Double-clic', 'Ouvrir un fichier ou un dossier'],
      ['Clic droit', 'Plus d’options'],
      ['Ctrl + clic', 'Sélectionner plusieurs éléments'],
      ['Glisser', 'Ranger dans un dossier, déplacer un événement'],
      ['Alt + glisser', 'Copier au lieu de déplacer (Drive)'],
    ],
  },
];

const keyLabel = (k: string) => (IS_MAC ? k.replace(/Ctrl /g, '⌘ ').replace(/Alt /g, '⌥ ') : k);

function ShortcutsTab() {
  return (
    <div className="space-y-5">
      <Section title="Raccourcis clavier">
        {SHORTCUTS.map(g => (
          <div key={g.group} className="px-5 py-3">
            <h3 className="eyebrow mb-1">{g.group}</h3>
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {g.keys.map(([k, d]) => (
                <div key={k + d} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                  <dt className="text-stone-600">{d}</dt>
                  <dd className="kbd shrink-0">{keyLabel(k)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
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
    <Section label="Notifications">
      <Row
        label="Notifications du navigateur"
        hint={
          !supported
            ? "Ton navigateur ne les prend pas en charge."
            : perm === 'denied'
              ? 'Bloquées : autorise-les dans les réglages du site de ton navigateur.'
              : 'Rappels de Kompa et fin des sessions, même dans un autre onglet.'
        }
      >
        <Toggle label="Notifications" checked={s.browserNotifications && perm === 'granted'} onChange={v => void toggle(v)} />
      </Row>
      <Row label="Tester">
        <button className="btn-secondary h-8" disabled={!s.browserNotifications || perm !== 'granted'} onClick={() => notify('Kompa', 'Les notifications fonctionnent.', true)}>
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
    if (!(await confirmAction('Restaurer cette sauvegarde ?', 'Les notes, événements, tâches et dossiers absents d’ici seront ajoutés. Rien d’actuel n’est remplacé (sauf les réglages).', 'Restaurer', false))) return;
    try {
      const r = await importBackup(f);
      toast(r.notes + r.events ? `${r.notes} note${r.notes > 1 ? 's' : ''} et ${r.events} événement${r.events > 1 ? 's' : ''} récupérés` : 'Rien à récupérer : tout est déjà là', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <Section title="Sauvegarde" description={cloudEnabled ? 'Tes données sont enregistrées dans ton compte en ligne.' : 'Tes données sont enregistrées sur cet appareil.'}>
        <Row label="Exporter mes données" hint="Fichier .json, sans le contenu des fichiers du Drive.">
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
        <Row label="Exporter le calendrier" hint="Format .ics (Google Agenda, Apple Calendrier, Outlook).">
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
        <Row label="Effacer toutes mes données" hint="Fichiers du Drive, notes, événements, tâches, historique et conversation avec Kompa, corbeilles comprises. Ton compte, tes réglages et tes groupes restent.">
          <button
            className="btn-danger h-8"
            onClick={async () => {
              if (!(await confirmAction('Tout effacer ?', 'Tous tes fichiers, notes, événements, tâches et ta conversation avec Kompa seront supprimés définitivement, sur tous tes appareils. Pense à exporter une sauvegarde avant si tu veux les garder.', 'Tout effacer'))) return;
              await wipeUserData();
              toast('Données effacées', 'success');
            }}
          >
            <Trash2 size={14} /> Tout effacer
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
        <Section title="Double authentification">
          <Row label="Activée" hint="Un code de ton téléphone à chaque nouvelle connexion.">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
              <ShieldCheck size={15} /> Protégé
            </span>
          </Row>
          <Row label="Changer de téléphone" hint="Retire l'appareil actuel et affiche un nouveau QR code à scanner, avec une nouvelle clé de secours à garder.">
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
          <input type="password" className="field" placeholder="Mot de passe actuel" aria-label="Mot de passe actuel" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
          <input type="password" className="field" placeholder="Nouveau mot de passe" aria-label="Nouveau mot de passe" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
          <input type="password" className="field" placeholder="Confirmer" aria-label="Confirmer le nouveau mot de passe" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
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
        <Row label="Supprimer définitivement mon compte" hint="Tout sera effacé. Pense à exporter une sauvegarde avant.">
          <input type="password" className="field w-44" placeholder="Mot de passe" aria-label="Mot de passe, pour confirmer la suppression" value={deletePw} onChange={e => setDeletePw(e.target.value)} />
          <button
            className="btn-danger h-8"
            disabled={!deletePw}
            onClick={async () => {
              if (!(await confirmAction('Supprimer ton compte ?', 'Cette action est irréversible.', 'Supprimer'))) return;
              try {
                await verifyPassword(deletePw); // check first: never wipe data on a wrong password
                await wipeUserData({ deletingAccount: true });
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
  const usage = useSettings(s => s.usage);

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
                  tab === t.key ? 'bg-surface text-ink shadow-card ring-1 ring-stone-200' : 'text-stone-600 hover:bg-stone-100 hover:text-ink',
                )}
              >
                <t.icon size={15} className={tab === t.key ? 'text-brand-600' : ''} />
                {t.key === 'etudes' ? (WORDS[usage] ?? WORDS.etudes).profileTab : t.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            {tab === 'profil' && <ProfileTab />}
            {tab === 'apparence' && <AppearanceTab />}
            {tab === 'copilot' && <CopilotTab />}
            {tab === 'etudes' && <StudiesTab />}
            {tab === 'notifications' && <NotificationsTab />}
            {tab === 'donnees' && <DataTab />}
            {tab === 'raccourcis' && <ShortcutsTab />}
            {tab === 'compte' && <AccountTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
