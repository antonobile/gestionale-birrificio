import React, { useState } from 'react';
import { Beer, ShieldCheck, Sparkles, ArrowRight, Lock, User, FileText, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (username: string) => void;
  onRegister: (ragione: string, piva: string, username: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, onRegister }) => {
  const [mostraModal, setMostraModal] = useState(false);
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('BirraNobile2026!');

  // Register form
  const [regRagione, setRegRagione] = useState('Birrificio Artigianale Demo');
  const [regPiva, setRegPiva] = useState('01822710628');
  const [regUser, setRegUser] = useState('mastrobirraio');
  const [regPass, setRegPass] = useState('Password2026!');
  const [regTerms, setRegTerms] = useState(true);

  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim() || !loginPass.trim()) {
      setError('Inserisci nome utente e password.');
      return;
    }
    setError('');
    onLogin(loginUser.trim());
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regRagione.trim() || !regPiva.trim() || !regUser.trim() || !regPass.trim()) {
      setError('Compila tutti i campi contrassegnati.');
      return;
    }
    if (!regTerms) {
      setError('Accetta i termini di servizio e informativa privacy.');
      return;
    }
    setError('');
    onRegister(regRagione.trim(), regPiva.trim(), regUser.trim());
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Hero Showcase Section */}
      <div className="relative overflow-hidden pt-12 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Piattaforma Gestionale Microbirrifici Artigianali 2026</span>
          </div>

          <div className="flex justify-center mb-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
              <div className="w-full h-full bg-stone-900 rounded-[14px] flex items-center justify-center">
                <img
                  src="/brewdesk-icon-concept-1.png"
                  alt="BrewDesk"
                  className="w-14 h-14 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <Beer className="w-10 h-10 text-amber-400" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-stone-100 mb-5">
            Brew<span className="text-amber-500">Desk</span> Pro
          </h1>

          <p className="text-xl sm:text-2xl font-medium text-stone-300 max-w-2xl mx-auto mb-4 leading-snug">
            Cotte, accise, magazzino e scadenze del tuo birrificio, finalmente in perfetto ordine.
          </p>

          <p className="text-stone-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Il software operativo per microbirrifici artigianali italiani: Allegato I Dogane, tracciamento fusti nei pub, calcolo margini al litro e scarico fatture elettroniche XML.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                setTab('login');
                setMostraModal(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold px-6 py-3.5 rounded-xl shadow-lg shadow-amber-500/20 transition transform hover:-translate-y-0.5 text-sm"
            >
              <span>Accedi al Gestionale</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setTab('register');
                setMostraModal(true);
              }}
              className="flex items-center gap-2 bg-stone-800/90 hover:bg-stone-800 text-stone-200 border border-stone-700 px-6 py-3.5 rounded-xl transition text-sm font-semibold"
            >
              <span>Registra Nuovo Birrificio</span>
            </button>
          </div>
        </div>

        {/* Feature Cards Showcase */}
        <div className="max-w-5xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
          <div className="bg-stone-900/80 border border-stone-800 p-6 rounded-2xl">
            <div className="text-2xl mb-3">⚗️</div>
            <h3 className="font-bold text-lg text-stone-100 mb-2">In Sala Cottura & Cantina</h3>
            <p className="text-stone-400 text-xs leading-relaxed">
              Registro Cotte (Allegato I), ricette con profilo ammostamento e spezie, sanificazioni CIP, telemetria fermentatori multi-protocollo e pianificatore cotte con export .ICS.
            </p>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 p-6 rounded-2xl">
            <div className="text-2xl mb-3">📦</div>
            <h3 className="font-bold text-lg text-stone-100 mb-2">In Magazzino & Vendita</h3>
            <p className="text-stone-400 text-xs leading-relaxed">
              Carico automatico acquisti da fatture XML, confezionamento misto lotti, cauzioni fusti PolyKeg/Dolium nei pub, e calcolo automatico costo reale industriale al litro.
            </p>
          </div>

          <div className="bg-stone-900/80 border border-stone-800 p-6 rounded-2xl">
            <div className="text-2xl mb-3">🏛️</div>
            <h3 className="font-bold text-lg text-stone-100 mb-2">Fisco, Bollette & Dogane</h3>
            <p className="text-stone-400 text-xs leading-relaxed">
              Gestione bollette energetiche con scadenze, bilancio annuale Dogane del 31/12 in PDF pronto per la trasmissione e prospetto rimanenze fiscali per il commercialista.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Login / Register */}
      {mostraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-stone-900 border border-amber-900/50 rounded-2xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setMostraModal(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white text-lg p-1"
            >
              ✕
            </button>

            <div className="flex items-center gap-2 mb-6">
              <Beer className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-bold text-white">Area Riservata BrewDesk</h2>
            </div>

            {/* Tab switch */}
            <div className="flex border-b border-stone-800 mb-6">
              <button
                onClick={() => {
                  setTab('login');
                  setError('');
                }}
                className={`flex-1 pb-3 text-sm font-semibold transition ${
                  tab === 'login' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400 hover:text-stone-300'
                }`}
              >
                Accedi
              </button>
              <button
                onClick={() => {
                  setTab('register');
                  setError('');
                }}
                className={`flex-1 pb-3 text-sm font-semibold transition ${
                  tab === 'register' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-stone-400 hover:text-stone-300'
                }`}
              >
                Registra Birrificio
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Nome Utente o Email</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      className="w-full bg-stone-850 border border-stone-750 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="es. admin"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className="w-full bg-stone-850 border border-stone-750 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-stone-400 bg-stone-800/40 p-2.5 rounded-lg border border-stone-800">
                  💡 Credenziali demo già precompilate (Birrificio Nobile, P.IVA 01822710628).
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-3 rounded-xl transition shadow-md shadow-amber-500/10 text-sm mt-2"
                >
                  Entra nel Gestionale
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Ragione Sociale Birrificio *</label>
                  <input
                    type="text"
                    value={regRagione}
                    onChange={(e) => setRegRagione(e.target.value)}
                    className="w-full bg-stone-850 border border-stone-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="es. Birrificio Artigianale Rossi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-300 mb-1">Partita IVA (11 cifre) *</label>
                  <input
                    type="text"
                    value={regPiva}
                    onChange={(e) => setRegPiva(e.target.value)}
                    className="w-full bg-stone-850 border border-stone-750 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="01822710628"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">Nome Utente *</label>
                    <input
                      type="text"
                      value={regUser}
                      onChange={(e) => setRegUser(e.target.value)}
                      className="w-full bg-stone-850 border border-stone-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="mastrobirraio"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-300 mb-1">Password *</label>
                    <input
                      type="password"
                      value={regPass}
                      onChange={(e) => setRegPass(e.target.value)}
                      className="w-full bg-stone-850 border border-stone-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 text-xs text-stone-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regTerms}
                    onChange={(e) => setRegTerms(e.target.checked)}
                    className="mt-0.5 rounded border-stone-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Ho letto e accetto i termini di servizio e l&apos;informativa privacy per la gestione fiscale.</span>
                </label>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold py-3 rounded-xl transition shadow-md shadow-amber-500/10 text-sm mt-3"
                >
                  Registra Birrificio e Accedi
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-800/80 py-6 text-center text-xs text-stone-500">
        <p>BrewDesk Platform 2026 — Sviluppato per Microbirrifici Artigianali Italiani (Reg. TUA art. 35)</p>
      </footer>
    </div>
  );
};
