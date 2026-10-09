import React, { useState } from 'react';
import { Cotta, Ricetta, AziendaConfig, IngredienteAggiuntivo } from '../../types';
import { Plus, BookOpen, Trash2, Edit3, Sparkles, Check, Droplets, Flame, Tablet } from 'lucide-react';

interface TabCottaProps {
  cotte: Cotta[];
  ricette: Ricetta[];
  azienda: AziendaConfig;
  onAddCotta: (cotta: Omit<Cotta, 'id'>) => void;
  onDeleteCotta: (id: number) => void;
  onAddRicetta: (ricetta: Omit<Ricetta, 'id'>) => void;
  onDeleteRicetta: (id: number) => void;
  onAvviaCottaGuidata?: (ricettaId?: number) => void;
}

export const TabCotta: React.FC<TabCottaProps> = ({
  cotte,
  ricette,
  azienda,
  onAddCotta,
  onDeleteCotta,
  onAddRicetta,
  onDeleteRicetta,
  onAvviaCottaGuidata,
}) => {
  const [sezione, setSezione] = useState<'nuova_cotta' | 'ricette' | 'storico'>('nuova_cotta');

  // Form Nuova Cotta
  const [cottaNum, setCottaNum] = useState(`0${cotte.length + 1}/2026`);
  const [dataCotta, setDataCotta] = useState(new Date().toISOString().slice(0, 10));
  const [tipoBirra, setTipoBirra] = useState(ricette[0]?.nome_ricetta || 'Bionda Belga Speciale');
  const [lottoSfuso, setLottoSfuso] = useState(`LOTTO-260${cotte.length + 1}`);
  const [litriMosto, setLitriMosto] = useState(500.0);
  const [gradoPlato, setGradoPlato] = useState(13.5);
  const [contInizio, setContInizio] = useState(11245.0);
  const [contFine, setContFine] = useState(11745.0);
  const [maltoKg, setMaltoKg] = useState(115.0);
  const [luppoloKg, setLuppoloKg] = useState(2.2);
  const [lievitoKg, setLievitoKg] = useState(0.5);
  const [consumoGas, setConsumoGas] = useState(14.8);
  const [consumoEle, setConsumoEle] = useState(50.0);
  const [acquaLavaggio, setAcquaLavaggio] = useState(680.0);
  const [costoSanificazione, setCostoSanificazione] = useState(9.75);

  // Spezie dinamiche nella cotta
  const [spezieCotta, setSpezieCotta] = useState<IngredienteAggiuntivo[]>([]);
  const [nuovaSpeziaNome, setNuovaSpeziaNome] = useState('Buccia arancia amara');
  const [nuovaSpeziaGr, setNuovaSpeziaGr] = useState(100);

  // Form Nuova Ricetta
  const [ricNome, setRicNome] = useState('');
  const [ricStile, setRicStile] = useState('');
  const [ricLitri, setRicLitri] = useState(500.0);
  const [ricPlato, setRicPlato] = useState(12.5);
  const [ricMalto, setRicMalto] = useState(110.0);
  const [ricLupGr, setRicLupGr] = useState(2000.0);
  const [ricLievGr, setRicLievGr] = useState(500.0);
  const [ricNote, setRicNote] = useState('');

  // Handle load recipe into brew form
  const handleApplicaRicetta = (r: Ricetta) => {
    setTipoBirra(r.nome_ricetta);
    setLitriMosto(r.litri_previsti);
    setGradoPlato(r.plato_previsto);
    setMaltoKg(r.fermentabili_kg);
    setLuppoloKg(r.luppoli_gr / 1000.0);
    setLievitoKg(r.lieviti_gr / 1000.0);
    if (r.altri_ingredienti_json) {
      setSpezieCotta([...r.altri_ingredienti_json]);
    }
    setSezione('nuova_cotta');
  };

  const handleAddSpezia = () => {
    if (!nuovaSpeziaNome.trim()) return;
    setSpezieCotta([...spezieCotta, { nome: nuovaSpeziaNome.trim(), grammi: nuovaSpeziaGr }]);
  };

  const handleRimuoviSpezia = (index: number) => {
    setSpezieCotta(spezieCotta.filter((_, i) => i !== index));
  };

  const handleSubmitCotta = (e: React.FormEvent) => {
    e.preventDefault();
    // Calcoli di sala cottura
    // Accisa: litri * Plato * (aliquota / 100)
    const accisa = (litriMosto * gradoPlato * (azienda.aliquota_accisa / 100.0));
    // Costo materie prime stimate: malto 1.35, luppolo 28.50, lievito 64.00, gas 1.20, ele 0.28
    const costoMp = (maltoKg * 1.35) + (luppoloKg * 28.5) + (lievitoKg * 64.0);
    const costoEnergia = (consumoGas * 1.2) + (consumoEle * 0.28);
    const costoAcqua = acquaLavaggio * 0.0025;
    const costoTotale = costoMp + costoEnergia + costoAcqua + costoSanificazione;
    const costoLitro = litriMosto > 0 ? costoTotale / litriMosto : 0;
    // Resa sala cottura approssimata: (litri * plato * 1.04) / (maltoKg * 0.80)
    const resa = maltoKg > 0 ? Math.min(92, Math.max(65, (litriMosto * gradoPlato * 1.05) / (maltoKg * 0.78))) : 75;

    onAddCotta({
      cotta_num: cottaNum,
      data: dataCotta,
      tipo_birra: tipoBirra,
      litri_mosto: litriMosto,
      grado_plato: gradoPlato,
      lotto_sfuso: lottoSfuso,
      contalitri_inizio: contInizio,
      contalitri_fine: contFine,
      malto_usato_kg: maltoKg,
      luppolo_usato_kg: luppoloKg,
      lievito_usato_kg: lievitoKg,
      altri_ingredienti_json: spezieCotta,
      resa_perc: parseFloat(resa.toFixed(1)),
      consumo_gas_mc: consumoGas,
      consumo_elettrico_kwh: consumoEle,
      accisa_dovuta_euro: parseFloat(accisa.toFixed(2)),
      costo_totale_cotta: parseFloat(costoTotale.toFixed(2)),
      costo_litro_mosto: parseFloat(costoLitro.toFixed(3)),
      acqua_lavaggio_litri: acquaLavaggio,
      costo_acqua_lavaggio: parseFloat(costoAcqua.toFixed(2)),
      costo_totale_sanificazione: costoSanificazione,
    });

    setCottaNum(`0${cotte.length + 2}/2026`);
    setLottoSfuso(`LOTTO-260${cotte.length + 2}`);
    setSezione('storico');
  };

  const handleSubmitRicetta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ricNome.trim() || !ricStile.trim()) return;

    onAddRicetta({
      nome_ricetta: ricNome.trim(),
      stile_birra: ricStile.trim(),
      litri_previsti: ricLitri,
      plato_previsto: ricPlato,
      fermentabili_kg: ricMalto,
      luppoli_gr: ricLupGr,
      lieviti_gr: ricLievGr,
      note: ricNote.trim(),
    });

    setRicNome('');
    setRicStile('');
    setRicNote('');
    setSezione('ricette');
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-stone-200 gap-2">
        <div className="flex border-b sm:border-b-0 border-stone-200">
          <button
            onClick={() => setSezione('nuova_cotta')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              sezione === 'nuova_cotta'
                ? 'border-amber-600 text-amber-900 bg-amber-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Registra Cotta in Sala Cottura</span>
          </button>

          <button
            onClick={() => setSezione('ricette')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              sezione === 'ricette'
                ? 'border-amber-600 text-amber-900 bg-amber-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Ricettario & Stili ({ricette.length})</span>
          </button>

          <button
            onClick={() => setSezione('storico')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
              sezione === 'storico'
                ? 'border-amber-600 text-amber-900 bg-amber-50/50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <span>Registro Mosto Allegato I ({cotte.length})</span>
          </button>
        </div>

        {onAvviaCottaGuidata && (
          <button
            type="button"
            onClick={() => onAvviaCottaGuidata()}
            className="mb-1 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-amber-900/20 transition active:scale-95"
          >
            <Flame className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Apri Modalità Cotta Guidata (Tablet Brew Day)</span>
          </button>
        )}
      </div>

      {/* Banner Rapido Modalità Guidata */}
      {onAvviaCottaGuidata && sezione === 'nuova_cotta' && (
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 p-4 rounded-2xl border border-stone-800 text-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <Tablet className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-white flex items-center gap-2">
                Sei in sala cottura con un Tablet?
                <span className="text-[10px] bg-amber-500 text-stone-950 font-bold px-1.5 py-0.2 rounded">TOUCH READY</span>
              </div>
              <p className="text-xs text-stone-300">
                Usa il Foglio di Lavoro interattivo passo-passo con timer automatici, check-list, calcolo scostamenti e annotazioni al volo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onAvviaCottaGuidata()}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs flex items-center gap-1.5 transition shrink-0 active:scale-95 shadow-sm"
          >
            <Flame className="w-4 h-4 fill-current" />
            <span>Avvia Foglio Cotta (Brew Day)</span>
          </button>
        </div>
      )}

      {/* SEZIONE 1: REGISTRA NUOVA COTTA */}
      {sezione === 'nuova_cotta' && (
        <form onSubmit={handleSubmitCotta} className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-bold text-stone-900 text-base">⚗️ Inserimento Cotta & Dati Operativi Sala Cottura</h3>
              <p className="text-xs text-stone-500">I dati generano l&apos;Allegato I per le Dogane e alimentano i consumi di cantina.</p>
            </div>
            {ricette.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-stone-500">Precompila da ricetta:</span>
                <select
                  onChange={(e) => {
                    const r = ricette.find((x) => x.id === parseInt(e.target.value));
                    if (r) handleApplicaRicetta(r);
                  }}
                  className="bg-amber-50 border border-amber-200 text-amber-900 font-semibold rounded-lg px-2.5 py-1 text-xs"
                >
                  <option value="">-- Seleziona Ricetta --</option>
                  {ricette.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_ricetta} ({r.stile_birra})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Dati Generali Cotta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">N° Cotta Annuale *</label>
              <input
                type="text"
                value={cottaNum}
                onChange={(e) => setCottaNum(e.target.value)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Data Cotta *</label>
              <input
                type="date"
                value={dataCotta}
                onChange={(e) => setDataCotta(e.target.value)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Tipo / Nome Birra *</label>
              <input
                type="text"
                value={tipoBirra}
                onChange={(e) => setTipoBirra(e.target.value)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Lotto Sfuso Serbatoio *</label>
              <input
                type="text"
                value={lottoSfuso}
                onChange={(e) => setLottoSfuso(e.target.value)}
                className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono"
                required
              />
            </div>
          </div>

          {/* Volumi e Grado Plato */}
          <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-amber-900 mb-1">Volume Mosto (LT) *</label>
              <input
                type="number"
                step="5"
                value={litriMosto}
                onChange={(e) => setLitriMosto(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-bold p-2.5 bg-white border border-amber-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-900 mb-1">Grado Plato (°P) *</label>
              <input
                type="number"
                step="0.1"
                value={gradoPlato}
                onChange={(e) => setGradoPlato(parseFloat(e.target.value) || 0)}
                className="w-full text-sm font-bold p-2.5 bg-white border border-amber-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-900 mb-1">Contalitri Inizio (LT)</label>
              <input
                type="number"
                step="1"
                value={contInizio}
                onChange={(e) => setContInizio(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-amber-900 mb-1">Contalitri Fine (LT)</label>
              <input
                type="number"
                step="1"
                value={contFine}
                onChange={(e) => setContFine(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2.5 bg-white border border-amber-300 rounded-lg"
              />
            </div>
          </div>

          {/* Materie Prime Impiegate in Cotta */}
          <div>
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">🌾 Materie Prime Impiegate</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Malti / Fermentabili (kg) *</label>
                <input
                  type="number"
                  step="0.5"
                  value={maltoKg}
                  onChange={(e) => setMaltoKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Luppoli Totali (kg) *</label>
                <input
                  type="number"
                  step="0.05"
                  value={luppoloKg}
                  onChange={(e) => setLuppoloKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Lieviti Inoculati (kg) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={lievitoKg}
                  onChange={(e) => setLievitoKg(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
            </div>
          </div>

          {/* Spezie & Aromatizzazioni Multi-ingrediente */}
          <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-800">🌿 Spezie, Zuccheri Canditi & Aromatizzazioni</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <input
                type="text"
                placeholder="es. Buccia arancia amara, Coriandolo..."
                value={nuovaSpeziaNome}
                onChange={(e) => setNuovaSpeziaNome(e.target.value)}
                className="text-xs p-2 bg-white border border-stone-300 rounded-lg flex-1 min-w-[180px]"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={nuovaSpeziaGr}
                  onChange={(e) => setNuovaSpeziaGr(parseFloat(e.target.value) || 0)}
                  className="text-xs p-2 bg-white border border-stone-300 rounded-lg w-20 text-right"
                />
                <span className="text-xs text-stone-500">grammi</span>
              </div>
              <button
                type="button"
                onClick={handleAddSpezia}
                className="text-xs bg-stone-800 hover:bg-stone-900 text-white px-3 py-2 rounded-lg font-semibold"
              >
                + Aggiungi
              </button>
            </div>

            {spezieCotta.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {spezieCotta.map((sp, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300"
                  >
                    <span>
                      {sp.nome} ({sp.grammi}g)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRimuoviSpezia(idx)}
                      className="text-amber-700 hover:text-amber-950 font-bold ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Consumi Energetici & CIP Sanificazione */}
          <div>
            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">⚡ Consumi Energetici & Lavaggio CIP</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Consumo Gas Metano/GPL (Smc)</label>
                <input
                  type="number"
                  step="0.1"
                  value={consumoGas}
                  onChange={(e) => setConsumoGas(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Energia Elettrica (kWh)</label>
                <input
                  type="number"
                  step="0.5"
                  value={consumoEle}
                  onChange={(e) => setConsumoEle(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Acqua di Lavaggio (LT)</label>
                <input
                  type="number"
                  step="10"
                  value={acquaLavaggio}
                  onChange={(e) => setAcquaLavaggio(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Costo Prodotti CIP (€)</label>
                <input
                  type="number"
                  step="0.5"
                  value={costoSanificazione}
                  onChange={(e) => setCostoSanificazione(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition text-sm flex items-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              <span>Salva Cotta nel Registro Allegato I</span>
            </button>
          </div>
        </form>
      )}

      {/* SEZIONE 2: RICETTARIO */}
      {sezione === 'ricette' && (
        <div className="space-y-6">
          <form onSubmit={handleSubmitRicetta} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h3 className="font-bold text-stone-900 text-sm">📖 Salva Nuova Ricetta nel Database</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Nome Ricetta *</label>
                <input
                  type="text"
                  placeholder="es. Red Ale Irlandese"
                  value={ricNome}
                  onChange={(e) => setRicNome(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Stile Birra *</label>
                <input
                  type="text"
                  placeholder="es. Irish Red Ale"
                  value={ricStile}
                  onChange={(e) => setRicStile(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Litri Previsti (LT)</label>
                <input
                  type="number"
                  value={ricLitri}
                  onChange={(e) => setRicLitri(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Grado Plato Previsto (°P)</label>
                <input
                  type="number"
                  step="0.1"
                  value={ricPlato}
                  onChange={(e) => setRicPlato(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Fermentabili Totali (kg)</label>
                <input
                  type="number"
                  value={ricMalto}
                  onChange={(e) => setRicMalto(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Luppoli Totali (Grammi)</label>
                <input
                  type="number"
                  value={ricLupGr}
                  onChange={(e) => setRicLupGr(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Lievito (Grammi)</label>
                <input
                  type="number"
                  value={ricLievGr}
                  onChange={(e) => setRicLievGr(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Note Tecniche di Ammostamento / Luppolatura</label>
              <textarea
                rows={2}
                value={ricNote}
                onChange={(e) => setRicNote(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                placeholder="Rampa di temperatura, profili d'acqua, dry hopping..."
              />
            </div>

            <button
              type="submit"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg"
            >
              Salva Ricetta
            </button>
          </form>

          {/* Elenco ricette */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ricette.map((r) => (
              <div key={r.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-sm">{r.nome_ricetta}</h4>
                  <button
                    onClick={() => onDeleteRicetta(r.id)}
                    className="text-stone-400 hover:text-rose-600 p-1"
                    title="Elimina ricetta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-amber-700 font-semibold">{r.stile_birra}</div>
                <div className="text-xs text-stone-600 space-y-1 pt-1">
                  <div>Litri previsti: <span className="font-semibold">{r.litri_previsti} LT</span> | Grado Plato: <span className="font-semibold">{r.plato_previsto}°P</span></div>
                  <div>Fermentabili: <span className="font-semibold">{r.fermentabili_kg} kg</span> | Luppoli: <span className="font-semibold">{r.luppoli_gr} g</span></div>
                  {r.note && <div className="text-[11px] text-stone-500 italic mt-1">{r.note}</div>}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => handleApplicaRicetta(r)}
                    className="text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold py-1.5 rounded-lg border border-stone-200 text-center"
                  >
                    Carica Dati
                  </button>
                  {onAvviaCottaGuidata && (
                    <button
                      type="button"
                      onClick={() => onAvviaCottaGuidata(r.id)}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 rounded-lg shadow-2xs flex items-center justify-center gap-1"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Cotta Guidata</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SEZIONE 3: STORICO ALLEGATO I */}
      {sezione === 'storico' && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">📋 Registro di Sala Cottura (Allegato I Dogane)</h3>
            <span className="text-xs text-stone-500">{cotte.length} cotte registrate</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 border-b border-stone-200">
                  <th className="p-2.5 font-bold">N° Cotta</th>
                  <th className="p-2.5 font-bold">Data</th>
                  <th className="p-2.5 font-bold">Lotto</th>
                  <th className="p-2.5 font-bold">Birra</th>
                  <th className="p-2.5 font-bold text-right">Litri</th>
                  <th className="p-2.5 font-bold text-right">Plato</th>
                  <th className="p-2.5 font-bold text-right">Malto (kg)</th>
                  <th className="p-2.5 font-bold text-right">Accisa (€)</th>
                  <th className="p-2.5 font-bold text-right">Costo Tot (€)</th>
                  <th className="p-2.5 font-bold text-right">€/LT</th>
                  <th className="p-2.5 font-bold text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {cotte.map((c) => (
                  <tr key={c.id} className="hover:bg-amber-50/40">
                    <td className="p-2.5 font-bold font-mono text-stone-900">{c.cotta_num}</td>
                    <td className="p-2.5 text-stone-600">{c.data}</td>
                    <td className="p-2.5 font-mono text-stone-600">{c.lotto_sfuso}</td>
                    <td className="p-2.5 font-medium text-stone-800">{c.tipo_birra}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-stone-900">{c.litri_mosto.toFixed(1)}</td>
                    <td className="p-2.5 text-right font-mono">{c.grado_plato.toFixed(1)}°P</td>
                    <td className="p-2.5 text-right font-mono">{c.malto_usato_kg.toFixed(1)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-amber-700">€ {c.accisa_dovuta_euro.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono">€ {c.costo_totale_cotta.toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700">€ {c.costo_litro_mosto.toFixed(3)}</td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => onDeleteCotta(c.id)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                        title="Elimina cotta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
