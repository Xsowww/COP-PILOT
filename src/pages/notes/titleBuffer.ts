// « + Note » from another page: the Notes page takes 0.5 s to show up, and the keys typed meanwhile
// must not be lost. A hidden field outside React takes the focus within the click (which also opens
// the keyboard on phones), keeps what is typed, and hands it over to the new note's title.

const ID = 'note-title-buffer';

export function startTitleBuffer() {
  document.getElementById(ID)?.remove();
  const el = document.createElement('textarea');
  el.id = ID;
  el.setAttribute('aria-label', 'Titre de la note');
  el.setAttribute('autocomplete', 'off');
  // 16 px: no zoom on iPhone when it takes the focus.
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px;resize:none;pointer-events:none';
  // One line, like the title.
  el.addEventListener('keydown', e => e.key === 'Enter' && e.preventDefault());
  // Left for good (clicked elsewhere): nothing to hand over.
  // (after the blur: removing an element while it is being blurred throws)
  el.onblur = () => setTimeout(() => el.remove(), 0);
  document.body.appendChild(el);
  el.focus({ preventScroll: true });
}

/** What was typed since `startTitleBuffer`, or null if nothing is waiting. */
export function takeTitleBuffer(): string | null {
  const el = document.getElementById(ID) as HTMLTextAreaElement | null;
  if (!el) return null;
  const text = el.value.replace(/[\r\n]+/g, ' ');
  el.onblur = null;
  el.remove();
  return text;
}
