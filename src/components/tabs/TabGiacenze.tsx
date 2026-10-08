import React, { useState } from 'react';
import { BirraCondizionata, MateriaPrima } from '../../types';
import {
  Warehouse,
  Wheat,
  Flower2,
  FlaskConical,
  Trash2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
} from 'lucide-react';

interface TabGiacenzeProps {
  movimenti: BirraCondizionata[];
  onDeleteMovimento: (id: number) => void;
  materiePrime: MateriaPrima[];
  onAddMovimentoMp?: (m: Omit<MateriaPrima, 'id'>) => void;
  onDeleteMovimentoMp?: (id: number) => void;
}

export const TabGiacenze: React.FC<TabGiacenzeProps> = ({
  movimenti,
  onDeleteMovimento,
  materiePrime,
  onAddMovimentoMp,
  onDeleteMovimentoMp,
}) => {
  // Quick form state for raw material adjustments
  const [showFormMp, setShowFormMp] = useState(false);
  const [tipoMovMp, setTipoMovMp] = useState<'CARICO' | 'SCARICO'>('CARICO');
  const [dataMovMp, setDataMovMp] = useState(new Date().toISOString().slice(0, 10));
  const [rifMovMp, setRifMovMp] = useState('Rettifica Magazzino');
  const [aziendaMovMp, setAziendaMovMp] = useState('Inventario Fisico');
  const [maltoKgInput, setMaltoKgInput] = useState(0);
  const [luppoloKgInput, setLuppoloKgInput] = useState(0);
  const [lievitoKgInput, setLievitoKgInput] = useState(0);

  // Calcolo giacenze materie prime in tempo reale
  let totCaricoMalto = 0;
  let totScaricoMalto = 0;
  let totCaricoLuppolo = 0;
  let totScaricoLuppolo = 0;
  let totCaricoLievito = 0;
  let totScaricoLievito = 0;

  for (const m of materiePrime) {
    if (m.tipo === 'CARICO') {
      totCaricoMalto += m.malto_kg;
      totCaricoLuppolo += m.luppolo_kg;
      totCaricoLievito += m.lievito_kg;
    } else {
      totScaricoMalto += m.malto_kg;
      totScaricoLuppolo += m.luppolo_kg;
      totScaricoLievito += m.lievito_kg;
    }
  }

  const maltoGiacenza = Math.max(0, totCaricoMalto - totScaricoMalto);
  const luppoloGiacenza = Math.max(0, totCaricoLuppolo - totScaricoLuppolo);
  const lievitoGiacenza = Math.max(0, totCaricoLievito - totScaricoLievito);

  // Calcolo giacenze per formato birra finita
  const giacenzeBirra: { [fmt: string]: { pz: number; litri: number; platoSomma: number; count: number } } = {};

  for (const m of movimenti) {
    if (!giacenzeBirra[m.formato]) {
      giacenzeBirra[m.formato] = { pz: 0, litri: 0, platoSomma: 0, count: 0 };
    }
    const g = giacenzeBirra[m.formato];
    if (m.tipo === 'CARICO') {
      g.pz += m.quantita;
      g.litri += m.litri_totali;
      g.platoSomma += m.grado_plato * m.quantita;
      g.count += m.quantita;
    } else {
      g.pz -= m.quantita;
      g.litri -= m.litri_totali;
    }
  }

  const totLitriBirraMagazzino = Object.values(giacenzeBirra).reduce(
    (acc, v) => acc + Math.max(0, v.litri),
    0
  );

  const handleSalvaMovimentoMp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddMovimentoMp) return;
    if (maltoKgInput <= 0 && luppoloKgInput <= 0 && lievitoKgInput <= 0) return;

    onAddMovimentoMp({
      tipo: tipoMovMp,
      data: dataMovMp,
      riferimento: rifMovMp.trim() || 'Rettifica Magazzino',
      azienda: aziendaMovMp.trim() || 'Birrificio',
      malto_kg: maltoKgInput,
      luppolo_kg: luppoloKgInput,
      lievito_kg: lievitoKgInput,
      costo_malto_kg: 1.35,
      costo_luppolo_kg: 28.5,
      costo_lievito_kg: 64.0,
      costo_kg_medio: 1.35,
    });

    setMaltoKgInput(0);
    setLuppoloKgInput(0);
    setLievitoKgInput(0);
    setShowFormMp(false);
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. SEZIONE GIACENZE MATERIE PRIME CON TESTO E CARATTERI INGRANDITI        */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border-2 border-amber-300/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Wheat className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                GIACENZE MATERIE PRIME IN TEMPO REALE
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Monitoraggio dinamico continuo ad ogni carico ddt/fattura o scarico cotta registrato
              </p>
            </div>
          </div>

          {onAddMovimentoMp && (
            <button
              onClick={() => setShowFormMp(!showFormMp)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showFormMp ? 'Chiudi Modulo' : '+ Rettifica / Carico Rapido MP'}</span>
            </button>
          )}
        </div>

        {/* Form Registrazione Rapida Materia Prima */}
        {showFormMp && (
          <form
            onSubmit={handleSalvaMovimentoMp}
            className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-fade-in text-xs"
          >
            <div className="font-bold text-stone-900 flex items-center gap-1.5 text-sm">
              <Plus className="w-4 h-4 text-amber-700" />
              <span>Registra Movimento Materie Prime</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-stone-700 font-bold mb-1">Tipo Movimento</label>
                <select
                  value={tipoMovMp}
                  onChange={(e) => setTipoMovMp(e.target.value as 'CARICO' | 'SCARICO')}
                  className="w-full p-2 bg-white border border-stone-300 rounded-lg font-bold"
                >
                  <option value="CARICO">CARICO (Acquisto / Rettifica +)</option>
                  <option value="SCARICO">SCARICO (Uso Cotta / Rettifica -)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">Data</label>
                <input
                  type="date"
                  value={dataMovMp}
                  onChange={(e) => setDataMovMp(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">Riferimento / Documento</label>
                <input
                  type="text"
                  value={rifMovMp}
                  onChange={(e) => setRifMovMp(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                  placeholder="es. Fattura / Inventario 2026"
                />
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">Fornitore / Motivo</label>
                <input
                  type="text"
                  value={aziendaMovMp}
                  onChange={(e) => setAziendaMovMp(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                  placeholder="es. Weyermann / Rettifica"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-2.5 bg-white rounded-xl border border-amber-200">
                <label className="block font-black text-amber-900 mb-1">MALTO (kg)</label>
                <input
                  type="number"
                  step="0.5"
                  value={maltoKgInput}
                  onChange={(e) => setMaltoKgInput(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-stone-300 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-emerald-200">
                <label className="block font-black text-emerald-900 mb-1">LUPPOLO (kg)</label>
                <input
                  type="number"
                  step="0.05"
                  value={luppoloKgInput}
                  onChange={(e) => setLuppoloKgInput(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-stone-300 rounded-lg font-mono font-bold text-sm"
                />
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-indigo-200">
                <label className="block font-black text-indigo-900 mb-1">LIEVITO (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={lievitoKgInput}
                  onChange={(e) => setLievitoKgInput(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-stone-300 rounded-lg font-mono font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFormMp(false)}
                className="px-3.5 py-1.5 rounded-lg bg-stone-200 text-stone-700 font-bold"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs"
              >
                Registra Movimento
              </button>
            </div>
          </form>
        )}

        {/* Grandi Schede delle Tre Categorie Principali */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. MALTO */}
          <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-white rounded-2xl p-5 sm:p-6 border-2 border-amber-300 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center text-white shadow-xs">
                  <Wheat className="w-6 h-6" />
                </div>
                <span className="text-base sm:text-lg font-black tracking-wider text-amber-950 uppercase">
                  MALTO
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900">
                Giacenza Netta
              </span>
            </div>

            {/* CIFRA GIGANTE */}
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-stone-900 tracking-tight leading-none my-3">
              {maltoGiacenza.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span className="text-lg sm:text-xl font-bold text-amber-700 ml-1">kg</span>
            </div>

            {/* Dettagli Movimentazione */}
            <div className="pt-3 border-t border-amber-200/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-stone-500 block text-[11px]">Carichi Totali:</span>
                <span className="font-mono font-bold text-emerald-700">+{totCaricoMalto.toFixed(1)} kg</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Consumi / Cotte:</span>
                <span className="font-mono font-bold text-rose-700">-{totScaricoMalto.toFixed(1)} kg</span>
              </div>
            </div>
          </div>

          {/* 2. LUPPOLO */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50 to-white rounded-2xl p-5 sm:p-6 border-2 border-emerald-300 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                  <Flower2 className="w-6 h-6" />
                </div>
                <span className="text-base sm:text-lg font-black tracking-wider text-emerald-950 uppercase">
                  LUPPOLO
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">
                Giacenza Netta
              </span>
            </div>

            {/* CIFRA GIGANTE */}
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-stone-900 tracking-tight leading-none my-3">
              {luppoloGiacenza.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-lg sm:text-xl font-bold text-emerald-700 ml-1">kg</span>
            </div>

            {/* Dettagli Movimentazione */}
            <div className="pt-3 border-t border-emerald-200/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-stone-500 block text-[11px]">Carichi Totali:</span>
                <span className="font-mono font-bold text-emerald-700">+{totCaricoLuppolo.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Consumi / Cotte:</span>
                <span className="font-mono font-bold text-rose-700">-{totScaricoLuppolo.toFixed(2)} kg</span>
              </div>
            </div>
          </div>

          {/* 3. LIEVITO */}
          <div className="bg-gradient-to-br from-indigo-500/10 via-indigo-50 to-white rounded-2xl p-5 sm:p-6 border-2 border-indigo-300 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <span className="text-base sm:text-lg font-black tracking-wider text-indigo-950 uppercase">
                  LIEVITO
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-200/80 text-indigo-900">
                Giacenza Netta
              </span>
            </div>

            {/* CIFRA GIGANTE */}
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-stone-900 tracking-tight leading-none my-3">
              {lievitoGiacenza.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              <span className="text-lg sm:text-xl font-bold text-indigo-700 ml-1">kg</span>
            </div>

            {/* Dettagli Movimentazione */}
            <div className="pt-3 border-t border-indigo-200/80 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-stone-500 block text-[11px]">Carichi Totali:</span>
                <span className="font-mono font-bold text-emerald-700">+{totCaricoLievito.toFixed(3)} kg</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Consumi / Cotte:</span>
                <span className="font-mono font-bold text-rose-700">-{totScaricoLievito.toFixed(3)} kg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Registro Dettagliato Movimenti Materie Prime */}
        <div className="pt-2">
          <div className="text-xs font-bold text-stone-700 mb-2">
            Registro Movimentazioni Materie Prime (Carichi e Scarichi in tempo reale):
          </div>
          <div className="overflow-x-auto max-h-56 overflow-y-auto border border-stone-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 sticky top-0">
                <tr>
                  <th className="p-2 font-bold">Data</th>
                  <th className="p-2 font-bold">Tipo</th>
                  <th className="p-2 font-bold">Riferimento</th>
                  <th className="p-2 font-bold">Azienda / Motivo</th>
                  <th className="p-2 font-bold text-right">Malto (kg)</th>
                  <th className="p-2 font-bold text-right">Luppolo (kg)</th>
                  <th className="p-2 font-bold text-right">Lievito (kg)</th>
                  {onDeleteMovimentoMp && <th className="p-2 font-bold text-center">Azioni</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {materiePrime.map((m) => (
                  <tr key={m.id} className="hover:bg-amber-50/20">
                    <td className="p-2 font-mono text-stone-500">{m.data}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.tipo === 'CARICO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {m.tipo}
                      </span>
                    </td>
                    <td className="p-2 font-medium text-stone-800">{m.riferimento}</td>
                    <td className="p-2 text-stone-600 truncate max-w-[150px]">{m.azienda}</td>
                    <td className="p-2 text-right font-mono font-bold text-amber-900">{m.malto_kg.toFixed(1)}</td>
                    <td className="p-2 text-right font-mono font-bold text-emerald-900">{m.luppolo_kg.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-bold text-indigo-900">{m.lievito_kg.toFixed(3)}</td>
                    {onDeleteMovimentoMp && (
                      <td className="p-2 text-center">
                        <button
                          onClick={() => onDeleteMovimentoMp(m.id)}
                          className="text-stone-400 hover:text-rose-600 p-1"
                          title="Elimina movimento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SEZIONE GIACENZE MAGAZZINO PRODOTTI FINITI                              */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-sm">🏛️ Giacenze Magazzino Prodotti Finiti</h3>
          </div>
          <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
            Totale Disponibile: {totLitriBirraMagazzino.toFixed(1)} LT
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2.5 font-bold">Formato Contenitore</th>
                <th className="p-2.5 font-bold text-right">Giacenza (Pezzi)</th>
                <th className="p-2.5 font-bold text-right">Giacenza (Litri)</th>
                <th className="p-2.5 font-bold text-right">Grado Plato Medio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Object.entries(giacenzeBirra).map(([fmt, g]) => {
                const platoMedio = g.count > 0 ? g.platoSomma / g.count : 13.5;
                return (
                  <tr key={fmt} className="hover:bg-amber-50/20">
                    <td className="p-2.5 font-bold text-stone-900">{fmt}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-900">
                      {Math.max(0, g.pz)} pz
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-stone-900">
                      {Math.max(0, g.litri).toFixed(1)} LT
                    </td>
                    <td className="p-2.5 text-right font-mono text-stone-600">{platoMedio.toFixed(1)}°P</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dettaglio Movimentazioni & Lotti Prodotti Finiti */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <h4 className="font-bold text-stone-900 text-sm">🔍 Registro Movimenti Prodotti Finiti</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2 font-bold">Data</th>
                <th className="p-2 font-bold">Movimento</th>
                <th className="p-2 font-bold">Lotto</th>
                <th className="p-2 font-bold">Formato</th>
                <th className="p-2 font-bold text-right">Pz</th>
                <th className="p-2 font-bold text-right">Litri</th>
                <th className="p-2 font-bold">Riferimento</th>
                <th className="p-2 font-bold text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {movimenti.map((m) => (
                <tr key={m.id} className="hover:bg-stone-50">
                  <td className="p-2 font-mono text-stone-500">{m.data}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.tipo === 'CARICO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {m.tipo}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-stone-600">{m.lotto}</td>
                  <td className="p-2 font-medium text-stone-800">{m.formato}</td>
                  <td className="p-2 text-right font-mono font-bold">{m.quantita}</td>
                  <td className="p-2 text-right font-mono">{m.litri_totali.toFixed(1)}</td>
                  <td className="p-2 text-stone-500 text-[11px]">{m.documento_rif}</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => onDeleteMovimento(m.id)}
                      className="text-stone-400 hover:text-rose-600 p-1"
                      title="Elimina movimento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
