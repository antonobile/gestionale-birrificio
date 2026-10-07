import React, { useState } from 'react';
import { Cotta, FatturaUtenza, AziendaConfig } from '../../types';
import { Coins, Calculator, TrendingUp, DollarSign } from 'lucide-react';

interface TabCostoRealeProps {
  cotte: Cotta[];
  bollette: FatturaUtenza[];
  azienda: AziendaConfig;
}

export const TabCostoReale: React.FC<TabCostoRealeProps> = ({ cotte, bollette, azienda }) => {
  // Calcolo incidenza costi fissi al litro
  const totSpeseUtenze = bollette.reduce((acc, b) => acc + b.totale_fattura, 0);
  const totLitriCotte = cotte.reduce((acc, c) => acc + c.litri_mosto, 0);
  const quotaFissaLitro = totLitriCotte > 0 ? totSpeseUtenze / totLitriCotte : 0.35;

  // Cotta selezionata per analisi
  const [cottaId, setCottaId] = useState<number>(cotte[0]?.id || 0);

  const cottaSelezionata = cotte.find((c) => c.id === cottaId) || cotte[0] || {
    tipo_birra: 'Bionda Belga',
    costo_litro_mosto: 0.775,
    grado_plato: 13.5,
    litri_mosto: 500,
  };

  const costoMpLitro = cottaSelezionata.costo_litro_mosto || 0.775;
  const plato = cottaSelezionata.grado_plato || 13.5;

  // Accisa per litro = (Plato / 100) * aliquota
  const accisaLitro = (plato / 100.0) * azienda.aliquota_accisa;

  // Costo Pieno Industriale al Litro
  const costoIndustrialeLitro = costoMpLitro + accisaLitro + quotaFissaLitro;

  // Simulatore Formato di Vendita
  const [formato, setFormato] = useState('Fusto 24L');
  const [costoImballo, setCostoImballo] = useState(1.5);
  const [prezzoVendita, setPrezzoVendita] = useState(85.0);

  const formatoMap: { [f: string]: number } = {
    'Fusto 20L': 20.0,
    'Fusto 24L': 24.0,
    'Fusto 25L': 25.0,
    'Fusto 30L': 30.0,
    'Fusto 12L': 12.0,
    'Bottiglia 0.33L': 0.33,
    'Bottiglia 0.75L': 0.75,
  };

  const litriFormato = formatoMap[formato] || 24.0;
  const costoPienoFormato = costoIndustrialeLitro * litriFormato + costoImballo;
  const utileNetto = prezzoVendita - costoPienoFormato;
  const marginePerc = prezzoVendita > 0 ? (utileNetto / prezzoVendita) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Costo Pieno */}
      <div className="bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent p-5 sm:p-6 rounded-2xl border border-amber-500/30 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-base">💰 Calcolo Costo Reale Industriale & Margini al Litro</h3>
          </div>

          {cotte.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-600 font-medium">Analizza Cotta:</span>
              <select
                value={cottaId}
                onChange={(e) => setCottaId(parseInt(e.target.value))}
                className="bg-white border border-stone-300 rounded-lg p-1.5 font-bold text-stone-800 text-xs"
              >
                {cotte.map((c) => (
                  <option key={c.id} value={c.id}>
                    Cotta {c.cotta_num} - {c.tipo_birra} ({c.grado_plato}°P)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Breakdown Costi Industriali */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="bg-white/90 p-4 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase">1. Materie Prime + CIP</span>
            <div className="text-xl font-black text-stone-900 font-mono mt-1">€ {costoMpLitro.toFixed(3)} <span className="text-xs font-normal text-stone-500">/ LT</span></div>
            <p className="text-[11px] text-stone-500 mt-1">Malti, luppoli, lieviti e soda</p>
          </div>

          <div className="bg-white/90 p-4 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase">2. Accisa Doganale</span>
            <div className="text-xl font-black text-amber-700 font-mono mt-1">€ {accisaLitro.toFixed(3)} <span className="text-xs font-normal text-stone-500">/ LT</span></div>
            <p className="text-[11px] text-stone-500 mt-1">{plato}°P x {azienda.aliquota_accisa.toFixed(3)} €/hl/°P</p>
          </div>

          <div className="bg-white/90 p-4 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase">3. Bollette & Fissi</span>
            <div className="text-xl font-black text-indigo-700 font-mono mt-1">€ {quotaFissaLitro.toFixed(3)} <span className="text-xs font-normal text-stone-500">/ LT</span></div>
            <p className="text-[11px] text-stone-500 mt-1">Luce, gas, acqua e canoni</p>
          </div>

          <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-4 rounded-xl shadow-md">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100">Costo Pieno Reale</span>
            <div className="text-2xl font-black font-mono mt-1">€ {costoIndustrialeLitro.toFixed(3)} <span className="text-xs font-medium text-amber-200">/ LT</span></div>
            <p className="text-[11px] text-amber-100 mt-1">Costo finito birra in tank</p>
          </div>
        </div>
      </div>

      {/* SIMULATORE MARGINE DI VENDITA */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <Calculator className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-stone-900 text-base">🍺 Simulatore Margine e Utile per Formato di Vendita (Pub & Horeca)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Formato Confezionato</label>
            <select
              value={formato}
              onChange={(e) => {
                const f = e.target.value;
                setFormato(f);
                if (f.includes('Bottiglia')) {
                  setCostoImballo(0.35);
                  setPrezzoVendita(2.6);
                } else {
                  setCostoImballo(1.5);
                  setPrezzoVendita(85.0);
                }
              }}
              className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-bold"
            >
              <option value="Fusto 20L">Fusto 20L</option>
              <option value="Fusto 24L">Fusto 24L</option>
              <option value="Fusto 25L">Fusto 25L</option>
              <option value="Fusto 30L">Fusto 30L</option>
              <option value="Fusto 12L">Fusto 12L</option>
              <option value="Bottiglia 0.33L">Bottiglia 0.33L</option>
              <option value="Bottiglia 0.75L">Bottiglia 0.75L</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Costo Imballo a Perdere (€/pz)</label>
            <input
              type="number"
              step="0.05"
              value={costoImballo}
              onChange={(e) => setCostoImballo(parseFloat(e.target.value) || 0)}
              className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Prezzo Vendita Netto al Pub (€/pz)</label>
            <input
              type="number"
              step="0.5"
              value={prezzoVendita}
              onChange={(e) => setPrezzoVendita(parseFloat(e.target.value) || 0)}
              className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
            />
          </div>
        </div>

        {/* Risultati della simulazione */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-stone-100">
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
            <span className="text-xs font-semibold text-stone-500">Costo Pieno {formato}</span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-1">€ {costoPienoFormato.toFixed(2)}</div>
            <p className="text-[11px] text-stone-500 mt-1">Litri ({litriFormato} L) x € {costoIndustrialeLitro.toFixed(3)} + imballo</p>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
            <span className="text-xs font-semibold text-emerald-800">Utile Netto a Pezzo</span>
            <div className="text-xl font-black font-mono text-emerald-800 mt-1">€ {utileNetto.toFixed(2)}</div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Margine lordo per fusto o bottiglia</p>
          </div>

          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200">
            <span className="text-xs font-semibold text-amber-800">Margine di Profitto %</span>
            <div className="text-xl font-black font-mono text-amber-900 mt-1">{marginePerc.toFixed(1)}%</div>
            <p className="text-[11px] text-amber-700 font-medium mt-1">Rapporto margine / prezzo di vendita</p>
          </div>
        </div>
      </div>
    </div>
  );
};
