import React, { useState } from 'react';
import { Imballaggio } from '../../types';
import { Package, Plus } from 'lucide-react';

interface TabImballaggiProps {
  imballaggi: Imballaggio[];
  onAddImballaggio: (imb: Omit<Imballaggio, 'id'>) => void;
}

const ARTICOLI_DISPONIBILI = [
  'Bottiglie 0.33L vuote',
  'Bottiglie 0.75L vuote',
  'Tappi a corona',
  'Etichette',
  'Scatole / Cartoni',
  'Fusti vuoti 12L',
  'Fusti vuoti 20L',
  'Fusti vuoti 24L',
  'Fusti vuoti 25L',
  'Fusti vuoti 30L',
];

export const TabImballaggi: React.FC<TabImballaggiProps> = ({ imballaggi, onAddImballaggio }) => {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [articolo, setArticolo] = useState(ARTICOLI_DISPONIBILI[0]);
  const [quantita, setQuantita] = useState(1000);
  const [costoUnitario, setCostoUnitario] = useState(0.22);
  const [riferimento, setRiferimento] = useState('Fatt. Fornitore');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantita <= 0) return;

    onAddImballaggio({
      tipo_movimento: 'CARICO',
      data,
      riferimento,
      articolo,
      quantita,
      costo_unitario: costoUnitario,
    });

    setRiferimento('');
    setQuantita(500);
  };

  // Calcolo giacenze aggregate
  const giacenzeMap: { [art: string]: { qta: number; costo: number } } = {};
  for (const m of imballaggi) {
    if (!giacenzeMap[m.articolo]) {
      giacenzeMap[m.articolo] = { qta: 0, costo: m.costo_unitario };
    }
    if (m.tipo_movimento === 'CARICO') {
      giacenzeMap[m.articolo].qta += m.quantita;
    } else {
      giacenzeMap[m.articolo].qta -= m.quantita;
    }
    giacenzeMap[m.articolo].costo = Math.max(giacenzeMap[m.articolo].costo, m.costo_unitario);
  }

  const totaleValoreImballaggi = Object.values(giacenzeMap).reduce(
    (acc, val) => acc + Math.max(0, val.qta) * val.costo,
    0
  );

  return (
    <div className="space-y-6">
      {/* Form Carico Imballaggi */}
      <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-600" />
          <span>Carico Materiale di Imballaggio & Confezionamento</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Data Acquisto *</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Tipo Articolo *</label>
            <select
              value={articolo}
              onChange={(e) => {
                const a = e.target.value;
                setArticolo(a);
                if (a.includes('0.33')) setCostoUnitario(0.22);
                else if (a.includes('0.75')) setCostoUnitario(0.45);
                else if (a.includes('Tappi')) setCostoUnitario(0.02);
                else if (a.includes('Fusti')) setCostoUnitario(14.0);
              }}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
            >
              {ARTICOLI_DISPONIBILI.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Quantità (pz) *</label>
            <input
              type="number"
              min="1"
              value={quantita}
              onChange={(e) => setQuantita(parseInt(e.target.value) || 1)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Costo Unitario (€/pz)</label>
            <input
              type="number"
              step="0.01"
              value={costoUnitario}
              onChange={(e) => setCostoUnitario(parseFloat(e.target.value) || 0)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Riferimento Fornitore</label>
            <input
              type="text"
              value={riferimento}
              onChange={(e) => setRiferimento(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              placeholder="es. Vetri d'Italia"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm"
          >
            Carica Imballaggi
          </button>
        </div>
      </form>

      {/* Tabella Giacenze Imballaggi */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm">🏷️ Giacenze e Consistenze Magazzino Imballaggi</h3>
          <span className="text-xs font-bold text-stone-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
            Valore Fiscale Totale: € {totaleValoreImballaggi.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2.5 font-bold">Articolo Imballaggio</th>
                <th className="p-2.5 font-bold text-right">Giacenza (Pezzi)</th>
                <th className="p-2.5 font-bold text-right">Costo Acquisto Unitario (€)</th>
                <th className="p-2.5 font-bold text-right">Totale Valore (€)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Object.entries(giacenzeMap).map(([art, info]) => {
                const valTot = Math.max(0, info.qta) * info.costo;
                return (
                  <tr key={art} className="hover:bg-amber-50/20">
                    <td className="p-2.5 font-bold text-stone-900">{art}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-900">{info.qta.toLocaleString('it-IT')} pz</td>
                    <td className="p-2.5 text-right font-mono text-stone-600">€ {info.costo.toFixed(3)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-stone-900">€ {valTot.toFixed(2)}</td>
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
