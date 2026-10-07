import React from 'react';
import { BirraCondizionata } from '../../types';
import { Warehouse, Trash2 } from 'lucide-react';

interface TabGiacenzeProps {
  movimenti: BirraCondizionata[];
  onDeleteMovimento: (id: number) => void;
}

export const TabGiacenze: React.FC<TabGiacenzeProps> = ({ movimenti, onDeleteMovimento }) => {
  // Calcolo giacenze per formato
  const giacenze: { [fmt: string]: { pz: number; litri: number; platoSomma: number; count: number } } = {};

  for (const m of movimenti) {
    if (!giacenze[m.formato]) {
      giacenze[m.formato] = { pz: 0, litri: 0, platoSomma: 0, count: 0 };
    }
    const g = giacenze[m.formato];
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

  const totLitriMagazzino = Object.values(giacenze).reduce((acc, v) => acc + Math.max(0, v.litri), 0);

  return (
    <div className="space-y-6">
      {/* Giacenze per Formato */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-sm">🏛️ Giacenze Magazzino Prodotti Finiti</h3>
          </div>
          <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
            Totale Disponibile: {totLitriMagazzino.toFixed(1)} LT
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
              {Object.entries(giacenze).map(([fmt, g]) => {
                const platoMedio = g.count > 0 ? g.platoSomma / g.count : 13.5;
                return (
                  <tr key={fmt} className="hover:bg-amber-50/20">
                    <td className="p-2.5 font-bold text-stone-900">{fmt}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-900">{Math.max(0, g.pz)} pz</td>
                    <td className="p-2.5 text-right font-mono font-bold text-stone-900">{Math.max(0, g.litri).toFixed(1)} LT</td>
                    <td className="p-2.5 text-right font-mono text-stone-600">{platoMedio.toFixed(1)}°P</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dettaglio Movimentazioni & Lotti */}
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
                        m.tipo === 'CARICO' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
