import React, { useState } from 'react';
import { Cotta, MateriaPrima, Imballaggio, BirraCondizionata, AziendaConfig } from '../../types';
import { generateDoganePdf, generateCommercialistaPdf } from '../../utils/pdfGenerator';
import { FileText, Download, Scale, Briefcase } from 'lucide-react';

interface TabReportDoganeProps {
  cotte: Cotta[];
  materiePrime: MateriaPrima[];
  imballaggi: Imballaggio[];
  birraCondizionata: BirraCondizionata[];
  azienda: AziendaConfig;
}

export const TabReportDogane: React.FC<TabReportDoganeProps> = ({
  cotte,
  materiePrime,
  imballaggi,
  birraCondizionata,
  azienda,
}) => {
  const [annoBilancio, setAnnoBilancio] = useState(2026);
  const [tipoAliquota, setTipoAliquota] = useState<'micro' | 'ordinario'>('micro');

  const aliquotaCalcolo = tipoAliquota === 'micro' ? 1.49 : 2.98;

  // Filtra per anno
  const cotteAnno = cotte.filter((c) => c.data.startsWith(`${annoBilancio}`));
  const cotteTotN = cotteAnno.length;
  const litriTotCotte = cotteAnno.reduce((acc, c) => acc + c.litri_mosto, 0);
  const totMcGpl = cotteAnno.reduce((acc, c) => acc + c.consumo_gas_mc, 0);
  const totKwhEle = cotteAnno.reduce((acc, c) => acc + c.consumo_elettrico_kwh, 0);
  const mUsatoTot = cotteAnno.reduce((acc, c) => acc + c.malto_usato_kg, 0);
  const lUsatoTot = cotteAnno.reduce((acc, c) => acc + c.luppolo_usato_kg, 0);
  const yUsatoTotGr = cotteAnno.reduce((acc, c) => acc + c.lievito_usato_kg * 1000, 0);
  const resaMedia =
    cotteAnno.length > 0 ? cotteAnno.reduce((acc, c) => acc + c.resa_perc, 0) / cotteAnno.length : 78.0;

  const mpAcqAnno = materiePrime.filter((m) => m.tipo === 'CARICO' && m.data.startsWith(`${annoBilancio}`));
  const mAcqTot = mpAcqAnno.reduce((acc, m) => acc + m.malto_kg, 0);
  const lAcqTot = mpAcqAnno.reduce((acc, m) => acc + m.luppolo_kg, 0);
  const yAcqTotGr = mpAcqAnno.reduce((acc, m) => acc + m.lievito_kg * 1000, 0);

  // Formati confezionati nell'anno
  const confAnno = birraCondizionata.filter((b) => b.tipo === 'CARICO' && b.data.startsWith(`${annoBilancio}`));
  const countFormato = (fmt: string) =>
    confAnno.filter((b) => b.formato === fmt).reduce((acc, b) => acc + b.quantita, 0);

  const nB33 = countFormato('Bottiglia 0.33L');
  const nB75 = countFormato('Bottiglia 0.75L');
  const nF12 = countFormato('Fusto 12L');
  const nF20 = countFormato('Fusto 20L');
  const nF24 = countFormato('Fusto 24L');
  const nF25 = countFormato('Fusto 25L');
  const nF30 = countFormato('Fusto 30L');

  // Giacenze attuali complessive
  const giacM = materiePrime.reduce((acc, m) => acc + (m.tipo === 'CARICO' ? m.malto_kg : -m.malto_kg), 0);
  const giacL = materiePrime.reduce((acc, m) => acc + (m.tipo === 'CARICO' ? m.luppolo_kg : -m.luppolo_kg), 0);
  const giacY = materiePrime.reduce((acc, m) => acc + (m.tipo === 'CARICO' ? m.lievito_kg : -m.lievito_kg), 0);
  const giacBirraLt = birraCondizionata.reduce(
    (acc, b) => acc + (b.tipo === 'CARICO' ? b.litri_totali : -b.litri_totali),
    0
  );

  // Valorizzazione Rimanenze al 31/12
  const valM = Math.max(0, giacM) * 1.35;
  const valL = Math.max(0, giacL) * 28.5;
  const valY = Math.max(0, giacY) * 65.0;
  const valMpTot = valM + valL + valY;

  // Imballaggi valore
  const valImbTot = imballaggi.reduce(
    (acc, i) => acc + (i.tipo_movimento === 'CARICO' ? i.quantita * i.costo_unitario : -i.quantita * i.costo_unitario),
    0
  );

  // Birra finita valore
  const valPfTot = Math.max(0, giacBirraLt) * 1.15;
  const totBilancio = valMpTot + Math.max(0, valImbTot) + valPfTot;

  const handleScaricaDoganePdf = () => {
    generateDoganePdf({
      anno: annoBilancio,
      cotte_n: cotteTotN,
      litri_cotte: litriTotCotte,
      mc_gpl: totMcGpl,
      kwh_ele: totKwhEle,
      m_acq: mAcqTot,
      m_usat: mUsatoTot,
      l_acq: lAcqTot,
      l_usat: lUsatoTot,
      y_acq_g: yAcqTotGr,
      y_usat_g: yUsatoTotGr,
      b33: nB33,
      b75: nB75,
      f12: nF12,
      f20: nF20,
      f24: nF24,
      f25: nF25,
      f30: nF30,
      giac_m: Math.max(0, giacM),
      giac_l: Math.max(0, giacL),
      giac_y: Math.max(0, giacY),
      giac_birra_lt: Math.max(0, giacBirraLt),
      resa_media: resaMedia,
      ragione_soc: azienda.ragione_sociale,
      piva_az: azienda.piva,
      aliquota_acc: aliquotaCalcolo,
    });
  };

  const handleScaricaCommercialistaPdf = () => {
    generateCommercialistaPdf({
      val_mp: valMpTot,
      val_imb: Math.max(0, valImbTot),
      val_pf: valPfTot,
      tot_bilancio: totBilancio,
      malto: Math.max(0, giacM),
      luppolo: Math.max(0, giacL),
      lievito: Math.max(0, giacY),
      litri_pf: Math.max(0, giacBirraLt),
      ragione_soc: azienda.ragione_sociale,
      piva_az: azienda.piva,
    });
  };

  return (
    <div className="space-y-6">
      {/* Controlli Anno e Aliquota */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-stone-700">Anno Fiscale di Chiusura:</label>
          <select
            value={annoBilancio}
            onChange={(e) => setAnnoBilancio(parseInt(e.target.value))}
            className="text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
          >
            <option value={2026}>Esercizio Fiscale 2026</option>
            <option value={2025}>Esercizio Fiscale 2025</option>
            <option value={2024}>Esercizio Fiscale 2024</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="regimeAccisa"
              checked={tipoAliquota === 'micro'}
              onChange={() => setTipoAliquota('micro')}
              className="text-amber-600 focus:ring-amber-500"
            />
            <span className="font-semibold text-stone-800">Microbirrificio -50% (1,490 €/hl/°P)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="regimeAccisa"
              checked={tipoAliquota === 'ordinario'}
              onChange={() => setTipoAliquota('ordinario')}
              className="text-amber-600 focus:ring-amber-500"
            />
            <span className="font-semibold text-stone-800">Ordinario (2,980 €/hl/°P)</span>
          </label>
        </div>
      </div>

      {/* SEZIONE 1: BILANCIO DOGANE */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-base">
              🏛️ 1. Prospetto Bilancio Dogane Esercizio {annoBilancio} (Comunicazione 31 Gennaio)
            </h3>
          </div>

          <button
            onClick={handleScaricaDoganePdf}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>SCARICA BILANCIO DOGANE (PDF)</span>
          </button>
        </div>

        {/* Indicatori Dogane */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <span className="text-[11px] font-semibold text-amber-900 uppercase">Cotte Realizzate</span>
            <div className="text-xl font-black text-amber-950 font-mono mt-1">{cotteTotN} cotte</div>
          </div>
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <span className="text-[11px] font-semibold text-amber-900 uppercase">Volume Mosto Prodotto</span>
            <div className="text-xl font-black text-amber-950 font-mono mt-1">
              {litriTotCotte.toLocaleString('it-IT', { minimumFractionDigits: 1 })} LT
            </div>
          </div>
          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200">
            <span className="text-[11px] font-semibold text-amber-900 uppercase">Resa Media Sala Cottura</span>
            <div className="text-xl font-black text-amber-950 font-mono mt-1">{resaMedia.toFixed(1)}%</div>
          </div>
        </div>

        {/* Bilancio Energetico */}
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2">
          <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wide">⚡ Bilancio Energetico Dichiarato</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-stone-500">Consumo Gas GPL / Metano: </span>
              <strong className="font-mono text-stone-900">{totMcGpl.toFixed(2)} Smc</strong>
            </div>
            <div>
              <span className="text-stone-500">Consumo Energia Elettrica: </span>
              <strong className="font-mono text-stone-900">{totKwhEle.toFixed(1)} kWh</strong>
            </div>
          </div>
        </div>

        {/* Tabella Bilancio di Materia */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <th className="p-2.5 font-bold">Materia Prima</th>
                <th className="p-2.5 font-bold text-right">Acquistato nel {annoBilancio}</th>
                <th className="p-2.5 font-bold text-right">Impiegato in Cotta ({annoBilancio})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="p-2.5 font-medium text-stone-800">Malto d&apos;orzo & fermentabili</td>
                <td className="p-2.5 text-right font-mono font-bold">{mAcqTot.toFixed(1)} kg</td>
                <td className="p-2.5 text-right font-mono font-bold text-amber-900">{mUsatoTot.toFixed(1)} kg</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-stone-800">Luppolo</td>
                <td className="p-2.5 text-right font-mono font-bold">{lAcqTot.toFixed(2)} kg</td>
                <td className="p-2.5 text-right font-mono font-bold text-amber-900">{lUsatoTot.toFixed(2)} kg</td>
              </tr>
              <tr>
                <td className="p-2.5 font-medium text-stone-800">Lievito</td>
                <td className="p-2.5 text-right font-mono font-bold">{yAcqTotGr.toFixed(0)} gr</td>
                <td className="p-2.5 text-right font-mono font-bold text-amber-900">{yUsatoTotGr.toFixed(0)} gr</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SEZIONE 2: PROSPETTO COMMERCIALISTA */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-stone-900 text-base">
              💼 2. Prospetto Rimanenze Finali di Magazzino al 31/12 (Studio Commerciale)
            </h3>
          </div>

          <button
            onClick={handleScaricaCommercialistaPdf}
            className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            <span>SCARICA PROSPETTO COMMERCIALISTA (PDF)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase">Valore Materie Prime</span>
            <div className="text-lg font-bold font-mono text-stone-900 mt-1">€ {valMpTot.toFixed(2)}</div>
            <p className="text-[11px] text-stone-500 mt-1">Malti, luppoli e lieviti in stock</p>
          </div>
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase">Valore Imballaggi</span>
            <div className="text-lg font-bold font-mono text-stone-900 mt-1">€ {Math.max(0, valImbTot).toFixed(2)}</div>
            <p className="text-[11px] text-stone-500 mt-1">Bottiglie vuote, fusti e tappi</p>
          </div>
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase">Valore Birra Confezionata</span>
            <div className="text-lg font-bold font-mono text-stone-900 mt-1">€ {valPfTot.toFixed(2)}</div>
            <p className="text-[11px] text-stone-500 mt-1">{giacBirraLt.toFixed(1)} LT a magazzino</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center justify-between">
          <span className="text-sm font-bold text-emerald-950 uppercase">Totale Rimanenze Finali di Bilancio al 31/12</span>
          <span className="text-2xl font-black font-mono text-emerald-900">
            € {totBilancio.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
};
