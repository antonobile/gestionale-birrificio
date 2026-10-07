import React, { useState } from 'react';
import { FatturaUtenza } from '../../types';
import { parseXmlUtenza } from '../../utils/xmlParser';
import { generateIcs, downloadIcsFile } from '../../utils/calendar';
import { Zap, Upload, CheckCircle, Calendar, AlertCircle } from 'lucide-react';

interface TabBolletteProps {
  bollette: FatturaUtenza[];
  onAddBolletta: (bolletta: Omit<FatturaUtenza, 'id'>) => void;
  onUpdateStatoBolletta: (id: number, nuovoStato: 'DA PAGARE' | 'PAGATA') => void;
}

export const TabBollette: React.FC<TabBolletteProps> = ({
  bollette,
  onAddBolletta,
  onUpdateStatoBolletta,
}) => {
  const [sezione, setSezione] = useState<'nuova' | 'storico'>('storico');

  // Form State
  const [tipoUtenza, setTipoUtenza] = useState('Energia Elettrica (Bolletta)');
  const [fornitore, setFornitore] = useState('');
  const [pivaFornitore, setPivaFornitore] = useState('');
  const [numeroFattura, setNumeroFattura] = useState('');
  const [dataFattura, setDataFattura] = useState(new Date().toISOString().slice(0, 10));
  const [dataScadenza, setDataScadenza] = useState(new Date().toISOString().slice(0, 10));
  const [imponibile, setImponibile] = useState(0);
  const [iva, setIva] = useState(0);
  const [totale, setTotale] = useState(0);
  const [consumo, setConsumo] = useState(0);
  const [unitaMisura, setUnitaMisura] = useState('kWh');
  const [podPdr, setPodPdr] = useState('');
  const [statoPagamento, setStatoPagamento] = useState<'DA PAGARE' | 'PAGATA'>('DA PAGARE');
  const [note, setNote] = useState('');

  // Filtri Storico
  const [filtroTipo, setFiltroTipo] = useState('Tutte');
  const [filtroStato, setFiltroStato] = useState('Tutti');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const parsed = parseXmlUtenza(text);
          setTipoUtenza(parsed.tipo_utenza);
          setFornitore(parsed.fornitore);
          setPivaFornitore(parsed.piva_fornitore);
          setNumeroFattura(parsed.numero_fattura);
          setDataFattura(parsed.data_fattura);
          setDataScadenza(parsed.data_scadenza);
          setImponibile(parsed.imponibile);
          setIva(parsed.iva);
          setTotale(parsed.totale_fattura);
          setConsumo(parsed.consumo);
          setUnitaMisura(parsed.unita_misura);
          setPodPdr(parsed.pod_pdr);
          setSezione('nuova');
        } catch (err) {
          console.error('Error parsing XML utenza:', err);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornitore.trim() && !numeroFattura.trim()) return;

    onAddBolletta({
      tipo_utenza: tipoUtenza,
      fornitore: fornitore.trim(),
      piva_fornitore: pivaFornitore.trim(),
      numero_fattura: numeroFattura.trim(),
      data_fattura: dataFattura,
      data_scadenza: dataScadenza,
      imponibile,
      iva,
      totale_fattura: totale || imponibile + iva,
      consumo,
      unita_misura: unitaMisura,
      pod_pdr: podPdr.trim(),
      stato_pagamento: statoPagamento,
      data_pagamento: statoPagamento === 'PAGATA' ? new Date().toISOString().slice(0, 10) : undefined,
      note: note.trim(),
    });

    setFornitore('');
    setNumeroFattura('');
    setImponibile(0);
    setTotale(0);
    setConsumo(0);
    setSezione('storico');
  };

  const getStatoScadenza = (b: FatturaUtenza) => {
    if (b.stato_pagamento === 'PAGATA') return { label: 'PAGATA', color: 'bg-emerald-100 text-emerald-800' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(b.data_scadenza);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'SCADUTA', color: 'bg-rose-100 text-rose-800 font-bold' };
    if (diffDays <= 3) return { label: 'IN SCADENZA', color: 'bg-amber-100 text-amber-800 font-bold' };
    return { label: 'DA PAGARE', color: 'bg-stone-100 text-stone-700' };
  };

  const handleScaricaIcs = (b: FatturaUtenza) => {
    const icsContent = generateIcs([
      {
        uid: `brewdesk-bolletta-${b.id}@brewdesk`,
        title: `Scadenza Bolletta ${b.tipo_utenza} - ${b.fornitore}`,
        start: b.data_scadenza,
        description: `Fattura N. ${b.numero_fattura || '-'} | Importo: € ${b.totale_fattura.toFixed(2)} | BrewDesk`,
      },
    ]);
    downloadIcsFile(`scadenza_bolletta_${b.id}.ics`, icsContent);
  };

  // Metriche
  const totImporti = bollette.reduce((acc, b) => acc + b.totale_fattura, 0);
  const totDaPagare = bollette.filter((b) => b.stato_pagamento !== 'PAGATA').reduce((acc, b) => acc + b.totale_fattura, 0);
  const numScadute = bollette.filter((b) => getStatoScadenza(b).label === 'SCADUTA').length;
  const numInScadenza = bollette.filter((b) => getStatoScadenza(b).label === 'IN SCADENZA').length;

  const bolletteFiltrate = bollette.filter((b) => {
    if (filtroTipo !== 'Tutte' && b.tipo_utenza !== filtroTipo) return false;
    if (filtroStato !== 'Tutti' && getStatoScadenza(b).label !== filtroStato) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-stone-500 uppercase">Totale Registrato</span>
          <div className="text-xl font-bold font-mono text-stone-900 mt-1">€ {totImporti.toFixed(2)}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30">
          <span className="text-[11px] font-semibold text-amber-800 uppercase">Importi Da Pagare</span>
          <div className="text-xl font-bold font-mono text-amber-900 mt-1">€ {totDaPagare.toFixed(2)}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-rose-600 uppercase">Bollette Scadute</span>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">{numScadute}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-stone-200">
          <span className="text-[11px] font-semibold text-amber-600 uppercase">In Scadenza (≤ 3 gg)</span>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">{numInScadenza}</div>
        </div>
      </div>

      {/* Navigation & XML Upload */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSezione('storico')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              sezione === 'storico' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            📋 Storico Bollette ({bollette.length})
          </button>
          <button
            onClick={() => setSezione('nuova')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              sezione === 'nuova' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            ➕ Nuova Bolletta Manuale
          </button>
        </div>

        {/* Quick XML Upload */}
        <label className="flex items-center gap-2 bg-stone-800 hover:bg-stone-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition">
          <Upload className="w-3.5 h-3.5" />
          <span>Carica Fattura Elettronica XML</span>
          <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
        </label>
      </div>

      {/* SEZIONE NUOVA BOLLETTA */}
      {sezione === 'nuova' && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600" />
            <span>Inserimento Dettagli Bolletta / Utenza</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Tipo Utenza / Costo</label>
              <select
                value={tipoUtenza}
                onChange={(e) => setTipoUtenza(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="Energia Elettrica (Bolletta)">Energia Elettrica (Bolletta)</option>
                <option value="Gas Metano di Rete">Gas Metano di Rete</option>
                <option value="GPL Carico Serbatoio Fisso">GPL Carico Serbatoio Fisso</option>
                <option value="Acqua & Fognatura">Acqua & Fognatura</option>
                <option value="Affitto / Canone Capannone">Affitto / Canone Capannone</option>
                <option value="Consulenze / Laboratorio / HACCP">Consulenze / Laboratorio / HACCP</option>
                <option value="Altro Costo Fisso">Altro Costo Fisso</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Fornitore / Ente *</label>
              <input
                type="text"
                value={fornitore}
                onChange={(e) => setFornitore(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                placeholder="es. Enel Energia SpA"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">N° Fattura</label>
              <input
                type="text"
                value={numeroFattura}
                onChange={(e) => setNumeroFattura(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                placeholder="es. 0049281938"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Fattura</label>
              <input
                type="date"
                value={dataFattura}
                onChange={(e) => setDataFattura(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Scadenza Pagamento *</label>
              <input
                type="date"
                value={dataScadenza}
                onChange={(e) => setDataScadenza(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-amber-900"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Totale Fattura (€) *</label>
              <input
                type="number"
                step="0.01"
                value={totale}
                onChange={(e) => setTotale(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Stato Pagamento</label>
              <select
                value={statoPagamento}
                onChange={(e) => setStatoPagamento(e.target.value as 'DA PAGARE' | 'PAGATA')}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
              >
                <option value="DA PAGARE">DA PAGARE</option>
                <option value="PAGATA">PAGATA</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Consumo Rilevato</label>
              <input
                type="number"
                step="1"
                value={consumo}
                onChange={(e) => setConsumo(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Unità di Misura</label>
              <input
                type="text"
                value={unitaMisura}
                onChange={(e) => setUnitaMisura(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">POD / PDR Contatore</label>
              <input
                type="text"
                value={podPdr}
                onChange={(e) => setPodPdr(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSezione('storico')}
              className="text-xs px-3 py-2 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm"
            >
              Salva Bolletta
            </button>
          </div>
        </form>
      )}

      {/* SEZIONE STORICO BOLLETTE */}
      {sezione === 'storico' && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-stone-900 text-sm">📋 Elenco Bollette & Scadenze Pagamento</h3>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="p-1.5 bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="Tutte">Tutte le utenze</option>
                <option value="Energia Elettrica (Bolletta)">Energia Elettrica</option>
                <option value="Gas Metano di Rete">Gas Metano</option>
                <option value="Acqua & Fognatura">Acqua</option>
                <option value="Altro Costo Fisso">Altro</option>
              </select>

              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value)}
                className="p-1.5 bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="Tutti">Tutti gli stati</option>
                <option value="DA PAGARE">DA PAGARE</option>
                <option value="IN SCADENZA">IN SCADENZA</option>
                <option value="SCADUTA">SCADUTA</option>
                <option value="PAGATA">PAGATA</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                  <th className="p-2.5 font-bold">Utenza</th>
                  <th className="p-2.5 font-bold">Fornitore</th>
                  <th className="p-2.5 font-bold">Fattura</th>
                  <th className="p-2.5 font-bold">Data Scadenza</th>
                  <th className="p-2.5 font-bold text-right">Consumo</th>
                  <th className="p-2.5 font-bold text-right">Totale (€)</th>
                  <th className="p-2.5 font-bold text-center">Stato</th>
                  <th className="p-2.5 font-bold text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {bolletteFiltrate.map((b) => {
                  const st = getStatoScadenza(b);
                  return (
                    <tr key={b.id} className="hover:bg-amber-50/30">
                      <td className="p-2.5 font-medium text-stone-800">{b.tipo_utenza}</td>
                      <td className="p-2.5 text-stone-900 font-bold">{b.fornitore}</td>
                      <td className="p-2.5 font-mono text-stone-500">{b.numero_fattura || '-'}</td>
                      <td className="p-2.5 font-mono text-stone-800 font-bold">{b.data_scadenza}</td>
                      <td className="p-2.5 text-right font-mono">
                        {b.consumo > 0 ? `${b.consumo} ${b.unita_misura}` : '-'}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-stone-900">
                        € {b.totale_fattura.toFixed(2)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() =>
                              onUpdateStatoBolletta(b.id, b.stato_pagamento === 'PAGATA' ? 'DA PAGARE' : 'PAGATA')
                            }
                            className={`p-1 rounded text-xs transition ${
                              b.stato_pagamento === 'PAGATA'
                                ? 'text-stone-400 hover:text-amber-700'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={b.stato_pagamento === 'PAGATA' ? 'Riapri come da pagare' : 'Segna come pagata'}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleScaricaIcs(b)}
                            className="p-1 rounded text-stone-400 hover:text-amber-700"
                            title="Scarica .ics promemoria scadenza"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
