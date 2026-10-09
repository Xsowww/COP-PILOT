import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Heading1, Heading2, List, ListOrdered, ListChecks, Quote, Code2, Link2, Minus, Undo2, Redo2,
} from 'lucide-react';
import { useNotes, type Note } from '../../store/notes';
import { cx } from '../../lib/utils';

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, Icon: typeof Bold, active: boolean, run: () => void) => (
    <button
      key={label}
      type="button"
      title={label}
      onMouseDown={e => e.preventDefault()}
      onClick={run}
      className={cx('flex h-7 w-7 items-center justify-center rounded-md transition-colors', active ? 'bg-stone-200/70 text-ink' : 'text-stone-500 hover:bg-stone-100 hover:text-ink')}
    >
      <Icon size={15} />
    </button>
  );
  const c = () => editor.chain().focus();
  const sep = (k: string) => <span key={k} className="mx-1 h-4 w-px bg-stone-200" />;

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {btn('Titre 1', Heading1, editor.isActive('heading', { level: 1 }), () => c().toggleHeading({ level: 1 }).run())}
      {btn('Titre 2', Heading2, editor.isActive('heading', { level: 2 }), () => c().toggleHeading({ level: 2 }).run())}
      {sep("s1")}
      {btn('Gras (Ctrl+B)', Bold, editor.isActive('bold'), () => c().toggleBold().run())}
      {btn('Italique (Ctrl+I)', Italic, editor.isActive('italic'), () => c().toggleItalic().run())}
      {btn('Souligné (Ctrl+U)', Underline, editor.isActive('underline'), () => c().toggleUnderline().run())}
      {btn('Barré', Strikethrough, editor.isActive('strike'), () => c().toggleStrike().run())}
      {btn('Surligner', Highlighter, editor.isActive('highlight'), () => c().toggleHighlight().run())}
      {sep('s2')}
      {btn('Liste à puces', List, editor.isActive('bulletList'), () => c().toggleBulletList().run())}
      {btn('Liste numérotée', ListOrdered, editor.isActive('orderedList'), () => c().toggleOrderedList().run())}
      {btn('Cases à cocher', ListChecks, editor.isActive('taskList'), () => c().toggleTaskList().run())}
      {sep('s3')}
      {btn('Citation', Quote, editor.isActive('blockquote'), () => c().toggleBlockquote().run())}
      {btn('Bloc de code', Code2, editor.isActive('codeBlock'), () => c().toggleCodeBlock().run())}
      {btn('Lien', Link2, editor.isActive('link'), () => {
        const prev = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Adresse du lien', prev ?? 'https://');
        if (url === null) return;
        if (!url.trim()) c().unsetLink().run();
        else c().extendMarkRange('link').setLink({ href: url.trim() }).run();
      })}
      {btn('Séparateur', Minus, false, () => c().setHorizontalRule().run())}
      {sep('s4')}
      {btn('Annuler (Ctrl+Z)', Undo2, false, () => c().undo().run())}
      {btn('Rétablir', Redo2, false, () => c().redo().run())}
    </div>
  );
}

export default function NoteEditor({ note }: { note: Note }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: 'Commence à écrire… (tape « # » pour un titre, « - » pour une liste)' }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: note.content,
    editorProps: { attributes: { class: 'prose-note' } },
    onUpdate: ({ editor: ed }) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => useNotes.getState().updateNote(note.id, { content: ed.getHTML() }), 350);
    },
  });

  // Flush pending save when switching notes / leaving the page.
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (editor && !editor.isDestroyed) {
        const html = editor.getHTML();
        if (html !== useNotes.getState().notes.find(n => n.id === note.id)?.content) useNotes.getState().updateNote(note.id, { content: html });
      }
    },
    [editor, note.id],
  );

  if (!editor) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sticky top-0 z-10 border-b border-stone-100 bg-white px-4 py-1.5 md:px-11">
        <Toolbar editor={editor} />
      </div>
      <div className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-6 md:px-12" onClick={() => !editor.isFocused && editor.commands.focus('end')}>
        <EditorContent editor={editor} onClick={e => e.stopPropagation()} />
      </div>
    </div>
  );
}
