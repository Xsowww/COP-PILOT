// Talking with Kompa: dictation with the browser's speech recognition, and spoken
// answers with speech synthesis. Both are optional and depend on the browser.

import { useEffect, useRef, useState } from 'react';
import { stripMarkdown } from './markdown';

// Minimal typing of the Web Speech API (not in TypeScript's DOM library yet).
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canDictate = () => typeof window !== 'undefined' && recognitionCtor() !== null;

/**
 * Dictation: `start()` listens, `onInterim` receives the text as it is recognised,
 * `onFinal` the whole sentence once the student stops talking.
 */
export function useDictation(onInterim: (text: string) => void, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef({ onInterim, onFinal });
  useEffect(() => {
    cb.current = { onInterim, onFinal };
  });

  useEffect(() => () => rec.current?.abort(), []);

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor || listening) return;
    stopSpeaking();
    const r = new Ctor();
    r.lang = 'fr-FR';
    r.interimResults = true;
    r.continuous = false;
    let finalText = '';
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      cb.current.onInterim((finalText + interim).trim());
    };
    r.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError("Micro refusé : autorise-le dans les réglages du navigateur.");
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError("Je n'ai pas réussi à t'entendre.");
    };
    r.onend = () => {
      setListening(false);
      rec.current = null;
      if (finalText.trim()) cb.current.onFinal(finalText.trim());
    };
    rec.current = r;
    setError(null);
    setListening(true);
    try {
      r.start();
    } catch {
      setListening(false);
    }
  };

  const stop = () => rec.current?.stop();

  return { listening, error, start, stop, supported: canDictate() };
}

// ── Spoken answers ────────────────────────────────────────────────────────────

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const listeners = new Set<(speaking: boolean) => void>();
const emit = (v: boolean) => listeners.forEach(l => l(v));

function frenchVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'fr-FR' && /google|natural|premium|enhanced/i.test(v.name)) ?? voices.find(v => v.lang === 'fr-FR') ?? voices.find(v => v.lang.startsWith('fr'));
}

/** Reads a text aloud in French (Markdown symbols and emojis removed). */
export function speakText(text: string) {
  if (!canSpeak()) return;
  const clean = stripMarkdown(text)
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean.slice(0, 4000));
  u.lang = 'fr-FR';
  const voice = frenchVoice();
  if (voice) u.voice = voice;
  u.rate = 1.04;
  u.onstart = () => emit(true);
  u.onend = () => emit(false);
  u.onerror = () => emit(false);
  synth.speak(u);
}

export function stopSpeaking() {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  emit(false);
}

export function useSpeaking() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    listeners.add(setSpeaking);
    return () => {
      listeners.delete(setSpeaking);
    };
  }, []);
  return speaking;
}
