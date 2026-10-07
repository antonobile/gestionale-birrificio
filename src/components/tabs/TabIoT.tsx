import React, { useState } from 'react';
import { FermentatoreConfig, TelemetriaFermentatore } from '../../types';
import { Activity, Plus, Trash2, Sliders, RefreshCw, Radio } from 'lucide-react';

interface TabIoTProps {
  tanks: FermentatoreConfig[];
  telemetria: TelemetriaFermentatore[];
  onAddTank: (tank: Omit<FermentatoreConfig, 'id'>) => void;
  onDeleteTank: (id: number) => void;
  onUpdateSetpoint: (tankName: string, newSetpoint: number) => void;
  onAddTelemetria: (packet: Omit<TelemetriaFermentatore, 'id'>) => void;
}

export const TabIoT: React.FC<TabIoTProps> = ({
  tanks,
  telemetria,
  onAddTank,
  onDeleteTank,
  onUpdateSetpoint,
  onAddTelemetria,
}) => {
  const [subTab, setSubTab] = useState<'dashboard' | 'config' | 'simulatore'>('dashboard');

  // Form Tank Config
  const [numTank, setNumTank] = useState(tanks.length + 1);
  const [nomeTank, setNomeTank] = useState(`Tank 0${tanks.length + 1} - Maturatore`);
  const [protocollo, setProtocollo] = useState('MQTT');
  const [capacita, setCapacita] = useState(600.0);
  const [setpointInit, setSetpointInit] = useState(18.0);

  // Setpoint Control Form
  const [selectedTankForSetpoint, setSelectedTankForSetpoint] = useState(tanks[0]?.nome_tank || '');
  const [newSetpointVal, setNewSetpointVal] = useState(18.0);

  // Simulator
  const [simTank, setSimTank] = useState(tanks[0]?.nome_tank || 'Tank 01 - Cilindroconico');
  const [simLotto, setSimLotto] = useState('LOTTO-2601');
  const [simTemp, setSimTemp] = useState(18.2);
  const [simDens, setSimDens] = useState(4.5);
  const [simPress, setSimPress] = useState(1.2);
  const [simStato, setSimStato] = useState('Fermentazione attiva');

  const handleSaveTank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeTank.trim()) return;
    onAddTank({
      numero_tank: numTank,
      nome_tank: nomeTank.trim(),
      protocollo,
      capacita_lt: capacita,
      setpoint_temperatura: setpointInit,
      stato_attivo: true,
    });
    setNumTank(tanks.length + 2);
    setNomeTank(`Tank 0${tanks.length + 2}`);
  };

  const handleSendSetpoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTankForSetpoint) return;
    onUpdateSetpoint(selectedTankForSetpoint, newSetpointVal);
  };

  const handleSimulatePacket = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toLocaleString('it-IT');
    onAddTelemetria({
      timestamp: now,
      tank_id: simTank,
      lotto: simLotto,
      temperatura: simTemp,
      densita: simDens,
      pressione: simPress,
      setpoint: newSetpointVal,
      stato: simStato,
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-stone-200">
        <button
          onClick={() => setSubTab('dashboard')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            subTab === 'dashboard'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Dashboard Live & Setpoint Remoto</span>
        </button>

        <button
          onClick={() => setSubTab('config')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            subTab === 'config'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Configurazione Serbatoi ({tanks.length})</span>
        </button>

        <button
          onClick={() => setSubTab('simulatore')}
          className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 transition ${
            subTab === 'simulatore'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Simulatore Telemetria IoT</span>
        </button>
      </div>

      {/* DASHBOARD LIVE */}
      {subTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Tanks Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tanks.map((t) => {
              const tel = telemetria.find((x) => x.tank_id === t.nome_tank) || {
                temperatura: t.setpoint_temperatura + 0.2,
                densita: 4.8,
                pressione: 1.2,
                timestamp: 'Live streaming',
                lotto: 'LOTTO-2601',
                stato: 'Fermentazione Controllata',
              };

              return (
                <div key={t.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">{t.nome_tank}</h4>
                      <span className="text-[10px] text-amber-700 font-mono font-semibold">
                        Cap. {t.capacita_lt} LT • Protocollo {t.protocollo}
                      </span>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center py-1">
                    <div className="bg-amber-50/80 p-2 rounded-xl">
                      <div className="text-[10px] text-stone-500 font-medium">Temp. Attuale</div>
                      <div className="text-lg font-black text-amber-900 font-mono">{tel.temperatura.toFixed(1)}°C</div>
                    </div>
                    <div className="bg-stone-50 p-2 rounded-xl">
                      <div className="text-[10px] text-stone-500 font-medium">Setpoint</div>
                      <div className="text-lg font-black text-stone-700 font-mono">{t.setpoint_temperatura.toFixed(1)}°C</div>
                    </div>
                    <div className="bg-indigo-50/80 p-2 rounded-xl">
                      <div className="text-[10px] text-stone-500 font-medium">Densità</div>
                      <div className="text-lg font-black text-indigo-900 font-mono">{tel.densita.toFixed(1)}°P</div>
                    </div>
                  </div>

                  <div className="text-xs text-stone-600 flex justify-between items-center pt-1 border-t border-stone-100">
                    <span>Pressione: <strong className="font-mono">{tel.pressione.toFixed(2)} bar</strong></span>
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {tel.stato}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Controllo Remoto Setpoint Form */}
          <form onSubmit={handleSendSetpoint} className="bg-stone-900 text-white p-5 rounded-2xl shadow-md space-y-3">
            <h4 className="font-bold text-sm text-stone-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Invia Comando Setpoint Temperatura da Remoto</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Seleziona Fermentatore</label>
                <select
                  value={selectedTankForSetpoint}
                  onChange={(e) => setSelectedTankForSetpoint(e.target.value)}
                  className="w-full text-xs p-2.5 bg-stone-850 border border-stone-700 rounded-lg text-white"
                >
                  {tanks.map((t) => (
                    <option key={t.id} value={t.nome_tank}>
                      {t.nome_tank} (attuale: {t.setpoint_temperatura}°C)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1">Nuovo Setpoint Target (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newSetpointVal}
                  onChange={(e) => setNewSetpointVal(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 bg-stone-850 border border-stone-700 rounded-lg text-white font-mono font-bold"
                />
              </div>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold p-2.5 rounded-lg text-xs transition"
              >
                Invia Setpoint via {tanks.find((t) => t.nome_tank === selectedTankForSetpoint)?.protocollo || 'IoT'}
              </button>
            </div>
          </form>

          {/* Tabella Storico Telemetria */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <h4 className="font-bold text-stone-900 text-sm">📡 Log Pacchetti Telemetria Ricevuti</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600">
                    <th className="p-2 font-bold">Data & Ora</th>
                    <th className="p-2 font-bold">Tank</th>
                    <th className="p-2 font-bold">Lotto</th>
                    <th className="p-2 font-bold text-right">Temp (°C)</th>
                    <th className="p-2 font-bold text-right">Setpoint (°C)</th>
                    <th className="p-2 font-bold text-right">Densità (°P)</th>
                    <th className="p-2 font-bold text-right">Pressione (bar)</th>
                    <th className="p-2 font-bold">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {telemetria.map((tel) => (
                    <tr key={tel.id}>
                      <td className="p-2 font-mono text-stone-500">{tel.timestamp}</td>
                      <td className="p-2 font-bold text-stone-800">{tel.tank_id}</td>
                      <td className="p-2 font-mono">{tel.lotto}</td>
                      <td className="p-2 text-right font-mono font-bold text-amber-700">{tel.temperatura.toFixed(1)}</td>
                      <td className="p-2 text-right font-mono text-stone-600">{tel.setpoint.toFixed(1)}</td>
                      <td className="p-2 text-right font-mono">{tel.densita.toFixed(1)}</td>
                      <td className="p-2 text-right font-mono">{tel.pressione.toFixed(2)}</td>
                      <td className="p-2 text-stone-700">{tel.stato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIGURAZIONE SERBATOI */}
      {subTab === 'config' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveTank} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <h4 className="font-bold text-stone-900 text-sm">➕ Aggiungi Nuovo Fermentatore / Tank</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Numero Tank</label>
                <input
                  type="number"
                  value={numTank}
                  onChange={(e) => setNumTank(parseInt(e.target.value) || 1)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Nome Identificativo</label>
                <input
                  type="text"
                  value={nomeTank}
                  onChange={(e) => setNomeTank(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Protocollo IoT</label>
                <select
                  value={protocollo}
                  onChange={(e) => setProtocollo(e.target.value)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                >
                  <option value="MQTT">MQTT (Sensori Standard)</option>
                  <option value="iSpindel">iSpindel (Densimetro WiFi)</option>
                  <option value="Modbus TCP">Modbus TCP (PLC Cantina)</option>
                  <option value="OPC UA">OPC UA (Automazione Industriale)</option>
                  <option value="Inkbird">Inkbird (Bridge Cloud)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Capacità (LT)</label>
                <input
                  type="number"
                  value={capacita}
                  onChange={(e) => setCapacita(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Setpoint Temp. (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={setpointInit}
                  onChange={(e) => setSetpointInit(parseFloat(e.target.value) || 0)}
                  className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg"
            >
              Salva Serbatoio
            </button>
          </form>

          {/* Elenco Tanks */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
            <h4 className="font-bold text-stone-900 text-sm mb-3">Elenco Serbatoi Configurati</h4>
            <div className="divide-y divide-stone-100">
              {tanks.map((t) => (
                <div key={t.id} className="py-3 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-stone-900 text-sm">{t.nome_tank}</h5>
                    <div className="text-xs text-stone-500">
                      Capacità: <span className="font-semibold text-stone-700">{t.capacita_lt} L</span> • Protocollo: <span className="font-semibold text-amber-700">{t.protocollo}</span> • Setpoint base: <span className="font-semibold text-stone-700">{t.setpoint_temperatura}°C</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteTank(t.id)}
                    className="text-stone-400 hover:text-rose-600 p-2"
                    title="Rimuovi Tank"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SIMULATORE TELEMETRIA */}
      {subTab === 'simulatore' && (
        <form onSubmit={handleSimulatePacket} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <h4 className="font-bold text-stone-900 text-sm">🧪 Simulatore Pacchetto Dati Telemetria</h4>
          <p className="text-xs text-stone-500">
            Simula l&apos;invio di metriche da densimetri WiFi (iSpindel) o sonde temperatura verso il database centrale.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Fermentatore</label>
              <select
                value={simTank}
                onChange={(e) => setSimTank(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              >
                {tanks.map((t) => (
                  <option key={t.id} value={t.nome_tank}>
                    {t.nome_tank}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Lotto Birra</label>
              <input
                type="text"
                value={simLotto}
                onChange={(e) => setSimLotto(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Stato Operativo</label>
              <input
                type="text"
                value={simStato}
                onChange={(e) => setSimStato(e.target.value)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Temperatura Rilevata (°C)</label>
              <input
                type="number"
                step="0.1"
                value={simTemp}
                onChange={(e) => setSimTemp(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Densità Rilevata (°P Plato)</label>
              <input
                type="number"
                step="0.1"
                value={simDens}
                onChange={(e) => setSimDens(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Pressione Spunding (bar)</label>
              <input
                type="number"
                step="0.05"
                value={simPress}
                onChange={(e) => setSimPress(parseFloat(e.target.value) || 0)}
                className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-lg shadow-sm"
          >
            🚀 Simula Ricezione Pacchetto Dati
          </button>
        </form>
      )}
    </div>
  );
};
