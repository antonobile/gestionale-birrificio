import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CalendarRange,
  FlaskConical,
  Package,
  Layers,
  ShoppingCart,
  Radio,
  Beer,
  Zap,
  Coins,
  Warehouse,
  Clock,
  Calendar,
  Scale,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { AziendaConfig } from '../types';

export type NavItemKey =
  | 'acquisti_xml'
  | 'pianifica_cotta'
  | 'cotta_cip'
  | 'imballaggi'
  | 'confezionamento'
  | 'vendite'
  | 'cantina_iot'
  | 'fusti_pub'
  | 'bollette_costi'
  | 'costo_reale'
  | 'giacenze_magazzino'
  | 'scadenze_promemoria'
  | 'agenda_birrificio'
  | 'report_dogane';

export interface NavItemConfig {
  key: NavItemKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { key: 'acquisti_xml', label: 'Acquisti XML', icon: FileSpreadsheet },
  { key: 'pianifica_cotta', label: 'Pianifica Cotta', icon: CalendarRange },
  { key: 'cotta_cip', label: 'Cotta e CIP', icon: FlaskConical },
  { key: 'imballaggi', label: 'Imballaggi', icon: Package },
  { key: 'confezionamento', label: 'Confezionamento', icon: Layers },
  { key: 'vendite', label: 'Vendite', icon: ShoppingCart },
  { key: 'cantina_iot', label: 'Cantina IoT', icon: Radio },
  { key: 'fusti_pub', label: 'Fusti e Pub', icon: Beer },
  { key: 'bollette_costi', label: 'Bollette e Costi', icon: Zap },
  { key: 'costo_reale', label: 'Costo Reale', icon: Coins },
  { key: 'giacenze_magazzino', label: 'Giacenze Magazzino', icon: Warehouse },
  { key: 'scadenze_promemoria', label: 'Scadenze e Promemoria', icon: Clock },
  { key: 'agenda_birrificio', label: 'Agenda Birrificio', icon: Calendar },
  { key: 'report_dogane', label: 'Report 31/12', icon: Scale },
];

interface SidebarProps {
  activeKey: NavItemKey;
  onSelectKey: (key: NavItemKey) => void;
  azienda: AziendaConfig;
  onLogout: () => void;
  pendingDeadlinesCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeKey,
  onSelectKey,
  azienda,
  onLogout,
  pendingDeadlinesCount = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <>
      {/* Spacer to push page content when sidebar is fixed collapsed */}
      <div className="w-16 shrink-0 transition-all duration-300" />

      {/* Vertical Collapsible / Icon-Only Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className={`fixed top-0 left-0 bottom-0 z-40 bg-stone-900 text-stone-200 border-r border-stone-800 transition-all duration-300 ease-in-out flex flex-col justify-between shadow-2xl select-none no-scrollbar ${
          isHovered ? 'w-64' : 'w-16'
        }`}
      >
        {/* Top: Branding / Icon */}
        <div>
          <div className="h-16 flex items-center px-3 border-b border-stone-800/80 overflow-hidden">
            <div className="flex items-center gap-3 min-w-[220px]">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src="/brewdesk-icon-concept-1.png"
                  alt="BrewDesk"
                  className="w-7 h-7 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <Beer className="w-5 h-5 text-amber-400 absolute" style={{ zIndex: -1 }} />
              </div>

              <div
                className={`transition-opacity duration-200 whitespace-nowrap ${
                  isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-stone-100 tracking-tight text-base">
                    Brew<span className="text-amber-400">Desk</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    PRO
                  </span>
                </div>
                <div className="text-[11px] text-stone-400 truncate max-w-[140px]">
                  {azienda.ragione_sociale}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links List */}
          <nav
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)] no-scrollbar"
          >
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const isActive = activeKey === item.key;
              const showBadge = item.key === 'scadenze_promemoria' && pendingDeadlinesCount > 0;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelectKey(item.key)}
                  className={`w-full flex items-center h-10 px-2.5 rounded-xl text-xs font-semibold transition-all group relative ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md shadow-amber-900/30 font-bold'
                      : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800/70'
                  }`}
                  title={!isHovered ? `${index + 1}. ${item.label}` : undefined}
                >
                  {/* Icon */}
                  <div className="w-7 flex items-center justify-center shrink-0">
                    <Icon
                      className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-stone-400 group-hover:text-amber-400'
                      }`}
                    />
                  </div>

                  {/* Text Label (visible on hover/expansion) */}
                  <span
                    className={`ml-2.5 whitespace-nowrap text-left transition-opacity duration-200 truncate ${
                      isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Badge Notification */}
                  {showBadge && (
                    <span
                      className={`ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white text-amber-900' : 'bg-rose-600 text-white'
                      } ${!isHovered && 'absolute top-1.5 right-1.5 w-2 h-2 p-0 rounded-full'}`}
                    >
                      {isHovered ? pendingDeadlinesCount : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: User & Logout */}
        <div className="p-2 border-t border-stone-800/80 bg-stone-900/90">
          <button
            onClick={onLogout}
            className={`w-full flex items-center h-10 px-2.5 rounded-xl text-xs font-medium text-stone-400 hover:text-rose-400 hover:bg-rose-950/20 transition group`}
            title={!isHovered ? 'Esci (Logout)' : undefined}
          >
            <div className="w-7 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4 text-stone-400 group-hover:text-rose-400" />
            </div>
            <span
              className={`ml-2.5 whitespace-nowrap transition-opacity duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              Disconnetti (Logout)
            </span>
          </button>
        </div>
      </aside>
    </>
  );
};
