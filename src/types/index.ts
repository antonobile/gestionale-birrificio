export interface Utente {
  id: number;
  username: string;
  ragione_sociale: string;
  piva: string;
  azienda_id: string;
  ruolo: 'admin' | 'operatore';
}

export interface AziendaConfig {
  ragione_sociale: string;
  piva: string;
  cf: string;
  aliquota_accisa: number; // e.g. 1.490 for -50% microbirrificio
}

export interface MateriaPrima {
  id: number;
  tipo: 'CARICO' | 'SCARICO';
  data: string;
  riferimento: string;
  azienda: string;
  malto_kg: number;
  luppolo_kg: number;
  lievito_kg: number;
  costo_malto_kg: number;
  costo_luppolo_kg: number;
  costo_lievito_kg: number;
  costo_kg_medio: number;
}

export interface Imballaggio {
  id: number;
  tipo_movimento: 'CARICO' | 'SCARICO';
  data: string;
  riferimento: string;
  articolo: string;
  quantita: number;
  costo_unitario: number;
}

export interface IngredienteAggiuntivo {
  nome: string;
  grammi: number;
}

export interface Cotta {
  id: number;
  data: string;
  data_preventiva?: string;
  cotta_num: string;
  tipo_birra: string;
  litri_mosto: number;
  grado_plato: number;
  lotto_sfuso: string;
  note_lievito?: string;
  contalitri_inizio: number;
  contalitri_fine: number;
  malto_usato_kg: number;
  luppolo_usato_kg: number;
  lievito_usato_kg: number;
  altri_ingredienti_note?: string;
  altri_ingredienti_json?: IngredienteAggiuntivo[];
  resa_perc: number;
  consumo_gas_mc: number;
  consumo_elettrico_kwh: number;
  accisa_dovuta_euro: number;
  costo_totale_cotta: number;
  costo_litro_mosto: number;
  acqua_lavaggio_litri: number;
  costo_acqua_lavaggio: number;
  prodotti_sanificazione_json?: { nome: string; quantita: number; costo: number }[];
  costo_totale_sanificazione: number;
}

export interface Ricetta {
  id: number;
  nome_ricetta: string;
  stile_birra: string;
  fermentabili_kg: number;
  luppoli_gr: number;
  lieviti_gr: number;
  altri_ingredienti_nome?: string;
  altri_ingredienti_json?: IngredienteAggiuntivo[];
  plato_previsto: number;
  litri_previsti: number;
  note?: string;
}

export interface BirraCondizionata {
  id: number;
  tipo: 'CARICO' | 'SCARICO';
  data: string;
  lotto: string;
  formato: string;
  quantita: number;
  litri_totali: number;
  grado_plato: number;
  ettogradi: number;
  scarto_litri?: number;
  costo_produzione_litro: number;
  documento_rif: string;
}

export interface TracciamentoFusti {
  id: number;
  tipo_movimento: 'USCITA_PUB' | 'RIENTRO_VUOTO';
  data: string;
  cliente_pub: string;
  formato_fusto: string;
  quantita: number;
  lotto_birra?: string;
  valore_cauzione_unitario: number;
  ddt_riferimento?: string;
  note?: string;
}

export interface FatturaUtenza {
  id: number;
  tipo_utenza: string;
  fornitore: string;
  piva_fornitore?: string;
  numero_fattura?: string;
  data_fattura: string;
  data_scadenza: string;
  periodo_da?: string;
  periodo_a?: string;
  imponibile: number;
  iva: number;
  totale_fattura: number;
  consumo: number;
  unita_misura?: string;
  pod_pdr?: string;
  stato_pagamento: 'DA PAGARE' | 'PAGATA';
  data_pagamento?: string;
  note?: string;
  file_nome?: string;
}

export interface FermentatoreConfig {
  id: number;
  numero_tank: number;
  nome_tank: string;
  protocollo: string;
  capacita_lt: number;
  setpoint_temperatura: number;
  stato_attivo: boolean;
}

export interface TelemetriaFermentatore {
  id: number;
  timestamp: string;
  tank_id: string;
  lotto: string;
  temperatura: number;
  densita: number;
  pressione: number;
  setpoint: number;
  stato: string;
}

export interface Annotazione {
  id: number;
  categoria: 'Manutenzione' | 'Ordinazioni' | 'Note di brassaggio' | 'Cantina & Qualità' | 'Generale';
  titolo: string;
  testo: string;
  data_scadenza?: string;
  completata: boolean;
  creato_da?: string;
  created_at: string;
}

export interface PromemoriaScadenza {
  id: number;
  titolo: string;
  categoria: string;
  data_scadenza: string;
  importo?: number;
  ricorrenza: 'Nessuna' | 'Mensile' | 'Trimestrale' | 'Semestrale' | 'Annuale';
  stato: 'APERTA' | 'COMPLETATA';
  note?: string;
  completata_il?: string;
}

export interface PianificazioneCotta {
  id: number;
  nome_birra: string;
  stile: string;
  litri_stimati: number;
  data_cotta: string;
  data_confezionamento: string;
  contenitore: string;
  formato_litri: number;
  calo_stimato_perc: number;
  n_fusti: number;
  tank: string;
  stato: 'PIANIFICATA' | 'IN FERMENTAZIONE' | 'CONFEZIONATA' | 'ANNULLATA';
  note?: string;
}

export interface EventoAgenda {
  id: number;
  titolo: string;
  categoria: '🟡 Produzione' | '🔵 Imbottigliamento' | '🟢 Fiera' | '🟣 Appuntamento' | '🟠 Evento';
  data_inizio: string;
  data_fine: string;
}
