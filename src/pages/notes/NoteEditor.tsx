import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import TiptapImage from '@tiptap/extension-image';
import type { EditorView } from '@tiptap/pm/view';
import { NodeSelection } from '@tiptap/pm/state';
import {
  Bold, Italic, Underline, Strikethrough, Highlighter, Heading1, Heading2, List, ListOrdered, ListChecks, Quote, Code2, Link2, Minus, Undo2, Redo2, ImagePlus,
} from 'lucide-react';
import { useNotes, type Note } from '../../store/notes';
import { toast } from '../../store/ui';
import { cx } from '../../lib/utils';
import { compressImage, imageFiles } from './images';
import { registerEditorFlush } from './noteUtils';
import './notes.css';

/** Compresses then inserts images at `pos` (drop) or at the selection (paste, toolbar). */
async function insertImages(view: EditorView, files: File[], pos?: number) {
  for (const file of files) {
    try {
      const src = await compressImage(file);
      if (view.isDestroyed) return;
      const { state } = view;
      const node = state.schema.nodes.image.create({ src });
      // A selected image is kept: the new one goes right after it.
      const at = pos ?? (state.selection instanceof NodeSelection ? state.selection.to : null);
      const tr = at == null ? state.tr.replaceSelectionWith(node) : state.tr.insert(Math.min(at, state.doc.content.size), node);
      view.dispatch(tr.scrollIntoView());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Impossible d’ajouter l’image', 'error');
    }
  }
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (label: string, Icon: typeof Bold, active: boolean, run: () => void) => (
    <button
      key={label}
      type="button"
      title={label} aria-label={label}
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
      <label
        key="image"
        title="Image (tu peux aussi la coller ou la glisser dans la note)"
        onMouseDown={e => e.preventDefault()}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
      >
        <ImagePlus size={15} />
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={e => {
            const files = imageFiles(e.target.files);
            e.target.value = '';
            if (files.length) void insertImages(editor.view, files);
          }}
        />
      </label>
      {sep('s4')}
      {btn('Annuler (Ctrl+Z)', Undo2, false, () => c().undo().run())}
      {btn('Rétablir', Redo2, false, () => c().redo().run())}
    </div>
  );
}

export default function NoteEditor({ note, readOnly = false, inset = 'px-4 py-6 md:px-12' }: { note: Note; readOnly?: boolean; inset?: string }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: 'Commence à écrire… (tape « # » pour un titre, « - » pour une liste)' }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      TiptapImage.configure({ allowBase64: true }),
    ],
    content: note.content,
    editorProps: {
      attributes: { class: 'prose-note', 'aria-label': 'Contenu de la note', 'aria-multiline': 'true' },
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(view, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = moved ? [] : imageFiles(event.dataTransfer?.files);
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(view, files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => useNotes.getState().updateNote(note.id, { content: ed.getHTML() }), 350);
    },
  });

  // Flush pending save when switching notes, leaving the page or closing the tab.
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      if (editor && !editor.isDestroyed && !readOnly) {
        const html = editor.getHTML();
        const saved = useNotes.getState().notes.find(n => n.id === note.id);
        // Gone (e.g. moved to the trash): nothing to save.
        if (saved && html !== saved.content) useNotes.getState().updateNote(note.id, { content: html });
      }
    };
    window.addEventListener('pagehide', flush);
    registerEditorFlush(flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      registerEditorFlush(null, flush);
      flush();
    };
  }, [editor, note.id, readOnly]);

  if (!editor) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!readOnly && (
        <div className="sticky top-0 z-10 border-b border-stone-100 bg-surface px-4 py-1.5 md:px-11">
          <Toolbar editor={editor} />
        </div>
      )}
      <div className={cx('min-h-0 flex-1 overflow-y-auto', inset, !readOnly && 'cursor-text')} onClick={() => !readOnly && !editor.isFocused && editor.commands.focus('end')}>
        <EditorContent editor={editor} onClick={e => e.stopPropagation()} />
      </div>
    </div>
  );
}
