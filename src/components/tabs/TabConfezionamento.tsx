import React, { useState } from 'react';
import { Cotta, BirraCondizionata } from '../../types';
import { Layers, Beer, CheckCircle2 } from 'lucide-react';

interface TabConfezionamentoProps {
  cotte: Cotta[];
  onAddConfezionamento: (movs: Omit<BirraCondizionata, 'id'>[]) => void;
}

export const TabConfezionamento: React.FC<TabConfezionamentoProps> = ({ cotte, onAddConfezionamento }) => {
  const [cottaId, setCottaId] = useState<number>(cotte[0]?.id || 0);
  const cottaSelezionata = cotte.find((c) => c.id === cottaId) || cotte[0];

  const [dataConf, setDataConf] = useState(new Date().toISOString().slice(0, 10));
  const [lotto, setLotto] = useState(cottaSelezionata?.lotto_sfuso || 'LOTTO-2601');
  const [costoProduzioneLt, setCostoProduzioneLt] = useState(1.15);

  // Formati Fusti
  const [qF12, setQF12] = useState(0);
  const [qF20, setQF20] = useState(0);
  const [qF24, setQF24] = useState(10);
  const [qF25, setQF25] = useState(0);
  const [qF30, setQF30] = useState(0);

  // Formati Bottiglie
  const [qB33, setQB33] = useState(600);
  const [qB75, setQB75] = useState(0);

  // Calcolo Litri
  const litriTeorici =
    qF12 * 12.0 +
    qF20 * 20.0 +
    qF24 * 24.0 +
    qF25 * 25.0 +
    qF30 * 30.0 +
    qB33 * 0.33 +
    qB75 * 0.75;

  const litriInizialiCotta = cottaSelezionata?.litri_mosto || 500.0;
  const scartoTeorico = Math.max(0, litriInizialiCotta - litriTeorici);
  const [scartoReale, setScartoReale] = useState(scartoTeorico);

  const platoRif = cottaSelezionata?.grado_plato || 13.5;
  const ettogradiTot = (litriTeorici * platoRif) / 100.0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (litriTeorici <= 0) return;

    const movs: Omit<BirraCondizionata, 'id'>[] = [];

    const aggiungiFormato = (fmt: string, qta: number, ltUn: number) => {
      if (qta > 0) {
        const lt = qta * ltUn;
        movs.push({
          tipo: 'CARICO',
          data: dataConf,
          lotto,
          formato: fmt,
          quantita: qta,
          litri_totali: lt,
          grado_plato: platoRif,
          ettogradi: (lt * platoRif) / 100.0,
          scarto_litri: movs.length === 0 ? scartoReale : 0,
          costo_produzione_litro: costoProduzioneLt,
          documento_rif: 'CONFEZIONAMENTO',
        });
      }
    };

    aggiungiFormato('Fusto 12L', qF12, 12.0);
    aggiungiFormato('Fusto 20L', qF20, 20.0);
    aggiungiFormato('Fusto 24L', qF24, 24.0);
    aggiungiFormato('Fusto 25L', qF25, 25.0);
    aggiungiFormato('Fusto 30L', qF30, 30.0);
    aggiungiFormato('Bottiglia 0.33L', qB33, 0.33);
    aggiungiFormato('Bottiglia 0.75L', qB75, 0.75);

    onAddConfezionamento(movs);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div>
          <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-600" />
            <span>📦 Confezionamento Misto Cotta (Fusti e Bottiglie)</span>
          </h3>
          <p className="text-xs text-stone-500">
            Prendi in carico una cotta fermentata e suddividila contemporaneamente in fusti e bottiglie a magazzino.
          </p>
        </div>

        {cotte.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-stone-600">Seleziona Cotta:</span>
            <select
              value={cottaId}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                setCottaId(id);
                const c = cotte.find((x) => x.id === id);
                if (c) {
                  setLotto(c.lotto_sfuso);
                  setCostoProduzioneLt(c.costo_litro_mosto * 1.35 || 1.15);
                }
              }}
              className="bg-amber-50 border border-amber-300 text-amber-950 font-bold p-1.5 rounded-lg text-xs"
            >
              {cotte.map((c) => (
                <option key={c.id} value={c.id}>
                  Cotta {c.cotta_num} ({c.tipo_birra}) - {c.litri_mosto} LT - {c.grado_plato}°P
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Dati Generali Confezionamento */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">Data Confezionamento *</label>
          <input
            type="date"
            value={dataConf}
            onChange={(e) => setDataConf(e.target.value)}
            className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">Lotto Birra Confezionata *</label>
          <input
            type="text"
            value={lotto}
            onChange={(e) => setLotto(e.target.value)}
            className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">Costo Produzione Pieno (€/LT)</label>
          <input
            type="number"
            step="0.05"
            value={costoProduzioneLt}
            onChange={(e) => setCostoProduzioneLt(parseFloat(e.target.value) || 0)}
            className="w-full text-xs p-2.5 bg-stone-50 border border-stone-300 rounded-lg font-mono"
          />
        </div>
      </div>

      {/* Ripartizione Fusti */}
      <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200">
        <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider mb-3">🛢️ Fusti da Confezionare</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Fusti 12L (pz)</label>
            <input
              type="number"
              min="0"
              value={qF12}
              onChange={(e) => setQF12(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono text-center font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Fusti 20L (pz)</label>
            <input
              type="number"
              min="0"
              value={qF20}
              onChange={(e) => setQF20(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono text-center font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Fusti 24L (pz)</label>
            <input
              type="number"
              min="0"
              value={qF24}
              onChange={(e) => setQF24(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono text-center font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Fusti 25L (pz)</label>
            <input
              type="number"
              min="0"
              value={qF25}
              onChange={(e) => setQF25(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono text-center font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Fusti 30L (pz)</label>
            <input
              type="number"
              min="0"
              value={qF30}
              onChange={(e) => setQF30(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg font-mono text-center font-bold"
            />
          </div>
        </div>
      </div>

      {/* Ripartizione Bottiglie */}
      <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-3">🍾 Bottiglie da Confezionare</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Bottiglie 0.33L (Pezzi)</label>
            <input
              type="number"
              min="0"
              step="12"
              value={qB33}
              onChange={(e) => setQB33(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2.5 bg-white border border-stone-300 rounded-lg font-mono font-bold"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">Volume: {(qB33 * 0.33).toFixed(1)} LT</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Bottiglie 0.75L (Pezzi)</label>
            <input
              type="number"
              min="0"
              step="6"
              value={qB75}
              onChange={(e) => setQB75(parseInt(e.target.value) || 0)}
              className="w-full text-xs p-2.5 bg-white border border-stone-300 rounded-lg font-mono font-bold"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">Volume: {(qB75 * 0.75).toFixed(1)} LT</span>
          </div>
        </div>
      </div>

      {/* Bilancio Volumi e Scarti */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <div>
          <span className="text-xs font-semibold text-stone-600">Litri Totali Confezionati</span>
          <div className="text-2xl font-black font-mono text-stone-900 mt-0.5">{litriTeorici.toFixed(1)} LT</div>
        </div>
        <div>
          <span className="text-xs font-semibold text-stone-600">Ettogradi Fiscali (°E)</span>
          <div className="text-2xl font-black font-mono text-amber-800 mt-0.5">{ettogradiTot.toFixed(2)} °E</div>
        </div>
        <div>
          <span className="text-xs font-semibold text-stone-600">Scarto di Cantina Rilevato (LT)</span>
          <input
            type="number"
            step="1"
            value={scartoReale}
            onChange={(e) => setScartoReale(parseFloat(e.target.value) || 0)}
            className="w-full text-sm p-1.5 bg-white border border-amber-300 rounded-lg font-mono font-bold mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition text-sm flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Carica Tutti i Formati a Magazzino</span>
        </button>
      </div>
    </form>
  );
};
