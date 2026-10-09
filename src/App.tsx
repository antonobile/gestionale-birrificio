import React, { useState, useEffect } from 'react';
import {
  AziendaConfig,
  Cliente,
  MateriaPrima,
  Imballaggio,
  Cotta,
  Ricetta,
  BirraCondizionata,
  TracciamentoFusti,
  FatturaUtenza,
  FermentatoreConfig,
  TelemetriaFermentatore,
  Annotazione,
  PromemoriaScadenza,
  PianificazioneCotta,
  EventoAgenda,
  BrewDayLog,
} from './types';
import {
  initialAzienda,
  initialClienti,
  initialMateriePrime,
  initialImballaggi,
  initialCotte,
  initialRicette,
  initialBirraCondizionata,
  initialTracciamentoFusti,
  initialFattureUtenze,
  initialFermentatori,
  initialTelemetria,
  initialAnnotazioni,
  initialPromemoria,
  initialPiani,
  initialEventiAgenda,
  initialBrewDayLogs,
} from './data/mockData';
import { loadStorage, saveStorage } from './utils/storage';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { StickyNotes } from './components/StickyNotes';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar, NavItemKey } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';

// Tabs
import { TabAcquisti } from './components/tabs/TabAcquisti';
import { TabPianificatore } from './components/tabs/TabPianificatore';
import { TabCotta } from './components/tabs/TabCotta';
import { TabBrewDayLog } from './components/tabs/TabBrewDayLog';
import { TabImballaggi } from './components/tabs/TabImballaggi';
import { TabConfezionamento } from './components/tabs/TabConfezionamento';
import { TabVendite } from './components/tabs/TabVendite';
import { TabClienti } from './components/tabs/TabClienti';
import { TabIoT } from './components/tabs/TabIoT';
import { TabFusti } from './components/tabs/TabFusti';
import { TabBollette } from './components/tabs/TabBollette';
import { TabCostoReale } from './components/tabs/TabCostoReale';
import { TabGiacenze } from './components/tabs/TabGiacenze';
import { TabScadenze } from './components/tabs/TabScadenze';
import { TabAgenda } from './components/tabs/TabAgenda';
import { TabReportDogane } from './components/tabs/TabReportDogane';

