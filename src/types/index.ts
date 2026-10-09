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
  indirizzo?: string;
  email?: string;
  telefono?: string;
  pec?: string;
  codice_sdi?: string;
  contatore_mosto_iniziale?: number; // Offset contatore iniziale contalitri mosto
}

export type TipoCliente = 'B2B' | 'B2C';

export interface Cliente {
  id: number;
  tipo_cliente?: TipoCliente; // 'B2B' (Locale / Pub) vs 'B2C' (Cliente Privato)
  ragione_sociale: string; // Ragione sociale per B2B o Nome e Cognome per B2C
  piva_cf?: string; // P.IVA (B2B) o Codice Fiscale (B2C)
  indirizzo?: string;
  telefono?: string;
  email?: string;
  pec?: string;
  codice_sdi?: string;
  note?: string;
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
  cliente?: string;
  tipo_cliente?: TipoCliente;
  stile_birra?: string;
  prezzo_totale?: number;
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

export interface BrewDayNota {
  id: string;
  orario: string;
  testo: string;
}

export interface BrewDayLog {
  id: number;
  data: string;
  codice_cotta: string;
  ricetta_id?: number;
  nome_birra: string;
  stile_birra: string;
  lotto_sfuso: string;
  operatore: string;
  tank_destinazione: string;

  // Valori previsti (target)
  target_litri_mosto: number;
  target_plato: number;
  target_preboil_litri: number;
  target_preboil_plato: number;
  target_mash_temp: number;
  target_mash_durata_min: number;
  target_boil_durata_min: number;
  malto_totale_kg: number;
  luppolo_totale_gr: number;
  lievito_totale_gr: number;

  // Valori reali misurati in cantina
  reale_strike_water_temp?: number;
  reale_mash_temp?: number;
  reale_ph_mash?: number;
  reale_preboil_litri?: number;
  reale_preboil_plato?: number;
  reale_postboil_litri?: number;
  reale_og_plato?: number;
  reale_temp_whirlpool?: number;
  reale_temp_raffreddamento?: number;
  reale_ph_mosto_freddo?: number;
  reale_contalitri_inizio?: number;
  reale_contalitri_fine?: number;

  // Scostamenti calcolati
  scostamento_litri?: number;
  scostamento_litri_perc?: number;
  scostamento_plato?: number;
  scostamento_plato_perc?: number;
  efficienza_teorica_perc?: number;
  efficienza_reale_perc?: number;
  scostamento_efficienza?: number;
  evaporazione_oraria_litri?: number;
  suggerimento_calibrazione?: string;

  // Annotazioni
  annotazioni_libere: string;
  annotazioni_orarie: BrewDayNota[];

  // Avanzamento
  step_attivo: number;
  step_completati: string[];
  stato: 'IN_CORSO' | 'COMPLETATA' | 'ANNULLATA';
  ora_inizio?: string;
  ora_fine?: string;
}
