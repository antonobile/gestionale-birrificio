import React, { useState, useMemo, useRef } from 'react';
import { TracciamentoFusti, Cliente } from '../../types';
import {
  Truck,
  RotateCcw,
  Building2,
  Users,
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface TabFustiProps {
  fusti: TracciamentoFusti[];
  onAddMovimentoFusti: (mov: Omit<TracciamentoFusti, 'id'>) => void;
  onDeleteMovimentoFusti?: (id: number) => void;
  clienti: Cliente[];
  onAddCliente: (c: Omit<Cliente, 'id'>) => void;
  onAddClientiBulk?: (clientiList: Omit<Cliente, 'id'>[]) => void;
  onDeleteCliente: (id: number) => void;
}

export const TabFusti: React.FC<TabFustiProps> = ({
  fusti,
  onAddMovimentoFusti,
  onDeleteMovimentoFusti,
  clienti,
  onAddCliente,
  onAddClientiBulk,
  onDeleteCliente,
}) => {
  // Navigation tabs within Fusti module
  const [activeTab, setActiveTab] = useState<'movimenti' | 'monitoraggio' | 'anagrafica'>('movimenti');

  // Modal / drawer state for quick status popup
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [filtroPubMonitoraggio, setFiltroPubMonitoraggio] = useState('');

  // Form Consegna
  const [dataConsegna, setDataConsegna] = useState(new Date().toISOString().slice(0, 10));
  const [clienteSelezionatoConsegna, setClienteSelezionatoConsegna] = useState<string>(
    clienti.length > 0 ? clienti[0].ragione_sociale : 'Birroteca Centrale'
  );
  const [clienteCustomConsegna, setClienteCustomConsegna] = useState('');
  const [isCustomCliente, setIsCustomCliente] = useState(false);
  const [formatoFusto, setFormatoFusto] = useState('Fusto 24L');
  const [qtaConsegna, setQtaConsegna] = useState(2);
  const [lottoBirra, setLottoBirra] = useState('LOTTO-2601');
  const [cauzioneUnit, setCauzioneUnit] = useState(30.0);
  const [ddtRif, setDdtRif] = useState('DDT 12/2026');

  // Form Rientro
  const [dataRientro, setDataRientro] = useState(new Date().toISOString().slice(0, 10));
  const [pubRientro, setPubRientro] = useState('');
  const [formatoRientro, setFormatoRientro] = useState('Fusto 24L');
  const [qtaRientro, setQtaRientro] = useState(1);
  const [noteRientro, setNoteRientro] = useState('Ritiro furgone birrificio');

  // Anagrafica Clienti Form State
  const [showFormCliente, setShowFormCliente] = useState(false);
  const [nuovaRagioneSociale, setNuovaRagioneSociale] = useState('');
  const [nuovaPivaCf, setNuovaPivaCf] = useState('');
  const [nuovoIndirizzo, setNuovoIndirizzo] = useState('');
  const [nuovoTelefono, setNuovoTelefono] = useState('');
  const [nuovaEmail, setNuovaEmail] = useState('');
  const [nuovaPec, setNuovaPec] = useState('');
  const [nuovoCodiceSdi, setNuovoCodiceSdi] = useState('');
  const [nuoveNote, setNuoveNote] = useState('');

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Omit<Cliente, 'id'>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search in Anagrafica
  const [searchAnagrafica, setSearchAnagrafica] = useState('');

  // ----------------------------------------------------
  // COMPUTED: Keg balances per Customer/Pub
  // ----------------------------------------------------
  const pubStats = useMemo(() => {
    const stats: {
      [pub: string]: {
        fuori: number;
        cauzione: number;
        ultimoMov: string;
        formati: { [fmt: string]: number };
        lotti: Set<string>;
        movimentiCount: number;
      };
    } = {};

    for (const m of fusti) {
      if (!stats[m.cliente_pub]) {
        stats[m.cliente_pub] = {
          fuori: 0,
          cauzione: 0,
          ultimoMov: m.data,
          formati: {},
          lotti: new Set(),
          movimentiCount: 0,
        };
      }
      const s = stats[m.cliente_pub];
      s.movimentiCount += 1;

      if (!s.formati[m.formato_fusto]) {
        s.formati[m.formato_fusto] = 0;
      }

      if (m.tipo_movimento === 'USCITA_PUB') {
        s.fuori += m.quantita;
        s.cauzione += m.quantita * m.valore_cauzione_unitario;
        s.formati[m.formato_fusto] += m.quantita;
        if (m.lotto_birra && m.lotto_birra !== '-') {
          s.lotti.add(m.lotto_birra);
        }
      } else {
        s.fuori -= m.quantita;
        s.cauzione -= m.quantita * m.valore_cauzione_unitario;
        s.formati[m.formato_fusto] = Math.max(0, s.formati[m.formato_fusto] - m.quantita);
      }

      if (new Date(m.data) > new Date(s.ultimoMov)) {
        s.ultimoMov = m.data;
      }
    }
    return stats;
  }, [fusti]);

  const pubAttivi = useMemo(() => {
    return Object.entries(pubStats).filter(([_, s]) => s.fuori > 0);
  }, [pubStats]);

  const totFustiFuori = useMemo(() => {
    return pubAttivi.reduce((acc, [_, s]) => acc + s.fuori, 0);
  }, [pubAttivi]);

  const totCauzioniFuori = useMemo(() => {
    return pubAttivi.reduce((acc, [_, s]) => acc + Math.max(0, s.cauzione), 0);
  }, [pubAttivi]);

  // Set default pub for rientro if not set
  React.useEffect(() => {
    if (pubAttivi.length > 0 && (!pubRientro || !pubStats[pubRientro] || pubStats[pubRientro].fuori <= 0)) {
      setPubRientro(pubAttivi[0][0]);
    }
  }, [pubAttivi, pubRientro, pubStats]);

  // Handler for Registra Consegna
  const handleConsegna = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCliente = isCustomCliente
      ? clienteCustomConsegna.trim()
      : clienteSelezionatoConsegna.trim();

    if (!finalCliente || qtaConsegna <= 0) return;

    onAddMovimentoFusti({
      tipo_movimento: 'USCITA_PUB',
      data: dataConsegna,
      cliente_pub: finalCliente,
      formato_fusto: formatoFusto,
      quantita: qtaConsegna,
      lotto_birra: lottoBirra,
      valore_cauzione_unitario: cauzioneUnit,
      ddt_riferimento: ddtRif,
    });

    // Se cliente custom, aggiungi automaticamente in anagrafica
    if (isCustomCliente && !clienti.some((c) => c.ragione_sociale.toLowerCase() === finalCliente.toLowerCase())) {
      onAddCliente({
        ragione_sociale: finalCliente,
        piva_cf: '',
        indirizzo: '',
        telefono: '',
        email: '',
        codice_sdi: '0000000',
        note: 'Creato automaticamente da consegna fusti',
      });
      setIsCustomCliente(false);
      setClienteCustomConsegna('');
      setClienteSelezionatoConsegna(finalCliente);
    }

    setQtaConsegna(1);
  };

  // Handler for Registra Rientro
  const handleRientro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubRientro.trim() || qtaRientro <= 0) return;

    onAddMovimentoFusti({
      tipo_movimento: 'RIENTRO_VUOTO',
      data: dataRientro,
      cliente_pub: pubRientro.trim(),
      formato_fusto: formatoRientro,
      quantita: qtaRientro,
      valore_cauzione_unitario: cauzioneUnit,
      note: noteRientro,
    });

    setQtaRientro(1);
  };

  // Quick action: pre-fill rientro from monitoraggio
  const avviaRientroPerPub = (nomePub: string, formato?: string) => {
    setPubRientro(nomePub);
    if (formato) setFormatoRientro(formato);
    setActiveTab('movimenti');
    setShowStatusModal(false);
  };

  // Handler for Adding New Client Manually
  const handleSalvaCliente = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuovaRagioneSociale.trim()) return;

    onAddCliente({
      ragione_sociale: nuovaRagioneSociale.trim(),
      piva_cf: nuovaPivaCf.trim(),
      indirizzo: nuovoIndirizzo.trim(),
      telefono: nuovoTelefono.trim(),
      email: nuovaEmail.trim(),
      pec: nuovaPec.trim() || undefined,
      codice_sdi: nuovoCodiceSdi.trim().toUpperCase() || '0000000',
      note: nuoveNote.trim() || undefined,
    });

    setNuovaRagioneSociale('');
    setNuovaPivaCf('');
    setNuovoIndirizzo('');
    setNuovoTelefono('');
    setNuovaEmail('');
    setNuovaPec('');
    setNuovoCodiceSdi('');
    setNuoveNote('');
    setShowFormCliente(false);
  };

  // CSV Template Download
  const scaricaTemplateCsv = () => {
    const csvContent =
      'Ragione Sociale;P.IVA / CF;Indirizzo;Telefono;Email;PEC;Codice SDI;Note\n' +
      'Birroteca Centrale Srl;01928374651;Corso Vittorio Emanuele 45, Bari;+39 080 5214890;info@birrotecacentrale.it;birroteca@pec.it;M5UXCR1;Consegna il martedi\n' +
      'The Celtic Tavern Pub;08273645192;Via Roma 12, Altamura;+39 080 3119842;pub@celtictavern.it;celtic@pec.it;K8RN42P;Fusti 20L e 24L\n' +
      'Luppolo Station Craft;09845120581;Via Magazzini Generali 4, Roma;+39 06 5730219;info@luppolostation.it;luppolo@legalmail.it;SUBM70N;Spillatura 12 vie\n';

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modello_importazione_clienti_brewdesk.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV / Text File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setImportError('Il file caricato è vuoto.');
        return;
      }

      try {
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setImportError('Il file deve contenere almeno una riga di intestazione e una riga di dati.');
          return;
        }

        // Determine separator: comma or semicolon
        const firstLine = lines[0];
        const separator = firstLine.includes(';') ? ';' : ',';

        const headers = lines[0]
          .split(separator)
          .map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

        // Find index mappings
        const idxRagione = headers.findIndex((h) =>
          h.includes('ragione') || h.includes('nome') || h.includes('denominazione') || h.includes('cliente')
        );
        const idxPiva = headers.findIndex((h) =>
          h.includes('piva') || h.includes('iva') || h.includes('partita') || h.includes('cf') || h.includes('fiscale')
        );
        const idxIndirizzo = headers.findIndex((h) =>
          h.includes('indirizzo') || h.includes('sede') || h.includes('via') || h.includes('citta')
        );
        const idxTelefono = headers.findIndex((h) =>
          h.includes('tel') || h.includes('telefono') || h.includes('cell') || h.includes('mobile')
        );
        const idxEmail = headers.findIndex((h) =>
          (h.includes('email') || h.includes('mail')) && !h.includes('pec')
        );
        const idxPec = headers.findIndex((h) => h.includes('pec'));
        const idxSdi = headers.findIndex((h) =>
          h.includes('sdi') || h.includes('destinatario') || h.includes('codice')
        );
        const idxNote = headers.findIndex((h) => h.includes('note') || h.includes('descrizione'));

        const parsedList: Omit<Cliente, 'id'>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const rawCols = lines[i].split(separator).map((c) => c.replace(/^["']|["']$/g, '').trim());
          if (rawCols.length === 0 || !rawCols.some((c) => c.length > 0)) continue;

          const ragione =
            idxRagione !== -1 && rawCols[idxRagione]
              ? rawCols[idxRagione]
              : rawCols[0] || `Cliente ${i}`;

          if (!ragione.trim()) continue;

          parsedList.push({
            ragione_sociale: ragione.trim(),
            piva_cf: idxPiva !== -1 && rawCols[idxPiva] ? rawCols[idxPiva].trim() : '',
            indirizzo: idxIndirizzo !== -1 && rawCols[idxIndirizzo] ? rawCols[idxIndirizzo].trim() : '',
            telefono: idxTelefono !== -1 && rawCols[idxTelefono] ? rawCols[idxTelefono].trim() : '',
            email: idxEmail !== -1 && rawCols[idxEmail] ? rawCols[idxEmail].trim() : '',
            pec: idxPec !== -1 && rawCols[idxPec] ? rawCols[idxPec].trim() : undefined,
            codice_sdi:
              idxSdi !== -1 && rawCols[idxSdi] ? rawCols[idxSdi].trim().toUpperCase() : '0000000',
            note: idxNote !== -1 && rawCols[idxNote] ? rawCols[idxNote].trim() : undefined,
          });
        }

        if (parsedList.length === 0) {
          setImportError('Nessun cliente valido trovato nel file. Verifica il formato delle colonne.');
          return;
        }

        setImportRows(parsedList);
      } catch (err) {
        setImportError(`Errore durante l'elaborazione del file: ${String(err)}`);
      }
    };

    reader.readAsText(file);
  };

  // Confirm Import
  const confermaImportazione = () => {
    if (importRows.length === 0) return;

    if (onAddClientiBulk) {
      onAddClientiBulk(importRows);
    } else {
      importRows.forEach((c) => onAddCliente(c));
    }

    setImportSuccess(`Importati con successo ${importRows.length} clienti nell'anagrafica.`);
    setImportRows([]);
    setTimeout(() => {
      setShowImportModal(false);
      setImportSuccess('');
      setActiveTab('anagrafica');
    }, 1200);
  };

  // Export Clients to CSV
  const esportaClientiCsv = () => {
    if (clienti.length === 0) return;
    const header = 'ID;Ragione Sociale;P.IVA / CF;Indirizzo;Telefono;Email;PEC;Codice SDI;Note\n';
    const rows = clienti
      .map(
        (c) =>
          `"${c.id}";"${c.ragione_sociale}";"${c.piva_cf}";"${c.indirizzo}";"${c.telefono}";"${c.email}";"${c.pec || ''}";"${c.codice_sdi || '0000000'}";"${c.note || ''}"`
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anagrafica_clienti_brewdesk_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtered Clients for directory view
  const clientiFiltrati = useMemo(() => {
    if (!searchAnagrafica.trim()) return clienti;
    const q = searchAnagrafica.toLowerCase();
    return clienti.filter(
      (c) =>
        c.ragione_sociale.toLowerCase().includes(q) ||
        (c.piva_cf && c.piva_cf.toLowerCase().includes(q)) ||
        (c.indirizzo && c.indirizzo.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.telefono && c.telefono.toLowerCase().includes(q))
    );
  }, [clienti, searchAnagrafica]);

  // Clients with kegs list for monitoraggio view
  const monitoraggioPubList = useMemo(() => {
    return pubAttivi.filter(([pub]) => {
      if (!filtroPubMonitoraggio.trim()) return true;
      return pub.toLowerCase().includes(filtroPubMonitoraggio.toLowerCase());
    });
  }, [pubAttivi, filtroPubMonitoraggio]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Sub-Tabs Switcher */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-700">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                  Gestione Fusti nei Pub, Cauzioni & Anagrafica Clienti
                </h2>
                <p className="text-xs text-stone-500">
                  Tracciamento fusti in affido, cauzioni aperte con i locali e database anagrafico clienti
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Button to Monitor Keg Status & Locations */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setShowStatusModal(true);
                setActiveTab('monitoraggio');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/20 hover:from-blue-700 hover:to-indigo-700 transition"
              title="Monitora lo stato dei fusti e visualizza dove si trovano"
            >
              <Eye className="w-4 h-4" />
              <span>Monitora Stato Fusti & Ubicazione</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-mono text-[11px] font-black">
                {totFustiFuori} fusti
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowImportModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition"
            >
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              <span>Importa Clienti (CSV/Excel)</span>
            </button>
          </div>
        </div>

        {/* 3 Main View Tabs */}
        <div className="flex flex-wrap border-b border-stone-200 pt-1">
          <button
            onClick={() => setActiveTab('movimenti')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'movimenti'
                ? 'border-amber-600 text-amber-900 bg-amber-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Movimentazione Fusti & Cauzioni</span>
          </button>

          <button
            onClick={() => setActiveTab('monitoraggio')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'monitoraggio'
                ? 'border-blue-600 text-blue-900 bg-blue-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Eye className="w-4 h-4 text-blue-600" />
            <span>Monitoraggio Stato Fusti ({pubAttivi.length} Pub con Fusti)</span>
          </button>

          <button
            onClick={() => setActiveTab('anagrafica')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'anagrafica'
                ? 'border-emerald-600 text-emerald-900 bg-emerald-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Anagrafica Clienti ({clienti.length} Registrati)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MOVIMENTAZIONE FUSTI & CAUZIONI                                     */}
      {/* ========================================================================= */}
      {activeTab === 'movimenti' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Form Consegna Fusti */}
            <form
              onSubmit={handleConsegna}
              className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <h3 className="font-bold text-stone-900 text-sm">🚚 Registra Consegna Fusti al Pub</h3>
                </div>
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  Uscita birrificio
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Data Consegna *</label>
                  <input
                    type="date"
                    value={dataConsegna}
                    onChange={(e) => setDataConsegna(e.target.value)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-stone-700">Cliente / Pub Destinatario *</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCliente(!isCustomCliente)}
                      className="text-[10px] text-amber-700 hover:underline font-bold"
                    >
                      {isCustomCliente ? '← Seleziona da Anagrafica' : '+ Inserisci Altro'}
                    </button>
                  </div>

                  {isCustomCliente ? (
                    <input
                      type="text"
                      value={clienteCustomConsegna}
                      onChange={(e) => setClienteCustomConsegna(e.target.value)}
                      placeholder="es. Bar Sport di Rossi"
                      className="w-full text-xs p-2 bg-stone-50 border border-amber-300 rounded-lg font-bold"
                      required
                    />
                  ) : (
                    <select
                      value={clienteSelezionatoConsegna}
                      onChange={(e) => setClienteSelezionatoConsegna(e.target.value)}
                      className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                    >
                      {clienti.map((c) => (
                        <option key={c.id} value={c.ragione_sociale}>
                          {c.ragione_sociale} {c.indirizzo ? `(${c.indirizzo.slice(0, 25)}...)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Formato Fusto</label>
                  <select
                    value={formatoFusto}
                    onChange={(e) => setFormatoFusto(e.target.value)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-semibold"
                  >
                    <option value="Fusto 20L">Fusto 20L</option>
                    <option value="Fusto 24L">Fusto 24L</option>
                    <option value="Fusto 25L">Fusto 25L</option>
                    <option value="Fusto 30L">Fusto 30L</option>
                    <option value="Fusto 12L">Fusto 12L</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Quantità (pz) *</label>
                  <input
                    type="number"
                    min="1"
                    value={qtaConsegna}
                    onChange={(e) => setQtaConsegna(parseInt(e.target.value) || 1)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Cauzione (€/pz)</label>
                  <input
                    type="number"
                    step="5"
                    value={cauzioneUnit}
                    onChange={(e) => setCauzioneUnit(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Lotto Birra</label>
                  <input
                    type="text"
                    value={lottoBirra}
                    onChange={(e) => setLottoBirra(e.target.value)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">N° DDT / Bolla Accompagnamento</label>
                  <input
                    type="text"
                    value={ddtRif}
                    onChange={(e) => setDdtRif(e.target.value)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold p-2.5 rounded-lg text-xs transition shadow-xs"
              >
                Registra Consegna al Locale
              </button>
            </form>

            {/* Form Rientro Fusti */}
            <form
              onSubmit={handleRientro}
              className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-stone-900 text-sm">🔄 Registra Rientro Fusti Vuoti dal Pub</h3>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Rientro e scarico cauzione
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Data Rientro *</label>
                  <input
                    type="date"
                    value={dataRientro}
                    onChange={(e) => setDataRientro(e.target.value)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Pub che Restituisce i Vuoti *</label>
                  {pubAttivi.length > 0 ? (
                    <select
                      value={pubRientro}
                      onChange={(e) => setPubRientro(e.target.value)}
                      className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                    >
                      {pubAttivi.map(([p, s]) => (
                        <option key={p} value={p}>
                          {p} ({s.fuori} fusti fuori)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={pubRientro}
                      onChange={(e) => setPubRientro(e.target.value)}
                      className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                      placeholder="Nome Pub"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Formato Fusto Rientrato</label>
                  <select
                    value={formatoRientro}
                    onChange={(e) => setFormatoRientro(e.target.value)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  >
                    <option value="Fusto 20L">Fusto 20L</option>
                    <option value="Fusto 24L">Fusto 24L</option>
                    <option value="Fusto 25L">Fusto 25L</option>
                    <option value="Fusto 30L">Fusto 30L</option>
                    <option value="Fusto 12L">Fusto 12L</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Numero Fusti Vuoti (pz)</label>
                  <input
                    type="number"
                    min="1"
                    value={qtaRientro}
                    onChange={(e) => setQtaRientro(parseInt(e.target.value) || 1)}
                    className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Note Ritiro / Mezzo</label>
                <input
                  type="text"
                  value={noteRientro}
                  onChange={(e) => setNoteRientro(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  placeholder="es. Ritiro furgone aziendale / reso cliente"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold p-2.5 rounded-lg text-xs transition shadow-xs"
              >
                Scarica Fusti dal Pub e Reintegra Vuoti
              </button>
            </form>
          </div>

          {/* Quick Keg Balance Summary Table */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-stone-900 text-sm">📊 Situazione Sintetica Fusti nei Pub</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('monitoraggio')}
                  className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1"
                >
                  <span>Apri Schede Dettagliate Ubicazione</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {pubAttivi.length === 0 ? (
              <div className="text-xs text-stone-400 italic py-5 text-center bg-stone-50 rounded-xl">
                Tutti i fusti sono rientrati in magazzino. Nessun debito di cauzione aperto con i locali.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                      <th className="p-2.5 font-bold">Locale / Pub</th>
                      <th className="p-2.5 font-bold text-right">Fusti Fuori (pz)</th>
                      <th className="p-2.5 font-bold text-right">Valore Cauzioni Trattenute (€)</th>
                      <th className="p-2.5 font-bold text-right">Ultimo Movimento</th>
                      <th className="p-2.5 font-bold text-center">Azione Rapida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {pubAttivi.map(([pub, s]) => (
                      <tr key={pub} className="hover:bg-amber-50/30">
                        <td className="p-2.5 font-bold text-stone-900">{pub}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-800">{s.fuori} fusti</td>
                        <td className="p-2.5 text-right font-mono font-bold text-stone-800">
                          € {s.cauzione.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-stone-500">{s.ultimoMov}</td>
                        <td className="p-2.5 text-center">
                          <button
                            onClick={() => avviaRientroPerPub(pub)}
                            className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                          >
                            Registra Rientro
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Log Storico Movimenti */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <h3 className="font-bold text-stone-900 text-sm">📋 Storico Movimentazioni Fusti</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                    <th className="p-2 font-bold">Data</th>
                    <th className="p-2 font-bold">Tipo Movimento</th>
                    <th className="p-2 font-bold">Locale / Pub</th>
                    <th className="p-2 font-bold">Formato</th>
                    <th className="p-2 font-bold text-right">Quantità</th>
                    <th className="p-2 font-bold">Lotto</th>
                    <th className="p-2 font-bold text-right">Cauzione (€)</th>
                    <th className="p-2 font-bold">Riferimento</th>
                    {onDeleteMovimentoFusti && <th className="p-2 font-bold text-center">Azioni</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {fusti.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2 font-mono text-stone-500">{m.data}</td>
                      <td className="p-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.tipo_movimento === 'USCITA_PUB'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {m.tipo_movimento === 'USCITA_PUB' ? 'USCITA AL PUB' : 'RIENTRO VUOTO'}
                        </span>
                      </td>
                      <td className="p-2 font-medium text-stone-800">{m.cliente_pub}</td>
                      <td className="p-2 text-stone-600">{m.formato_fusto}</td>
                      <td className="p-2 text-right font-mono font-bold">{m.quantita}</td>
                      <td className="p-2 font-mono text-stone-500">{m.lotto_birra || '-'}</td>
                      <td className="p-2 text-right font-mono">
                        € {(m.quantita * m.valore_cauzione_unitario).toFixed(2)}
                      </td>
                      <td className="p-2 text-stone-500 text-[11px]">{m.ddt_riferimento || m.note || '-'}</td>
                      {onDeleteMovimentoFusti && (
                        <td className="p-2 text-center">
                          <button
                            onClick={() => onDeleteMovimentoFusti(m.id)}
                            className="text-stone-400 hover:text-rose-600 p-1"
                            title="Elimina movimento fusto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONITORAGGIO STATO FUSTI & DOVE SI TROVANO                          */}
      {/* ========================================================================= */}
      {activeTab === 'monitoraggio' && (
        <div className="space-y-6">
          {/* Status Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4.5 rounded-2xl border border-blue-200 shadow-xs">
              <div className="flex items-center justify-between text-blue-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Fusti Fuori Sede</span>
                <Truck className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black font-mono text-blue-900">{totFustiFuori}</div>
              <p className="text-xs text-blue-700 mt-1">Fusti totali affidati ai clienti</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between text-amber-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Cauzioni in Sospeso</span>
                <Coins className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black font-mono text-amber-900">
                € {totCauzioniFuori.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-amber-700 mt-1">Valore cauzionale a credito</p>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider">Pub con Fusti</span>
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black font-mono text-emerald-900">{pubAttivi.length}</div>
              <p className="text-xs text-emerald-700 mt-1">Locali partner con vuoti da restituire</p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={filtroPubMonitoraggio}
                onChange={(e) => setFiltroPubMonitoraggio(e.target.value)}
                placeholder="Cerca per nome pub, città o lotto..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
            <span className="text-xs text-stone-500 font-medium">
              Mostrati {monitoraggioPubList.length} di {pubAttivi.length} pub con fusti
            </span>
          </div>

          {/* Detailed Cards for Every Pub holding Kegs */}
          {monitoraggioPubList.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-stone-800 text-sm">Nessun fusto fuori sede trovato</h4>
              <p className="text-xs text-stone-500">
                Tutti i fusti risultano rientrati o nessun locale corrisponde ai criteri di ricerca.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monitoraggioPubList.map(([pubNome, stats]) => {
                const clienteInfo = clienti.find(
                  (c) => c.ragione_sociale.toLowerCase() === pubNome.toLowerCase()
                );

                return (
                  <div
                    key={pubNome}
                    className="bg-white rounded-2xl border-2 border-stone-200 hover:border-amber-400 transition p-5 shadow-xs space-y-4"
                  >
                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                          <h4 className="font-black text-stone-900 text-base">{pubNome}</h4>
                        </div>
                        {clienteInfo?.indirizzo && (
                          <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{clienteInfo.indirizzo}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-black font-mono bg-blue-100 text-blue-900">
                          {stats.fuori} FUSTI
                        </span>
                        <div className="text-[11px] font-bold text-stone-500 mt-0.5">
                          Cauzione: € {stats.cauzione.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown by Format */}
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                        Formati Attualmente in Carico:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.formati)
                          .filter(([_, q]) => q > 0)
                          .map(([fmt, q]) => (
                            <span
                              key={fmt}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 text-xs font-bold text-stone-800"
                            >
                              {fmt}: <span className="text-amber-800 font-mono">{q} pz</span>
                            </span>
                          ))}
                      </div>
                    </div>

                    {/* Beer Lots Delivered */}
                    {stats.lotti.size > 0 && (
                      <div className="text-xs text-stone-600 flex items-center gap-2">
                        <span className="font-bold text-stone-500 text-[11px]">Lotti Birra in Affido:</span>
                        <span className="font-mono bg-amber-50 text-amber-900 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                          {Array.from(stats.lotti).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Contact & Timeline Details */}
                    <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between text-xs text-stone-500 gap-2">
                      <div className="flex items-center gap-3">
                        {clienteInfo?.telefono && (
                          <a
                            href={`tel:${clienteInfo.telefono}`}
                            className="flex items-center gap-1 text-blue-700 hover:underline font-medium"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{clienteInfo.telefono}</span>
                          </a>
                        )}
                        {clienteInfo?.email && (
                          <a
                            href={`mailto:${clienteInfo.email}`}
                            className="flex items-center gap-1 text-stone-600 hover:underline"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Email</span>
                          </a>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-stone-400">
                        <Clock className="w-3 h-3" />
                        <span>Ultimo mov: {stats.ultimoMov}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => avviaRientroPerPub(pubNome)}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Registra Rientro Rapido per {pubNome}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ANAGRAFICA CLIENTI                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'anagrafica' && (
        <div className="space-y-6">
          {/* Header Actions for Anagrafica */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-700">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-base">Registro Anagrafica Clienti & Locali</h3>
                <p className="text-xs text-stone-500">
                  Dati fiscali completi, contatti, PEC e Codice Destinatario SDI
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFormCliente(!showFormCliente)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showFormCliente ? 'Chiudi Modulo' : '+ Nuovo Cliente Manuale'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition"
              >
                <Upload className="w-3.5 h-3.5 text-amber-600" />
                <span>Importa CSV / Excel</span>
              </button>

              <button
                type="button"
                onClick={esportaClientiCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition"
                title="Esporta tutta l'anagrafica in formato CSV compatibile Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Esporta CSV</span>
              </button>
            </div>
          </div>

          {/* Form Nuovo Cliente Manuale */}
          {showFormCliente && (
            <form
              onSubmit={handleSalvaCliente}
              className="bg-white p-5 rounded-2xl border-2 border-emerald-500/40 shadow-md space-y-4 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>Inserimento Dati Anagrafici Completi</span>
                </h4>
                <span className="text-[11px] text-stone-500">* Campi obbligatori</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Ragione Sociale / Denominazione *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuovaRagioneSociale}
                    onChange={(e) => setNuovaRagioneSociale(e.target.value)}
                    placeholder="es. Birroteca Centrale Srl"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Partita IVA / Codice Fiscale *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuovaPivaCf}
                    onChange={(e) => setNuovaPivaCf(e.target.value)}
                    placeholder="es. 01928374651"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono font-semibold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Indirizzo Sede (Via, N°, CAP, Città, Prov.) *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuovoIndirizzo}
                    onChange={(e) => setNuovoIndirizzo(e.target.value)}
                    placeholder="es. Corso Vittorio Emanuele 45, 70122 Bari (BA)"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Telefono / Cellulare *</label>
                  <input
                    type="text"
                    required
                    value={nuovoTelefono}
                    onChange={(e) => setNuovoTelefono(e.target.value)}
                    placeholder="es. +39 080 5214890"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Email Ordinaria *</label>
                  <input
                    type="email"
                    required
                    value={nuovaEmail}
                    onChange={(e) => setNuovaEmail(e.target.value)}
                    placeholder="es. info@birrotecacentrale.it"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">PEC (Posta Certificata)</label>
                  <input
                    type="email"
                    value={nuovaPec}
                    onChange={(e) => setNuovaPec(e.target.value)}
                    placeholder="es. birroteca@pec.it"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Codice Destinatario SDI (7 caratteri)
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    value={nuovoCodiceSdi}
                    onChange={(e) => setNuovoCodiceSdi(e.target.value.toUpperCase())}
                    placeholder="es. M5UXCR1 (oppure 0000000)"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Note / Giorni di Consegna / Referente
                  </label>
                  <input
                    type="text"
                    value={nuoveNote}
                    onChange={(e) => setNuoveNote(e.target.value)}
                    placeholder="es. Consegne preferibili al martedì mattina ore 10:00"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFormCliente(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-xs"
                >
                  Salva Cliente in Anagrafica
                </button>
              </div>
            </form>
          )}

          {/* Search Bar for Clients */}
          <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs flex items-center gap-3">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              type="text"
              value={searchAnagrafica}
              onChange={(e) => setSearchAnagrafica(e.target.value)}
              placeholder="Cerca cliente per ragione sociale, P.IVA, indirizzo, telefono o email..."
              className="w-full text-xs bg-transparent border-none outline-hidden"
            />
            {searchAnagrafica && (
              <button
                onClick={() => setSearchAnagrafica('')}
                className="text-xs text-stone-400 hover:text-stone-700 px-2"
              >
                Pulisci
              </button>
            )}
          </div>

          {/* Client Table / Cards */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                    <th className="p-3 font-bold">Ragione Sociale</th>
                    <th className="p-3 font-bold">P.IVA / CF</th>
                    <th className="p-3 font-bold">Indirizzo</th>
                    <th className="p-3 font-bold">Contatti</th>
                    <th className="p-3 font-bold">SDI / PEC</th>
                    <th className="p-3 font-bold text-center">Fusti in Affido</th>
                    <th className="p-3 font-bold text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {clientiFiltrati.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-stone-400 italic">
                        Nessun cliente trovato corrispondente ai criteri.
                      </td>
                    </tr>
                  ) : (
                    clientiFiltrati.map((c) => {
                      const fustiInCarico = pubStats[c.ragione_sociale]?.fuori || 0;
                      return (
                        <tr key={c.id} className="hover:bg-amber-50/20">
                          <td className="p-3">
                            <div className="font-bold text-stone-900">{c.ragione_sociale}</div>
                            {c.note && <div className="text-[11px] text-stone-500 italic mt-0.5">{c.note}</div>}
                          </td>
                          <td className="p-3 font-mono font-semibold text-stone-700">{c.piva_cf || '-'}</td>
                          <td className="p-3 text-stone-600">{c.indirizzo || '-'}</td>
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              {c.telefono && (
                                <span className="text-stone-700 font-mono text-[11px]">{c.telefono}</span>
                              )}
                              {c.email && (
                                <a
                                  href={`mailto:${c.email}`}
                                  className="text-blue-600 hover:underline text-[11px]"
                                >
                                  {c.email}
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-bold text-stone-800 text-[11px]">
                                SDI: {c.codice_sdi || '0000000'}
                              </span>
                              {c.pec && <span className="text-stone-500 text-[10px] font-mono">{c.pec}</span>}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {fustiInCarico > 0 ? (
                              <button
                                onClick={() => {
                                  setFiltroPubMonitoraggio(c.ragione_sociale);
                                  setActiveTab('monitoraggio');
                                }}
                                className="px-2.5 py-1 rounded-full text-[11px] font-black font-mono bg-blue-100 text-blue-900 hover:bg-blue-200 transition"
                                title="Visualizza dettagli fusti in affido"
                              >
                                {fustiInCarico} FUSTI
                              </button>
                            ) : (
                              <span className="text-stone-400 text-[11px]">0 fusti</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => onDeleteCliente(c.id)}
                              className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg transition"
                              title="Elimina cliente da anagrafica"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE IMPORTAZIONE CSV / EXCEL                                            */}
      {/* ========================================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-stone-900 text-base">
                  Importazione Anagrafica Clienti da CSV / Excel
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportRows([]);
                  setImportError('');
                  setImportSuccess('');
                }}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Carica un file <strong>.CSV</strong> o esportato da <strong>Excel</strong> contenente le colonne:{' '}
              <em>Ragione Sociale, P.IVA/CF, Indirizzo, Telefono, Email, PEC, Codice SDI, Note</em>.
            </p>

            {/* Template Download Box */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-amber-900 block">Hai bisogno del modello già formattato?</span>
                <span className="text-amber-700">Scarica il file modello pre-impostato con esempi.</span>
              </div>
              <button
                type="button"
                onClick={scaricaTemplateCsv}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica Modello CSV</span>
              </button>
            </div>

            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-2xl p-6 text-center cursor-pointer bg-stone-50 hover:bg-amber-50/30 transition space-y-2"
            >
              <Upload className="w-8 h-8 text-stone-400 mx-auto" />
              <div className="text-xs font-bold text-stone-800">
                {importFileName ? importFileName : 'Clicca o trascina qui il file .CSV'}
              </div>
              <div className="text-[11px] text-stone-500">Separatori supportati: virgola (,) o punto e virgola (;)</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{importError}</span>
              </div>
            )}

            {importSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{importSuccess}</span>
              </div>
            )}

            {/* Preview of Parsed Rows */}
            {importRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-800">
                    Anteprima Clienti Rilevati ({importRows.length} record pronti):
                  </span>
                  <span className="text-emerald-700 font-semibold font-mono">Pronto per inserimento</span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-xl">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-stone-100 text-stone-600 sticky top-0">
                      <tr>
                        <th className="p-2 font-bold">Ragione Sociale</th>
                        <th className="p-2 font-bold">P.IVA / CF</th>
                        <th className="p-2 font-bold">Città / Indirizzo</th>
                        <th className="p-2 font-bold">SDI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {importRows.map((r, i) => (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="p-2 font-bold text-stone-900">{r.ragione_sociale}</td>
                          <td className="p-2 font-mono">{r.piva_cf || '-'}</td>
                          <td className="p-2 truncate max-w-[150px]">{r.indirizzo || '-'}</td>
                          <td className="p-2 font-mono">{r.codice_sdi || '0000000'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportRows([]);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 transition"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={importRows.length === 0}
                onClick={confermaImportazione}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 transition shadow-xs"
              >
                Importa {importRows.length} Clienti in Anagrafica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
