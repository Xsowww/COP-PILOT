import { useState } from 'react';
import { Check, Plus, Tags, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Overlays';
import { confirmAction } from '../../store/ui';
import { useSettings } from '../../store/settings';
import { useCalendar, CATEGORIES, CATEGORY_COLORS, createCategory, deleteCategory, updateCategory, type CustomCategory } from '../../store/calendar';
import { cx } from '../../lib/utils';

export function ColorChoice({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Couleur">
      {CATEGORY_COLORS.map(c => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Couleur ${c}`}
          onClick={() => onChange(c)}
          className={cx('flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition', value === c && 'ring-2 ring-stone-400')}
          style={{ background: c }}
        >
          {value === c && <Check size={12} strokeWidth={3} className="text-white" />}
        </button>
      ))}
    </div>
  );
}

/** Name + colour of a new category; calls back with the one created. */
export function NewCategory({ onCreated, autoFocus }: { onCreated: (c: CustomCategory) => void; autoFocus?: boolean }) {
  const used = useSettings(s => s.customCategories).length;
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[(used + 5) % CATEGORY_COLORS.length]);
  const submit = () => {
    if (!label.trim()) return;
    onCreated(createCategory(label, color));
    setLabel('');
  };
  return (
    <div className="space-y-2.5">
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Nom, ex. Stage, Asso, Job…"
          aria-label="Nom de la nouvelle catégorie"
          maxLength={24}
          className="field min-w-0 flex-1"
        />
        <button type="button" className="btn-secondary shrink-0" disabled={!label.trim()} onClick={submit}>
          <Plus size={15} /> Créer
        </button>
      </div>
      <ColorChoice value={color} onChange={setColor} />
    </div>
  );
}

function Row({ cat }: { cat: CustomCategory }) {
  const [label, setLabel] = useState(cat.label);
  const [editingColor, setEditingColor] = useState(false);
  const count = useCalendar(s => s.events.filter(e => e.category === cat.id).length);
  const remove = async () => {
    const msg = count ? `Ses ${count} événement${count > 1 ? 's' : ''} passeront dans « ${CATEGORIES.perso.label} ».` : 'Aucun événement ne l’utilise.';
    if (await confirmAction(`Supprimer « ${cat.label} » ?`, msg, 'Supprimer')) deleteCategory(cat.id);
  };
  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditingColor(v => !v)} className="h-5 w-5 shrink-0 rounded-full ring-1 ring-stone-200" style={{ background: cat.color }} aria-label={`Changer la couleur de « ${cat.label} »`} aria-expanded={editingColor} />
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={() => (label.trim() ? updateCategory(cat.id, { label }) : setLabel(cat.label))}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label={`Nom de la catégorie « ${cat.label} »`}
          maxLength={24}
          className="field h-8 min-w-0 flex-1"
        />
        <span className="tabular w-14 shrink-0 text-right text-[12px] text-stone-500">{count ? `${count} év.` : ''}</span>
        <button type="button" onClick={() => void remove()} className="icon-btn shrink-0 hover:text-red-600" title="Supprimer" aria-label={`Supprimer la catégorie « ${cat.label} »`}>
          <Trash2 size={14} />
        </button>
      </div>
      {editingColor && (
        <div className="mt-2 pl-7">
          <ColorChoice
            value={cat.color}
            onChange={color => {
              updateCategory(cat.id, { color });
              setEditingColor(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

/** The student's own calendar categories: create, rename, recolour, delete. */
export default function CategoriesDialog({ onClose }: { onClose: () => void }) {
  const custom = useSettings(s => s.customCategories);
  return (
    <Modal open onClose={onClose} width={460}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
          <Tags size={15} />
        </span>
        <h3 className="text-[15px] font-semibold">Mes catégories</h3>
      </div>

      <p className="eyebrow mt-5">De base</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.values(CATEGORIES).map(c => (
          <span key={c.label} className="flex h-7 items-center gap-1.5 rounded-full border border-stone-200 px-2.5 text-[12px] text-stone-600">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>

      <p className="eyebrow mt-5">Les tiennes</p>
      {custom.length ? (
        <ul className="mt-1 divide-y divide-stone-100">
          {custom.map(c => (
            <Row key={c.id} cat={c} />
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13px] text-stone-500">Aucune pour l’instant. Crée-en une ci-dessous.</p>
      )}

      <div className="mt-4 rounded-lg bg-stone-50 p-3">
        <NewCategory onCreated={() => undefined} />
      </div>
      <p className="mt-2 text-[12px] text-stone-500">Astuce : écris son nom dans le titre d’un événement (« Stage chez Airbus ») et Kompaly la choisit tout seul.</p>

      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={onClose}>
          Terminé
        </button>
      </div>
    </Modal>
  );
}
