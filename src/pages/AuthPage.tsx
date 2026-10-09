import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import { loadUserData, seedNewAccount } from '../store/session';
import Character from '../copilot/Character';
import Logo from '../components/Logo';
import FileIcon from '../components/FileIcon';

function Showcase() {
  const days = [
    { d: 'Lun', n: 13 },
    { d: 'Mar', n: 14, dot: '#3b6fd8' },
    { d: 'Mer', n: 15, dot: '#d48a17' },
    { d: 'Jeu', n: 16, active: true },
    { d: 'Ven', n: 17, dot: '#d9483b' },
  ];
  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-14">
      <div className="max-w-[440px]">
        <p className="eyebrow">Pour les étudiants</p>
        <h2 className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
          Tes cours, ton planning et tes fichiers, enfin au même endroit.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-stone-500">Un espace calme pour t'organiser, et Copilot pour te rappeler ce qui compte.</p>
      </div>

      {/* Product preview */}
      <div className="mt-10 grid max-w-[460px] grid-cols-5 gap-3">
        <div className="card col-span-3 p-4">
          <p className="eyebrow">Cette semaine</p>
          <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
            {days.map(x => (
              <div key={x.n} className={x.active ? 'rounded-lg bg-ink py-1.5 text-white' : 'py-1.5'}>
                <p className={x.active ? 'text-[10px] text-white/60' : 'text-[10px] text-stone-400'}>{x.d}</p>
                <p className="tabular text-[14px] font-semibold">{x.n}</p>
                <span className="mx-auto mt-1 block h-1 w-1 rounded-full" style={{ background: x.dot ?? 'transparent' }} />
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 rounded-md bg-stone-50 px-2 py-1.5 text-[12px]">
              <span className="h-3 w-0.5 rounded-full bg-[#3b6fd8]" /> Cours de maths <span className="ml-auto tabular text-stone-400">09:00</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-stone-50 px-2 py-1.5 text-[12px]">
              <span className="h-3 w-0.5 rounded-full bg-[#d48a17]" /> Rendre le TP <span className="ml-auto tabular text-stone-400">18:00</span>
            </div>
          </div>
        </div>
        <div className="card col-span-2 flex flex-col p-4">
          <p className="eyebrow">Prochain examen</p>
          <p className="tabular mt-auto text-[34px] font-semibold leading-none tracking-tight">J-4</p>
          <p className="mt-1.5 text-[12px] text-stone-500">Partiel d'anglais</p>
        </div>
        <div className="card col-span-2 flex items-center gap-2.5 p-3">
          <FileIcon category="folder" size={30} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium">Semestre 1</p>
            <p className="text-[11px] text-stone-400">24 fichiers</p>
          </div>
        </div>
        <div className="card col-span-3 flex items-center gap-2.5 p-3">
          <FileIcon category="pdf" size={30} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium">Chapitre 4 — Thermodynamique.pdf</p>
            <p className="text-[11px] text-stone-400">Modifié hier</p>
          </div>
        </div>
      </div>

      {/* Copilot peeking from the edge */}
      <div className="absolute right-0 top-[58%]">
        <div className="pop absolute right-[96px] top-2 w-48 rounded-2xl rounded-br-sm border border-stone-200 bg-white px-3 py-2 text-[12.5px] leading-snug shadow-pop" style={{ animationDelay: '600ms' }}>
          Psst. Ton partiel est dans 4 jours, on cale des révisions ?
        </div>
        <Character pose="peek" look={{ x: -0.9, y: -0.2 }} mood="happy" size={104} />
      </div>
    </div>
  );
}

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const { login, register } = useAuth.getState();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isRegister = mode === 'register';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (isRegister && name.trim().length < 2) return setError('Ton prénom doit contenir au moins 2 caractères.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Adresse e-mail invalide.');
    if (password.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.');
    setBusy(true);
    try {
      if (isRegister) {
        const user = await register(name, email, password);
        await loadUserData();
        seedNewAccount(user.name);
      } else {
        await login(email, password);
        await loadUserData();
      }
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full overflow-y-auto">
      <main className="flex flex-1 flex-col px-6 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={onSubmit} className="enter w-full max-w-[340px]">
            <h1 className="text-[22px] font-semibold tracking-[-0.015em]">{isRegister ? 'Créer un compte' : 'Connexion'}</h1>
            <p className="mt-1 text-[13px] text-stone-500">
              {isRegister ? 'Gratuit, et prêt en quelques secondes.' : 'Retrouve ton espace là où tu l’as laissé.'}
            </p>

            <div className="mt-7 space-y-3.5">
              {isRegister && (
                <label className="block">
                  <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Prénom</span>
                  <input className="field w-full" value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" autoFocus />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-stone-600">E-mail</span>
                <input className="field w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus={!isRegister} placeholder="prenom@universite.fr" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-medium text-stone-600">Mot de passe</span>
                <span className="relative block">
                  <input
                    className="field w-full pr-10"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder={isRegister ? '6 caractères minimum' : undefined}
                  />
                  <button type="button" onClick={() => setShow(s => !s)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-stone-400 hover:text-stone-700" title={show ? 'Masquer' : 'Afficher'}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
              </label>
            </div>

            {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {isRegister ? 'Créer mon compte' : 'Se connecter'}
            </button>

            <p className="mt-6 text-center text-[13px] text-stone-500">
              {isRegister ? 'Déjà inscrit ?' : 'Pas encore de compte ?'}{' '}
              <Link to={isRegister ? '/connexion' : '/inscription'} className="font-medium text-ink underline decoration-stone-300 underline-offset-4 hover:decoration-ink">
                {isRegister ? 'Se connecter' : 'Créer un compte'}
              </Link>
            </p>
          </form>
        </div>
        <p className="text-[11px] text-stone-400">Tes données restent enregistrées sur cet appareil.</p>
      </main>
      <aside className="hidden flex-1 border-l border-stone-200/80 bg-stone-100/60 lg:block">
        <Showcase />
      </aside>
    </div>
  );
}
