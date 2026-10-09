import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Ricetta,
  Cotta,
  FermentatoreConfig,
  AziendaConfig,
  BrewDayLog,
  BrewDayNota,
} from '../../types';
import {
  Flame,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  Clock,
  Save,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  History,
  AlertTriangle,
  Sparkles,
  Volume2,
  VolumeX,
  FileText,
  Plus,
  Trash2,
  Check,
  Scale,
  Thermometer,
  Droplets,
  Timer,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  FileCheck,
} from 'lucide-react';

interface TabBrewDayLogProps {
  ricette: Ricetta[];
  cotte: Cotta[];
  tanks: FermentatoreConfig[];
  azienda: AziendaConfig;
  brewDayLogs: BrewDayLog[];
  onSaveBrewDayLog: (log: BrewDayLog) => void;
  onRiversaInCotte: (cotta: Omit<Cotta, 'id'>) => void;
  onNavigateToCotte?: () => void;
  initialRecipeId?: number;
}

interface StepItem {
  id: string;
  titolo: string;
  fase: string;
  durataConsigliataMin?: number;
  temperaturaTarget?: number;
  istruzioni: string[];
  controlli: string[];
}

const STEPS_CONFIG: StepItem[] = [
  {
    id: 'step_prep',
    titolo: '1. Preparazione & Acqua di Ammostamento',
    fase: 'Preparazione & Strike Water',
    temperaturaTarget: 72.0,
    durataConsigliataMin: 30,
    istruzioni: [
      'Calcolare il volume di acqua di ammostamento (rapporto consigliato 3.0 - 3.2 L/kg di malto).',
      'Riscaldare l\'acqua di impasto (strike water) a 4-6°C al di sopra della temperatura di saccarificazione desiderata.',
      'Trattare l\'acqua di processo con sali minerali (CaCl2, CaSO4) e acido lattico per target pH 5.2 - 5.4.',
      'Verificare la macinatura dei malti: bucce integre, endosperma sfarinato senza polvere eccessiva.',
    ],
    controlli: [
      'Trattamento sali e verifica durezza/pH acqua eseguito',
      'Temperatura strike water raggiunta',
      'Macinatura e pesatura malti verificata',
      'pH-metro calibrato e pronto in sala cottura',
    ],
  },
  {
    id: 'step_mash',
    titolo: '2. Ammostamento (Mash & Step Termici)',
    fase: 'Ammostamento',
    temperaturaTarget: 66.0,
    durataConsigliataMin: 60,
    istruzioni: [
      'Versare i malti macinati nell\'acqua miscelando costantemente per evitare grumi secchi (dough-in).',
      'Misurare la temperatura effettiva dopo l\'impasto e omogeneizzare.',
      'Mantenere la temperatura di saccarificazione costante per 60 minuti.',
      'Se previsto, effettuare Mash-Out a 76-78°C per 10 minuti per inattivare gli enzimi e ridurre la viscosità.',
      'Eseguire il test dello iodio per accertarsi della completa degradazione degli amidi.',
    ],
    controlli: [
      'Impasto uniforme completato (assenza di grumi)',
      'Temperatura di saccarificazione stabilizzata',
      'Controllo pH mash (ottimale 5.2 - 5.5)',
      'Sosta mash-out a 76-78°C eseguita',
      'Test dello iodio negativo (nessuna colorazione scura)',
    ],
  },
  {
    id: 'step_sparge',
    titolo: '3. Filtrazione & Lavaggio Trebbie (Lautering & Sparge)',
    fase: 'Filtrazione & Sparge',
    temperaturaTarget: 78.0,
    durataConsigliataMin: 45,
    istruzioni: [
      'Avviare il ricircolo del mosto (vorlauf) per 10-15 minuti fino a quando il liquido non esce limpido.',
      'Iniziare il trasferimento delicato verso la caldaia di bollitura (evitare ossigenazione a caldo).',
      'Procedere con lo sparge (lavaggio trebbie) utilizzando acqua a 78°C.',
      'Monitorare il volume in caldaia e arrestare il lavaggio prima che la densità di uscita scenda sotto 2.5° Plato per evitare estrazione di tannini amari e astringenti.',
      'Misurare il volume pre-boil e la densità pre-boil.',
    ],
    controlli: [
      'Vorlauf effettuato e mosto limpido',
      'Acqua di sparge a 78°C costante',
      'Flusso di filtrazione regolare senza compattamento del letto',
      'Rilevazione volume effettivo pre-boil eseguita',
      'Misurazione densità / Plato pre-boil registrata',
    ],
  },
  {
    id: 'step_boil',
    titolo: '4. Bollitura & Gittate Luppoli',
    fase: 'Bollitura & Luppolature',
    temperaturaTarget: 100.0,
    durataConsigliataMin: 60,
    istruzioni: [
      'Portare il mosto a ebollizione vigorosa e costante a 100°C con caldaia aperta/apertura vapore.',
      'Schiumare se necessario nella fase iniziale di rottura a caldo (hot break).',
      'Inserire il luppolo da amaro all\'inizio della bollitura (60 min).',
      'Aggiungere i luppoli da aroma a 15 min / 10 min dalla fine.',
      'Aggiungere chiarificante (es. Irish Moss / Protofloc) e nutrienti lievito a 10 min.',
      'Aggiungere eventuali spezie o zuccheri a 5 min da fine bollitura.',
    ],
    controlli: [
      'Ebollizione franca e vigorosa raggiunta',
      'Gittata luppolo da amaro effettuata (60 min)',
      'Gittata luppolo aroma / sapore effettuata (15 min)',
      'Aggiunta chiarificante / nutrienti lievito (10 min)',
      'Aggiunta spezie / luppolo finale (5 min)',
    ],
  },
  {
    id: 'step_whirlpool',
    titolo: '5. Whirlpool & Riposo (Hop Stand)',
    fase: 'Whirlpool & Trub',
    temperaturaTarget: 85.0,
    durataConsigliataMin: 20,
    istruzioni: [
      'Spegnere la fonte di riscaldamento/vapore.',
      'Attivare la pompa per generare il vortice tangenziale (whirlpool) per 10-15 minuti.',
      'Se previsti, effettuare aggiunte di luppoli in hop stand (a 80-85°C per preservare aromi delicati e oli essenziali).',
      'Fermare la pompa e lasciare a riposo per 15-20 minuti per consentire la compattazione del cono centrale di trub (proteine e luppoli precipitati).',
    ],
    controlli: [
      'Vortice whirlpool innescato con successo',
      'Gittata luppolo in whirlpool eseguita (se prevista)',
      'Tempo di riposo rispettato (cono di trub compattato)',
      'Verifica temperatura mosto a fine whirlpool',
    ],
  },
  {
    id: 'step_transfer',
    titolo: '6. Raffreddamento & Trasferimento Fermentatore',
    fase: 'Raffreddamento & Inoculo',
    temperaturaTarget: 19.0,
    durataConsigliataMin: 30,
    istruzioni: [
      'Sanificare accuratamente scambiatore a piastre, tubazioni e fermentatore di destinazione.',
      'Avviare il passaggio attraverso lo scambiatore raffreddando fino alla temperatura target di inoculo (es. 18-20°C per Ale o 10-12°C per Lager).',
      'Ossigenare il mosto in linea durante il trasferimento.',
      'Inoculare il lievito selezionato (secco reidratato o starter fresco) garantendo adeguata dispersione.',
      'Rilevare il volume finale immesso nel fermentatore e il Grado Plato / OG reale definitivo.',
      'Registrare i contatori di cantina e sigillare il fermentatore impostando il setpoint termico.',
    ],
    controlli: [
      'Linee e scambiatore sanificati',
      'Temperatura mosto freddo in target all\'ingresso nel tank',
      'Ossigenazione mosto effettuata',
      'Inoculo lievito effettuato correttamente',
      'Misurazione volume effettivo in fermentatore eseguita',
      'Misurazione Grado Plato / OG definitiva registrata',
      'Contalitri iniziale e finale rilevati',
    ],
  },
  {
    id: 'step_summary',
    titolo: '7. Analisi Scostamenti & Chiusura Cotta',
    fase: 'Riepilogo & Calibrazione',
    istruzioni: [
      'Analizzare il confronto tra valori previsti in ricetta e dati reali rilevati in cantina.',
      'Verificare l\'efficienza reale dell\'impianto calcolata automaticamente.',
      'Consultare i suggerimenti di calibrazione per le prossime cotte di questo stile.',
      'Aggiungere eventuali note conclusive sul comportamento dell\'impianto o delle materie prime.',
      'Riversare i dati nel Registro Cotte ufficiale per alimentare l\'Allegato I Dogane e lo scarico materie prime.',
    ],
    controlli: [
      'Tutti i dati reali verificati e confermati',
      'Scostamenti analizzati',
      'Annotazioni e particolarità registrate',
      'Sessione archiviata nello storico',
    ],
  },
];

