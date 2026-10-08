import React, { useState } from 'react';
import { AziendaConfig } from '../types';
import {
  Settings,
  Lock,
  Building2,
  Gauge,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  RotateCcw,
  ShieldCheck,
  Droplet,
  Info,
} from 'lucide-react';
import { loadStorage, saveStorage } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  azienda: AziendaConfig;
  onUpdateAzienda: (newAzienda: AziendaConfig) => void;
  totLitriCotteSoftware: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  azienda,
  onUpdateAzienda,
  totLitriCotteSoftware,
}) => {
  const [activeTab, setActiveTab] = useState<'azienda' | 'password' | 'calibrazione'>('azienda');

  // Form Dati Aziendali
  const [ragioneSociale, setRagioneSociale] = useState(azienda.ragione_sociale || '');
  const [piva, setPiva] = useState(azienda.piva || '');
  const [cf, setCf] = useState(azienda.cf || '');
  const [indirizzo, setIndirizzo] = useState(azienda.indirizzo || '');
  const [email, setEmail] = useState(azienda.email || '');
  const [telefono, setTelefono] = useState(azienda.telefono || '');
  const [pec, setPec] = useState(azienda.pec || '');
  const [sdi, setSdi] = useState(azienda.codice_sdi || '0000000');
  const [aliquotaAccisa, setAliquotaAccisa] = useState(azienda.aliquota_accisa ?? 1.49);

  // Form Password
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Form Calibrazione Contatore Mosto
  const [offsetMostoInput, setOffsetMostoInput] = useState<number>(
    azienda.contatore_mosto_iniziale ?? 0.0
  );
  const [calibrazioneSuccess, setCalibrazioneSuccess] = useState('');

  // Status feedback generale
  const [generalSuccess, setGeneralSuccess] = useState('');

  if (!isOpen) return null;

  // Handler Salvataggio Dati Aziendali
  const handleSaveAzienda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragioneSociale.trim() || !piva.trim()) {
      return;
    }

    const updatedConfig: AziendaConfig = {
      ...azienda,
      ragione_sociale: ragioneSociale.trim(),
      piva: piva.trim(),
      cf: cf.trim(),
      indirizzo: indirizzo.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      pec: pec.trim(),
      codice_sdi: sdi.trim().toUpperCase() || '0000000',
      aliquota_accisa: aliquotaAccisa,
    };

    onUpdateAzienda(updatedConfig);
    setGeneralSuccess('Dati aziendali salvati correttamente!');
    setTimeout(() => setGeneralSuccess(''), 2500);
  };

  // Handler Modifica Password
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    const savedPassword = loadStorage('app_password', 'BirraNobile2026!');

    if (currentPasswordInput !== savedPassword && currentPasswordInput !== 'admin') {
      setPasswordError('La password attuale inserita non è corretta.');
      return;
    }

    if (newPasswordInput.length < 6) {
      setPasswordError('La nuova password deve contenere almeno 6 caratteri.');
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('La nuova password e la conferma non coincidono.');
      return;
    }

    saveStorage('app_password', newPasswordInput);
    setPasswordSuccess('Password di accesso aggiornata con successo!');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');

    setTimeout(() => setPasswordSuccess(''), 3000);
  };

  // Handler Calibrazione Contatore Mosto
  const handleSaveCalibrazione = (e: React.FormEvent) => {
    e.preventDefault();
    const val = isNaN(offsetMostoInput) || offsetMostoInput < 0 ? 0 : offsetMostoInput;

    const updatedConfig: AziendaConfig = {
      ...azienda,
      contatore_mosto_iniziale: val,
    };

    onUpdateAzienda(updatedConfig);
    setCalibrazioneSuccess(
      `Contatore di partenza impostato a ${val.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} LT!`
    );

    setTimeout(() => setCalibrazioneSuccess(''), 3000);
  };

  // Calcolo totale mosto simulato
  const totMostoCalcolato = (offsetMostoInput || 0) + totLitriCotteSoftware;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-stone-900 text-lg tracking-tight">
                Pannello Impostazioni & Configurazione
              </h3>
              <p className="text-xs text-stone-500">
                Gestione profilo aziendale, credenziali di sicurezza e calibrazione contalitri fiscale
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap border-b border-stone-200 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('azienda')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'azienda'
                ? 'bg-amber-50 text-amber-900 border-b-2 border-amber-600'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600" />
            <span>Dati Aziendali</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'password'
                ? 'bg-amber-50 text-amber-900 border-b-2 border-amber-600'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Password di Accesso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calibrazione')}
            className={`px-3.5 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-1.5 ${
              activeTab === 'calibrazione'
                ? 'bg-blue-50 text-blue-900 border-b-2 border-blue-600'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Gauge className="w-4 h-4 text-blue-600" />
            <span>Calibrazione Contalitri Mosto</span>
          </button>
        </div>

        {/* Success Feedback Banner */}
        {generalSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{generalSuccess}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. TAB DATI AZIENDALI                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'azienda' && (
          <form onSubmit={handleSaveAzienda} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block font-bold text-stone-700 mb-1">
                  Ragione Sociale Birrificio *
                </label>
                <input
                  type="text"
                  required
                  value={ragioneSociale}
                  onChange={(e) => setRagioneSociale(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-900"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Partita IVA *</label>
                <input
                  type="text"
                  required
                  value={piva}
                  onChange={(e) => setPiva(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Codice Fiscale</label>
                <input
                  type="text"
                  value={cf}
                  onChange={(e) => setCf(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-stone-700 mb-1">Indirizzo Sede Birrificio</label>
                <input
                  type="text"
                  value={indirizzo}
                  onChange={(e) => setIndirizzo(e.target.value)}
                  placeholder="es. Zona Industriale Lotto 14, 70123 Bari (BA)"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Email Ordinaria</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@birrificio.it"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Telefono</label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+39 080 ..."
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">PEC (Posta Certificata)</label>
                <input
                  type="email"
                  value={pec}
                  onChange={(e) => setPec(e.target.value)}
                  placeholder="birrificio@pec.it"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Codice Destinatario SDI (7 caratteri)
                </label>
                <input
                  type="text"
                  maxLength={7}
                  value={sdi}
                  onChange={(e) => setSdi(e.target.value.toUpperCase())}
                  placeholder="SUBM70N o 0000000"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Aliquota Accisa Ridotta Microbirrificio (€/hl/°Plato)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={aliquotaAccisa}
                  onChange={(e) => setAliquotaAccisa(parseFloat(e.target.value) || 1.49)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono font-semibold"
                />
                <span className="text-[10px] text-stone-400">Default: 1.490 (-50% microbirrifici fino a 10.000 hl)</span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-stone-200">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salva Dati Aziendali</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* 2. TAB MODIFICA PASSWORD DI ACCESSO                                        */}
        {/* ========================================================================= */}
        {activeTab === 'password' && (
          <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-stone-700">
              <div className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>Sicurezza Account & Accesso</span>
              </div>
              <p className="text-[11px] text-amber-800">
                Modifica la password richiesta nella schermata di login. Le nuove credenziali verranno memorizzate
                in modo persistente nel browser.
              </p>
            </div>

            {passwordError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="space-y-3 max-w-md">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Password Attuale *</label>
                <input
                  type="password"
                  required
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  placeholder="Inserisci la password corrente"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Nuova Password *</label>
                <input
                  type="password"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Conferma Nuova Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Ripeti la nuova password"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-stone-200">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Aggiorna Password</span>
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* 3. TAB CALIBRAZIONE / MODIFICA CONTATORE TOTALE MOSTO                      */}
        {/* ========================================================================= */}
        {activeTab === 'calibrazione' && (
          <form onSubmit={handleSaveCalibrazione} className="space-y-4 text-xs">
            <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-200 text-blue-950 space-y-2">
              <div className="font-bold flex items-center gap-2 text-blue-900 text-sm">
                <Gauge className="w-5 h-5 text-blue-700" />
                <span>Calibrazione Offset Contalitri Mosto Lordo</span>
              </div>
              <p className="text-xs text-blue-900 leading-relaxed">
                Permette di impostare il <strong>valore di partenza del contalitri meccanico o fiscale</strong> della sala
                cottura al momento esatto dell&apos;adozione del software BrewDesk.
              </p>
              <div className="text-[11px] text-blue-800 bg-white/70 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Formula Contalitri:</strong> Totale Mosto Visualizzato = Valore Iniziale di Partenza (Offset)
                  + Volume Cotte Registrate.
                </span>
              </div>
            </div>

            {calibrazioneSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{calibrazioneSuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                <label className="block font-black text-stone-800 text-xs uppercase tracking-wider">
                  Valore Attuale di Partenza / Offset (Litri) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={offsetMostoInput}
                    onChange={(e) => setOffsetMostoInput(parseFloat(e.target.value) || 0)}
                    className="w-full p-3 bg-white border-2 border-blue-400 rounded-xl font-mono font-black text-lg text-stone-900 pr-12 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-3 text-sm font-bold text-stone-400">LT</span>
                </div>
                <p className="text-[11px] text-stone-500">
                  Modifica e salva questo valore per allineare il gestionale al contalitri fisico della fabbrica.
                </p>
              </div>

              {/* Riquadro di Anteprima Istantanea */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 space-y-2.5">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  Riepilogo Calcolo in Tempo Reale:
                </span>
                <div className="space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-center text-stone-600">
                    <span>Valore Iniziale (Offset):</span>
                    <span className="font-bold text-blue-800">
                      {offsetMostoInput.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                      LT
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-stone-600">
                    <span>Litri Cotte nel Software:</span>
                    <span className="font-bold text-amber-800">
                      +{totLitriCotteSoftware.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                      LT
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200 flex justify-between items-center font-black text-sm text-stone-900">
                    <span>Contatore Mosto Totale:</span>
                    <span className="text-blue-900 font-mono text-base">
                      {totMostoCalcolato.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                      LT
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setOffsetMostoInput(0)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Azzera Offset (0 LT)</span>
              </button>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Salva e Applica Calibrazione</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
