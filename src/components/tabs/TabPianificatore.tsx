import React, { useState } from 'react';
import { PianificazioneCotta, FermentatoreConfig, Ricetta } from '../../types';
import { generateIcs, downloadIcsFile, getGoogleCalendarUrl } from '../../utils/calendar';
import { CalendarRange, Plus, AlertTriangle, CheckCircle, Trash2, Calendar, Flame } from 'lucide-react';

interface TabPianificatoreProps {
  piani: PianificazioneCotta[];
  tanks: FermentatoreConfig[];
  ricette: Ricetta[];
  onAddPiano: (piano: Omit<PianificazioneCotta, 'id'>) => void;
  onUpdateStatoPiano: (id: number, stato: PianificazioneCotta['stato']) => void;
  onDeletePiano: (id: number) => void;
  onAvviaCottaGuidata?: (ricettaId?: number) => void;
}

export const TabPianificatore: React.FC<TabPianificatoreProps> = ({
  piani,
  tanks,
  ricette,
  onAddPiano,
  onUpdateStatoPiano,
  onDeletePiano,
  onAvviaCottaGuidata,
}) => {
  const [mostraForm, setMostraForm] = useState(false);

  // Form State
  const [nomeBirra, setNomeBirra] = useState('Bionda Belga Speciale - Cotta 05');
  const [stile, setStile] = useState('Belgian Blonde Ale');
  const [litri, setLitri] = useState(500.0);
  const [dataCotta, setDataCotta] = useState(new Date().toISOString().slice(0, 10));
  const [giorniMat, setGiorniMat] = useState(14);
  const [contenitore, setContenitore] = useState('PolyKeg');
  const [formatoLitri, setFormatoLitri] = useState(24.0);
  const [caloPerc, setCaloPerc] = useState(8.0);
  const [tankScelto, setTankScelto] = useState(tanks[0]?.nome_tank || '');
  const [noteText, setNoteText] = useState('');

  // Auto calc data confezionamento
  const dCottaObj = new Date(dataCotta);
  const dConfObj = new Date(dCottaObj);
  dConfObj.setDate(dConfObj.getDate() + giorniMat);
  const dataConf = dConfObj.toISOString().slice(0, 10);

  // Calcolo fusti
  const litriUtili = Math.max(0, litri * (1.0 - caloPerc / 100.0));
  const nFusti = formatoLitri > 0 ? Math.floor(litriUtili / formatoLitri) : 0;
  const restoLitri = Math.max(0, litriUtili - nFusti * formatoLitri);

  // Controllo conflitti tank
  const conflitti = piani.filter((p) => {
    if (p.stato === 'CONFEZIONATA' || p.stato === 'ANNULLATA') return false;
    if (p.tank !== tankScelto) return false;
    // Overlap check
    return p.data_cotta <= dataConf && dataCotta <= p.data_confezionamento;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeBirra.trim()) return;

    onAddPiano({
      nome_birra: nomeBirra.trim(),
      stile: stile.trim(),
      litri_stimati: litri,
      data_cotta: dataCotta,
      data_confezionamento: dataConf,
      contenitore,
      formato_litri: formatoLitri,
      calo_stimato_perc: caloPerc,
      n_fusti: nFusti,
      tank: tankScelto,
      stato: 'PIANIFICATA',
      note: noteText.trim(),
    });

    setNomeBirra('');
    setNoteText('');
    setMostraForm(false);
  };

  const handleScaricaIcs = (p: PianificazioneCotta) => {
    const ics = generateIcs([
      {
        uid: `brewdesk-cotta-${p.id}@brewdesk`,
        title: `🍺 Cotta: ${p.nome_birra} (${p.litri_stimati} LT)`,
        start: p.data_cotta,
        description: `Stile: ${p.stile} | Serbatoio: ${p.tank} | Confezionamento: ${p.data_confezionamento}`,
      },
      {
        uid: `brewdesk-conf-${p.id}@brewdesk`,
        title: `📦 Confezionamento: ${p.nome_birra} (${p.n_fusti} fusti ${p.contenitore} ${p.formato_litri}L)`,
        start: p.data_confezionamento,
        description: `Serbatoio: ${p.tank} | Volume utile stimato: ${(p.litri_stimati * (1 - p.calo_stimato_perc / 100)).toFixed(1)} LT`,
      },
    ]);
    downloadIcsFile(`pianificazione_cotta_${p.id}.ics`, ics);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div>
          <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-amber-600" />
            <span>🗓️ Pianificatore Cotte & Occupazione Serbatoi</span>
          </h3>
          <p className="text-xs text-stone-500">
            Programma i cicli di fermentazione e maturazione in cantina per evitare sovrapposizioni sui tank.
          </p>
        </div>

        <button
          onClick={() => setMostraForm(!mostraForm)}
          className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Pianifica Nuova Cotta</span>
        </button>
      </div>

      {/* Form Nuova Pianificazione */}
      {mostraForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
            <h4 className="font-bold text-stone-900 text-sm">Pianifica Brassaggio e Maturazione</h4>
            {ricette.length > 0 && (
              <select
                onChange={(e) => {
                  const r = ricette.find((x) => x.id === parseInt(e.target.value));
                  if (r) {
                    setNomeBirra(`${r.nome_ricetta} - Cotta ${piani.length + 1}`);
                    setStile(r.stile_birra);
                    setLitri(r.litri_previsti);
                  }
                }}
                className="text-xs p-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-semibold"
              >
                <option value="">-- Parti da una ricetta --</option>
                {ricette.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome_ricetta} ({r.stile_birra})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Nome Birra / Cotta *</label>
              <input
                type="text"
                value={nomeBirra}
                onChange={(e) => setNomeBirra(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Stile</label>
              <input
                type="text"
                value={stile}
                onChange={(e) => setStile(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Litri Stimati Mosto</label>
              <input
                type="number"
                step="50"
                value={litri}
                onChange={(e) => setLitri(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Cotta *</label>
              <input
                type="date"
                value={dataCotta}
                onChange={(e) => setDataCotta(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Giorni Maturazione</label>
              <input
                type="number"
                min="3"
                max="90"
                value={giorniMat}
                onChange={(e) => setGiorniMat(parseInt(e.target.value) || 14)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Data Confezionamento</label>
              <input
                type="text"
                value={dataConf}
                disabled
                className="w-full text-xs p-2 bg-stone-100 border border-stone-200 rounded-lg font-mono font-bold text-stone-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Serbatoio Assegnato</label>
              <select
                value={tankScelto}
                onChange={(e) => setTankScelto(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
              >
                {tanks.map((t) => (
                  <option key={t.id} value={t.nome_tank}>
                    {t.nome_tank} ({t.capacita_lt} L)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Formati e Resa Fusti */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Contenitore & Formato</label>
              <div className="flex gap-2">
                <select
                  value={contenitore}
                  onChange={(e) => setContenitore(e.target.value)}
                  className="w-1/2 text-xs p-2 bg-white border border-stone-300 rounded-lg"
                >
                  <option value="PolyKeg">PolyKeg</option>
                  <option value="Dolium">Dolium</option>
                  <option value="Fusto Acciaio">Fusto Acciaio</option>
                </select>
                <select
                  value={formatoLitri}
                  onChange={(e) => setFormatoLitri(parseFloat(e.target.value) || 24)}
                  className="w-1/2 text-xs p-2 bg-white border border-stone-300 rounded-lg"
                >
                  <option value={20}>20 Litri</option>
                  <option value={24}>24 Litri</option>
                  <option value={25}>25 Litri</option>
                  <option value={30}>30 Litri</option>
                  <option value={12}>12 Litri</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Calo Stimato (%)</label>
              <input
                type="number"
                step="0.5"
                value={caloPerc}
                onChange={(e) => setCaloPerc(parseFloat(e.target.value) || 8)}
                className="w-full text-xs p-2 bg-white border border-stone-300 rounded-lg"
              />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] text-stone-500">Resa Prevista Fusti:</span>
              <span className="text-base font-black text-amber-900 font-mono">
                {nFusti} fusti pieni <span className="text-xs font-normal text-stone-600">(resto {restoLitri.toFixed(1)} L)</span>
              </span>
            </div>
          </div>

          {/* Conflict Warning */}
          {conflitti.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Attenzione! Possibile sovrapposizione serbatoio:</strong>
                {conflitti.map((c) => (
                  <div key={c.id} className="mt-0.5">
                    «{c.tank}» è già occupato da {c.nome_birra} ({c.data_cotta} → {c.data_confezionamento})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setMostraForm(false)}
              className="text-xs px-3 py-1.5 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-100"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg shadow-sm"
            >
              Salva in Calendario
            </button>
          </div>
        </form>
      )}

      {/* Elenco Cotte Pianificate */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <h4 className="font-bold text-stone-900 text-sm">📋 Programma di Produzione Cantina</h4>

        {piani.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-xs italic">
            Nessuna cotta attualmente pianificata.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                  <th className="p-2.5 font-bold">Stato</th>
                  <th className="p-2.5 font-bold">Birra & Stile</th>
                  <th className="p-2.5 font-bold">Serbatoio</th>
                  <th className="p-2.5 font-bold">Data Cotta</th>
                  <th className="p-2.5 font-bold">Data Confezionamento</th>
                  <th className="p-2.5 font-bold text-right">Litri</th>
                  <th className="p-2.5 font-bold text-right">Fusti Previsti</th>
                  <th className="p-2.5 font-bold text-center">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {piani.map((p) => {
                  const gCalCotta = getGoogleCalendarUrl(`Cotta: ${p.nome_birra}`, p.data_cotta, `Serbatoio: ${p.tank}`);
                  return (
                    <tr key={p.id} className="hover:bg-amber-50/20">
                      <td className="p-2.5">
                        <select
                          value={p.stato}
                          onChange={(e) => onUpdateStatoPiano(p.id, e.target.value as any)}
                          className="text-[11px] font-bold p-1 rounded-md border border-stone-200 bg-white"
                        >
                          <option value="PIANIFICATA">🗓️ PIANIFICATA</option>
                          <option value="IN FERMENTAZIONE">🫧 IN FERMENTAZIONE</option>
                          <option value="CONFEZIONATA">✅ CONFEZIONATA</option>
                          <option value="ANNULLATA">❌ ANNULLATA</option>
                        </select>
                      </td>
                      <td className="p-2.5 font-bold text-stone-900">
                        <div>{p.nome_birra}</div>
                        <div className="text-[11px] text-stone-500 font-normal">{p.stile}</div>
                      </td>
                      <td className="p-2.5 font-medium text-amber-800">{p.tank}</td>
                      <td className="p-2.5 font-mono text-stone-900 font-bold">{p.data_cotta}</td>
                      <td className="p-2.5 font-mono text-stone-900 font-bold">{p.data_confezionamento}</td>
                      <td className="p-2.5 text-right font-mono font-bold">{p.litri_stimati} L</td>
                      <td className="p-2.5 text-right font-mono font-bold text-stone-900">
                        {p.n_fusti} x {p.formato_litri}L
                      </td>
                      <td className="p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onAvviaCottaGuidata && (
                            <button
                              onClick={() => {
                                const matchedRicetta = ricette.find((r) =>
                                  p.nome_birra.toLowerCase().includes(r.nome_ricetta.toLowerCase())
                                );
                                onAvviaCottaGuidata(matchedRicetta?.id);
                              }}
                              className="p-1 rounded text-amber-600 hover:text-amber-800 hover:bg-amber-100 transition"
                              title="Avvia Foglio Cotta (Brew Day Log)"
                            >
                              <Flame className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleScaricaIcs(p)}
                            className="p-1 rounded text-stone-400 hover:text-amber-700"
                            title="Scarica file .ICS"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={gCalCotta}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded text-stone-400 hover:text-amber-700"
                            title="Aggiungi a Google Calendar"
                          >
                            <CalendarRange className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => onDeletePiano(p.id)}
                            className="p-1 rounded text-stone-400 hover:text-rose-600"
                            title="Elimina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
