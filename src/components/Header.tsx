import React from 'react';
import { AziendaConfig } from '../types';
import { Beer, LogOut, ShieldCheck, Scale } from 'lucide-react';

interface HeaderProps {
  azienda: AziendaConfig;
  onUpdateAzienda: (newConfig: AziendaConfig) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ azienda, onUpdateAzienda, onLogout }) => {
  return (
    <header className="bg-gradient-to-r from-stone-900 via-stone-850 to-amber-950 text-white border-b border-amber-900/40 shadow-lg px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 shadow-inner">
            <img
              src="/brewdesk-icon-concept-1.png"
              alt="BrewDesk Logo"
              className="w-8 h-8 object-contain"
              onError={(e) => {
                // fallback to beer icon if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Beer className="w-6 h-6 text-amber-400 absolute" style={{ zIndex: -1 }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white flex items-center">
                Brew<span className="text-amber-400">Desk</span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">PRO</span>
              </h1>
            </div>
            <p className="text-xs text-stone-400">Brewery Management & Compliance Platform</p>
          </div>
        </div>

        {/* Company Badge & Tax Config */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-stone-800/80 border border-stone-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-stone-200">{azienda.ragione_sociale}</span>
              <span className="text-stone-400 ml-1.5 font-mono">P.IVA: {azienda.piva}</span>
            </div>
          </div>

          <div className="bg-stone-800/80 border border-amber-700/50 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-stone-300">Accisa 2026: </span>
              <span className="font-bold text-amber-300 font-mono">{azienda.aliquota_accisa.toFixed(3)} €/hl/°P</span>
              <span className="text-stone-400 ml-1">
                ({azienda.aliquota_accisa === 1.49 ? 'Microbirrificio -50%' : 'Ordinario'})
              </span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white px-3 py-1.5 rounded-lg border border-stone-700 transition"
            title="Esci dalla sessione"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Esci</span>
          </button>
        </div>
      </div>
    </header>
  );
};
