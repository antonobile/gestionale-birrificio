import React, { useState } from 'react';
import { Annotazione } from '../types';
import { Plus, Check, RotateCcw, Trash2, Calendar, Pin } from 'lucide-react';

interface StickyNotesProps {
  note: Annotazione[];
  onAddNota: (nota: Omit<Annotazione, 'id' | 'created_at'>) => void;
  onToggleNota: (id: number) => void;
  onDeleteNota: (id: number) => void;
}

const CATEGORIE_NOTE = {
  Manutenzione: { emoji: '🔧', bg: 'bg-amber-100/90', border: 'border-l-amber-500', text: 'text-amber-900' },
  Ordinazioni: { emoji: '🛒', bg: 'bg-sky-100/90', border: 'border-l-sky-500', text: 'text-sky-900' },
  'Note di brassaggio': { emoji: '🍺', bg: 'bg-emerald-100/90', border: 'border-l-emerald-500', text: 'text-emerald-900' },
  'Cantina & Qualità': { emoji: '🧪', bg: 'bg-purple-100/90', border: 'border-l-purple-500', text: 'text-purple-900' },
  Generale: { emoji: '📝', bg: 'bg-rose-100/90', border: 'border-l-rose-500', text: 'text-rose-900' },
};

type CategoriaKey = keyof typeof CATEGORIE_NOTE;

export const StickyNotes: React.FC<StickyNotesProps> = ({
  note,
  onAddNota,
  onToggleNota,
  onDeleteNota,
}) => {
  const [mostraForm, setMostraForm] = useState(false);
  const [filtroCat, setFiltroCat] = useState<string>('Tutte');
  const [mostraFatte, setMostraFatte] = useState(false);

  // Form state
  const [titolo, setTitolo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaKey>('Generale');
  const [testo, setTesto] = useState('');
  const [dataScadenza, setDataScadenza] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim() && !testo.trim()) return;
    onAddNota({
      titolo: titolo.trim(),
      categoria,
      testo: testo.trim(),
      data_scadenza: dataScadenza || undefined,
      completata: false,
      creato_da: 'admin',
    });
    setTitolo('');
    setTesto('');
    setDataScadenza('');
    setMostraForm(false);
  };

  const noteFiltrate = note.filter((n) => {
    if (!mostraFatte && n.completata) return false;
    if (filtroCat !== 'Tutte' && n.categoria !== filtroCat) return false;
    return true;
  });

  return (
    <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Pin className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-stone-900">Bacheca Post-It & Annotazioni Rapide</h2>
          <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
            {noteFiltrate.length} {noteFiltrate.length === 1 ? 'nota' : 'note'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroCat}
            onChange={(e) => setFiltroCat(e.target.value)}
            className="text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 shadow-2xs"
          >
            <option value="Tutte">Tutte le categorie</option>
            {Object.keys(CATEGORIE_NOTE).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label className="text-xs flex items-center gap-1.5 text-stone-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostraFatte}
              onChange={(e) => setMostraFatte(e.target.checked)}
              className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Completate</span>
          </label>

          <button
            onClick={() => setMostraForm(!mostraForm)}
            className="flex items-center gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Nota</span>
          </button>
        </div>
      </div>

      {/* Form Aggiungi Nota */}
      {mostraForm && (
        <form onSubmit={handleSubmit} className="mb-5 bg-amber-50/60 p-4 rounded-xl border border-amber-200 shadow-inner">
          <h3 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
            <span>✍️ Scrivi una nuova nota per la cantina o sala cottura</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              placeholder="Titolo nota..."
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              className="text-xs p-2 rounded-lg bg-white border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaKey)}
              className="text-xs p-2 rounded-lg bg-white border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {Object.keys(CATEGORIE_NOTE).map((c) => (
                <option key={c} value={c}>
                  {CATEGORIE_NOTE[c as CategoriaKey].emoji} {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dataScadenza}
              onChange={(e) => setDataScadenza(e.target.value)}
              className="text-xs p-2 rounded-lg bg-white border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Data scadenza (opzionale)"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Descrizione / dettagli operativi..."
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            className="w-full text-xs p-2 rounded-lg bg-white border border-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="text-xs px-4 py-1.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 shadow-xs"
            >
              Appendi in Bacheca
            </button>
          </div>
        </form>
      )}

      {/* Grid of Post-it Notes */}
      {noteFiltrate.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-xs italic bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
          Nessuna annotazione presente. Usa &quot;Nuova Nota&quot; per appuntare promemoria o controlli.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {noteFiltrate.map((n, idx) => {
            const catInfo = CATEGORIE_NOTE[n.categoria as CategoriaKey] || CATEGORIE_NOTE.Generale;
            const isScaduta = n.data_scadenza && new Date(n.data_scadenza) < new Date();

            return (
              <div
                key={n.id}
                style={{ transform: idx % 2 === 0 ? 'rotate(-0.5deg)' : 'rotate(0.5deg)' }}
                className={`p-3.5 rounded-lg shadow-sm border-l-4 transition hover:shadow-md flex flex-col justify-between ${
                  n.completata ? 'bg-stone-100/70 opacity-60 border-l-stone-400' : `${catInfo.bg} ${catInfo.border}`
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1 text-stone-600">
                    <span>
                      {catInfo.emoji} {n.categoria}
                    </span>
                    {n.data_scadenza && (
                      <span
                        className={`flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded ${
                          isScaduta && !n.completata
                            ? 'bg-rose-600 text-white font-bold'
                            : 'bg-stone-200/80 text-stone-700'
                        }`}
                      >
                        <Calendar className="w-2.5 h-2.5" />
                        {n.data_scadenza}
                      </span>
                    )}
                  </div>
                  <h4 className={`text-sm font-bold text-stone-900 mb-1 ${n.completata ? 'line-through text-stone-500' : ''}`}>
                    {n.titolo}
                  </h4>
                  {n.testo && (
                    <p className={`text-xs text-stone-700 leading-relaxed whitespace-pre-wrap ${n.completata ? 'line-through text-stone-400' : ''}`}>
                      {n.testo}
                    </p>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-stone-200/50 flex items-center justify-between">
                  <span className="text-[10px] text-stone-400">ID #{n.id}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleNota(n.id)}
                      className={`p-1 rounded hover:bg-black/10 transition ${n.completata ? 'text-amber-700' : 'text-emerald-700'}`}
                      title={n.completata ? 'Riapri nota' : 'Segna come completata'}
                    >
                      {n.completata ? <RotateCcw className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onDeleteNota(n.id)}
                      className="p-1 rounded text-rose-600 hover:bg-rose-100/60 transition"
                      title="Elimina nota"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
