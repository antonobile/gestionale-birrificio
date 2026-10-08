import React, { useState, useMemo, useRef } from 'react';
import { Cliente, TipoCliente, TracciamentoFusti, BirraCondizionata } from '../../types';
import {
  Users,
  Building2,
  User,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Beer,
  ShoppingCart,
  X,
  FileText,
} from 'lucide-react';

interface TabClientiProps {
  clienti: Cliente[];
  onAddCliente: (cliente: Omit<Cliente, 'id'>) => void;
  onUpdateCliente?: (id: number, cliente: Partial<Cliente>) => void;
  onDeleteCliente: (id: number) => void;
  onAddClientiBulk?: (clientiList: Omit<Cliente, 'id'>[]) => void;
  fusti?: TracciamentoFusti[];
  vendite?: BirraCondizionata[];
  onNavigateToVendite?: (clienteNome: string) => void;
}

export const TabClienti: React.FC<TabClientiProps> = ({
  clienti,
  onAddCliente,
  onUpdateCliente,
  onDeleteCliente,
  onAddClientiBulk,
  fusti = [],
  vendite = [],
  onNavigateToVendite,
}) => {
  // Filters & Search
  const [filterTipo, setFilterTipo] = useState<'ALL' | 'B2B' | 'B2C'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Form State (New / Edit)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formTipo, setFormTipo] = useState<TipoCliente>('B2B');
  const [formRagioneSociale, setFormRagioneSociale] = useState('');
  const [formPivaCf, setFormPivaCf] = useState('');
  const [formIndirizzo, setFormIndirizzo] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPec, setFormPec] = useState('');
  const [formCodiceSdi, setFormCodiceSdi] = useState('');
  const [formNote, setFormNote] = useState('');

  // CSV Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Omit<Cliente, 'id'>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute kegs held by each client (only for B2B)
  const fustiInCaricoMap = useMemo(() => {
    const map: { [cliente: string]: number } = {};
    for (const m of fusti) {
      if (!map[m.cliente_pub]) map[m.cliente_pub] = 0;
      if (m.tipo_movimento === 'USCITA_PUB') {
        map[m.cliente_pub] += m.quantita;
      } else {
        map[m.cliente_pub] = Math.max(0, map[m.cliente_pub] - m.quantita);
      }
    }
    return map;
  }, [fusti]);

  // Compute sales volume (liters) and purchases count per client
  const venditeStatsMap = useMemo(() => {
    const map: { [cliente: string]: { litri: number; count: number; lastDate: string } } = {};
    for (const v of vendite) {
      if (v.tipo === 'SCARICO' && v.cliente) {
        if (!map[v.cliente]) {
          map[v.cliente] = { litri: 0, count: 0, lastDate: v.data };
        }
        map[v.cliente].litri += v.litri_totali;
        map[v.cliente].count += 1;
        if (v.data > map[v.cliente].lastDate) {
          map[v.cliente].lastDate = v.data;
        }
      }
    }
    return map;
  }, [vendite]);

  // Open modal for creating new client
  const handleOpenNew = (tipo: TipoCliente = 'B2B') => {
    setEditingId(null);
    setFormTipo(tipo);
    setFormRagioneSociale('');
    setFormPivaCf('');
    setFormIndirizzo('');
    setFormTelefono('');
    setFormEmail('');
    setFormPec('');
    setFormCodiceSdi('');
    setFormNote('');
    setShowModal(true);
  };

  // Open modal for editing existing client
  const handleOpenEdit = (c: Cliente) => {
    setEditingId(c.id);
    setFormTipo(c.tipo_cliente || 'B2B');
    setFormRagioneSociale(c.ragione_sociale);
    setFormPivaCf(c.piva_cf || '');
    setFormIndirizzo(c.indirizzo || '');
    setFormTelefono(c.telefono || '');
    setFormEmail(c.email || '');
    setFormPec(c.pec || '');
    setFormCodiceSdi(c.codice_sdi || '');
    setFormNote(c.note || '');
    setShowModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRagioneSociale.trim()) return;

    if (editingId && onUpdateCliente) {
      onUpdateCliente(editingId, {
        tipo_cliente: formTipo,
        ragione_sociale: formRagioneSociale.trim(),
        piva_cf: formPivaCf.trim(),
        indirizzo: formIndirizzo.trim(),
        telefono: formTelefono.trim(),
        email: formEmail.trim(),
        pec: formTipo === 'B2B' ? formPec.trim() : undefined,
        codice_sdi: formTipo === 'B2B' ? formCodiceSdi.trim() : undefined,
        note: formNote.trim(),
      });
    } else {
      onAddCliente({
        tipo_cliente: formTipo,
        ragione_sociale: formRagioneSociale.trim(),
        piva_cf: formPivaCf.trim(),
        indirizzo: formIndirizzo.trim(),
        telefono: formTelefono.trim(),
        email: formEmail.trim(),
        pec: formTipo === 'B2B' ? formPec.trim() : undefined,
        codice_sdi: formTipo === 'B2B' ? formCodiceSdi.trim() : undefined,
        note: formNote.trim(),
      });
    }

    setShowModal(false);
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Tipo', 'Ragione Sociale / Nominativo', 'P.IVA / CF', 'Indirizzo', 'Telefono', 'Email', 'PEC', 'SDI', 'Note'];
    const rows = clienti.map((c) => [
      c.tipo_cliente || 'B2B',
      `"${(c.ragione_sociale || '').replace(/"/g, '""')}"`,
      `"${(c.piva_cf || '').replace(/"/g, '""')}"`,
      `"${(c.indirizzo || '').replace(/"/g, '""')}"`,
      `"${(c.telefono || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.pec || '').replace(/"/g, '""')}"`,
      `"${(c.codice_sdi || '').replace(/"/g, '""')}"`,
      `"${(c.note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `anagrafica_clienti_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Import parser
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('File vuoto');

        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) throw new Error('Il file deve contenere almeno una riga di intestazione e un record.');

        const splitLine = (l: string) => {
          const sep = l.includes(';') ? ';' : ',';
          return l.split(sep).map((f) => f.replace(/^["']|["']$/g, '').trim());
        };

        const parsed: Omit<Cliente, 'id'>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = splitLine(lines[i]);
          if (!cols[0] && !cols[1]) continue;

          let tipo: TipoCliente = 'B2B';
          let nome = '';
          let piva = '';
          let ind = '';
          let tel = '';
          let mail = '';
          let pec = '';
          let sdi = '';
          let nte = '';

          // Check if first col is type B2B/B2C
          if (cols[0].toUpperCase() === 'B2B' || cols[0].toUpperCase().includes('PUB') || cols[0].toUpperCase().includes('LOCALE')) {
            tipo = 'B2B';
            nome = cols[1] || '';
            piva = cols[2] || '';
            ind = cols[3] || '';
            tel = cols[4] || '';
            mail = cols[5] || '';
            pec = cols[6] || '';
            sdi = cols[7] || '';
            nte = cols[8] || '';
          } else if (cols[0].toUpperCase() === 'B2C' || cols[0].toUpperCase().includes('PRIVAT')) {
            tipo = 'B2C';
            nome = cols[1] || '';
            piva = cols[2] || '';
            ind = cols[3] || '';
            tel = cols[4] || '';
            mail = cols[5] || '';
            nte = cols[6] || '';
          } else {
            // Assume col 0 is Name
            nome = cols[0] || '';
            piva = cols[1] || '';
            ind = cols[2] || '';
            tel = cols[3] || '';
            mail = cols[4] || '';
            pec = cols[5] || '';
            sdi = cols[6] || '';
            nte = cols[7] || '';
            tipo = piva.length === 11 && !isNaN(Number(piva)) ? 'B2B' : 'B2B';
          }

          if (nome) {
            parsed.push({
              tipo_cliente: tipo,
              ragione_sociale: nome,
              piva_cf: piva,
              indirizzo: ind,
              telefono: tel,
              email: mail,
              pec,
              codice_sdi: sdi,
              note: nte,
            });
          }
        }

        if (parsed.length === 0) {
          throw new Error('Nessun cliente valido trovato nel file. Controlla il formato delle colonne.');
        }

        setImportRows(parsed);
      } catch (err: unknown) {
        setImportError(err instanceof Error ? err.message : 'Errore nella lettura del file');
        setImportRows([]);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleConfirmImport = () => {
    if (importRows.length === 0) return;
    if (onAddClientiBulk) {
      onAddClientiBulk(importRows);
    } else {
      importRows.forEach((r) => onAddCliente(r));
    }
    setImportSuccess(`Importati con successo ${importRows.length} clienti!`);
    setTimeout(() => {
      setShowImportModal(false);
      setImportRows([]);
      setImportFileName('');
      setImportSuccess('');
    }, 1200);
  };

  // Filtered clients list
  const filteredClienti = useMemo(() => {
    return clienti.filter((c) => {
      const matchTipo =
        filterTipo === 'ALL' || (c.tipo_cliente || 'B2B') === filterTipo;
      if (!matchTipo) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.ragione_sociale.toLowerCase().includes(q) ||
        (c.piva_cf && c.piva_cf.toLowerCase().includes(q)) ||
        (c.indirizzo && c.indirizzo.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.telefono && c.telefono.toLowerCase().includes(q)) ||
        (c.note && c.note.toLowerCase().includes(q))
      );
    });
  }, [clienti, filterTipo, searchQuery]);

  // Counts
  const countB2B = clienti.filter((c) => (c.tipo_cliente || 'B2B') === 'B2B').length;
  const countB2C = clienti.filter((c) => c.tipo_cliente === 'B2C').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 p-6 rounded-2xl text-white shadow-md border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-stone-100 flex items-center gap-2">
                Anagrafica Clienti
                <span className="text-xs font-mono font-normal bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  {clienti.length} registrati
                </span>
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Gestione completa Locali / Pub (B2B) e Clienti Privati (B2C) con storico acquisti e fusti
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenNew('B2C')}
            className="px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm border border-emerald-500/30"
            title="Inserimento rapido nominativo privato per spaccio o asporto"
          >
            <User className="w-3.5 h-3.5" />
            + Nuovo Privato (B2C)
          </button>

          <button
            onClick={() => handleOpenNew('B2B')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm border border-amber-400/40"
            title="Inserimento locale o distributore B2B con P.IVA e SDI"
          >
            <Building2 className="w-3.5 h-3.5" />
            + Nuovo Pub / Locale (B2B)
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border border-stone-700"
            title="Importa anagrafica clienti da file CSV o Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            Importa CSV
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border border-stone-700"
            title="Scarica anagrafica in formato CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterTipo('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              filterTipo === 'ALL'
                ? 'bg-white text-stone-900 font-bold shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Tutti ({clienti.length})
          </button>
          <button
            onClick={() => setFilterTipo('B2B')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              filterTipo === 'B2B'
                ? 'bg-amber-600 text-white font-bold shadow-xs'
                : 'text-stone-600 hover:text-amber-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Locali & Pub B2B ({countB2B})
          </button>
          <button
            onClick={() => setFilterTipo('B2C')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              filterTipo === 'B2C'
                ? 'bg-emerald-600 text-white font-bold shadow-xs'
                : 'text-stone-600 hover:text-emerald-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Privati B2C ({countB2C})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per nome, P.IVA, CF, telefono, città..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Client List Grid / Table */}
      {filteredClienti.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs">
          <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-stone-800">Nessun cliente trovato</h4>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `Nessun risultato corrisponde a "${searchQuery}". Prova a modificare i filtri.`
              : 'Non ci sono clienti registrati in questa categoria. Aggiungi il primo adesso!'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => handleOpenNew('B2C')}
              className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
            >
              + Inserisci Privato (B2C)
            </button>
            <button
              onClick={() => handleOpenNew('B2B')}
              className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg"
            >
              + Inserisci Pub (B2B)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClienti.map((c) => {
            const isB2B = (c.tipo_cliente || 'B2B') === 'B2B';
            const fustiFuori = fustiInCaricoMap[c.ragione_sociale] || 0;
            const stats = venditeStatsMap[c.ragione_sociale];

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-stone-200/90 hover:border-amber-300/80 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Accent top stripe */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    isB2B ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />

                <div>
                  {/* Card Header: Type Badge & Actions */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isB2B
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {isB2B ? (
                        <>
                          <Building2 className="w-3 h-3 text-amber-600" />
                          Locale / Pub (B2B)
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-emerald-600" />
                          Cliente Privato (B2C)
                        </>
                      )}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        title="Modifica cliente"
                        className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Sei sicuro di voler eliminare il cliente "${c.ragione_sociale}"?`)) {
                            onDeleteCliente(c.id);
                          }
                        }}
                        title="Elimina cliente"
                        className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Client Name */}
                  <h3 className="font-bold text-stone-900 text-base leading-snug line-clamp-1">
                    {c.ragione_sociale}
                  </h3>

                  {/* P.IVA / CF */}
                  {c.piva_cf && (
                    <p className="text-[11px] font-mono text-stone-500 mt-0.5">
                      {isB2B ? 'P.IVA:' : 'CF:'} <span className="text-stone-700 font-semibold">{c.piva_cf}</span>
                    </p>
                  )}

                  {/* Details List */}
                  <div className="space-y-1.5 mt-3 pt-3 border-t border-stone-100 text-xs text-stone-600">
                    {c.indirizzo && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{c.indirizzo}</span>
                      </div>
                    )}
                    {c.telefono && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <a href={`tel:${c.telefono}`} className="hover:text-amber-700 font-mono text-[11px]">
                          {c.telefono}
                        </a>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <a href={`mailto:${c.email}`} className="hover:text-amber-700 text-[11px] truncate">
                          {c.email}
                        </a>
                      </div>
                    )}
                    {isB2B && (c.codice_sdi || c.pec) && (
                      <div className="flex items-center gap-2 text-[10px] text-stone-500 font-mono">
                        <FileText className="w-3 h-3 text-stone-400 shrink-0" />
                        {c.codice_sdi && <span>SDI: <strong className="text-stone-700">{c.codice_sdi}</strong></span>}
                        {c.pec && <span className="truncate">PEC: {c.pec}</span>}
                      </div>
                    )}
                    {c.note && (
                      <p className="text-[11px] italic text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-100 line-clamp-2 mt-2">
                        "{c.note}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Metrics & Action */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    {isB2B && (
                      <div
                        className={`flex items-center gap-1 font-bold px-2 py-1 rounded-lg text-[11px] ${
                          fustiFuori > 0
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-stone-50 text-stone-500 border border-stone-200'
                        }`}
                        title="Fusti attualmente in carico presso il locale"
                      >
                        <Beer className="w-3 h-3 text-amber-600" />
                        <span>{fustiFuori} fusti</span>
                      </div>
                    )}
                    {stats && (
                      <div
                        className="text-[11px] font-mono text-stone-600 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200"
                        title="Totale litri ritirati/acquistati"
                      >
                        <strong>{stats.litri.toFixed(0)}L</strong> ({stats.count} ordini)
                      </div>
                    )}
                  </div>

                  {onNavigateToVendite && (
                    <button
                      onClick={() => onNavigateToVendite(c.ragione_sociale)}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                      title="Registra subito una vendita a questo cliente"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      Vendi
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Inserimento / Modifica Cliente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${formTipo === 'B2B' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {formTipo === 'B2B' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-stone-100">
                    {editingId ? 'Modifica Scheda Cliente' : 'Nuovo Cliente in Anagrafica'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {formTipo === 'B2B' ? 'Locale, Pub, Birreria o Distributore' : 'Cliente Privato (B2C) / Spaccio'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-stone-400 hover:text-stone-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">Tipologia Cliente *</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFormTipo('B2B')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      formTipo === 'B2B'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    Locale / Pub (B2B)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormTipo('B2C')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                      formTipo === 'B2C'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Cliente Privato (B2C)
                  </button>
                </div>
              </div>

              {/* Name / Business Name */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {formTipo === 'B2B' ? 'Ragione Sociale / Nome Locale *' : 'Nome e Cognome *'}
                </label>
                <input
                  type="text"
                  value={formRagioneSociale}
                  onChange={(e) => setFormRagioneSociale(e.target.value)}
                  placeholder={formTipo === 'B2B' ? 'es. The Celtic Tavern Pub' : 'es. Marco Rossi'}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  required
                />
              </div>

              {/* P.IVA / CF */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    {formTipo === 'B2B' ? 'Partita IVA o CF *' : 'Codice Fiscale (opzionale)'}
                  </label>
                  <input
                    type="text"
                    value={formPivaCf}
                    onChange={(e) => setFormPivaCf(e.target.value.toUpperCase())}
                    placeholder={formTipo === 'B2B' ? 'es. 01822710628' : 'es. RSSMRC85M01A662K'}
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Telefono / Cellulare</label>
                  <input
                    type="tel"
                    value={formTelefono}
                    onChange={(e) => setFormTelefono(e.target.value)}
                    placeholder="es. +39 347 1234567"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              {/* Email & Indirizzo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="es. cliente@email.it"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Indirizzo di Consegna</label>
                  <input
                    type="text"
                    value={formIndirizzo}
                    onChange={(e) => setFormIndirizzo(e.target.value)}
                    placeholder="es. Via Roma 12, Bari"
                    className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              {/* B2B Only: SDI and PEC */}
              {formTipo === 'B2B' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
                  <div>
                    <label className="block text-xs font-medium text-amber-950 mb-1">Codice SDI Destinatario</label>
                    <input
                      type="text"
                      maxLength={7}
                      value={formCodiceSdi}
                      onChange={(e) => setFormCodiceSdi(e.target.value.toUpperCase())}
                      placeholder="es. SUBM70N o 0000000"
                      className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-950 mb-1">PEC Fatturazione</label>
                    <input
                      type="email"
                      value={formPec}
                      onChange={(e) => setFormPec(e.target.value)}
                      placeholder="es. locale@pec.it"
                      className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Note {formTipo === 'B2B' ? '(orari scarico, referente, accordi fusti)' : '(gusti preferiti, promo)'}
                </label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Informazioni aggiuntive..."
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-xl"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-all ${
                    formTipo === 'B2B'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {editingId ? 'Salva Modifiche' : 'Salva in Anagrafica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importazione CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Importa Clienti da CSV / Excel</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-stone-600">
                Puoi caricare un file CSV (delimitato da virgola o punto e virgola). Il sistema riconosce sia clienti B2B (Locali/Pub) sia B2C (Privati).
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 hover:border-amber-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-stone-50 hover:bg-amber-50/30"
              >
                <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-800">
                  {importFileName ? importFileName : 'Clicca per selezionare il file CSV'}
                </p>
                <p className="text-[10px] text-stone-500 mt-1">Formati supportati: .csv, .txt</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{importSuccess}</span>
                </div>
              )}

              {importRows.length > 0 && !importSuccess && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <p className="font-bold">
                    ✓ Riconosciuti {importRows.length} clienti pronti per l'importazione
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    ({importRows.filter((r) => r.tipo_cliente === 'B2B').length} Locali B2B,{' '}
                    {importRows.filter((r) => r.tipo_cliente === 'B2C').length} Privati B2C)
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    const template =
                      'Tipo,Ragione Sociale o Nome,PIVA o CF,Indirizzo,Telefono,Email,PEC,SDI,Note\nB2B,The King Pub,01234567890,Via Roma 1 Bari,080123456,info@kingpub.it,kingpub@pec.it,SUBM70N,Locale storico\nB2C,Mario Rossi,RSSMRA80A01A662K,Via Dante 10 Bari,340123456,mario@rossi.it,,,Cliente spaccio\n';
                    const blob = new Blob([template], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'template_clienti.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Scarica Modello Esempio CSV
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900"
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    disabled={importRows.length === 0}
                    onClick={handleConfirmImport}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Importa ({importRows.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
