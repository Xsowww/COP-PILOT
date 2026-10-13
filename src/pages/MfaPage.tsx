import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuth, type MfaEnrollment } from '../store/auth';
import { loadUserData } from '../store/session';
import Logo from '../components/Logo';

/**
 * Second factor: the student scans a QR code with their phone camera (or an authenticator
 * app), the phone then shows a 6-digit code that changes every 30 s, to type here.
 * Shown once when the account is created, then at each new login.
 */
export default function MfaPage() {
  const navigate = useNavigate();
  const { user, mfaStep, startMfaSetup, submitMfaCode, logout } = useAuth();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const started = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mfaStep !== 'setup' || started.current) return;
    started.current = true;
    startMfaSetup().then(setEnrollment, (e: Error) => setError(e.message));
  }, [mfaStep, startMfaSetup]);

  useEffect(() => {
    if (!user) navigate('/connexion', { replace: true });
    else if (!mfaStep) navigate('/', { replace: true });
  }, [user, mfaStep, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) return setError('Le code contient 6 chiffres.');
    setBusy(true);
    setError('');
    try {
      await submitMfaCode(code, enrollment?.factorId);
      await loadUserData();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const isSetup = mfaStep === 'setup';

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-6 sm:px-10">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-8">
        <form onSubmit={submit} className="enter w-full max-w-[380px]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {isSetup ? <ShieldCheck size={20} /> : <Smartphone size={20} />}
          </span>
          <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.015em]">{isSetup ? 'Sécurise ton compte' : 'Code de sécurité'}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-500">
            {isSetup
              ? 'Dernière étape : associe ton téléphone. Même si quelqu’un découvre ton mot de passe, il ne pourra pas entrer sans lui.'
              : 'Ouvre l’app où tu as ajouté COP-PILOT et tape le code à 6 chiffres affiché.'}
          </p>

          {isSetup && (
            <ol className="mt-6 space-y-4 text-[13px]">
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-paper">1</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Scanne ce QR code avec ton téléphone</p>
                  <p className="mt-0.5 text-stone-500">
                    iPhone : l’appareil photo, puis « Ajouter dans Mots de passe ». Android : Google Authenticator ou Microsoft Authenticator.
                  </p>
                  <div className="mt-3 flex h-[180px] w-[180px] items-center justify-center rounded-xl border border-stone-200 bg-surface p-2.5">
                    {enrollment ? <img src={enrollment.qrCode} alt="QR code à scanner" className="h-full w-full" /> : <Loader2 className="animate-spin text-stone-400" />}
                  </div>
                  {enrollment && (
                    <div className="mt-2 text-[12px] text-stone-500">
                      <a href={enrollment.uri} className="underline decoration-stone-300 underline-offset-2 hover:text-ink">
                        Tu es déjà sur ton téléphone ? Touche ici
                      </a>
                      {' · '}
                      <button type="button" onClick={() => setShowSecret(s => !s)} className="underline decoration-stone-300 underline-offset-2 hover:text-ink">
                        Saisir la clé à la main
                      </button>
                      {showSecret && <p className="mt-1.5 break-all rounded-md bg-stone-100 px-2 py-1.5 font-mono text-[12px] text-ink">{enrollment.secret}</p>}
                    </div>
                  )}
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-paper">2</span>
                <p className="font-medium">Tape le code à 6 chiffres affiché par ton téléphone</p>
              </li>
            </ol>
          )}

          <input
            ref={inputRef}
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus={!isSetup}
            placeholder="123 456"
            aria-label="Code à 6 chiffres"
            className="field mt-5 h-12 w-full text-center font-mono text-[22px] tracking-[0.3em]"
          />

          {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

          <button type="submit" disabled={busy || (isSetup && !enrollment)} className="btn-primary mt-4 w-full">
            {busy && <Loader2 size={15} className="animate-spin" />}
            {isSetup ? 'Activer et entrer' : 'Valider'}
          </button>

          <p className="mt-5 text-center text-[13px] text-stone-500">
            {isSetup ? 'Pas le bon compte ?' : 'Tu n’as plus accès à ton téléphone ?'}{' '}
            <button
              type="button"
              onClick={() => void logout().then(() => navigate('/connexion', { replace: true }))}
              className="font-medium text-ink underline decoration-stone-300 underline-offset-4 hover:decoration-ink"
            >
              Se déconnecter
            </button>
          </p>
          {!isSetup && <p className="mt-2 text-center text-[12px] text-stone-500">Contacte le support de COP-PILOT pour réinitialiser ta double authentification.</p>}
        </form>
      </div>
    </div>
  );
}
