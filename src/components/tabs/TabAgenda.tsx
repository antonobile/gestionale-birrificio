import React, { useState } from 'react';
import { EventoAgenda } from '../../types';
import { generateIcs, downloadIcsFile } from '../../utils/calendar';
import { Calendar as CalendarIcon, Plus, Trash2, Clock, Tag } from 'lucide-react';

interface TabAgendaProps {
  eventi: EventoAgenda[];
  onAddEvento: (evento: Omit<EventoAgenda, 'id'>) => void;
  onDeleteEvento: (id: number) => void;
}

const CATEGORIE_MAP: { [key: string]: { label: string; bg: string; text: string } } = {
  '🟡 Produzione': { label: '🟡 Produzione', bg: 'bg-yellow-100', text: 'text-yellow-900' },
  '🔵 Imbottigliamento': { label: '🔵 Imbottigliamento', bg: 'bg-sky-100', text: 'text-sky-900' },
  '🟢 Fiera': { label: '🟢 Fiera', bg: 'bg-emerald-100', text: 'text-emerald-900' },
  '🟣 Appuntamento': { label: '🟣 Appuntamento', bg: 'bg-purple-100', text: 'text-purple-900' },
  '🟠 Evento': { label: '🟠 Evento', bg: 'bg-orange-100', text: 'text-orange-900' },
};

export const TabAgenda: React.FC<TabAgendaProps> = ({ eventi, onAddEvento, onDeleteEvento }) => {
  const [mostraForm, setMostraForm] = useState(false);

  const [titolo, setTitolo] = useState('');
  const [categoria, setCategoria] = useState<EventoAgenda['categoria']>('🟡 Produzione');
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().slice(0, 16));
  const [dataFine, setDataFine] = useState(new Date().toISOString().slice(0, 16));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim()) return;

    onAddEvento({
      titolo: titolo.trim(),
      categoria,
      data_inizio: dataInizio,
      data_fine: dataFine,
    });

    setTitolo('');
    setMostraForm(false);
  };

  const handleScaricaIcs = () => {
    const events = eventi.map((e) => ({
      uid: `brewdesk-agenda-${e.id}@brewdesk`,
      title: `${e.categoria} ${e.titolo}`,
      start: e.data_inizio,
      end: e.data_fine,
      description: `Agenda Birrificio BrewDesk`,
    }));
    const ics = generateIcs(events, 'BrewDesk Agenda');
    downloadIcsFile('agenda_birrificio.ics', ics);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div>
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-600" />
            <span>📅 Agenda & Pianificazione Attività del Birrificio</span>
          </h3>
          <p className="text-xs text-stone-500">
            Traccia appuntamenti, cotte, fiere ed imbottigliamenti settimanali.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostraForm(!mostraForm)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Attività</span>
          </button>
          <button
            onClick={handleScaricaIcs}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow-xs transition"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Esporta .ICS</span>
          </button>
        </div>
      </div>

      {mostraForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h4 className="font-bold text-stone-900 text-sm">Aggiungi Evento all&apos;Agenda</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Titolo Attività *</label>
              <input
                type="text"
                placeholder="es. Controllo Fermentatore 1 / Fiera Beer Attraction"
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Categoria</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as any)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              >
                {Object.keys(CATEGORIE_MAP).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Inizio (Data e Ora)</label>
              <input
                type="datetime-local"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Fine (Data e Ora)</label>
              <input
                type="datetime-local"
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              className="text-xs px-3 py-1.5 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-1.5 rounded-lg shadow-sm"
            >
              Salva Attività
            </button>
          </div>
        </form>
      )}

      {/* Grid of Events */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {eventi.map((e) => {
          const cat = CATEGORIE_MAP[e.categoria] || CATEGORIE_MAP['🟡 Produzione'];
          return (
            <div
              key={e.id}
              className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs flex items-center justify-between"
            >
              <div className="space-y-1">
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${cat.bg} ${cat.text}`}>
                  {e.categoria}
                </span>
                <h4 className="font-bold text-stone-900 text-sm">{e.titolo}</h4>
                <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>
                    {e.data_inizio.replace('T', ' ')} → {e.data_fine.replace('T', ' ')}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onDeleteEvento(e.id)}
                className="p-1.5 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                title="Elimina evento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