// Suono sintetizzato Web Audio API per avviso fine timer
const playAlarmBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(880, now, 0.2);
    playTone(1174.66, now + 0.25, 0.3);
    playTone(1760, now + 0.6, 0.5);
  } catch {
    // Ignore audio context errors if browser blocks autoplay
  }
};

export const TabBrewDayLog: React.FC<TabBrewDayLogProps> = ({
  ricette,
  cotte,
  tanks,
  azienda,
  brewDayLogs,
  onSaveBrewDayLog,
  onRiversaInCotte,
  onNavigateToCotte,
  initialRecipeId,
}) => {
  const [modalitaVista, setModalitaVista] = useState<'guidata' | 'storico'>('guidata');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selezione ricetta per la sessione corrente
  const ricettaSelezionata = useMemo(() => {
    if (initialRecipeId) {
      const trovata = ricette.find((r) => r.id === initialRecipeId);
      if (trovata) return trovata;
    }
    return ricette[0] || null;
  }, [ricette, initialRecipeId]);

  const [currentRecipeId, setCurrentRecipeId] = useState<number>(ricettaSelezionata?.id || 1);
  const ricettaAttiva = useMemo(() => {
    return ricette.find((r) => r.id === currentRecipeId) || ricettaSelezionata;
  }, [ricette, currentRecipeId, ricettaSelezionata]);

  // Stato Dati di Sessione della Cotta Guidata
  const [codiceCotta, setCodiceCotta] = useState(`COTTA-0${cotte.length + 1}/2026`);
  const [lottoSfuso, setLottoSfuso] = useState(`LOTTO-260${cotte.length + 1}`);
  const [dataCotta, setDataCotta] = useState(new Date().toISOString().slice(0, 10));
  const [operatore, setOperatore] = useState('Mastro Birraio');
  const [tankDestinazione, setTankDestinazione] = useState(tanks[0]?.nome_tank || 'Tank 01 - Cilindroconico');

  // Parametri Teorici (dalla ricetta)
  const [targetLitri, setTargetLitri] = useState(ricettaAttiva?.litri_previsti || 500.0);
  const [targetPlato, setTargetPlato] = useState(ricettaAttiva?.plato_previsto || 13.5);
  const [targetPreboilLitri, setTargetPreboilLitri] = useState(
    ricettaAttiva ? Math.round(ricettaAttiva.litri_previsti * 1.09) : 545.0
  );
  const [targetPreboilPlato, setTargetPreboilPlato] = useState(
    ricettaAttiva ? parseFloat((ricettaAttiva.plato_previsto * 0.91).toFixed(1)) : 12.2
  );
  const [targetMashTemp, setTargetMashTemp] = useState(66.0);
  const [maltoKg, setMaltoKg] = useState(ricettaAttiva?.fermentabili_kg || 110.0);
  const [luppoloGr, setLuppoloGr] = useState(ricettaAttiva?.luppoli_gr || 1800.0);
  const [lievitoGr, setLievitoGr] = useState(ricettaAttiva?.lieviti_gr || 500.0);

  // Parametri Reali Misurati in Cantina
  const [realeStrikeTemp, setRealeStrikeTemp] = useState<number | ''>(72.0);
  const [realeMashTemp, setRealeMashTemp] = useState<number | ''>(66.2);
  const [realePhMash, setRealePhMash] = useState<number | ''>(5.35);
  const [realePreboilLitri, setRealePreboilLitri] = useState<number | ''>(548.0);
  const [realePreboilPlato, setRealePreboilPlato] = useState<number | ''>(12.3);
  const [realePostboilLitri, setRealePostboilLitri] = useState<number | ''>(508.0);
  const [realeOgPlato, setRealeOgPlato] = useState<number | ''>(13.6);
  const [realeTempWhirlpool, setRealeTempWhirlpool] = useState<number | ''>(84.5);
  const [realeTempRaffreddamento, setRealeTempRaffreddamento] = useState<number | ''>(19.2);
  const [realePhMostoFreddo, setRealePhMostoFreddo] = useState<number | ''>(5.18);
  const [realeContInizio, setRealeContInizio] = useState<number | ''>(11245.0);
  const [realeContFine, setRealeContFine] = useState<number | ''>(11753.0);

  // Stepper & Controlli completati
  const [stepAttivoIdx, setStepAttivoIdx] = useState(0);
  const [controlliCompletati, setControlliCompletati] = useState<Record<string, boolean>>({});

  // Annotazioni
  const [annotazioniLibere, setAnnotazioniLibere] = useState('');
  const [noteOrarie, setNoteOrarie] = useState<BrewDayNota[]>([]);
  const [nuovaNotaInput, setNuovaNotaInput] = useState('');

  // Timer di Sala Cottura
  const [timerSeconds, setTimerSeconds] = useState(60 * 60); // default 60 min
  const [timerInitial, setTimerInitial] = useState(60 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [timerNome, setTimerNome] = useState('Timer Ammostamento');
  const [timerExpired, setTimerExpired] = useState(false);

  // Notifiche di salvataggio
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Aggiorna parametri target quando cambia la ricetta
  const handleCambiaRicetta = (id: number) => {
    setCurrentRecipeId(id);
    const r = ricette.find((x) => x.id === id);
    if (r) {
      setTargetLitri(r.litri_previsti);
      setTargetPlato(r.plato_previsto);
      setTargetPreboilLitri(Math.round(r.litri_previsti * 1.09));
      setTargetPreboilPlato(parseFloat((r.plato_previsto * 0.91).toFixed(1)));
      setMaltoKg(r.fermentabili_kg);
      setLuppoloGr(r.luppoli_gr);
      setLievitoGr(r.lieviti_gr);
      setSaveSuccessMsg(`Ricetta caricata: ${r.nome_ricetta}`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }
  };

  // Timer Interval Effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setTimerExpired(true);
            if (!isMuted) {
              playAlarmBeep();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds, isMuted]);

  // Formattazione minuti e secondi
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSetPresetTimer = (minuti: number, nome: string) => {
    setIsTimerRunning(false);
    setTimerExpired(false);
    setTimerSeconds(minuti * 60);
    setTimerInitial(minuti * 60);
    setTimerNome(nome);
  };

  const toggleTimer = () => {
    if (timerExpired) {
      setTimerExpired(false);
      setTimerSeconds(timerInitial);
    }
    setIsTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerExpired(false);
    setTimerSeconds(timerInitial);
  };

  const adjustTimer = (seconds: number) => {
    setTimerSeconds((prev) => Math.max(0, prev + seconds));
  };

  // Toggle checkbox controllo
  const handleToggleControllo = (controlloKey: string) => {
    setControlliCompletati((prev) => ({
      ...prev,
      [controlloKey]: !prev[controlloKey],
    }));
  };

  // Calcoli Scostamenti & Efficienza
  const scostamenti = useMemo(() => {
    const volReale = typeof realePostboilLitri === 'number' ? realePostboilLitri : targetLitri;
    const platoReale = typeof realeOgPlato === 'number' ? realeOgPlato : targetPlato;
    const preboilReale = typeof realePreboilLitri === 'number' ? realePreboilLitri : targetPreboilLitri;

    const diffLitri = volReale - targetLitri;
    const diffLitriPerc = targetLitri > 0 ? (diffLitri / targetLitri) * 100 : 0;

    const diffPlato = platoReale - targetPlato;
    const diffPlatoPerc = targetPlato > 0 ? (diffPlato / targetPlato) * 100 : 0;

    const diffMashTemp =
      typeof realeMashTemp === 'number' ? realeMashTemp - targetMashTemp : 0;

    // Efficienza sala cottura teorica ~78%
    const effTeorica = 78.0;

    // Efficienza sala cottura reale (Brewhouse efficiency):
    // Formula standard: (Litri * Plato * 1.05) / (MaltoKg * 0.78 / 100 * 100)
    let effReale = effTeorica;
    if (maltoKg > 0 && volReale > 0) {
      effReale = (volReale * platoReale * 1.05) / (maltoKg * 0.78);
      effReale = Math.min(95, Math.max(55, effReale));
    }
    const diffEff = effReale - effTeorica;

    // Evaporazione oraria
    const boilDurataOre = 1.0;
    const evapLitri = Math.max(0, preboilReale - volReale);
    const evapOrariaLitri = evapLitri / boilDurataOre;
    const evapPerc = preboilReale > 0 ? (evapLitri / preboilReale) * 100 : 0;

    // Suggerimento di calibrazione intelligente
    let suggerimento = '';
    if (diffEff > 2.5) {
      suggerimento = `L'efficienza reale dell'impianto è risultata superiore alle previsioni (+${diffEff.toFixed(
        1
      )}%). La saccarificazione e il lavaggio hanno estratto più zuccheri del previsto. Per le prossime cotte dello stile "${
        ricettaAttiva?.stile_birra || 'Questo Stile'
      }", puoi ridurre il malto base di circa ${(
        (diffEff / 100) *
        maltoKg *
        0.5
      ).toFixed(1)} kg oppure aumentare leggermente il volume di diluizione.`;
    } else if (diffEff < -2.5) {
      suggerimento = `L'efficienza reale è inferiore alle attese (${diffEff.toFixed(
        1
      )}%). Possibile estrazione zuccherina incompleta o lavaggio troppo veloce del letto di trebbie. Per le prossime cotte, consigliato prolungare la sosta a 66°C di 10 minuti, controllare la calibrazione del pH a 5.3 o stringere lievemente la distanza dei rulli del mulino.`;
    } else {
      suggerimento = `Efficienza perfettamente allineata al profilo teorico (scostamento minimo ${diffEff.toFixed(
        1
      )}%). I parametri di ammostamento, acqua di lavaggio e macinatura sono ottimali per questo stile.`;
    }

    if (diffLitri < -15) {
      suggerimento += ` Nota: volume finale inferiore di ${Math.abs(diffLitri).toFixed(
        0
      )} L (evaporazione ${evapPerc.toFixed(1)}%). Considerare +${Math.abs(diffLitri).toFixed(
        0
      )} L di acqua nello sparge iniziale.`;
    } else if (diffLitri > 15) {
      suggerimento += ` Nota: volume finale superiore di +${diffLitri.toFixed(
        0
      )} L. Ridurre lievemente l'acqua di lavaggio o aumentare l'intensità della bollitura.`;
    }

    return {
      diffLitri,
      diffLitriPerc,
      diffPlato,
      diffPlatoPerc,
      diffMashTemp,
      effTeorica,
      effReale,
      diffEff,
      evapOrariaLitri,
      evapPerc,
      suggerimento,
    };
  }, [
    realePostboilLitri,
    realeOgPlato,
    realePreboilLitri,
    realeMashTemp,
    targetLitri,
    targetPlato,
    targetPreboilLitri,
    targetMashTemp,
    maltoKg,
    ricettaAttiva,
  ]);

  // Aggiungi annotazione rapida predefinita
  const handleAggiungiQuickNote = (testo: string) => {
    const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const nuovaNota: BrewDayNota = {
      id: Date.now().toString(),
      orario: ora,
      testo,
    };
    setNoteOrarie((prev) => [nuovaNota, ...prev]);
    setSaveSuccessMsg(`Nota registrata: ${testo}`);
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  // Aggiungi annotazione manuale con orario
  const handleAggiungiNotaManuale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuovaNotaInput.trim()) return;
    const ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const nuovaNota: BrewDayNota = {
      id: Date.now().toString(),
      orario: ora,
      testo: nuovaNotaInput.trim(),
    };
    setNoteOrarie((prev) => [nuovaNota, ...prev]);
    setNuovaNotaInput('');
  };

  const handleRimuoviNota = (id: string) => {
    setNoteOrarie((prev) => prev.filter((n) => n.id !== id));
  };

  // Toggle Fullscreen Tablet
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Salvataggio Log Cotta Guidata nello Storico
  const handleSalvaSessioneLog = () => {
    const logCompleto: BrewDayLog = {
      id: Date.now(),
      data: dataCotta,
      codice_cotta: codiceCotta,
      ricetta_id: ricettaAttiva?.id,
      nome_birra: ricettaAttiva?.nome_ricetta || 'Birra Speciale',
      stile_birra: ricettaAttiva?.stile_birra || 'Artigianale',
      lotto_sfuso: lottoSfuso,
      operatore,
      tank_destinazione: tankDestinazione,
      target_litri_mosto: targetLitri,
      target_plato: targetPlato,
      target_preboil_litri: targetPreboilLitri,
      target_preboil_plato: targetPreboilPlato,
      target_mash_temp: targetMashTemp,
      target_mash_durata_min: 60,
      target_boil_durata_min: 60,
      malto_totale_kg: maltoKg,
      luppolo_totale_gr: luppoloGr,
      lievito_totale_gr: lievitoGr,
      reale_strike_water_temp: typeof realeStrikeTemp === 'number' ? realeStrikeTemp : undefined,
      reale_mash_temp: typeof realeMashTemp === 'number' ? realeMashTemp : undefined,
      reale_ph_mash: typeof realePhMash === 'number' ? realePhMash : undefined,
      reale_preboil_litri: typeof realePreboilLitri === 'number' ? realePreboilLitri : undefined,
      reale_preboil_plato: typeof realePreboilPlato === 'number' ? realePreboilPlato : undefined,
      reale_postboil_litri: typeof realePostboilLitri === 'number' ? realePostboilLitri : undefined,
      reale_og_plato: typeof realeOgPlato === 'number' ? realeOgPlato : undefined,
      reale_temp_whirlpool: typeof realeTempWhirlpool === 'number' ? realeTempWhirlpool : undefined,
      reale_temp_raffreddamento: typeof realeTempRaffreddamento === 'number' ? realeTempRaffreddamento : undefined,
      reale_ph_mosto_freddo: typeof realePhMostoFreddo === 'number' ? realePhMostoFreddo : undefined,
      reale_contalitri_inizio: typeof realeContInizio === 'number' ? realeContInizio : undefined,
      reale_contalitri_fine: typeof realeContFine === 'number' ? realeContFine : undefined,
      scostamento_litri: parseFloat(scostamenti.diffLitri.toFixed(1)),
      scostamento_litri_perc: parseFloat(scostamenti.diffLitriPerc.toFixed(1)),
      scostamento_plato: parseFloat(scostamenti.diffPlato.toFixed(2)),
      scostamento_plato_perc: parseFloat(scostamenti.diffPlatoPerc.toFixed(1)),
      efficienza_teorica_perc: scostamenti.effTeorica,
      efficienza_reale_perc: parseFloat(scostamenti.effReale.toFixed(1)),
      scostamento_efficienza: parseFloat(scostamenti.diffEff.toFixed(1)),
      evaporazione_oraria_litri: parseFloat(scostamenti.evapOrariaLitri.toFixed(1)),
      suggerimento_calibrazione: scostamenti.suggerimento,
      annotazioni_libere: annotazioniLibere,
      annotazioni_orarie: noteOrarie,
      step_attivo: stepAttivoIdx,
      step_completati: Object.keys(controlliCompletati).filter((k) => controlliCompletati[k]),
      stato: 'COMPLETATA',
      ora_inizio: '08:00',
      ora_fine: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };

    onSaveBrewDayLog(logCompleto);
    setSaveSuccessMsg('✅ Foglio Cotta (Brew Day Log) salvato correttamente nello storico!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Riversa nel Registro Cotte Ufficiale (TabCotta + Allegato I Dogane + Scarico Magazzino)
  const handleRiversaInCotteUfficiale = () => {
    const vol = typeof realePostboilLitri === 'number' ? realePostboilLitri : targetLitri;
    const plato = typeof realeOgPlato === 'number' ? realeOgPlato : targetPlato;
    const contIniz = typeof realeContInizio === 'number' ? realeContInizio : 11000.0;
    const contFin = typeof realeContFine === 'number' ? realeContFine : contIniz + vol;

    const accisa = vol * plato * (azienda.aliquota_accisa / 100.0);
    const costoMp = maltoKg * 1.35 + (luppoloGr / 1000.0) * 28.5 + (lievitoGr / 1000.0) * 64.0;
    const costoEnergia = 14.8 * 1.2 + 50.0 * 0.28;
    const costoAcqua = 650.0 * 0.0025;
    const costoTotale = costoMp + costoEnergia + costoAcqua + 9.75;
    const costoLitro = vol > 0 ? costoTotale / vol : 0;

    const cottaRecord: Omit<Cotta, 'id'> = {
      cotta_num: codiceCotta.replace('COTTA-', ''),
      data: dataCotta,
      tipo_birra: ricettaAttiva?.nome_ricetta || 'Birra Cotta Guidata',
      litri_mosto: vol,
      grado_plato: plato,
      lotto_sfuso: lottoSfuso,
      note_lievito: `Inoculo ${operatore} - Tank: ${tankDestinazione}`,
      contalitri_inizio: contIniz,
      contalitri_fine: contFin,
      malto_usato_kg: maltoKg,
      luppolo_usato_kg: parseFloat((luppoloGr / 1000.0).toFixed(2)),
      lievito_usato_kg: parseFloat((lievitoGr / 1000.0).toFixed(2)),
      altri_ingredienti_note: annotazioniLibere.slice(0, 150),
      altri_ingredienti_json: ricettaAttiva?.altri_ingredienti_json || [],
      resa_perc: parseFloat(scostamenti.effReale.toFixed(1)),
      consumo_gas_mc: 14.8,
      consumo_elettrico_kwh: 50.0,
      accisa_dovuta_euro: parseFloat(accisa.toFixed(2)),
      costo_totale_cotta: parseFloat(costoTotale.toFixed(2)),
      costo_litro_mosto: parseFloat(costoLitro.toFixed(3)),
      acqua_lavaggio_litri: 650.0,
      costo_acqua_lavaggio: parseFloat(costoAcqua.toFixed(2)),
      costo_totale_sanificazione: 9.75,
    };

    onRiversaInCotte(cottaRecord);
    handleSalvaSessioneLog();
    setSaveSuccessMsg(
      '🎉 Cotta registrata con successo nel Registro Ufficiale e scarico materie prime effettuato!'
    );
    setTimeout(() => {
      setSaveSuccessMsg(null);
      if (onNavigateToCotte) onNavigateToCotte();
    }, 2000);
  };

  // Percentuale avanzamento controlli
  const currentStep = STEPS_CONFIG[stepAttivoIdx];
  const totalControls = STEPS_CONFIG.reduce((acc, s) => acc + s.controlli.length, 0);
  const completedControlsCount = Object.values(controlliCompletati).filter(Boolean).length;
  const progressPerc = Math.round((completedControlsCount / Math.max(1, totalControls)) * 100);

  return (
    <div
      ref={containerRef}
      className={`space-y-6 transition-colors ${
        isFullscreen ? 'bg-stone-900 text-stone-100 p-6 overflow-y-auto min-h-screen' : ''
      }`}
    >
      {/* 1. Header Toolbar della Sala Cottura */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 p-4 sm:p-5 rounded-2xl text-stone-100 shadow-xl border border-stone-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
            <Flame className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                MODALITÀ COTTA GUIDATA
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-stone-950">
                TABLET TOUCH READY
              </span>
            </div>
            <p className="text-xs text-stone-300">
              Foglio di lavoro interattivo in sala cottura: step operativi, timer, scostamenti e annotazioni.
            </p>
          </div>
        </div>

        {/* Action Controls & Modalità Vista */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Vista */}
          <div className="bg-stone-950/70 p-1 rounded-xl flex items-center border border-stone-700">
            <button
              type="button"
              onClick={() => setModalitaVista('guidata')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalitaVista === 'guidata'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Sessione Attiva</span>
            </button>
            <button
              type="button"
              onClick={() => setModalitaVista('storico')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                modalitaVista === 'storico'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Storico Log ({brewDayLogs.length})</span>
            </button>
          </div>

          {/* Fullscreen Button per Tablet */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Schermo intero per tablet"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Esci Schermo Intero</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Schermo Intero Tablet</span>
              </>
            )}
          </button>

          {/* Stampa / Salva Rapido */}
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-600 text-stone-200 transition active:scale-95"
            title="Stampa foglio cotta"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messaggio Notifica Salvataggio */}
      {saveSuccessMsg && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <span>{saveSuccessMsg}</span>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg(null)}
            className="text-emerald-200 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: SESSIONE COTTA GUIDATA INTERATTIVA */}
      {/* ========================================================================= */}
      {modalitaVista === 'guidata' && (
        <div className="space-y-6">
          {/* Card Configurazione Rapida della Cotta (Selezione Ricetta e Tank) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                    Ricetta & Identificativi della Sessione
                  </h3>
                  <p className="text-xs text-stone-500">
                    Seleziona una ricetta esistente per caricare automaticamente i parametri previsti.
                  </p>
                </div>
              </div>

              {/* Selettore Ricetta */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-stone-700 whitespace-nowrap">
                  Ricetta in Produzione:
                </label>
                <select
                  value={currentRecipeId}
                  onChange={(e) => handleCambiaRicetta(parseInt(e.target.value))}
                  className="bg-amber-50/60 border border-amber-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
                >
                  {ricette.map((r) => (
                    <option key={r.id} value={r.id}>
                      🍺 {r.nome_ricetta} ({r.stile_birra} - {r.plato_previsto}°P)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Griglia Dati di Base Cotta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 text-xs">
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Codice Cotta</span>
                <input
                  type="text"
                  value={codiceCotta}
                  onChange={(e) => setCodiceCotta(e.target.value)}
                  className="font-bold text-stone-800 bg-transparent w-full focus:outline-hidden"
                />
              </div>

              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Lotto Mosto</span>
                <input
                  type="text"
                  value={lottoSfuso}
                  onChange={(e) => setLottoSfuso(e.target.value)}
                  className="font-bold text-stone-800 bg-transparent w-full focus:outline-hidden"
                />
              </div>

              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Data Cotta</span>
                <input
                  type="date"
                  value={dataCotta}
                  onChange={(e) => setDataCotta(e.target.value)}
                  className="font-bold text-stone-800 bg-transparent w-full focus:outline-hidden"
                />
              </div>

              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Operatore</span>
                <input
                  type="text"
                  value={operatore}
                  onChange={(e) => setOperatore(e.target.value)}
                  className="font-bold text-stone-800 bg-transparent w-full focus:outline-hidden"
                />
              </div>

              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200/80">
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Tank Fermentazione</span>
                <select
                  value={tankDestinazione}
                  onChange={(e) => setTankDestinazione(e.target.value)}
                  className="font-bold text-stone-800 bg-transparent w-full focus:outline-hidden"
                >
                  {tanks.map((t) => (
                    <option key={t.id} value={t.nome_tank}>
                      {t.nome_tank} ({t.capacita_lt}L)
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Target Previsti</span>
                <span className="font-extrabold text-amber-900 text-xs">
                  {targetLitri} L @ {targetPlato}°P
                </span>
                <span className="text-[10px] text-amber-700 block mt-0.5">
                  Malto: {maltoKg}kg · Lup: {luppoloGr}g
                </span>
              </div>
            </div>
          </div>

          {/* SEZIONE CENTRALE SPLIT: TIMER GRANDE & STEP-BY-STEP WORKFLOW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* COLONNA SINISTRA (5/12): TIMER TOUCH-FRIENDLY & CONTROLLO SALA COTTURA */}
            <div className="lg:col-span-5 space-y-6">
              {/* Box Timer Gigante da Tablet */}
              <div
                className={`p-6 rounded-3xl border shadow-xl transition-all ${
                  timerExpired
                    ? 'bg-rose-950/90 text-white border-rose-600 animate-pulse'
                    : isTimerRunning
                    ? 'bg-stone-900 text-stone-100 border-amber-500 shadow-amber-900/20'
                    : 'bg-stone-900 text-stone-100 border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Timer className={`w-5 h-5 ${timerExpired ? 'text-rose-400' : 'text-amber-400'}`} />
                    <span className="text-xs font-bold tracking-wider uppercase text-stone-400">
                      {timerNome}
                    </span>
                  </div>

                  {/* Toggle Suono */}
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
                    title={isMuted ? 'Attiva avviso sonoro' : 'Silenzia'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                </div>

                {/* Display Digitale Timer Gigante */}
                <div className="py-8 text-center">
                  <div
                    className={`font-mono font-black text-6xl sm:text-7xl tracking-tight select-none ${
                      timerExpired
                        ? 'text-rose-400'
                        : isTimerRunning
                        ? 'text-amber-400'
                        : 'text-stone-100'
                    }`}
                  >
                    {formatTimer(timerSeconds)}
                  </div>
                  {timerExpired && (
                    <div className="mt-2 text-sm font-extrabold text-rose-300 animate-bounce">
                      ⏰ TEMPO SCADUTO! Verifica la fase in sala cottura
                    </div>
                  )}
                  {isTimerRunning && (
                    <div className="mt-2 text-xs font-semibold text-amber-300/80">
                      In conteggio... Mastro birraio all&apos;opera
                    </div>
                  )}
                </div>

                {/* Pulsanti Grandi Touch per Tablet */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className={`h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition shadow-lg active:scale-95 ${
                      isTimerRunning
                        ? 'bg-amber-600 hover:bg-amber-500 text-stone-950'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isTimerRunning ? (
                      <>
                        <Pause className="w-6 h-6" />
                        <span>Pausa</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-6 h-6 fill-current" />
                        <span>Avvia</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={resetTimer}
                    className="h-14 rounded-2xl font-bold text-sm bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>Reset</span>
                  </button>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustTimer(60)}
                      className="h-14 rounded-2xl font-bold text-xs bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 active:scale-95 flex items-center justify-center"
                    >
                      +1 min
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustTimer(300)}
                      className="h-14 rounded-2xl font-bold text-xs bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 active:scale-95 flex items-center justify-center"
                    >
                      +5 min
                    </button>
                  </div>
                </div>

                {/* Preset Rapidi Sala Cottura */}
                <div className="mt-5 pt-4 border-t border-stone-800">
                  <span className="text-[11px] font-bold text-stone-400 block mb-2 uppercase tracking-wider">
                    Preset Rapidi Fasi:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSetPresetTimer(60, 'Saccarificazione Mash (60 min)')}
                      className="p-2 rounded-xl bg-stone-800/80 hover:bg-amber-950/60 hover:text-amber-300 border border-stone-700/80 text-left transition"
                    >
                      🔥 Mash 60m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetTimer(10, 'Sosta Mash-Out 78°C (10 min)')}
                      className="p-2 rounded-xl bg-stone-800/80 hover:bg-amber-950/60 hover:text-amber-300 border border-stone-700/80 text-left transition"
                    >
                      🌡️ Mash-Out 10m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetTimer(60, 'Bollitura Totale (60 min)')}
                      className="p-2 rounded-xl bg-stone-800/80 hover:bg-amber-950/60 hover:text-amber-300 border border-stone-700/80 text-left transition"
                    >
                      🍲 Boil 60m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetTimer(15, 'Luppolo Aroma / Spezie (15 min)')}
                      className="p-2 rounded-xl bg-stone-800/80 hover:bg-amber-950/60 hover:text-amber-300 border border-stone-700/80 text-left transition"
                    >
                      🌿 Luppolo 15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetTimer(15, 'Whirlpool Dinamico (15 min)')}
                      className="p-2 rounded-xl bg-stone-800/80 hover:bg-amber-950/60 hover:text-amber-300 border border-stone-700/80 text-left transition"
                    >
                      🌀 Whirlpool 15m
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetPresetTimer(20, 'Riposo & Decantazione Trub (20 min)')}
                      className="p-2 rounded-xl bg-stone-800/80 hover:bg-amber-950/60 hover:text-amber-300 border border-stone-700/80 text-left transition"
                    >
                      🛑 Riposo 20m
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD DEDICATA: ANNOTAZIONI & NOTE RAPIDE SALA COTTURA */}
              <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-stone-900 text-sm">
                      Annotazioni di Cotta in Tempo Reale
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                    {noteOrarie.length} note
                  </span>
                </div>

                {/* Quick-chips a tocco rapido per tablet */}
                <div>
                  <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                    Note Rapide a 1 tocco:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '⚠️ Comportamento anomalo pompa / flusso rallentato',
                      '🌿 Profumo luppolo eccezionale e fresco',
                      '⏱️ Sparge prolungato di 15 min (letto compatto)',
                      '🧪 Test iodio negativo (conversione 100%)',
                      '💧 Correzione acido lattico +30ml',
                      '❄️ Scambiatore rapido: mosto a 19°C perfetto',
                    ].map((notaRapida, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAggiungiQuickNote(notaRapida)}
                        className="text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-900 px-2.5 py-1.5 rounded-lg border border-amber-200 transition text-left active:scale-95"
                      >
                        {notaRapida}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input manuale con orario */}
                <form onSubmit={handleAggiungiNotaManuale} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Appunta imprevisto, profumo o nota..."
                      value={nuovaNotaInput}
                      onChange={(e) => setNuovaNotaInput(e.target.value)}
                      className="flex-1 bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Aggiungi</span>
                    </button>
                  </div>
                </form>

                {/* Note cronologiche registrate */}
                {noteOrarie.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {noteOrarie.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200/80 text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                            {n.orario}
                          </span>
                          <span className="text-stone-700 leading-relaxed">{n.testo}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRimuoviNota(n.id)}
                          className="text-stone-400 hover:text-rose-600 transition"
                          title="Elimina nota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Area testo libero globale */}
                <div>
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                    Note Conclusive / Diario Libero:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Note generali su fermentazione, lievito inoculato, comportamento caldaia..."
                    value={annotazioniLibere}
                    onChange={(e) => setAnnotazioniLibere(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* COLONNA DESTRA (7/12): STEPPER PROGRESSIVO & REGISTRAZIONE MISURAZIONI */}
            <div className="lg:col-span-7 space-y-6">
              {/* Barra Avanzamento Fasi della Cotta */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-stone-700">
                    Avanzamento Cotta: Fase {stepAttivoIdx + 1} di {STEPS_CONFIG.length}
                  </span>
                  <span className="font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    {progressPerc}% completato
                  </span>
                </div>
                {/* Barra progresso */}
                <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-600 h-full transition-all duration-300"
                    style={{ width: `${progressPerc}%` }}
                  />
                </div>

                {/* Selettore Fasi a Step Tabs per Tablet */}
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 mt-4">
                  {STEPS_CONFIG.map((step, idx) => {
                    const isCurrent = idx === stepAttivoIdx;
                    const stepControls = step.controlli.map((c) => `${step.id}_${c}`);
                    const allDone = stepControls.every((key) => controlliCompletati[key]);

                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setStepAttivoIdx(idx)}
                        className={`p-2 rounded-xl text-center transition flex flex-col items-center justify-center gap-1 border ${
                          isCurrent
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-bold'
                            : allDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        <span className="text-[10px] font-bold">Step {idx + 1}</span>
                        <span className="text-[10px] truncate max-w-[55px] font-medium leading-tight">
                          {step.fase.split(' ')[0]}
                        </span>
                        {allDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : isCurrent ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scheda Operativa Dello Step Attivo */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      Fase {stepAttivoIdx + 1}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-stone-900 mt-1">
                      {currentStep.titolo}
                    </h3>
                  </div>

                  {currentStep.temperaturaTarget && (
                    <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl self-start">
                      <Thermometer className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold text-stone-700">
                        Target Temp: {currentStep.temperaturaTarget}°C
                      </span>
                    </div>
                  )}
                </div>

                {/* Linee guida & istruzioni */}
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/70 space-y-2">
                  <span className="text-xs font-bold text-amber-900 block flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Istruzioni Operative di Sala Cottura:
                  </span>
                  <ul className="text-xs text-stone-700 space-y-1.5 list-disc list-inside">
                    {currentStep.istruzioni.map((istr, i) => (
                      <li key={i} className="leading-relaxed">
                        {istr}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Campi di Inserimento Misurazioni in Base allo Step Attivo */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-600" />
                    Parametri Reali Rilevati in Cantina:
                  </h4>

                  {/* Step 1: Preparazione & Strike */}
                  {currentStep.id === 'step_prep' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Temp. Strike Water (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={realeStrikeTemp}
                          onChange={(e) =>
                            setRealeStrikeTemp(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Target: ~72.0 °C</span>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Ammostamento */}
                  {currentStep.id === 'step_mash' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Temp. Saccarificazione (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={realeMashTemp}
                          onChange={(e) =>
                            setRealeMashTemp(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Target ricetta: {targetMashTemp}°C</span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">pH Mash Misurato</label>
                        <input
                          type="number"
                          step="0.01"
                          value={realePhMash}
                          onChange={(e) =>
                            setRealePhMash(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Ottimale: 5.20 - 5.45</span>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Filtrazione & Preboil */}
                  {currentStep.id === 'step_sparge' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Volume Pre-Boil Reale (L)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={realePreboilLitri}
                          onChange={(e) =>
                            setRealePreboilLitri(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Target: {targetPreboilLitri} L</span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Densità Pre-Boil (°P)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={realePreboilPlato}
                          onChange={(e) =>
                            setRealePreboilPlato(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Target: {targetPreboilPlato} °P</span>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Whirlpool */}
                  {currentStep.id === 'step_whirlpool' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Temp. Whirlpool Iniziale (°C)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={realeTempWhirlpool}
                          onChange={(e) =>
                            setRealeTempWhirlpool(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Ideale: 82 - 86 °C</span>
                      </div>
                    </div>
                  )}

                  {/* Step 6: Raffreddamento & Trasferimento */}
                  {currentStep.id === 'step_transfer' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Volume Mosto in Tank (L)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={realePostboilLitri}
                          onChange={(e) =>
                            setRealePostboilLitri(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-amber-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Target ricetta: {targetLitri} L</span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          OG Reale Finale (°Plato)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={realeOgPlato}
                          onChange={(e) =>
                            setRealeOgPlato(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-amber-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Target ricetta: {targetPlato} °P</span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Temp. Trasferimento (°C)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={realeTempRaffreddamento}
                          onChange={(e) =>
                            setRealeTempRaffreddamento(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Inoculo: ~19 °C</span>
                      </div>

                      <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                        <label className="text-[11px] font-bold text-stone-500 block">
                          Contalitri Finale Cantina
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={realeContFine}
                          onChange={(e) =>
                            setRealeContFine(e.target.value === '' ? '' : parseFloat(e.target.value))
                          }
                          className="w-full text-base font-extrabold text-stone-900 bg-transparent focus:outline-hidden mt-1"
                        />
                        <span className="text-[10px] text-stone-400">Iniziale: {realeContInizio}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Checkbox Controlli Evidenti e Grandi per Touch */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Check-list Operazioni di Fase (Tocca per spuntare):
                  </h4>

                  <div className="space-y-2">
                    {currentStep.controlli.map((ctrl, i) => {
                      const controlKey = `${currentStep.id}_${ctrl}`;
                      const isChecked = !!controlliCompletati[controlKey];

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleToggleControllo(controlKey)}
                          className={`w-full min-h-[50px] p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition active:scale-[0.99] ${
                            isChecked
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-semibold shadow-xs'
                              : 'bg-stone-50/70 border-stone-200 text-stone-700 hover:bg-stone-100/70'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition ${
                                isChecked
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-stone-300 text-transparent'
                              }`}
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                            <span className="text-xs sm:text-sm leading-snug">{ctrl}</span>
                          </div>

                          {isChecked && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                              FATTO
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Navigazione Fasi (Precedente / Successiva) */}
                <div className="flex items-center justify-between pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    disabled={stepAttivoIdx === 0}
                    onClick={() => setStepAttivoIdx((prev) => Math.max(0, prev - 1))}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 transition active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Fase Precedente</span>
                  </button>

                  {stepAttivoIdx < STEPS_CONFIG.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setStepAttivoIdx((prev) => Math.min(STEPS_CONFIG.length - 1, prev + 1))
                      }
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                    >
                      <span>Fase Successiva</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStepAttivoIdx(6)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                    >
                      <span>Visualizza Scostamenti Finali</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SEZIONE 3: RILEVAZIONE SCOSTAMENTI (PREVISTI VS REALI) & SUGGERIMENTI */}
          {/* ========================================================================= */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg">
                  ⚖️
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base sm:text-lg">
                    Rilevazione Scostamenti (Previsti in Ricetta vs Reali in Cantina)
                  </h3>
                  <p className="text-xs text-stone-500">
                    Confronto automatico di volume, Plato ed efficienza reale dell&apos;impianto con suggerimenti di calibrazione.
                  </p>
                </div>
              </div>

              {/* Bottoni Salvataggio & Riversamento nel Registro Ufficiale */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSalvaSessioneLog}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Log Cotta</span>
                </button>

                <button
                  type="button"
                  onClick={handleRiversaInCotteUfficiale}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-900/20 active:scale-95"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Riversa in Registro Cotte & Scarica Magazzino</span>
                </button>
              </div>
            </div>

            {/* Griglia KPI Scostamenti con Badge & Delta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* 1. Volume Mosto Finale */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Volume Finale Mosto
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-stone-900">
                    {realePostboilLitri || targetLitri} L
                  </span>
                  <span className="text-xs text-stone-500">prev. {targetLitri} L</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                  {scostamenti.diffLitri >= 0 ? (
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{scostamenti.diffLitri.toFixed(1)} L (+{scostamenti.diffLitriPerc.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {scostamenti.diffLitri.toFixed(1)} L ({scostamenti.diffLitriPerc.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Grado Plato / OG */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Densità / Grado Plato
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-stone-900">
                    {realeOgPlato || targetPlato} °P
                  </span>
                  <span className="text-xs text-stone-500">prev. {targetPlato} °P</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                  {scostamenti.diffPlato >= 0 ? (
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{scostamenti.diffPlato.toFixed(1)} °P (+{scostamenti.diffPlatoPerc.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {scostamenti.diffPlato.toFixed(1)} °P ({scostamenti.diffPlatoPerc.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Efficienza Reale Impianto */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Efficienza Reale Impianto
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-amber-950">
                    {scostamenti.effReale.toFixed(1)}%
                  </span>
                  <span className="text-xs text-stone-500">teorica {scostamenti.effTeorica}%</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                  {scostamenti.diffEff >= 0 ? (
                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      +{scostamenti.diffEff.toFixed(1)}% estrazione ottimale
                    </span>
                  ) : (
                    <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {scostamenti.diffEff.toFixed(1)}% rispetto al teorico
                    </span>
                  )}
                </div>
              </div>

              {/* 4. Evaporazione Oraria Boil */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Evaporazione Caldaia Boil
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-stone-900">
                    {scostamenti.evapOrariaLitri.toFixed(0)} L/h
                  </span>
                  <span className="text-xs text-stone-500">~{scostamenti.evapPerc.toFixed(1)}%</span>
                </div>
                <div className="mt-2 text-xs font-medium text-stone-500">
                  Preboil: {realePreboilLitri || targetPreboilLitri} L
                </div>
              </div>
            </div>

            {/* Box Suggerimenti Intelligenti di Calibrazione per le Cotte Successive */}
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 rounded-2xl border border-amber-300/80 space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Suggerimento di Calibrazione Automatica per le Cotte Successive:</span>
              </div>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                {scostamenti.suggerimento}
              </p>
              <div className="pt-2 flex items-center gap-3 text-xs text-stone-600">
                <span>
                  🎯 Stile associato: <strong>{ricettaAttiva?.stile_birra}</strong>
                </span>
                <span>·</span>
                <span>
                  📦 Malto impiegato: <strong>{maltoKg} kg</strong>
                </span>
                <span>·</span>
                <span>
                  💧 Rapporto mash: <strong>{(targetPreboilLitri / maltoKg).toFixed(2)} L/kg</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: STORICO FOGLI DI LAVORO COTTA (BREW DAY LOGS ARCHIVIO) */}
      {/* ========================================================================= */}
      {modalitaVista === 'storico' && (
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-stone-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h3 className="font-black text-stone-900 text-base sm:text-lg">
                Archivio Storico dei Fogli di Lavoro Cotta (Brew Day Logs)
              </h3>
              <p className="text-xs text-stone-500">
                Tutte le sessioni registrate in sala cottura con misurazioni reali, scostamenti e annotazioni.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalitaVista('guidata')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start"
            >
              <Plus className="w-4 h-4" />
              <span>Nuova Sessione di Cotta</span>
            </button>
          </div>

          {brewDayLogs.length === 0 ? (
            <div className="text-center py-12 text-stone-400 space-y-3">
              <Flame className="w-12 h-12 mx-auto text-stone-300" />
              <p className="text-sm font-semibold">Nessun foglio di lavoro cotta archiviato finora.</p>
              <p className="text-xs">
                Avvia una sessione guidata e salva il log al termine della produzione.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {brewDayLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-stone-50 p-5 rounded-2xl border border-stone-200/80 hover:border-amber-400 transition space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-600 text-white font-bold flex items-center justify-center text-xs">
                        COTTA
                      </div>
                      <div>
                        <h4 className="font-extrabold text-stone-900 text-base">
                          {log.codice_cotta} · {log.nome_birra}
                        </h4>
                        <div className="text-xs text-stone-500 flex items-center gap-2">
                          <span>Data: {log.data}</span>
                          <span>·</span>
                          <span>Stile: {log.stile_birra}</span>
                          <span>·</span>
                          <span>Operatore: {log.operatore}</span>
                          <span>·</span>
                          <span>Tank: {log.tank_destinazione}</span>
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 self-start">
                      {log.stato}
                    </span>
                  </div>

                  {/* Metriche registrate */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">
                        Volume Effettivo
                      </span>
                      <span className="font-black text-stone-900 text-sm">
                        {log.reale_postboil_litri || log.target_litri_mosto} L
                      </span>
                      <span className="text-[10px] text-stone-500 block">
                        Target: {log.target_litri_mosto} L (Δ {log.scostamento_litri || 0} L)
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">
                        Plato / OG Effettiva
                      </span>
                      <span className="font-black text-stone-900 text-sm">
                        {log.reale_og_plato || log.target_plato} °P
                      </span>
                      <span className="text-[10px] text-stone-500 block">
                        Target: {log.target_plato} °P (Δ {log.scostamento_plato || 0} °P)
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">
                        Efficienza Reale Impianto
                      </span>
                      <span className="font-black text-amber-900 text-sm">
                        {log.efficienza_reale_perc || 78}%
                      </span>
                      <span className="text-[10px] text-stone-500 block">
                        Teorica: {log.efficienza_teorica_perc || 78}%
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-stone-200">
                      <span className="text-stone-400 text-[10px] uppercase font-bold block">
                        Contalitri Totale
                      </span>
                      <span className="font-black text-stone-900 text-sm">
                        {log.reale_contalitri_fine
                          ? `${log.reale_contalitri_inizio} → ${log.reale_contalitri_fine}`
                          : 'N/D'}
                      </span>
                      <span className="text-[10px] text-stone-500 block">
                        Evap. {log.evaporazione_oraria_litri || 35} L/h
                      </span>
                    </div>
                  </div>

                  {/* Suggerimento salvato */}
                  {log.suggerimento_calibrazione && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-stone-800">
                      <span className="font-bold text-amber-900 block mb-0.5">
                        💡 Suggerimento di Calibrazione Storico:
                      </span>
                      {log.suggerimento_calibrazione}
                    </div>
                  )}

                  {/* Annotazioni e note orarie */}
                  {(log.annotazioni_libere || (log.annotazioni_orarie && log.annotazioni_orarie.length > 0)) && (
                    <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-2">
                      <span className="font-bold text-stone-700 block">Diario & Annotazioni:</span>
                      {log.annotazioni_libere && (
                        <p className="text-stone-600 italic">{log.annotazioni_libere}</p>
                      )}
                      {log.annotazioni_orarie && log.annotazioni_orarie.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-stone-100">
                          {log.annotazioni_orarie.map((no) => (
                            <div key={no.id} className="flex items-center gap-2 text-[11px]">
                              <span className="font-mono font-bold text-amber-800 bg-amber-100 px-1 rounded">
                                {no.orario}
                              </span>
                              <span className="text-stone-700">{no.testo}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
