import React from 'react';
import { AziendaConfig } from '../types';
import { Beer, LogOut, ShieldCheck, Settings, Eye, EyeOff } from 'lucide-react';

interface HeaderProps {
  azienda: AziendaConfig;
  onUpdateAzienda: (newConfig: AziendaConfig) => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
  showDashboard?: boolean;
  onToggleDashboard?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  azienda,
  onLogout,
  onOpenSettings,
  showDashboard = true,
  onToggleDashboard,
}) => {
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

        {/* Company Header (Brewery info, KPI toggle, Settings & Logout) */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs">
          <div className="bg-stone-800/80 border border-stone-700/60 rounded-lg px-3.5 py-2 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-stone-100 text-sm">{azienda.ragione_sociale}</span>
              <span className="text-stone-400 ml-2 font-mono text-xs">P.IVA: {azienda.piva}</span>
            </div>
          </div>

          {/* KPI Dashboard Toggle Button */}
          {onToggleDashboard && (
            <button
              onClick={onToggleDashboard}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition cursor-pointer ${
                showDashboard
                  ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border-stone-700'
                  : 'bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 hover:text-amber-200 border-amber-600/50 shadow-xs'
              }`}
              title={showDashboard ? 'Nascondi la barra KPI/Dashboard' : 'Mostra la barra KPI/Dashboard'}
              aria-label={showDashboard ? 'Nascondi KPI dashboard' : 'Mostra KPI dashboard'}
            >
              {showDashboard ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                  <span className="hidden sm:inline">Nascondi KPI</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Mostra KPI</span>
                </>
              )}
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-300 px-3.5 py-2 rounded-lg border border-stone-700 transition cursor-pointer"
              title="Apri Impostazioni aziendali, credenziali e contatore mosto"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Impostazioni</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white px-3.5 py-2 rounded-lg border border-stone-700 transition cursor-pointer"
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
