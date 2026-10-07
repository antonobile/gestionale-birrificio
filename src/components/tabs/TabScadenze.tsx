import React, { useState } from 'react';
import { PromemoriaScadenza, FatturaUtenza, Annotazione } from '../../types';
import { generateIcs, downloadIcsFile, getGoogleCalendarUrl } from '../../utils/calendar';
import { Clock, Plus, CheckCircle, Calendar, Trash2, Filter } from 'lucide-react';

interface TabScadenzeProps {
  promemoria: PromemoriaScadenza[];
  bollette: FatturaUtenza[];
  note: Annotazione[];
  onAddPromemoria: (prom: Omit<PromemoriaScadenza, 'id'>) => void;
  onCompletaPromemoria: (id: number) => void;
  onDeletePromemoria: (id: number) => void;
}

interface ScadenzaUnificata {
  id: number;
  tipo: 'manuale' | 'bolletta' | 'nota';
  titolo: string;
  categoria: string;
  data: string;
  importo?: number;
  ricorrenza?: string;
  stato: 'APERTA' | 'COMPLETATA';
  note?: string;
}

export const TabScadenze: React.FC<TabScadenzeProps> = ({
  promemoria,
  bollette,
  note,
  onAddPromemoria,
  onCompletaPromemoria,
  onDeletePromemoria,
}) => {
  const [mostraForm, setMostraForm] = useState(false);
  const [filtroOrizzonte, setFiltroOrizzonte] = useState('Tutte');
  const [filtroCat, setFiltroCat] = useState('Tutte');

  // Form State
  const [titolo, setTitolo] = useState('');
  const [categoria, setCategoria] = useState('Manutenzione');
  const [dataScadenza, setDataScadenza] = useState(new Date().toISOString().slice(0, 10));
  const [importo, setImporto] = useState<number>(0);
  const [ricorrenza, setRicorrenza] = useState<'Nessuna' | 'Mensile' | 'Trimestrale' | 'Semestrale' | 'Annuale'>('Nessuna');
  const [noteText, setNoteText] = useState('');

  // Costruisci elenco unificato
  const unificate: ScadenzaUnificata[] = [];

  for (const p of promemoria) {
    unificate.push({
      id: p.id,
      tipo: 'manuale',
      titolo: p.titolo,
      categoria: p.categoria,
      data: p.data_scadenza,
      importo: p.importo,
      ricorrenza: p.ricorrenza,
      stato: p.stato,
      note: p.note,
    });
  }

  for (const b of bollette) {
    if (b.stato_pagamento !== 'PAGATA') {
      unificate.push({
        id: b.id,
        tipo: 'bolletta',
        titolo: `Bolletta ${b.tipo_utenza} - ${b.fornitore}`,
        categoria: 'Bolletta / Utenza',
        data: b.data_scadenza,
        importo: b.totale_fattura,
        stato: 'APERTA',
        note: `Fattura ${b.numero_fattura || '-'}`,
      });
    }
  }

  for (const n of note) {
    if (n.data_scadenza && !n.completata) {
      unificate.push({
        id: n.id,
        tipo: 'nota',
        titolo: n.titolo || n.testo.slice(0, 40),
        categoria: n.categoria,
        data: n.data_scadenza,
        stato: 'APERTA',
        note: n.testo,
      });
    }
  }

  // Calcolo scadenze e stati temporali
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getUrgenza = (dataStr: string) => {
    const d = new Date(dataStr);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { codice: 'SCADUTA', badge: 'bg-rose-100 text-rose-800 font-bold', emoji: '🔴' };
    if (diff <= 3) return { codice: 'URGENTE', badge: 'bg-amber-100 text-amber-900 font-bold', emoji: '🟠' };
    if (diff <= 7) return { codice: 'IMMINENTE', badge: 'bg-yellow-100 text-yellow-900 font-bold', emoji: '🟡' };
    return { codice: 'PROGRAMMATA', badge: 'bg-emerald-50 text-emerald-800', emoji: '🟢' };
  };

  const aperte = unificate.filter((u) => u.stato === 'APERTA');
  const numScadute = aperte.filter((u) => getUrgenza(u.data).codice === 'SCADUTA').length;
  const numUrgenti = aperte.filter((u) => getUrgenza(u.data).codice === 'URGENTE').length;
  const numImminenti = aperte.filter((u) => getUrgenza(u.data).codice === 'IMMINENTE').length;
  const totImporti = aperte.reduce((acc, u) => acc + (u.importo || 0), 0);

  const filtrate = unificate.filter((u) => {
    if (filtroCat !== 'Tutte' && u.categoria !== filtroCat) return false;
    if (filtroOrizzonte === 'Scadute + prossimi 7 giorni') {
      const d = new Date(u.data);
      const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 7) return false;
    } else if (filtroOrizzonte === 'Solo scadute') {
      if (getUrgenza(u.data).codice !== 'SCADUTA') return false;
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titolo.trim()) return;

    onAddPromemoria({
      titolo: titolo.trim(),
      categoria,
      data_scadenza: dataScadenza,
      importo: importo > 0 ? importo : undefined,
      ricorrenza,
      stato: 'APERTA',
      note: noteText.trim(),
    });

    setTitolo('');
    setImporto(0);
    setNoteText('');
    setMostraForm(false);
  };

  const handleScaricaTuttoIcs = () => {
    const events = aperte.map((u) => ({
      uid: `brewdesk-scad-${u.tipo}-${u.id}@brewdesk`,
      title: `⏰ [${u.categoria}] ${u.titolo}`,
      start: u.data,
      description: `${u.note || ''} ${u.importo ? `\nImporto: € ${u.importo.toFixed(2)}` : ''}`,
    }));
    const ics = generateIcs(events, 'BrewDesk Scadenze Birrificio');
    downloadIcsFile('scadenze_birrificio.ics', ics);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-rose-600 uppercase">🔴 Scadute</span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{numScadute}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-amber-600 uppercase">🟠 Urgenti (≤ 3 gg)</span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">{numUrgenti}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-yellow-600 uppercase">🟡 In Arrivo (≤ 7 gg)</span>
          <div className="text-xl font-bold font-mono text-yellow-700 mt-1">{numImminenti}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-stone-500 uppercase">💶 Importi Aperti</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">€ {totImporti.toFixed(2)}</div>
        </div>
      </div>

      {/* Actions and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostraForm(!mostraForm)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuovo Promemoria</span>
          </button>

          {aperte.length > 0 && (
            <button
              onClick={handleScaricaTuttoIcs}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shadow-xs transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Esporta Tutte in Calendario (.ICS)</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={filtroOrizzonte}
            onChange={(e) => setFiltroOrizzonte(e.target.value)}
            className="p-1.5 bg-white border border-stone-300 rounded-lg"
          >
            <option value="Tutte">Tutte le scadenze</option>
            <option value="Scadute + prossimi 7 giorni">Scadute + prossimi 7 gg</option>
            <option value="Solo scadute">Solo scadute</option>
          </select>
        </div>
      </div>

      {/* Form Nuovo Promemoria */}
      {mostraForm && (
        <form onSubmit={handleCreate} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">➕ Inserisci Nuova Scadenza / Promemoria</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Cosa Scade? *</label>
              <input
                type="text"
                placeholder="es. Revisione caldaia / Taratura manometri / Rinnovo UTF"
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
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="Manutenzione">Manutenzione</option>
                <option value="Licenze & Certificazioni">Licenze & Certificazioni</option>
                <option value="Accise & Dogane">Accise & Dogane</option>
                <option value="Ordinazioni & Fornitori">Ordinazioni & Fornitori</option>
                <option value="Fisco & Tributi">Fisco & Tributi</option>
                <option value="Altro">Altro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Scadenza *</label>
              <input
                type="date"
                value={dataScadenza}
                onChange={(e) => setDataScadenza(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-amber-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Importo Previsto (€, facoltativo)</label>
              <input
                type="number"
                step="5"
                value={importo}
                onChange={(e) => setImporto(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Si Ripete?</label>
              <select
                value={ricorrenza}
                onChange={(e) => setRicorrenza(e.target.value as any)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="Nessuna">Nessuna (Scadenza singola)</option>
                <option value="Mensile">Mensile</option>
                <option value="Trimestrale">Trimestrale</option>
                <option value="Semestrale">Semestrale</option>
                <option value="Annuale">Annuale</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Note Operative</label>
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                placeholder="Riferimenti tecnici o documentali"
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
              Salva Scadenza
            </button>
          </div>
        </form>
      )}

      {/* Tabella Scadenze Unificate */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <h3 className="font-bold text-stone-900 text-sm">⏰ Scadenze & Adempimenti Attivi</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2.5 font-bold">Stato</th>
                <th className="p-2.5 font-bold">Scadenza</th>
                <th className="p-2.5 font-bold">Oggetto / Attività</th>
                <th className="p-2.5 font-bold">Categoria</th>
                <th className="p-2.5 font-bold">Origine</th>
                <th className="p-2.5 font-bold text-right">Importo (€)</th>
                <th className="p-2.5 font-bold text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtrate.map((u) => {
                const urg = getUrgenza(u.data);
                const gCalUrl = getGoogleCalendarUrl(u.titolo, u.data, u.note || '');

                return (
                  <tr key={`${u.tipo}-${u.id}`} className="hover:bg-amber-50/20">
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${urg.badge}`}>
                        {urg.emoji} {urg.codice}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-stone-900">{u.data}</td>
                    <td className="p-2.5 font-medium text-stone-900">
                      <div>{u.titolo}</div>
                      {u.note && <div className="text-[11px] text-stone-500 italic">{u.note}</div>}
                    </td>
                    <td className="p-2.5 text-stone-600">{u.categoria}</td>
                    <td className="p-2.5 text-stone-500 text-[11px]">
                      {u.tipo === 'manuale' ? '✍️ Manuale' : u.tipo === 'bolletta' ? '💡 Bolletta' : '📌 Nota Rapida'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {u.importo ? `€ ${u.importo.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {u.tipo === 'manuale' && u.stato === 'APERTA' && (
                          <button
                            onClick={() => onCompletaPromemoria(u.id)}
                            className="p-1 rounded text-emerald-700 hover:bg-emerald-50 transition"
                            title="Segna come completata"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <a
                          href={gCalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded text-stone-400 hover:text-amber-700"
                          title="Aggiungi a Google Calendar"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </a>
                        {u.tipo === 'manuale' && (
                          <button
                            onClick={() => onDeletePromemoria(u.id)}
                            className="p-1 rounded text-stone-400 hover:text-rose-600"
                            title="Elimina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
