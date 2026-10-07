import React, { useState } from 'react';
import { MateriaPrima } from '../../types';
import { parseXmlAcquisti } from '../../utils/xmlParser';
import { Upload, Plus, Wheat, Flower2, FlaskConical, FileText } from 'lucide-react';

interface TabAcquistiProps {
  materiePrime: MateriaPrima[];
  onAddCarico: (carico: Omit<MateriaPrima, 'id'>) => void;
}

export const TabAcquisti: React.FC<TabAcquistiProps> = ({ materiePrime, onAddCarico }) => {
  const [sezione, setSezione] = useState<'manuale' | 'xml'>('manuale');

  // Manual Form
  const [dataCarico, setDataCarico] = useState(new Date().toISOString().slice(0, 10));
  const [fornitore, setFornitore] = useState('Weyermann Malz Gmbh');
  const [riferimento, setRiferimento] = useState('Fatt. 550/2026');
  const [maltoKg, setMaltoKg] = useState(500.0);
  const [costoMalto, setCostoMalto] = useState(1.35);
  const [luppoloKg, setLuppoloKg] = useState(20.0);
  const [costoLuppolo, setCostoLuppolo] = useState(28.5);
  const [lievitoKg, setLievitoKg] = useState(3.0);
  const [costoLievito, setCostoLievito] = useState(65.0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        try {
          const parsed = parseXmlAcquisti(text);
          onAddCarico({
            tipo: 'CARICO',
            data: parsed.data,
            riferimento: `Fatt. ${parsed.numero_fattura}`,
            azienda: parsed.fornitore,
            malto_kg: parsed.malto_kg,
            luppolo_kg: parsed.luppolo_kg,
            lievito_kg: parsed.lievito_kg,
            costo_malto_kg: parsed.costo_malto_kg,
            costo_luppolo_kg: parsed.costo_luppolo_kg,
            costo_lievito_kg: parsed.costo_lievito_kg,
            costo_kg_medio: parsed.costo_malto_kg,
          });
        } catch (err) {
          console.error('Error parsing XML acquisti:', err);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSubmitManuale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornitore.trim()) return;

    onAddCarico({
      tipo: 'CARICO',
      data: dataCarico,
      riferimento,
      azienda: fornitore.trim(),
      malto_kg: maltoKg,
      luppolo_kg: luppoloKg,
      lievito_kg: lievitoKg,
      costo_malto_kg: costoMalto,
      costo_luppolo_kg: costoLuppolo,
      costo_lievito_kg: costoLievito,
      costo_kg_medio: costoMalto,
    });

    setRiferimento('');
    setMaltoKg(0);
    setLuppoloKg(0);
    setLievitoKg(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setSezione('manuale')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            sezione === 'manuale'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Carico Manuale Materie Prime</span>
        </button>

        <button
          onClick={() => setSezione('xml')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            sezione === 'xml'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Carico da Fattura XML Fornitore</span>
        </button>
      </div>

      {sezione === 'manuale' ? (
        <form onSubmit={handleSubmitManuale} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">🌾 Registrazione Entrata Merci (Malti, Luppoli, Lieviti)</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Arrivo Merce *</label>
              <input
                type="date"
                value={dataCarico}
                onChange={(e) => setDataCarico(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Fornitore / Malteria *</label>
              <input
                type="text"
                value={fornitore}
                onChange={(e) => setFornitore(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                placeholder="es. Weyermann Malz Gmbh"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Riferimento Fattura / DDT</label>
              <input
                type="text"
                value={riferimento}
                onChange={(e) => setRiferimento(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                placeholder="es. Fatt. 120/2026"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                <Wheat className="w-4 h-4 text-amber-700" />
                <span>Malto d&apos;orzo & Fermentabili</span>
              </span>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Quantità Caricata (kg)</label>
                  <input
                    type="number"
                    step="5"
                    value={maltoKg}
                    onChange={(e) => setMaltoKg(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Costo Unitario (€/kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={costoMalto}
                    onChange={(e) => setCostoMalto(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                <Flower2 className="w-4 h-4 text-emerald-700" />
                <span>Luppoli Pellet / Coni</span>
              </span>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Quantità Caricata (kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={luppoloKg}
                    onChange={(e) => setLuppoloKg(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Costo Unitario (€/kg)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={costoLuppolo}
                    onChange={(e) => setCostoLuppolo(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-200">
              <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5 mb-2">
                <FlaskConical className="w-4 h-4 text-indigo-700" />
                <span>Lieviti Secchi / Liquidi</span>
              </span>
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Quantità Caricata (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={lievitoKg}
                    onChange={(e) => setLievitoKg(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-0.5">Costo Unitario (€/kg)</label>
                  <input
                    type="number"
                    step="1"
                    value={costoLievito}
                    onChange={(e) => setCostoLievito(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs text-xs"
            >
              Registra Carico Materie Prime
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-300 text-center space-y-4">
          <Upload className="w-10 h-10 text-amber-600 mx-auto" />
          <div>
            <h3 className="font-bold text-stone-900 text-base">Carica Fattura Fornitore (.XML)</h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
              Il parser scansiona automaticamente le righe della fattura elettronica italiana, estraendo kg di malto, luppoli e lieviti con i relativi costi al kg.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer shadow-sm transition">
            <span>Seleziona File XML</span>
            <input type="file" accept=".xml" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {/* Tabella Storico Movimentazioni */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <h3 className="font-bold text-stone-900 text-sm">📋 Storico Movimentazioni Materie Prime</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2.5 font-bold">Data</th>
                <th className="p-2.5 font-bold">Tipo</th>
                <th className="p-2.5 font-bold">Riferimento</th>
                <th className="p-2.5 font-bold">Fornitore / Destinazione</th>
                <th className="p-2.5 font-bold text-right">Malto (kg)</th>
                <th className="p-2.5 font-bold text-right">Luppolo (kg)</th>
                <th className="p-2.5 font-bold text-right">Lievito (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {materiePrime.map((m) => (
                <tr key={m.id} className="hover:bg-amber-50/20">
                  <td className="p-2.5 font-mono text-stone-600">{m.data}</td>
                  <td className="p-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.tipo === 'CARICO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {m.tipo}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-stone-500">{m.riferimento}</td>
                  <td className="p-2.5 font-medium text-stone-800">{m.azienda}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-stone-900">{m.malto_kg.toFixed(1)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-stone-900">{m.luppolo_kg.toFixed(2)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-stone-900">{m.lievito_kg.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
