export interface ParsedUtenzaXml {
  tipo_utenza: string;
  fornitore: string;
  piva_fornitore: string;
  numero_fattura: string;
  data_fattura: string;
  data_scadenza: string;
  periodo_da?: string;
  periodo_a?: string;
  imponibile: number;
  iva: number;
  totale_fattura: number;
  consumo: number;
  unita_misura: string;
  pod_pdr: string;
}

export function parseXmlUtenza(xmlText: string): ParsedUtenzaXml {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const findText = (tags: string[]): string => {
    for (const tag of tags) {
      const els = xml.getElementsByTagName(tag);
      if (els.length > 0 && els[0].textContent) {
        return els[0].textContent.trim();
      }
    }
    return '';
  };

  const fornitore = findText(['Denominazione', 'Nome', 'Cognome']);
  const piva_fornitore = findText(['IdCodice', 'CodiceFiscale']);
  const numero_fattura = findText(['Numero']);
  const data_fattura = findText(['Data']);
  const data_scadenza = findText(['DataScadenzaPagamento', 'DataScadenza']);
  const periodo_da = findText(['DataInizioPeriodo']);
  const periodo_a = findText(['DataFinePeriodo']);

  const parseNum = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  };

  const imponibile = parseNum(findText(['ImponibileImporto', 'Imponibile']));
  const iva = parseNum(findText(['Imposta']));
  const totale_fattura = parseNum(findText(['ImportoTotaleDocumento', 'Totale']));

  // Scan descriptions for utility type & consumption
  const descEls = xml.getElementsByTagName('Descrizione');
  let fullDesc = '';
  for (let i = 0; i < descEls.length; i++) {
    fullDesc += ' ' + (descEls[i].textContent || '');
  }
  const upper = fullDesc.toUpperCase();

  let tipo_utenza = 'Altro Costo Fisso';
  if (upper.includes('ENERGIA') || upper.includes('ELETTRICA') || upper.includes('KWH') || upper.includes('POD')) {
    tipo_utenza = 'Energia Elettrica (Bolletta)';
  } else if (upper.includes('GAS') || upper.includes('METANO') || upper.includes('SMC') || upper.includes('PDR')) {
    tipo_utenza = 'Gas Metano di Rete';
  } else if (upper.includes('GPL') || upper.includes('PROPANO')) {
    tipo_utenza = 'GPL Carico Serbatoio Fisso';
  } else if (upper.includes('ACQUA') || upper.includes('FOGNATURA') || upper.includes('M3') || upper.includes('M³')) {
    tipo_utenza = 'Acqua & Fognatura';
  }

  let unita_misura = 'Nessuna';
  let consumo = 0;

  const kwhMatch = upper.match(/(\d+([.,]\d+)?)\s*KWH/);
  if (kwhMatch) {
    consumo = parseNum(kwhMatch[1]);
    unita_misura = 'kWh';
  } else {
    const smcMatch = upper.match(/(\d+([.,]\d+)?)\s*SMC/);
    if (smcMatch) {
      consumo = parseNum(smcMatch[1]);
      unita_misura = 'Smc (Metano)';
    } else {
      const m3Match = upper.match(/(\d+([.,]\d+)?)\s*(M3|M³)/);
      if (m3Match) {
        consumo = parseNum(m3Match[1]);
        unita_misura = 'mc (Acqua)';
      }
    }
  }

  const podMatch = upper.match(/(POD|PDR)\s*[:\-]?\s*([A-Z0-9]{8,})/);
  const pod_pdr = podMatch ? podMatch[2] : '';

  return {
    tipo_utenza,
    fornitore,
    piva_fornitore,
    numero_fattura,
    data_fattura: data_fattura ? data_fattura.slice(0, 10) : new Date().toISOString().slice(0, 10),
    data_scadenza: data_scadenza ? data_scadenza.slice(0, 10) : new Date().toISOString().slice(0, 10),
    periodo_da: periodo_da ? periodo_da.slice(0, 10) : undefined,
    periodo_a: periodo_a ? periodo_a.slice(0, 10) : undefined,
    imponibile,
    iva,
    totale_fattura: totale_fattura || imponibile + iva,
    consumo,
    unita_misura,
    pod_pdr,
  };
}

export interface ParsedAcquistiXml {
  fornitore: string;
  numero_fattura: string;
  data: string;
  malto_kg: number;
  luppolo_kg: number;
  lievito_kg: number;
  costo_malto_kg: number;
  costo_luppolo_kg: number;
  costo_lievito_kg: number;
}

export function parseXmlAcquisti(xmlText: string): ParsedAcquistiXml {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const findText = (tags: string[]): string => {
    for (const tag of tags) {
      const els = xml.getElementsByTagName(tag);
      if (els.length > 0 && els[0].textContent) {
        return els[0].textContent.trim();
      }
    }
    return '';
  };

  const fornitore = findText(['Denominazione', 'Cognome']) || 'Fornitore';
  const numero_fattura = findText(['Numero']) || 'Senza Numero';
  const data = findText(['Data']) || new Date().toISOString().slice(0, 10);

  let malto_kg = 0;
  let luppolo_kg = 0;
  let lievito_kg = 0;
  let costo_malto_kg = 1.35;
  let costo_luppolo_kg = 28.5;
  let costo_lievito_kg = 65.0;

  const linee = xml.getElementsByTagName('DettaglioLinee');
  for (let i = 0; i < linee.length; i++) {
    const el = linee[i];
    const descEl = el.getElementsByTagName('Descrizione')[0];
    const qtaEl = el.getElementsByTagName('Quantita')[0];
    const prEl = el.getElementsByTagName('PrezzoUnitario')[0];

    const desc = (descEl?.textContent || '').toUpperCase();
    const qta = parseFloat((qtaEl?.textContent || '0').replace(',', '.')) || 0;
    const pr = parseFloat((prEl?.textContent || '0').replace(',', '.')) || 0;

    let kg = qta;
    const mKg = desc.match(/(\d+([.,]\d+)?)\s*(KG|CHILI)/);
    const mG = desc.match(/(\d+([.,]\d+)?)\s*(G|GR|GRAMMI)/);
    if (mKg) {
      kg = parseFloat(mKg[1].replace(',', '.')) * qta;
    } else if (mG) {
      kg = (parseFloat(mG[1].replace(',', '.')) / 1000.0) * qta;
    }

    const costoReale = kg > 0 && pr > 0 ? (pr * qta) / kg : pr;

    if (desc.includes('MALTO') || desc.includes('PILSNER') || desc.includes('PALE') || desc.includes('CARA') || desc.includes('MUNICH')) {
      malto_kg += kg;
      if (costoReale > 0) costo_malto_kg = costoReale;
    } else if (desc.includes('LUPPOLO') || desc.includes('HOP') || desc.includes('PELLET') || desc.includes('T90') || desc.includes('CITRA')) {
      luppolo_kg += kg;
      if (costoReale > 0) costo_luppolo_kg = costoReale;
    } else if (desc.includes('LIEVITO') || desc.includes('YEAST') || desc.includes('FERMENTIS') || desc.includes('SAFALE')) {
      lievito_kg += kg;
      if (costoReale > 0) costo_lievito_kg = costoReale;
    }
  }

  return {
    fornitore,
    numero_fattura,
    data: data.slice(0, 10),
    malto_kg,
    luppolo_kg,
    lievito_kg,
    costo_malto_kg,
    costo_luppolo_kg,
    costo_lievito_kg,
  };
}
