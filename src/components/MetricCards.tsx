import React from 'react';
import { Droplet, Beer, TrendingDown, Truck, Wheat, Flower2, FlaskConical } from 'lucide-react';

interface MetricCardsProps {
  totMostoLordo: number;
  totBirraMagazzino: number;
  fustiFuori: number;
  maltoResiduo: number;
  luppoloResiduo: number;
  lievitoResiduo: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totMostoLordo,
  totBirraMagazzino,
  fustiFuori,
  maltoResiduo,
  luppoloResiduo,
  lievitoResiduo,
}) => {
  const caloTotale = Math.max(0, totMostoLordo - totBirraMagazzino);
  const resaVol = totMostoLordo > 0 ? (totBirraMagazzino / totMostoLordo) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-amber-500/20 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Contalitri Mosto Lordo</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Droplet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {totMostoLordo.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-medium text-stone-500">LT</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Volume complessivo cotte registrate</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-amber-500/20 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Birra Finita a Magazzino</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Beer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {totBirraMagazzino.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-medium text-stone-500">LT</span>
          </div>
          <p className="text-xs text-emerald-600 font-medium mt-1">Confezionata e disponibile</p>
        </div>

        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-amber-500/20 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Calo / Scarto Cantina</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {caloTotale.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-medium text-stone-500">LT</span>
          </div>
          <div className="flex items-center justify-between text-xs text-stone-500 mt-1">
            <span>Perdite e trub</span>
            <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">{resaVol.toFixed(1)}% resa vol.</span>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-amber-500/20 shadow-sm hover:shadow transition">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Fusti nei Pub (Cauzioni)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono">
            {fustiFuori} <span className="text-sm font-medium text-stone-500">fusti</span>
          </div>
          <p className="text-xs text-blue-600 font-medium mt-1">
            {fustiFuori > 0 ? `${fustiFuori} fusti vuoti da recuperare` : 'Nessun fusto fuori sede'}
          </p>
        </div>
      </div>

      {/* Raw Materials Quick Inventory Pill */}
      <div className="bg-gradient-to-r from-amber-50/80 via-yellow-50/70 to-emerald-50/60 p-3.5 rounded-xl border border-amber-200/70 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
          🌾 Giacenze Materie Prime:
        </span>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2">
            <Wheat className="w-4 h-4 text-amber-600" />
            <span className="text-stone-600">Malto Residuo:</span>
            <span className="font-mono font-bold text-stone-900 text-sm">{maltoResiduo.toFixed(1)} kg</span>
          </div>
          <div className="flex items-center gap-2">
            <Flower2 className="w-4 h-4 text-emerald-600" />
            <span className="text-stone-600">Luppolo Residuo:</span>
            <span className="font-mono font-bold text-stone-900 text-sm">{luppoloResiduo.toFixed(2)} kg</span>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-600" />
            <span className="text-stone-600">Lievito Residuo:</span>
            <span className="font-mono font-bold text-stone-900 text-sm">{lievitoResiduo.toFixed(3)} kg</span>
          </div>
        </div>
      </div>
    </div>
  );
};
