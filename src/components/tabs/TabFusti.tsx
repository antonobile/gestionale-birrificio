import React, { useState } from 'react';
import { TracciamentoFusti } from '../../types';
import { Truck, RotateCcw, Building2, PackageCheck } from 'lucide-react';

interface TabFustiProps {
  fusti: TracciamentoFusti[];
  onAddMovimentoFusti: (mov: Omit<TracciamentoFusti, 'id'>) => void;
}

export const TabFusti: React.FC<TabFustiProps> = ({ fusti, onAddMovimentoFusti }) => {
  // Form Consegna
  const [dataConsegna, setDataConsegna] = useState(new Date().toISOString().slice(0, 10));
  const [pubNome, setPubNome] = useState('Birroteca Centrale');
  const [formatoFusto, setFormatoFusto] = useState('Fusto 24L');
  const [qtaConsegna, setQtaConsegna] = useState(2);
  const [lottoBirra, setLottoBirra] = useState('LOTTO-2601');
  const [cauzioneUnit, setCauzioneUnit] = useState(30.0);
  const [ddtRif, setDdtRif] = useState('DDT 12/2026');

  // Form Rientro
  const [dataRientro, setDataRientro] = useState(new Date().toISOString().slice(0, 10));
  const [pubRientro, setPubRientro] = useState('Birroteca Centrale');
  const [formatoRientro, setFormatoRientro] = useState('Fusto 24L');
  const [qtaRientro, setQtaRientro] = useState(1);
  const [noteRientro, setNoteRientro] = useState('Ritiro furgone birrificio');

  // Calcolo bilancio fusti per Pub
  const pubStats: { [pub: string]: { fuori: number; cauzione: number; ultimoMov: string } } = {};
  for (const m of fusti) {
    if (!pubStats[m.cliente_pub]) {
      pubStats[m.cliente_pub] = { fuori: 0, cauzione: 0, ultimoMov: m.data };
    }
    const s = pubStats[m.cliente_pub];
    if (m.tipo_movimento === 'USCITA_PUB') {
      s.fuori += m.quantita;
      s.cauzione += m.quantita * m.valore_cauzione_unitario;
    } else {
      s.fuori -= m.quantita;
      s.cauzione -= m.quantita * m.valore_cauzione_unitario;
    }
    if (new Date(m.data) > new Date(s.ultimoMov)) {
      s.ultimoMov = m.data;
    }
  }

  const pubAttivi = Object.entries(pubStats).filter(([_, s]) => s.fuori > 0);

  const handleConsegna = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubNome.trim() || qtaConsegna <= 0) return;
    onAddMovimentoFusti({
      tipo_movimento: 'USCITA_PUB',
      data: dataConsegna,
      cliente_pub: pubNome.trim(),
      formato_fusto: formatoFusto,
      quantita: qtaConsegna,
      lotto_birra: lottoBirra,
      valore_cauzione_unitario: cauzioneUnit,
      ddt_riferimento: ddtRif,
    });
    setQtaConsegna(1);
  };

  const handleRientro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubRientro.trim() || qtaRientro <= 0) return;
    onAddMovimentoFusti({
      tipo_movimento: 'RIENTRO_VUOTO',
      data: dataRientro,
      cliente_pub: pubRientro.trim(),
      formato_fusto: formatoRientro,
      quantita: qtaRientro,
      valore_cauzione_unitario: cauzioneUnit,
      note: noteRientro,
    });
    setQtaRientro(1);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Consegna Fusti */}
        <form onSubmit={handleConsegna} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
            <Truck className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-sm">🚚 Registra Consegna Fusti al Pub</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Consegna *</label>
              <input
                type="date"
                value={dataConsegna}
                onChange={(e) => setDataConsegna(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Nome Pub / Locale *</label>
              <input
                type="text"
                value={pubNome}
                onChange={(e) => setPubNome(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                placeholder="es. Birroteca Centrale"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Formato Fusto</label>
              <select
                value={formatoFusto}
                onChange={(e) => setFormatoFusto(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-semibold"
              >
                <option value="Fusto 20L">Fusto 20L</option>
                <option value="Fusto 24L">Fusto 24L</option>
                <option value="Fusto 25L">Fusto 25L</option>
                <option value="Fusto 30L">Fusto 30L</option>
                <option value="Fusto 12L">Fusto 12L</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Quantità (pz) *</label>
              <input
                type="number"
                min="1"
                value={qtaConsegna}
                onChange={(e) => setQtaConsegna(parseInt(e.target.value) || 1)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Cauzione (€/pz)</label>
              <input
                type="number"
                step="5"
                value={cauzioneUnit}
                onChange={(e) => setCauzioneUnit(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Lotto Birra</label>
              <input
                type="text"
                value={lottoBirra}
                onChange={(e) => setLottoBirra(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">N° DDT / Bolla Accompagnamento</label>
              <input
                type="text"
                value={ddtRif}
                onChange={(e) => setDdtRif(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold p-2.5 rounded-lg text-xs transition"
          >
            Registra Consegna al Locale
          </button>
        </form>

        {/* Form Rientro Fusti */}
        <form onSubmit={handleRientro} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-stone-900 text-sm">🔄 Registra Rientro Fusti Vuoti dal Pub</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Rientro *</label>
              <input
                type="date"
                value={dataRientro}
                onChange={(e) => setDataRientro(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Pub che Restituisce i Vuoti *</label>
              {pubAttivi.length > 0 ? (
                <select
                  value={pubRientro}
                  onChange={(e) => setPubRientro(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                >
                  {pubAttivi.map(([p, s]) => (
                    <option key={p} value={p}>
                      {p} ({s.fuori} fusti fuori)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={pubRientro}
                  onChange={(e) => setPubRientro(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                  placeholder="Nome Pub"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Formato Fusto Rientrato</label>
              <select
                value={formatoRientro}
                onChange={(e) => setFormatoRientro(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              >
                <option value="Fusto 20L">Fusto 20L</option>
                <option value="Fusto 24L">Fusto 24L</option>
                <option value="Fusto 25L">Fusto 25L</option>
                <option value="Fusto 30L">Fusto 30L</option>
                <option value="Fusto 12L">Fusto 12L</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Numero Fusti Vuoti (pz)</label>
              <input
                type="number"
                min="1"
                value={qtaRientro}
                onChange={(e) => setQtaRientro(parseInt(e.target.value) || 1)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Note Ritiro / Mezzo</label>
            <input
              type="text"
              value={noteRientro}
              onChange={(e) => setNoteRientro(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              placeholder="es. Ritiro furgone aziendale"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold p-2.5 rounded-lg text-xs transition"
          >
            Scarica Fusti dal Pub e Carica Imballaggi
          </button>
        </form>
      </div>

      {/* Bilancio Fusti per Pub */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-sm">📊 Bilancio Situazione Fusti Fuori per Singolo Pub</h3>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            Totale fusti in circolazione: {pubAttivi.reduce((acc, [_, s]) => acc + s.fuori, 0)} fusti
          </span>
        </div>

        {pubAttivi.length === 0 ? (
          <div className="text-xs text-stone-400 italic py-4 text-center bg-stone-50 rounded-xl">
            Tutti i fusti sono rientrati in magazzino. Nessun debito di cauzione aperto con i locali.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                  <th className="p-2.5 font-bold">Locale / Pub</th>
                  <th className="p-2.5 font-bold text-right">Fusti Fuori (pz)</th>
                  <th className="p-2.5 font-bold text-right">Valore Cauzioni Trattenute (€)</th>
                  <th className="p-2.5 font-bold text-right">Ultimo Movimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pubAttivi.map(([pub, s]) => (
                  <tr key={pub} className="hover:bg-amber-50/30">
                    <td className="p-2.5 font-bold text-stone-900">{pub}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-800">{s.fuori} fusti</td>
                    <td className="p-2.5 text-right font-mono font-bold text-stone-800">€ {s.cauzione.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono text-stone-500">{s.ultimoMov}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Storico Movimenti */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <h3 className="font-bold text-stone-900 text-sm">📋 Storico Movimentazioni Fusti</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">Tipo Movimento</th>
                <th className="p-2 font-bold">Locale / Pub</th>
                <th className="p-2 font-bold">Formato</th>
                <th className="p-2 font-bold text-right">Quantità</th>
                <th className="p-2 font-bold">Lotto</th>
                <th className="p-2 font-bold text-right">Cauzione (€)</th>
                <th className="p-2 font-bold">Riferimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {fusti.map((m) => (
                <tr key={m.id}>
                  <td className="p-2 font-mono text-stone-500">{m.data}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.tipo_movimento === 'USCITA_PUB'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {m.tipo_movimento === 'USCITA_PUB' ? 'USCITA AL PUB' : 'RIENTRO VUOTO'}
                    </span>
                  </td>
                  <td className="p-2 font-medium text-stone-800">{m.cliente_pub}</td>
                  <td className="p-2 text-stone-600">{m.formato_fusto}</td>
                  <td className="p-2 text-right font-mono font-bold">{m.quantita}</td>
                  <td className="p-2 font-mono text-stone-500">{m.lotto_birra || '-'}</td>
                  <td className="p-2 text-right font-mono">€ {(m.quantita * m.valore_cauzione_unitario).toFixed(2)}</td>
                  <td className="p-2 text-stone-500 text-[11px]">{m.ddt_riferimento || m.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