export const App: React.FC = () => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => loadStorage('logged_in', true));
  const [currentUser, setCurrentUser] = useState<string>(() => loadStorage('current_user', 'admin'));

  // Main business data states
  const [azienda, setAzienda] = useState<AziendaConfig>(() => loadStorage('azienda', initialAzienda));
  const [clienti, setClienti] = useState<Cliente[]>(() => loadStorage('clienti', initialClienti));
  const [materiePrime, setMateriePrime] = useState<MateriaPrima[]>(() =>
    loadStorage('materie_prime', initialMateriePrime)
  );
  const [imballaggi, setImballaggi] = useState<Imballaggio[]>(() =>
    loadStorage('imballaggi', initialImballaggi)
  );
  const [cotte, setCotte] = useState<Cotta[]>(() => loadStorage('cotte', initialCotte));
  const [ricette, setRicette] = useState<Ricetta[]>(() => loadStorage('ricette', initialRicette));
  const [birraCondizionata, setBirraCondizionata] = useState<BirraCondizionata[]>(() =>
    loadStorage('birra_condizionata', initialBirraCondizionata)
  );
  const [tracciamentoFusti, setTracciamentoFusti] = useState<TracciamentoFusti[]>(() =>
    loadStorage('tracciamento_fusti', initialTracciamentoFusti)
  );
  const [fattureUtenze, setFattureUtenze] = useState<FatturaUtenza[]>(() =>
    loadStorage('fatture_utenze', initialFattureUtenze)
  );
  const [fermentatori, setFermentatori] = useState<FermentatoreConfig[]>(() =>
    loadStorage('fermentatori', initialFermentatori)
  );
  const [telemetria, setTelemetria] = useState<TelemetriaFermentatore[]>(() =>
    loadStorage('telemetria', initialTelemetria)
  );
  const [note, setNote] = useState<Annotazione[]>(() => loadStorage('note', initialAnnotazioni));
  const [promemoria, setPromemoria] = useState<PromemoriaScadenza[]>(() =>
    loadStorage('promemoria', initialPromemoria)
  );
  const [piani, setPiani] = useState<PianificazioneCotta[]>(() =>
    loadStorage('piani', initialPiani)
  );
  const [eventiAgenda, setEventiAgenda] = useState<EventoAgenda[]>(() =>
    loadStorage('eventi_agenda', initialEventiAgenda)
  );
  const [brewDayLogs, setBrewDayLogs] = useState<BrewDayLog[]>(() =>
    loadStorage('brew_day_logs', initialBrewDayLogs)
  );
  const [selectedRecipeForBrew, setSelectedRecipeForBrew] = useState<number | undefined>(undefined);

  // Active navigation key based on the strict 14 order requested:
  // 1. acquisti xml
  // 2. pianifica cotta
  // 3. cotta e cip
  // 4. imballaggi
  // 5. confezionamento
  // 6. vendite
  // 7. cantina IoT
  // 8. fusti e pub
  // 9. bollette e costi
  // 10. costo reale
  // 11. giacenze magazzino
  // 12. scadenze e promemoria
  // 13. agenda birrificio
  // 14. report 31/12
  const [activeKey, setActiveKey] = useState<NavItemKey>(() =>
    loadStorage('pagina_corrente', 'cotta_cip')
  );

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dashboard KPI visibility toggle (mostra/nascondi barra contatori e materie prime)
  const [showDashboard, setShowDashboard] = useState<boolean>(() =>
    loadStorage('show_dashboard_kpis', true)
  );

  // Bacheca Post-It visibility toggle (mostra/nascondi bacheca annotazioni)
  const [showPostIt, setShowPostIt] = useState<boolean>(() =>
    loadStorage('show_post_it', true)
  );

  // Auto-sync to storage
  useEffect(() => {
    saveStorage('pagina_corrente', activeKey);
    saveStorage('logged_in', isLoggedIn);
    saveStorage('current_user', currentUser);
    saveStorage('azienda', azienda);
    saveStorage('clienti', clienti);
    saveStorage('materie_prime', materiePrime);
    saveStorage('imballaggi', imballaggi);
    saveStorage('cotte', cotte);
    saveStorage('ricette', ricette);
    saveStorage('birra_condizionata', birraCondizionata);
    saveStorage('tracciamento_fusti', tracciamentoFusti);
    saveStorage('fatture_utenze', fattureUtenze);
    saveStorage('fermentatori', fermentatori);
    saveStorage('telemetria', telemetria);
    saveStorage('note', note);
    saveStorage('promemoria', promemoria);
    saveStorage('piani', piani);
    saveStorage('eventi_agenda', eventiAgenda);
    saveStorage('brew_day_logs', brewDayLogs);
    saveStorage('show_dashboard_kpis', showDashboard);
    saveStorage('show_post_it', showPostIt);
  }, [
    isLoggedIn,
    currentUser,
    azienda,
    clienti,
    materiePrime,
    imballaggi,
    cotte,
    ricette,
    birraCondizionata,
    tracciamentoFusti,
    fattureUtenze,
    fermentatori,
    telemetria,
    note,
    promemoria,
    piani,
    eventiAgenda,
    brewDayLogs,
    showDashboard,
    showPostIt,
  ]);

  if (!isLoggedIn) {
    return (
      <AuthScreen
        onLogin={(username) => {
          setCurrentUser(username);
          setIsLoggedIn(true);
        }}
        onRegister={(ragione, piva, username) => {
          setAzienda({
            ...azienda,
            ragione_sociale: ragione,
            piva,
          });
          setCurrentUser(username);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  // Aggregate KPI Calculations with Initial Counter Offset
  const litriCotteSoftware = cotte.reduce((acc, c) => acc + c.litri_mosto, 0);
  const offsetMostoIniziale = azienda.contatore_mosto_iniziale || 0;
  const totMostoLordo = offsetMostoIniziale + litriCotteSoftware;

  const totBirraMagazzino = birraCondizionata.reduce(
    (acc, b) => acc + (b.tipo === 'CARICO' ? b.litri_totali : -b.litri_totali),
    0
  );

  const fustiFuori = tracciamentoFusti.reduce(
    (acc, m) => acc + (m.tipo_movimento === 'USCITA_PUB' ? m.quantita : -m.quantita),
    0
  );

  const maltoResiduo = materiePrime.reduce(
    (acc, m) => acc + (m.tipo === 'CARICO' ? m.malto_kg : -m.malto_kg),
    0
  );

  const luppoloResiduo = materiePrime.reduce(
    (acc, m) => acc + (m.tipo === 'CARICO' ? m.luppolo_kg : -m.luppolo_kg),
    0
  );

  const lievitoResiduo = materiePrime.reduce(
    (acc, m) => acc + (m.tipo === 'CARICO' ? m.lievito_kg : -m.lievito_kg),
    0
  );

  const numScadenzeAperte =
    promemoria.filter((p) => p.stato === 'APERTA').length +
    fattureUtenze.filter((b) => b.stato_pagamento !== 'PAGATA').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/40 via-yellow-50/20 to-stone-100/60 text-stone-900 flex">
      {/* 1. Left Collapsible / Icon-Only Sidebar (Giacenze widget rimosso, logout sempre visibile e pulsante Impostazioni) */}
      <Sidebar
        activeKey={activeKey}
        onSelectKey={setActiveKey}
        azienda={azienda}
        onLogout={() => setIsLoggedIn(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        pendingDeadlinesCount={numScadenzeAperte}
      />

      {/* 2. Main Content Container */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div>
          {/* Header Bar */}
          <Header
            azienda={azienda}
            onUpdateAzienda={setAzienda}
            onLogout={() => setIsLoggedIn(false)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            showDashboard={showDashboard}
            onToggleDashboard={() => setShowDashboard((prev) => !prev)}
          />

          {/* Main Dashboard & Content */}
          <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
            {/* Top KPI Cards (visibilità controllata da toggle rapido - animazione fluida) */}
            {showDashboard && (
              <div className="transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-top-2">
                <MetricCards
                  totMostoLordo={totMostoLordo}
                  totBirraMagazzino={totBirraMagazzino}
                  fustiFuori={Math.max(0, fustiFuori)}
                  maltoResiduo={Math.max(0, maltoResiduo)}
                  luppoloResiduo={Math.max(0, luppoloResiduo)}
                  lievitoResiduo={Math.max(0, lievitoResiduo)}
                  onNavigateToGiacenze={() => setActiveKey('giacenze_magazzino')}
                  onNavigateToFusti={() => setActiveKey('fusti_pub')}
                  onOpenCalibrazione={() => setIsSettingsOpen(true)}
                  offsetMosto={offsetMostoIniziale}
                  onNavigateToBrewDay={() => setActiveKey('cotta_guidata')}
                />
              </div>
            )}

            {/* Sticky Notes Bulletin Board */}
            <StickyNotes
              note={note}
              onAddNota={(newN) => {
                setNote([{ id: Date.now(), created_at: new Date().toISOString().slice(0, 10), ...newN }, ...note]);
              }}
              onToggleNota={(id) => {
                setNote(note.map((n) => (n.id === id ? { ...n, completata: !n.completata } : n)));
              }}
              onDeleteNota={(id) => {
                setNote(note.filter((n) => n.id !== id));
              }}
              showPostIt={showPostIt}
              onToggleShowPostIt={() => setShowPostIt((prev) => !prev)}
            />

            {/* Active Module View Rendering (no reload, instant switch) */}
            <div className="animate-fade-in">
              {/* 1. acquisti xml */}
              {activeKey === 'acquisti_xml' && (
                <TabAcquisti
                  materiePrime={materiePrime}
                  onAddCarico={(c) => setMateriePrime([{ id: Date.now(), ...c }, ...materiePrime])}
                />
              )}

              {/* 2. pianifica cotta */}
              {activeKey === 'pianifica_cotta' && (
                <TabPianificatore
                  piani={piani}
                  tanks={fermentatori}
                  ricette={ricette}
                  onAddPiano={(p) => setPiani([{ id: Date.now(), ...p }, ...piani])}
                  onUpdateStatoPiano={(id, st) => {
                    setPiani(piani.map((p) => (p.id === id ? { ...p, stato: st } : p)));
                  }}
                  onDeletePiano={(id) => setPiani(piani.filter((p) => p.id !== id))}
                  onAvviaCottaGuidata={(rId) => {
                    setSelectedRecipeForBrew(rId);
                    setActiveKey('cotta_guidata');
                  }}
                />
              )}

              {/* 3. cotta e cip */}
              {activeKey === 'cotta_cip' && (
                <TabCotta
                  cotte={cotte}
                  ricette={ricette}
                  azienda={azienda}
                  onAddCotta={(c) => {
                    setCotte([{ id: Date.now(), ...c }, ...cotte]);
                    // Se la cotta ha consumato materie prime, registra scarico automatico per aggiornamento dinamico in tempo reale
                    if (c.malto_usato_kg > 0 || c.luppolo_usato_kg > 0 || c.lievito_usato_kg > 0) {
                      setMateriePrime([
                        {
                          id: Date.now() + 1,
                          tipo: 'SCARICO',
                          data: c.data,
                          riferimento: `Cotta ${c.cotta_num}`,
                          azienda: `Produzione ${c.tipo_birra}`,
                          malto_kg: c.malto_usato_kg,
                          luppolo_kg: c.luppolo_usato_kg,
                          lievito_kg: c.lievito_usato_kg,
                          costo_malto_kg: 1.35,
                          costo_luppolo_kg: 28.5,
                          costo_lievito_kg: 64.0,
                          costo_kg_medio: 1.35,
                        },
                        ...materiePrime,
                      ]);
                    }
                  }}
                  onDeleteCotta={(id) => {
                    const cottaToDelete = cotte.find((c) => c.id === id);
                    setCotte(cotte.filter((c) => c.id !== id));
                    if (cottaToDelete) {
                      // Rimuove anche lo scarico associato in materie prime
                      setMateriePrime(
                        materiePrime.filter((m) => m.riferimento !== `Cotta ${cottaToDelete.cotta_num}`)
                      );
                    }
                  }}
                  onAddRicetta={(r) => setRicette([{ id: Date.now(), ...r }, ...ricette])}
                  onDeleteRicetta={(id) => setRicette(ricette.filter((r) => r.id !== id))}
                  onAvviaCottaGuidata={(rId) => {
                    setSelectedRecipeForBrew(rId);
                    setActiveKey('cotta_guidata');
                  }}
                />
              )}

              {/* 3b. Modalità Cotta Guidata (Brew Day Log su Tablet) */}
              {activeKey === 'cotta_guidata' && (
                <TabBrewDayLog
                  ricette={ricette}
                  cotte={cotte}
                  tanks={fermentatori}
                  azienda={azienda}
                  brewDayLogs={brewDayLogs}
                  onSaveBrewDayLog={(log) => {
                    const exists = brewDayLogs.some((l) => l.id === log.id);
                    if (exists) {
                      setBrewDayLogs(brewDayLogs.map((l) => (l.id === log.id ? log : l)));
                    } else {
                      setBrewDayLogs([log, ...brewDayLogs]);
                    }
                  }}
                  onRiversaInCotte={(c) => {
                    setCotte([{ id: Date.now(), ...c }, ...cotte]);
                    if (c.malto_usato_kg > 0 || c.luppolo_usato_kg > 0 || c.lievito_usato_kg > 0) {
                      setMateriePrime([
                        {
                          id: Date.now() + 1,
                          tipo: 'SCARICO',
                          data: c.data,
                          riferimento: `Cotta ${c.cotta_num}`,
                          azienda: `Produzione ${c.tipo_birra}`,
                          malto_kg: c.malto_usato_kg,
                          luppolo_kg: c.luppolo_usato_kg,
                          lievito_kg: c.lievito_usato_kg,
                          costo_malto_kg: 1.35,
                          costo_luppolo_kg: 28.5,
                          costo_lievito_kg: 64.0,
                          costo_kg_medio: 1.35,
                        },
                        ...materiePrime,
                      ]);
                    }
                  }}
                  onNavigateToCotte={() => setActiveKey('cotta_cip')}
                  initialRecipeId={selectedRecipeForBrew}
                />
              )}

              {/* 4. imballaggi */}
              {activeKey === 'imballaggi' && (
                <TabImballaggi
                  imballaggi={imballaggi}
                  onAddImballaggio={(i) => setImballaggi([{ id: Date.now(), ...i }, ...imballaggi])}
                />
              )}

              {/* 5. confezionamento */}
              {activeKey === 'confezionamento' && (
                <TabConfezionamento
                  cotte={cotte}
                  onAddConfezionamento={(movs) => {
                    const newRecords: BirraCondizionata[] = movs.map((m, idx) => ({
                      id: Date.now() + idx,
                      ...m,
                    }));
                    setBirraCondizionata([...newRecords, ...birraCondizionata]);
                    setActiveKey('giacenze_magazzino');
                  }}
                />
              )}

              {/* 6. vendite */}
              {activeKey === 'vendite' && (
                <TabVendite
                  clienti={clienti}
                  vendite={birraCondizionata}
                  ricette={ricette}
                  azienda={azienda}
                  onNavigateToClienti={() => setActiveKey('clienti')}
                  onAddScaricoVendita={(m) => {
                    setBirraCondizionata([{ id: Date.now(), ...m }, ...birraCondizionata]);
                  }}
                />
              )}

              {/* 7. anagrafica clienti */}
              {activeKey === 'clienti' && (
                <TabClienti
                  clienti={clienti}
                  onAddCliente={(c) => setClienti([{ id: Date.now(), ...c }, ...clienti])}
                  onUpdateCliente={(id, upd) =>
                    setClienti(clienti.map((c) => (c.id === id ? { ...c, ...upd } : c)))
                  }
                  onDeleteCliente={(id) => setClienti(clienti.filter((c) => c.id !== id))}
                  onAddClientiBulk={(list) =>
                    setClienti([
                      ...list.map((c, i) => ({ id: Date.now() + i, ...c })),
                      ...clienti,
                    ])
                  }
                  fusti={tracciamentoFusti}
                  vendite={birraCondizionata}
                  onNavigateToVendite={() => setActiveKey('vendite')}
                />
              )}

              {/* 8. cantina IoT */}
              {activeKey === 'cantina_iot' && (
                <TabIoT
                  tanks={fermentatori}
                  telemetria={telemetria}
                  onAddTank={(t) => setFermentatori([...fermentatori, { id: Date.now(), ...t }])}
                  onDeleteTank={(id) => setFermentatori(fermentatori.filter((t) => t.id !== id))}
                  onUpdateSetpoint={(name, sp) => {
                    setFermentatori(
                      fermentatori.map((t) => (t.nome_tank === name ? { ...t, setpoint_temperatura: sp } : t))
                    );
                    setTelemetria([
                      {
                        id: Date.now(),
                        timestamp: new Date().toLocaleString('it-IT'),
                        tank_id: name,
                        lotto: 'AGGIORNAMENTO_SETPOINT',
                        temperatura: sp,
                        setpoint: sp,
                        densita: 0,
                        pressione: 0,
                        stato: 'Setpoint aggiornato',
                      },
                      ...telemetria,
                    ]);
                  }}
                  onAddTelemetria={(pkt) => setTelemetria([{ id: Date.now(), ...pkt }, ...telemetria])}
                />
              )}

              {/* 8. fusti e pub */}
              {activeKey === 'fusti_pub' && (
                <TabFusti
                  fusti={tracciamentoFusti}
                  onAddMovimentoFusti={(m) => {
                    setTracciamentoFusti([{ id: Date.now(), ...m }, ...tracciamentoFusti]);
                    if (m.tipo_movimento === 'RIENTRO_VUOTO') {
                      setImballaggi([
                        {
                          id: Date.now(),
                          tipo_movimento: 'CARICO',
                          data: m.data,
                          riferimento: `Reso da ${m.cliente_pub}`,
                          articolo: `Fusti vuoti ${m.formato_fusto.replace('Fusto ', '')}`,
                          quantita: m.quantita,
                          costo_unitario: 0.0,
                        },
                        ...imballaggi,
                      ]);
                    }
                  }}
                  onDeleteMovimentoFusti={(id) =>
                    setTracciamentoFusti(tracciamentoFusti.filter((f) => f.id !== id))
                  }
                  clienti={clienti}
                  onAddCliente={(c) => setClienti([{ id: Date.now(), ...c }, ...clienti])}
                  onAddClientiBulk={(list) =>
                    setClienti([
                      ...list.map((c, i) => ({ id: Date.now() + i, ...c })),
                      ...clienti,
                    ])
                  }
                  onDeleteCliente={(id) => setClienti(clienti.filter((c) => c.id !== id))}
                />
              )}

              {/* 9. bollette e costi */}
              {activeKey === 'bollette_costi' && (
                <TabBollette
                  bollette={fattureUtenze}
                  onAddBolletta={(b) => setFattureUtenze([{ id: Date.now(), ...b }, ...fattureUtenze])}
                  onUpdateStatoBolletta={(id, nuovoStato) => {
                    setFattureUtenze(
                      fattureUtenze.map((b) => (b.id === id ? { ...b, stato_pagamento: nuovoStato } : b))
                    );
                  }}
                />
              )}

              {/* 10. costo reale */}
              {activeKey === 'costo_reale' && (
                <TabCostoReale cotte={cotte} bollette={fattureUtenze} azienda={azienda} />
              )}

              {/* 11. giacenze magazzino */}
              {activeKey === 'giacenze_magazzino' && (
                <TabGiacenze
                  movimenti={birraCondizionata}
                  onDeleteMovimento={(id) =>
                    setBirraCondizionata(birraCondizionata.filter((b) => b.id !== id))
                  }
                  materiePrime={materiePrime}
                  onAddMovimentoMp={(m) =>
                    setMateriePrime([{ id: Date.now(), ...m }, ...materiePrime])
                  }
                  onDeleteMovimentoMp={(id) =>
                    setMateriePrime(materiePrime.filter((m) => m.id !== id))
                  }
                />
              )}

              {/* 12. scadenze e promemoria */}
              {activeKey === 'scadenze_promemoria' && (
                <TabScadenze
                  promemoria={promemoria}
                  bollette={fattureUtenze}
                  note={note}
                  onAddPromemoria={(p) => setPromemoria([{ id: Date.now(), ...p }, ...promemoria])}
                  onCompletaPromemoria={(id) => {
                    setPromemoria(
                      promemoria.map((p) => (p.id === id ? { ...p, stato: 'COMPLETATA' } : p))
                    );
                  }}
                  onDeletePromemoria={(id) => setPromemoria(promemoria.filter((p) => p.id !== id))}
                />
              )}

              {/* 13. agenda birrificio */}
              {activeKey === 'agenda_birrificio' && (
                <TabAgenda
                  eventi={eventiAgenda}
                  onAddEvento={(e) => setEventiAgenda([{ id: Date.now(), ...e }, ...eventiAgenda])}
                  onDeleteEvento={(id) => setEventiAgenda(eventiAgenda.filter((e) => e.id !== id))}
                />
              )}

              {/* 14. report 31/12 */}
              {activeKey === 'report_dogane' && (
                <TabReportDogane
                  cotte={cotte}
                  materiePrime={materiePrime}
                  imballaggi={imballaggi}
                  birraCondizionata={birraCondizionata}
                  azienda={azienda}
                />
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="mt-12 border-t border-stone-200/80 bg-white/60 py-4 text-center text-xs text-stone-500">
          <p>
            BrewDesk Pro — Microbrewery Management Platform • {azienda.ragione_sociale} (P.IVA {azienda.piva}) • Conforme Regolamenti Accise Agenzia delle Dogane
          </p>
        </footer>
      </div>

      {/* Settings Modal (Profilo aziendale, password e calibrazione contalitri mosto) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        azienda={azienda}
        onUpdateAzienda={setAzienda}
        totLitriCotteSoftware={litriCotteSoftware}
      />
    </div>
  );
};

export default App;
