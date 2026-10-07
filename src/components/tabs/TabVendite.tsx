import React, { useState } from 'react';
import { BirraCondizionata } from '../../types';
import { ShoppingCart, Upload, Plus } from 'lucide-react';

interface TabVenditeProps {
  onAddScaricoVendita: (mov: Omit<BirraCondizionata, 'id'>) => void;
}

export const TabVendite: React.FC<TabVenditeProps> = ({ onAddScaricoVendita }) => {
  const [dataVendita, setDataVendita] = useState(new Date().toISOString().slice(0, 10));
  const [cliente, setCliente] = useState('The Celtic Tavern');
  const [formato, setFormato] = useState('Fusto 24L');
  const [quantita, setQuantita] = useState(2);
  const [riferimento, setRiferimento] = useState('Fatt. 22/2026');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim() || quantita <= 0) return;

    onAddScaricoVendita({
      tipo: 'SCARICO',
      data: dataVendita,
      lotto: '-',
      formato,
      quantita,
      litri_totali: litriTotali,
      grado_plato: 0.0,
      ettogradi: 0.0,
      costo_produzione_litro: 1.15,
      documento_rif: `${riferimento} - ${cliente.trim()}`,
    });

    setCliente('');
    setQuantita(1);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
          <ShoppingCart className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-stone-900 text-sm">🚚 Scarico Vendite Birra (Fatture Emesse / DDT)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Data Consegna / Fattura *</label>
            <input
              type="date"
              value={dataVendita}
              onChange={(e) => setDataVendita(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Cliente / Locale / Distributore *</label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
              placeholder="es. Hop House Pub"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Formato Venduto *</label>
            <select
              value={formato}
              onChange={(e) => setFormato(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
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

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Quantità Venduta (pz) *</label>
            <input
              type="number"
              min="1"
              value={quantita}
              onChange={(e) => setQuantita(parseInt(e.target.value) || 1)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">N° Fattura o DDT</label>
            <input
              type="text"
              value={riferimento}
              onChange={(e) => setRiferimento(e.target.value)}
              className="w-full text-xs p-2 bg-stone-50 border border-stone-300 rounded-lg"
              placeholder="es. Fatt. 18/2026"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-xs text-amber-900 font-medium">Volume scaricato dal magazzino:</span>
            <span className="font-mono font-bold text-amber-900 text-sm">{litriTotali.toFixed(1)} Litri</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-xs text-xs"
          >
            Registra Scarico di Vendita
          </button>
        </div>
      </form>
    </div>
  );
};
