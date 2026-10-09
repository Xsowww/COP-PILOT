import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, FolderOpen, CalendarDays, NotebookPen, Loader2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import { loadUserData, seedNewAccount } from '../store/session';
import Character from '../copilot/Character';

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
    if (isRegister && name.trim().length < 2) return setError('Ton prénom doit faire au moins 2 caractères.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Cette adresse e-mail ne semble pas valide.');
    if (password.length < 6) return setError('Le mot de passe doit faire au moins 6 caractères.');
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
    <div className="app-backdrop flex h-full overflow-y-auto">
      {/* Showcase */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-bold backdrop-blur">C</div>
          <span className="text-lg font-semibold tracking-tight">COP-PILOT</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">Tes cours, ton planning et tes fichiers. Au même endroit.</h1>
          <p className="mt-4 text-white/80">Un espace pensé pour les étudiants : simple, rapide, et avec un copilote qui t'aide à rester concentré.</p>
          <div className="mt-8 grid gap-3">
            {[
              { icon: FolderOpen, t: 'Drive', d: 'Importe, range et retrouve tous tes documents.' },
              { icon: CalendarDays, t: 'Calendrier', d: 'Écris « Exam vendredi 14h », c\'est planifié.' },
              { icon: NotebookPen, t: 'Notes', d: 'Prends tes cours et range-les par dossier.' },
            ].map(f => (
              <div key={f.t} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 backdrop-blur">
                <f.icon size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{f.t}</p>
                  <p className="text-sm text-white/75">{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} COP-PILOT</p>
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 scale-[1.6] origin-right">
          <Character pose="peek" look={{ x: -1, y: 0.2 }} blink={false} mood="happy" />
        </div>
      </aside>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center p-6">
        <form onSubmit={onSubmit} className="glass fade-up w-full max-w-sm rounded-[32px] p-8">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{isRegister ? 'Créer ton compte' : 'Content de te revoir 👋'}</h2>
          <p className="mt-1 text-sm text-slate-500">{isRegister ? 'Ça prend 20 secondes, promis.' : 'Connecte-toi pour retrouver ton espace.'}</p>

          <div className="mt-6 space-y-3">
            {isRegister && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Prénom</span>
                <input className="field w-full" value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" autoFocus placeholder="Alex" />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">E-mail</span>
              <input className="field w-full" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" autoFocus={!isRegister} placeholder="alex@exemple.fr" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Mot de passe</span>
              <div className="relative">
                <input
                  className="field w-full pr-10"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="6 caractères minimum"
                />
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600" title={show ? 'Masquer' : 'Afficher'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          </div>

          {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary mt-6 w-full justify-center py-2.5">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {isRegister ? 'Créer mon compte' : 'Se connecter'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-500">
            {isRegister ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
            <Link to={isRegister ? '/connexion' : '/inscription'} className="font-semibold text-indigo-600 hover:underline">
              {isRegister ? 'Se connecter' : "S'inscrire"}
            </Link>
          </p>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">Version de démonstration : ton compte et tes données sont enregistrés uniquement dans ce navigateur.</p>
        </form>
      </main>
    </div>
  );
}
