import React, { useState, useMemo } from 'react';
import { BirraCondizionata, Cliente, Ricetta, AziendaConfig, TipoCliente } from '../../types';
import {
  ShoppingCart,
  Plus,
  TrendingUp,
  Award,
  Users,
  Building2,
  User,
  Beer,
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Percent,
  Layers,
  Sparkles,
} from 'lucide-react';
import { generateAnnualClientReportPdf, GeneratedPdfResult } from '../../utils/pdfGenerator';

interface TabVenditeProps {
  onAddScaricoVendita: (mov: Omit<BirraCondizionata, 'id'>) => void;
  clienti: Cliente[];
  vendite?: BirraCondizionata[];
  ricette?: Ricetta[];
  azienda?: AziendaConfig;
  initialSelectedCliente?: string;
  onNavigateToClienti?: () => void;
}

export const TabVendite: React.FC<TabVenditeProps> = ({
  onAddScaricoVendita,
  clienti = [],
  vendite = [],
  ricette = [],
  azienda,
  initialSelectedCliente,
  onNavigateToClienti,
}) => {
  // Navigation tabs within module: Registrazione vs Report Fine Anno
  const [activeTab, setActiveTab] = useState<'registrazione' | 'report_annuale'>('report_annuale');

  // Form State
  const [dataVendita, setDataVendita] = useState(new Date().toISOString().slice(0, 10));
  const [selectedClienteNome, setSelectedClienteNome] = useState<string>(
    initialSelectedCliente || (clienti.length > 0 ? clienti[0].ragione_sociale : 'Birroteca Centrale')
  );
  const [clienteCustom, setClienteCustom] = useState('');
  const [isCustomCliente, setIsCustomCliente] = useState(false);
  const [stileBirra, setStileBirra] = useState<string>(
    ricette.length > 0 ? ricette[0].nome_ricetta : 'Bionda Belga Speciale'
  );
  const [stileCustom, setStileCustom] = useState('');
  const [isCustomStile, setIsCustomStile] = useState(false);
  const [formato, setFormato] = useState('Fusto 24L');
  const [quantita, setQuantita] = useState(2);
  const [prezzoTotale, setPrezzoTotale] = useState<number>(240);
  const [riferimento, setRiferimento] = useState('Fatt. 28/2026');

  // Report Filters
  const currentYear = new Date().getFullYear();
  const [reportAnno, setReportAnno] = useState<number | 'ALL'>(currentYear);
  const [reportFiltroTipo, setReportFiltroTipo] = useState<'ALL' | 'B2B' | 'B2C'>('ALL');
  const [expandedClienteId, setExpandedClienteId] = useState<string | null>(null);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfModal, setPdfModal] = useState<GeneratedPdfResult | null>(null);

  const litriPerFormato: { [key: string]: number } = {
    'Fusto 20L': 20.0,
    'Fusto 24L': 24.0,
    'Fusto 25L': 25.0,
    'Fusto 30L': 30.0,
    'Fusto 12L': 12.0,
    'Bottiglia 0.33L': 0.33,
    'Bottiglia 0.75L': 0.75,
  };

  const litriTotali = (litriPerFormato[formato] || 24.0) * quantita;

  // Selected client object
  const currentClienteObj = useMemo(() => {
    return clienti.find((c) => c.ragione_sociale === selectedClienteNome);
  }, [clienti, selectedClienteNome]);

  // Handle submit sale
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalClienteNome = isCustomCliente ? clienteCustom.trim() : selectedClienteNome;
    if (!finalClienteNome || quantita <= 0) return;

    const matchedClient = clienti.find((c) => c.ragione_sociale === finalClienteNome);
    const tipoCliente: TipoCliente = matchedClient ? matchedClient.tipo_cliente || 'B2B' : 'B2B';
    const finalStile = isCustomStile ? stileCustom.trim() : stileBirra;

    onAddScaricoVendita({
      tipo: 'SCARICO',
      data: dataVendita,
      lotto: 'LOTTO-2601',
      formato,
      quantita,
      litri_totali: litriTotali,
      grado_plato: 13.5,
      ettogradi: Number(((litriTotali * 13.5) / 100).toFixed(2)),
      costo_produzione_litro: 1.15,
      documento_rif: `${riferimento} - ${finalClienteNome}`,
      cliente: finalClienteNome,
      tipo_cliente: tipoCliente,
      stile_birra: finalStile,
      prezzo_totale: Number(prezzoTotale) || 0,
    });

    // Reset inputs
    setQuantita(1);
    setPrezzoTotale(120);
    setActiveTab('report_annuale');
  };

  // --------------------------------------------------------------------------
  // ADVANCED ANNUAL REPORT COMPUTATIONS
  // --------------------------------------------------------------------------

  // Extract all sales records (tipo === 'SCARICO')
  const venditeList = useMemo(() => {
    return vendite.filter((v) => v.tipo === 'SCARICO');
  }, [vendite]);

  // Available years from sales data
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    venditeList.forEach((v) => {
      const y = new Date(v.data).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [venditeList, currentYear]);

  // Filtered sales according to selected year & client type
  const filteredSales = useMemo(() => {
    return venditeList.filter((v) => {
      // Filter year
      if (reportAnno !== 'ALL') {
        const y = new Date(v.data).getFullYear();
        if (y !== reportAnno) return false;
      }

      // Filter customer type
      if (reportFiltroTipo !== 'ALL') {
        // Try direct tipo_cliente or lookup in clienti
        let t = v.tipo_cliente;
        if (!t && v.cliente) {
          const c = clienti.find((cli) => cli.ragione_sociale === v.cliente);
          if (c) t = c.tipo_cliente;
        }
        if ((t || 'B2B') !== reportFiltroTipo) return false;
      }

      return true;
    });
  }, [venditeList, reportAnno, reportFiltroTipo, clienti]);

  // Aggregate stats: Totals
  const totalVolumeLitri = useMemo(() => {
    return filteredSales.reduce((acc, v) => acc + (v.litri_totali || 0), 0);
  }, [filteredSales]);

  const totalFatturatoEuro = useMemo(() => {
    return filteredSales.reduce((acc, v) => acc + (v.prezzo_totale || (v.litri_totali * 4.5)), 0);
  }, [filteredSales]);

  const totalOrdiniCount = filteredSales.length;

  // Aggregate stats per Client
  const clientRanking = useMemo(() => {
    const clientMap: {
      [nome: string]: {
        nome: string;
        tipo: TipoCliente;
        litri: number;
        ordini: number;
        fatturato: number;
        stiliMap: { [stile: string]: number };
        formatiMap: { [fmt: string]: number };
      };
    } = {};

    filteredSales.forEach((v) => {
      // Resolve client name
      let nome = v.cliente;
      if (!nome && v.documento_rif) {
        const parts = v.documento_rif.split(' - ');
        if (parts.length > 1) nome = parts.slice(1).join(' - ').trim();
      }
      if (!nome) nome = 'Cliente Diretto';

      // Resolve client type
      let tipo: TipoCliente = v.tipo_cliente || 'B2B';
      const foundClient = clienti.find((c) => c.ragione_sociale === nome);
      if (foundClient?.tipo_cliente) {
        tipo = foundClient.tipo_cliente;
      }

      // Resolve beer style
      const stile = v.stile_birra || 'Bionda Belga Speciale';

      if (!clientMap[nome]) {
        clientMap[nome] = {
          nome,
          tipo,
          litri: 0,
          ordini: 0,
          fatturato: 0,
          stiliMap: {},
          formatiMap: {},
        };
      }

      clientMap[nome].litri += v.litri_totali || 0;
      clientMap[nome].ordini += 1;
      clientMap[nome].fatturato += v.prezzo_totale || (v.litri_totali * 4.5);

      clientMap[nome].stiliMap[stile] = (clientMap[nome].stiliMap[stile] || 0) + (v.litri_totali || 0);
      clientMap[nome].formatiMap[v.formato] = (clientMap[nome].formatiMap[v.formato] || 0) + v.quantita;
    });

    // Sort by Volume (litri) descending
    const list = Object.values(clientMap).sort((a, b) => b.litri - a.litri);

    return list.map((c, index) => {
      const quotaPerc = totalVolumeLitri > 0 ? (c.litri / totalVolumeLitri) * 100 : 0;
      const stiliSorted = Object.entries(c.stiliMap)
        .map(([stile, litri]) => ({ stile, litri, quotaLocale: c.litri > 0 ? (litri / c.litri) * 100 : 0 }))
        .sort((a, b) => b.litri - a.litri);

      return {
        ...c,
        pos: index + 1,
        quotaPerc,
        stiliList: stiliSorted,
      };
    });
  }, [filteredSales, clienti, totalVolumeLitri]);

  // Aggregate stats per Beer Style (Overall)
  const styleRanking = useMemo(() => {
    const map: { [stile: string]: { stile: string; litri: number; ordini: number } } = {};

    filteredSales.forEach((v) => {
      const stile = v.stile_birra || 'Bionda Belga Speciale';
      if (!map[stile]) {
        map[stile] = { stile, litri: 0, ordini: 0 };
      }
      map[stile].litri += v.litri_totali || 0;
      map[stile].ordini += 1;
    });

    return Object.values(map)
      .map((s) => ({
        ...s,
        quotaPerc: totalVolumeLitri > 0 ? (s.litri / totalVolumeLitri) * 100 : 0,
      }))
      .sort((a, b) => b.litri - a.litri);
  }, [filteredSales, totalVolumeLitri]);

  // Export CSV Report
  const handleExportCsvReport = () => {
    const annoStr = reportAnno === 'ALL' ? 'Tutti_Anni' : String(reportAnno);
    const headers = [
      'Posizione',
      'Cliente / Pub',
      'Tipologia',
      'Litri Totali',
      'Quota % Volume',
      'Frequenza Ordini',
      'Fatturato Stimato EUR',
      'Dettaglio Stili Consumati',
    ];

    const rows = clientRanking.map((c) => [
      c.pos,
      `"${c.nome.replace(/"/g, '""')}"`,
      c.tipo === 'B2B' ? 'Locale/Pub (B2B)' : 'Privato (B2C)',
      c.litri.toFixed(1),
      `${c.quotaPerc.toFixed(1)}%`,
      c.ordini,
      c.fatturato.toFixed(2),
      `"${c.stiliList.map((s) => `${s.stile}: ${s.litri.toFixed(1)}L (${s.quotaLocale.toFixed(0)}%)`).join(' | ')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report_consumi_clienti_${annoStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export PDF Report
  const handleExportPdfReport = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      try {
        const annoNum = reportAnno === 'ALL' ? currentYear : reportAnno;
        const result = generateAnnualClientReportPdf({
          anno: annoNum,
          ragione_soc: azienda?.ragione_sociale || 'Birrificio Artigianale',
          piva_az: azienda?.piva || '01822710628',
          totaleLitri: totalVolumeLitri,
          totaleOrdini: totalOrdiniCount,
          totaleFatturato: totalFatturatoEuro,
          clientiClassifica: clientRanking.map((c) => ({
            pos: c.pos,
            nome: c.nome,
            tipo: c.tipo,
            litri: c.litri,
            quotaPerc: c.quotaPerc,
            ordini: c.ordini,
            fatturato: c.fatturato,
            stili: c.stiliList.map((s) => ({ stile: s.stile, litri: s.litri })),
          })),
          stiliGlobali: styleRanking.map((s) => ({
            stile: s.stile,
            litri: s.litri,
            quotaPerc: s.quotaPerc,
          })),
        });

        setPdfModal(result);
      } catch (err) {
        console.error('Error generating sales report PDF:', err);
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 200);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('report_annuale')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'report_annuale'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Report Fine Anno & Consumi Clienti
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-mono">
              {clientRanking.length} clienti
            </span>
          </button>

          <button
            onClick={() => setActiveTab('registrazione')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'registrazione'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Nuovo Scarico Vendita
          </button>
        </div>

        {onNavigateToClienti && (
          <button
            onClick={onNavigateToClienti}
            className="text-xs font-semibold text-stone-600 hover:text-amber-700 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-amber-300 transition-colors flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-amber-600" />
            Vai all'Anagrafica Clienti ({clienti.length})
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: REPORT FINE ANNO & ANALISI CONSUMI                           */}
      {/* ========================================================================= */}
      {activeTab === 'report_annuale' && (
        <div className="space-y-6">
          {/* Header Banner & Export Controls */}
          <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 p-6 rounded-2xl text-white shadow-md border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
                    Report Consumi & Classifica Clienti
                    <span className="text-xs font-mono font-normal bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                      Esercizio {reportAnno === 'ALL' ? 'Globale' : reportAnno}
                    </span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Analisi annuale dei volumi per cliente (Pub B2B e Privati B2C), frequenza ordini e gradimento per stile di birra
                  </p>
                </div>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportCsvReport}
                className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-stone-700 shadow-sm"
                title="Esporta foglio di calcolo con dettaglio clienti e stili"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Esporta Prospetto CSV
              </button>

              <button
                onClick={handleExportPdfReport}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm border border-amber-400/40"
                title="Scarica documento PDF impaginato pronto per commercialista o riunioni"
              >
                <Download className="w-4 h-4" />
                {isGeneratingPdf ? 'Generazione in corso...' : 'Scarica Report Annuale (PDF)'}
              </button>
            </div>
          </div>

          {/* Filter Bar (Anno e Tipologia) */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Year Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">Anno:</span>
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                  {availableYears.map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setReportAnno(yr)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                        reportAnno === yr
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                  <button
                    onClick={() => setReportAnno('ALL')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      reportAnno === 'ALL'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Tutti
                  </button>
                </div>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2 border-l border-stone-200 pl-3">
                <Filter className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-semibold text-stone-700">Canale:</span>
                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                  <button
                    onClick={() => setReportFiltroTipo('ALL')}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                      reportFiltroTipo === 'ALL'
                        ? 'bg-white text-stone-900 font-bold shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Tutti i Canali
                  </button>
                  <button
                    onClick={() => setReportFiltroTipo('B2B')}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                      reportFiltroTipo === 'B2B'
                        ? 'bg-amber-600 text-white font-bold shadow-xs'
                        : 'text-stone-600 hover:text-amber-700'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    Locali B2B
                  </button>
                  <button
                    onClick={() => setReportFiltroTipo('B2C')}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                      reportFiltroTipo === 'B2C'
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'text-stone-600 hover:text-emerald-700'
                    }`}
                  >
                    <User className="w-3 h-3" />
                    Privati B2C
                  </button>
                </div>
              </div>
            </div>

            <div className="text-xs text-stone-500">
              Movimenti considerati: <strong className="text-stone-800">{filteredSales.length}</strong>
            </div>
          </div>

          {/* Key KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Volume Totale Venduto</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-700 font-mono">
                  {totalVolumeLitri.toFixed(1)}
                </span>
                <span className="text-xs font-bold text-stone-500">Litri</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">Birra confezionata uscita dal birrificio</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Fatturato Commerciale</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-stone-900 font-mono">
                  € {totalFatturatoEuro.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">Totale corrispettivi da DDT e fatture</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Frequenza Consegne</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-stone-900 font-mono">
                  {totalOrdiniCount}
                </span>
                <span className="text-xs font-bold text-stone-500">Spedizioni</span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">Numero totale ordini eseguiti nel periodo</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Clienti Attivi</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-stone-900 font-mono">
                  {clientRanking.length}
                </span>
                <span className="text-xs font-medium text-stone-500">
                  ({clientRanking.filter((c) => c.tipo === 'B2B').length} B2B / {clientRanking.filter((c) => c.tipo === 'B2C').length} B2C)
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">Con almeno un acquisto registrato</p>
            </div>
          </div>

          {/* Section: Breakdown per Stile di Birra (Overall) */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Beer className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-stone-900 text-sm">Gradimento per Stile di Birra (Mix di Produzione)</h3>
              </div>
              <span className="text-xs text-stone-500">{styleRanking.length} stili registrati</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {styleRanking.map((st, i) => (
                <div
                  key={st.stile}
                  className="bg-stone-50 p-4 rounded-xl border border-stone-200/80 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-stone-900 leading-tight">{st.stile}</span>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                      {st.quotaPerc.toFixed(1)}%
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(4, st.quotaPerc))}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-stone-500 mt-1.5 font-mono">
                      <span>{st.litri.toFixed(1)} Litri</span>
                      <span>{st.ordini} ordini</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: CLASSIFICA CLIENTI (Volume, Frequenza & Dettaglio Stili) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">
                    Classifica Clienti per Volume e Frequenza di Riordino
                  </h3>
                  <p className="text-xs text-stone-500">
                    Clicca su un cliente per espandere il dettaglio completo di quali stili ha acquistato
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono font-medium text-stone-500 bg-white px-3 py-1 rounded-lg border border-stone-200">
                {clientRanking.length} clienti in classifica
              </span>
            </div>

            {clientRanking.length === 0 ? (
              <div className="p-10 text-center text-stone-500 text-xs">
                Nessuna vendita registrata con i filtri attuali.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {clientRanking.map((cl) => {
                  const isExpanded = expandedClienteId === cl.nome;
                  const isB2B = cl.tipo === 'B2B';

                  // Badge style for position
                  let posBadge = 'bg-stone-100 text-stone-700';
                  if (cl.pos === 1) posBadge = 'bg-amber-500 text-white font-black shadow-xs';
                  else if (cl.pos === 2) posBadge = 'bg-stone-300 text-stone-800 font-bold';
                  else if (cl.pos === 3) posBadge = 'bg-amber-700 text-white font-bold';

                  return (
                    <div key={cl.nome} className="hover:bg-amber-50/20 transition-colors">
                      {/* Main Row */}
                      <div
                        onClick={() => setExpandedClienteId(isExpanded ? null : cl.nome)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        {/* Position & Client Name */}
                        <div className="flex items-center gap-3 min-w-[260px]">
                          <span
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-mono shrink-0 ${posBadge}`}
                          >
                            {cl.pos}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-900 text-sm">{cl.nome}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  isB2B
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}
                              >
                                {isB2B ? <Building2 className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                                {isB2B ? 'Locale B2B' : 'Privato B2C'}
                              </span>
                            </div>

                            {/* Summary Beer styles preview */}
                            <p className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
                              Stili preferiti:{' '}
                              <span className="text-stone-700 font-medium">
                                {cl.stiliList.map((s) => `${s.stile} (${s.litri.toFixed(0)}L)`).join(', ')}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Metrics: Volume & Orders */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 grow">
                          {/* Progress bar of total brewery volume */}
                          <div className="hidden lg:block w-36">
                            <div className="flex justify-between text-[10px] text-stone-500 mb-1">
                              <span>Quota vendite:</span>
                              <strong className="text-amber-800 font-mono">{cl.quotaPerc.toFixed(1)}%</strong>
                            </div>
                            <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-600 h-1.5 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(3, cl.quotaPerc))}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <span className="text-xs text-stone-400 block font-medium">Volume</span>
                            <span className="font-mono font-bold text-stone-900 text-sm">
                              {cl.litri.toFixed(1)} <span className="text-xs font-normal text-stone-500">L</span>
                            </span>
                          </div>

                          <div className="text-right min-w-[70px]">
                            <span className="text-xs text-stone-400 block font-medium">Frequenza</span>
                            <span className="font-mono font-bold text-stone-800 text-xs bg-stone-100 px-2 py-0.5 rounded-md">
                              {cl.ordini} ordini
                            </span>
                          </div>

                          <div className="text-right min-w-[100px] hidden sm:block">
                            <span className="text-xs text-stone-400 block font-medium">Importo Stimato</span>
                            <span className="font-mono font-bold text-emerald-800 text-xs">
                              € {cl.fatturato.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          <button className="text-stone-400 hover:text-stone-700 p-1 rounded-lg">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Section: Detailed Beer Styles Consumption Breakdown */}
                      {isExpanded && (
                        <div className="bg-stone-50/80 px-6 py-4 border-t border-stone-100 animate-fade-in space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                              <Beer className="w-3.5 h-3.5 text-amber-600" />
                              Dettaglio Birre & Stili acquistati da {cl.nome}:
                            </h4>
                            <span className="text-[11px] text-stone-500">
                              Totale consumato dal cliente: <strong>{cl.litri.toFixed(1)} Litri</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {cl.stiliList.map((st) => (
                              <div
                                key={st.stile}
                                className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs"
                              >
                                <div className="flex justify-between items-start gap-1">
                                  <span className="font-bold text-xs text-stone-800">{st.stile}</span>
                                  <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    {st.quotaLocale.toFixed(0)}% del totale
                                  </span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between text-xs font-mono text-stone-600">
                                  <span>{st.litri.toFixed(1)} Litri</span>
                                  <span className="text-[10px] text-stone-400">
                                    {cl.litri > 0 ? ((st.litri / totalVolumeLitri) * 100).toFixed(1) : 0}% birrificio
                                  </span>
                                </div>
                                <div className="w-full bg-stone-100 rounded-full h-1 mt-1.5 overflow-hidden">
                                  <div
                                    className="bg-amber-500 h-1 rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(5, st.quotaLocale))}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: REGISTRAZIONE SCARICO VENDITA                                 */}
      {/* ========================================================================= */}
      {activeTab === 'registrazione' && (
        <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-stone-900 text-sm">🚚 Registra Nuovo Scarico di Vendita</h3>
            </div>
            <span className="text-xs text-stone-500">Aggiorna le giacenze e la classifica clienti</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Consegna / Fattura *</label>
              <input
                type="date"
                value={dataVendita}
                onChange={(e) => setDataVendita(e.target.value)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                required
              />
            </div>

            {/* Client Selector (B2B & B2C) */}
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-stone-700">
                  Cliente / Destinatario *
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomCliente(!isCustomCliente)}
                  className="text-[11px] text-amber-700 hover:underline"
                >
                  {isCustomCliente ? 'Seleziona da anagrafica' : '+ Inserisci nome manuale'}
                </button>
              </div>

              {isCustomCliente ? (
                <input
                  type="text"
                  value={clienteCustom}
                  onChange={(e) => setClienteCustom(e.target.value)}
                  placeholder="Nome del cliente o privato..."
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  required
                />
              ) : (
                <select
                  value={selectedClienteNome}
                  onChange={(e) => setSelectedClienteNome(e.target.value)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  required
                >
                  <optgroup label="Locali & Pub (B2B)">
                    {clienti
                      .filter((c) => (c.tipo_cliente || 'B2B') === 'B2B')
                      .map((c) => (
                        <option key={c.id} value={c.ragione_sociale}>
                          {c.ragione_sociale} ({c.indirizzo || 'B2B'})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Clienti Privati (B2C)">
                    {clienti
                      .filter((c) => c.tipo_cliente === 'B2C')
                      .map((c) => (
                        <option key={c.id} value={c.ragione_sociale}>
                          {c.ragione_sociale} (Privato)
                        </option>
                      ))}
                  </optgroup>
                </select>
              )}
            </div>

            {/* Beer Style / Recipe Selection */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-stone-700">Stile Birra *</label>
                <button
                  type="button"
                  onClick={() => setIsCustomStile(!isCustomStile)}
                  className="text-[10px] text-amber-700 hover:underline"
                >
                  {isCustomStile ? 'Da ricette' : 'Manuale'}
                </button>
              </div>

              {isCustomStile ? (
                <input
                  type="text"
                  value={stileCustom}
                  onChange={(e) => setStileCustom(e.target.value)}
                  placeholder="es. American IPA"
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  required
                />
              ) : (
                <select
                  value={stileBirra}
                  onChange={(e) => setStileBirra(e.target.value)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                >
                  {ricette.length > 0 ? (
                    ricette.map((r) => (
                      <option key={r.id} value={r.nome_ricetta}>
                        {r.nome_ricetta} ({r.stile_birra})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Bionda Belga Speciale">Bionda Belga Speciale</option>
                      <option value="Lupolina IPA">Lupolina IPA</option>
                      <option value="Notte Scura Stout">Notte Scura Stout</option>
                    </>
                  )}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Formato */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Formato Venduto *</label>
              <select
                value={formato}
                onChange={(e) => setFormato(e.target.value)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
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

            {/* Quantità */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Quantità (pz) *</label>
              <input
                type="number"
                min="1"
                value={quantita}
                onChange={(e) => setQuantita(parseInt(e.target.value) || 1)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            {/* Prezzo Totale */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Importo Totale (€)</label>
              <input
                type="number"
                step="0.10"
                value={prezzoTotale}
                onChange={(e) => setPrezzoTotale(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
              />
            </div>

            {/* Documento Riferimento */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">N° Fattura, Ricevuta o DDT</label>
              <input
                type="text"
                value={riferimento}
                onChange={(e) => setRiferimento(e.target.value)}
                placeholder="es. Fatt. 31/2026"
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-amber-50/70 rounded-xl border border-amber-200">
            <div>
              <span className="text-xs text-amber-900 font-medium">Volume scaricato dal magazzino birra:</span>
              <p className="text-[11px] text-amber-800">
                Cliente:{' '}
                <strong>
                  {isCustomCliente ? clienteCustom : selectedClienteNome} (
                  {currentClienteObj?.tipo_cliente === 'B2C' ? 'Privato B2C' : 'Locale B2B'})
                </strong>
              </p>
            </div>
            <span className="font-mono font-bold text-amber-950 text-base">{litriTotali.toFixed(1)} Litri</span>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-xs text-xs transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Registra Scarico di Vendita
            </button>
          </div>
        </form>
      )}

      {/* MODAL: PDF Preview / Download confirmation */}
      {pdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Report Annuale Generato con Successo</h3>
                  <p className="text-[11px] text-stone-400">{pdfModal.filename}</p>
                </div>
              </div>
              <button
                onClick={() => setPdfModal(null)}
                className="text-stone-400 hover:text-white px-2 py-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Embedded PDF iframe preview */}
            <div className="flex-1 bg-stone-100 p-2 min-h-[420px]">
              <iframe
                src={pdfModal.url}
                title="Anteprima Report Vendite e Consumi"
                className="w-full h-full min-h-[420px] rounded-xl border border-stone-300 bg-white"
              />
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
              <span className="text-xs text-stone-500">
                Il download è stato avviato automaticamente dal browser.
              </span>
              <div className="flex gap-2">
                <a
                  href={pdfModal.url}
                  download={pdfModal.filename}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Scarica di Nuovo PDF
                </a>
                <button
                  onClick={() => setPdfModal(null)}
                  className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold rounded-xl"
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
