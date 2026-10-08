import React from 'react';
import { Droplet, Beer, Truck, Wheat, Flower2, FlaskConical, Warehouse, Gauge } from 'lucide-react';

interface MetricCardsProps {
  totMostoLordo: number;
  totBirraMagazzino: number;
  fustiFuori: number;
  maltoResiduo: number;
  luppoloResiduo: number;
  lievitoResiduo: number;
  onNavigateToGiacenze?: () => void;
  onNavigateToFusti?: () => void;
  onOpenCalibrazione?: () => void;
  offsetMosto?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  totMostoLordo,
  totBirraMagazzino,
  fustiFuori,
  maltoResiduo,
  luppoloResiduo,
  lievitoResiduo,
  onNavigateToGiacenze,
  onNavigateToFusti,
  onOpenCalibrazione,
  offsetMosto = 0,
}) => {
  return (
    <div className="space-y-4">
      {/* Primary KPI Row (Calo/trub rimosso completamente su richiesta dell'utente) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Contalitri Mosto Lordo */}
        <div className="bg-white/95 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-amber-500/20 shadow-xs hover:shadow-md transition relative group">
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Contalitri Mosto Lordo</span>
            <div className="flex items-center gap-1.5">
              {onOpenCalibrazione && (
                <button
                  type="button"
                  onClick={onOpenCalibrazione}
                  className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition"
                  title="Modifica o calibra il contatore iniziale / offset"
                >
                  <Gauge className="w-3 h-3 text-amber-600" />
                  <span>Calibra</span>
                </button>
              )}
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <Droplet className="w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight">
            {totMostoLordo.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
            <span className="text-sm font-semibold text-stone-500">LT</span>
          </div>
          <div className="text-xs text-stone-500 mt-1 flex items-center justify-between">
            <span>Volume totale progressivo</span>
            {offsetMosto > 0 && (
              <span className="text-[11px] font-semibold text-blue-700 font-mono bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                Offset: +{offsetMosto.toLocaleString('it-IT')} LT
              </span>
            )}
          </div>
        </div>

        {/* 2. Birra Finita a Magazzino */}
        <div
          onClick={onNavigateToGiacenze}
          className="bg-white/95 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-emerald-500/20 shadow-xs hover:shadow-md transition cursor-pointer group"
          title="Clicca per aprire Giacenze Magazzino"
        >
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Birra Finita a Magazzino</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Beer className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono tracking-tight">
            {totBirraMagazzino.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
            <span className="text-sm font-semibold text-emerald-700">LT</span>
          </div>
          <p className="text-xs text-emerald-700 font-medium mt-1 flex items-center gap-1">
            <span>Disponibile per vendita e fusti</span>
          </p>
        </div>

        {/* 3. Fusti nei Pub (Cauzioni) */}
        <div
          onClick={onNavigateToFusti}
          className="bg-white/95 backdrop-blur-sm p-4 sm:p-5 rounded-2xl border border-blue-500/20 shadow-xs hover:shadow-md transition cursor-pointer group"
          title="Clicca per monitorare fusti e pub"
        >
          <div className="flex items-center justify-between text-stone-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Fusti nei Pub (Cauzioni)</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-900 font-mono tracking-tight">
            {fustiFuori}{' '}
            <span className="text-sm font-semibold text-blue-600">fusti</span>
          </div>
          <p className="text-xs text-blue-700 font-medium mt-1">
            {fustiFuori > 0 ? `${fustiFuori} fusti in carico ai clienti (cauzione attiva)` : 'Nessun fusto fuori sede'}
          </p>
        </div>
      </div>

      {/* Widget Giacenze Materie Prime con TESTO E CARATTERI VISIBILMENTE INGRANDITI */}
      <div className="bg-gradient-to-br from-amber-50 via-yellow-50/80 to-stone-100 p-4 sm:p-5 rounded-2xl border-2 border-amber-300/80 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-amber-200/80 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center text-white shadow-xs">
              <Warehouse className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider">
                Giacenze Materie Prime in Tempo Reale
              </h3>
              <p className="text-[11px] text-stone-600 font-medium">
                Aggiornamento dinamico istantaneo ad ogni carico fattura o scarico cotta
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-200/70 text-amber-900 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Giacenza Attiva
          </span>
        </div>

        {/* Categorie Principali con TESTO E CIFRE VISIBILMENTE MAGGIORI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          {/* 1. MALTO */}
          <div className="bg-white/90 rounded-xl p-4 border border-amber-200 shadow-xs flex items-center gap-3.5 hover:border-amber-400 transition">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <Wheat className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black tracking-wider text-amber-900 uppercase">
                MALTO
              </div>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight leading-tight">
                {maltoResiduo.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="text-base font-bold text-amber-700">kg</span>
              </div>
              <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                Giacenza disponibile
              </div>
            </div>
          </div>

          {/* 2. LUPPOLO */}
          <div className="bg-white/90 rounded-xl p-4 border border-emerald-200 shadow-xs flex items-center gap-3.5 hover:border-emerald-400 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <Flower2 className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black tracking-wider text-emerald-900 uppercase">
                LUPPOLO
              </div>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight leading-tight">
                {luppoloResiduo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-base font-bold text-emerald-700">kg</span>
              </div>
              <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                Pellet & coni in cella
              </div>
            </div>
          </div>

          {/* 3. LIEVITO */}
          <div className="bg-white/90 rounded-xl p-4 border border-indigo-200 shadow-xs flex items-center gap-3.5 hover:border-indigo-400 transition">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
              <FlaskConical className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black tracking-wider text-indigo-900 uppercase">
                LIEVITO
              </div>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight leading-tight">
                {lievitoResiduo.toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}{' '}
                <span className="text-base font-bold text-indigo-700">kg</span>
              </div>
              <div className="text-[11px] font-semibold text-stone-500 mt-0.5">
                Ceppi secchi e liquidi
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

