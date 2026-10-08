import jsPDF from 'jspdf';

export interface DoganeData {
  anno: number;
  cotte_n: number;
  litri_cotte: number;
  mc_gpl: number;
  kwh_ele: number;
  m_acq: number;
  m_usat: number;
  l_acq: number;
  l_usat: number;
  y_acq_g: number;
  y_usat_g: number;
  b33: number;
  b75: number;
  f12: number;
  f20: number;
  f24: number;
  f25: number;
  f30: number;
  giac_m: number;
  giac_l: number;
  giac_y: number;
  giac_birra_lt: number;
  resa_media: number;
  ragione_soc: string;
  piva_az: string;
  cf_az?: string;
  indirizzo_az?: string;
  pec_az?: string;
  aliquota_acc: number;
}

export interface CommData {
  anno?: number;
  val_mp: number;
  val_imb: number;
  val_pf: number;
  tot_bilancio: number;
  malto: number;
  luppolo: number;
  lievito: number;
  litri_pf: number;
  ragione_soc: string;
  piva_az: string;
  cf_az?: string;
  indirizzo_az?: string;
  pec_az?: string;
}

export interface GeneratedPdfResult {
  blob: Blob;
  url: string;
  filename: string;
  dataUri: string;
  success: boolean;
}

/**
 * Trigger browser file download using standard Blob and temporary anchor element
 */
export function triggerBlobDownload(blob: Blob, filename: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 200);
    return true;
  } catch (err) {
    console.error('Trigger blob download failed:', err);
    return false;
  }
}

/**
 * Generate official Bilancio Dogane PDF (A4 Portrait)
 */
export function generateDoganePdf(data: DoganeData): GeneratedPdfResult {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210;
  const margin = 14;
  const contentWidth = pw - margin * 2;

  const anno = data.anno || new Date().getFullYear();
  const filename = `Bilancio_Finanziario_Dogane_${anno}.pdf`;

  let y = 14;

  // Header Box
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(margin, y, contentWidth, 20, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BILANCIO FINANZIARIO & DI MATERIA ANNUALE AL 31/12', pw / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  doc.text(`Agenzia delle Dogane e dei Monopoli - Comunicazione di Chiusura Esercizio Fiscale ${anno}`, pw / 2, y + 15, { align: 'center' });

  y += 24;

  // Company Details Block
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Ditta / Fabbrica: ${data.ragione_soc || 'Birrificio Artigianale'}`, margin, y);
  doc.text(`P.IVA: ${data.piva_az || 'Non specificata'}`, pw - margin, y, { align: 'right' });

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const indInfo = data.indirizzo_az ? `Sede: ${data.indirizzo_az}` : `C.F.: ${data.cf_az || data.piva_az}`;
  doc.text(indInfo, margin, y);
  doc.text(`Scadenza Deposito: 31 Gennaio ${anno + 1}`, pw - margin, y, { align: 'right' });

  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pw - margin, y);
  y += 5;

  // Section 1: Produzione Mosto e Cotte
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('1. VOLUME DI BIRRA PRODOTTA & ATTIVITA DI SALA COTTURA', margin + 3, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  // Row 1
  doc.rect(margin, y, 120, 6);
  doc.text(`Numero totale di cotte eseguite nell'anno fiscale ${anno}:`, margin + 3, y + 4.2);
  doc.rect(margin + 120, y, contentWidth - 120, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(data.cotte_n || 0)} cotte`, pw - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  // Row 2
  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 120, 6);
  doc.text('Volume complessivo di mosto/birra prodotto (Litri):', margin + 3, y + 4.2);
  doc.rect(margin + 120, y, contentWidth - 120, 6);
  doc.setFont('helvetica', 'bold');
  const litriFormatted = (data.litri_cotte || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  doc.text(`${litriFormatted} Litri`, pw - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  // Row 3
  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 120, 6);
  doc.text('Resa media ponderata sala cottura rilevata nel ciclo produttivo:', margin + 3, y + 4.2);
  doc.rect(margin + 120, y, contentWidth - 120, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(data.resa_media || 0).toFixed(1)} %`, pw - margin - 3, y + 4.2, { align: 'right' });
  y += 7.5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Regime fiscale accise applicato: ${(data.aliquota_acc || 1.49).toFixed(3)} EUR / ettolitro / grado Plato (Art. 35 TUA microbirrifici)`, margin, y);
  y += 5.5;

  // Section 2: Bilancio Energetico
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('2. BILANCIO ENERGETICO (Combustibili ed Elettricita impiegati)', margin + 3, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  // Gas
  doc.rect(margin, y, 120, 6);
  doc.text('Consumo totale Gas GPL / Metano per ciclo cottura:', margin + 3, y + 4.2);
  doc.rect(margin + 120, y, contentWidth - 120, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(data.mc_gpl || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Smc`, pw - margin - 3, y + 4.2, { align: 'right' });
  y += 6;

  // Electric
  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 120, 6);
  doc.text('Consumo totale Energia Elettrica (Sala cottura e cantina):', margin + 3, y + 4.2);
  doc.rect(margin + 120, y, contentWidth - 120, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${(data.kwh_ele || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`, pw - margin - 3, y + 4.2, { align: 'right' });
  y += 8.5;

  // Section 3: Bilancio di Materia
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('3. BILANCIO DI MATERIA (Materie Prime Acquistate vs Impiegate in Cotta)', margin + 3, y + 4.2);
  y += 7;

  // Table header
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, y, 76, 5.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('Materia Prima Dichiarata', margin + 3, y + 3.8);

  doc.rect(margin + 76, y, 53, 5.5, 'FD');
  doc.text(`Acquistato nel ${anno}`, margin + 76 + 26.5, y + 3.8, { align: 'center' });

  doc.rect(margin + 129, y, 53, 5.5, 'FD');
  doc.text(`Impiegato in Cotta (${anno})`, margin + 129 + 26.5, y + 3.8, { align: 'center' });
  y += 5.5;

  const matRows = [
    {
      nome: "Malto d'orzo & cereali fermentabili",
      acq: `${(data.m_acq || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`,
      usat: `${(data.m_usat || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`,
    },
    {
      nome: 'Luppolo (Pellet / Fiori)',
      acq: `${(data.l_acq || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`,
      usat: `${(data.l_usat || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`,
    },
    {
      nome: 'Lievito birrario (Secco / Liquido)',
      acq: `${(data.y_acq_g || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })} gr`,
      usat: `${(data.y_usat_g || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })} gr`,
    },
  ];

  doc.setFont('helvetica', 'normal');
  for (const r of matRows) {
    doc.rect(margin, y, 76, 5.5);
    doc.text(r.nome, margin + 3, y + 3.8);
    doc.rect(margin + 76, y, 53, 5.5);
    doc.text(r.acq, margin + 126, y + 3.8, { align: 'right' });
    doc.rect(margin + 129, y, 53, 5.5);
    doc.setFont('helvetica', 'bold');
    doc.text(r.usat, pw - margin - 3, y + 3.8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 5.5;
  }
  y += 3;

  // Section 4: Confezionamento
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text("4. BIRRA CONDIZIONATA NEL CORSO DELL'ANNO (Presa in Carico a Magazzino)", margin + 3, y + 4.2);
  y += 7;

  const confList = [
    { label: 'Bottiglie da 0.33 L', val: data.b33 || 0, vol: (data.b33 || 0) * 0.33, um: 'bottiglie' },
    { label: 'Bottiglie da 0.75 L', val: data.b75 || 0, vol: (data.b75 || 0) * 0.75, um: 'bottiglie' },
    { label: 'Fusti PolyKeg / Acciaio da 12 L', val: data.f12 || 0, vol: (data.f12 || 0) * 12, um: 'fusti' },
    { label: 'Fusti PolyKeg / Acciaio da 20 L', val: data.f20 || 0, vol: (data.f20 || 0) * 20, um: 'fusti' },
    { label: 'Fusti PolyKeg / Acciaio da 24 L', val: data.f24 || 0, vol: (data.f24 || 0) * 24, um: 'fusti' },
    { label: 'Fusti PolyKeg / Acciaio da 25 L', val: data.f25 || 0, vol: (data.f25 || 0) * 25, um: 'fusti' },
    { label: 'Fusti PolyKeg / Acciaio da 30 L', val: data.f30 || 0, vol: (data.f30 || 0) * 30, um: 'fusti' },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  for (const item of confList) {
    doc.text(` - ${item.label}:`, margin + 3, y + 3.2);
    doc.setFont('helvetica', 'bold');
    const qStr = `${(item.val || 0).toLocaleString('it-IT')} ${item.um} (${(item.vol || 0).toFixed(1)} LT)`;
    doc.text(qStr, pw - margin - 3, y + 3.2, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 4.2, pw - margin, y + 4.2);
    y += 4.5;
  }
  y += 2.5;

  // Section 5: Inventario Fisico
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`5. INVENTARIO FISICO DELLE ESISTENZE AL 31/12/${anno}`, margin + 3, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(30, 41, 59);
  doc.text(
    ` - Giacenze Materie Prime: Malto/Fermentabili ${(data.giac_m || 0).toFixed(1)} kg  |  Luppoli ${(data.giac_l || 0).toFixed(2)} kg  |  Lieviti ${((data.giac_y || 0) * 1000).toFixed(0)} gr`,
    margin + 3,
    y + 2
  );
  y += 4.5;
  doc.text(` - Giacenza Birra Finita a Magazzino: ${(data.giac_birra_lt || 0).toFixed(1)} Litri complessivi`, margin + 3, y + 2);
  y += 10;

  // Signature block
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Luogo e Data: __________________________, 31/01/${anno + 1}`, margin, y);
  doc.text('Firma e Timbro del Legale Rappresentante', pw - margin, y, { align: 'right' });
  y += 8;
  doc.text('_________________________________________________', margin, y);
  doc.text('_________________________________________________', pw - margin, y, { align: 'right' });

  // Generate blob and trigger download
  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');
  const url = URL.createObjectURL(blob);
  const success = triggerBlobDownload(blob, filename);

  return { blob, url, filename, dataUri, success };
}

/**
 * Generate official Prospetto Commercialista PDF (A4 Landscape)
 */
export function generateCommercialistaPdf(data: CommData): GeneratedPdfResult {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = 297;
  const margin = 14;
  const contentWidth = pw - margin * 2;

  const anno = data.anno || new Date().getFullYear();
  const filename = `Prospetto_Rimanenze_31_12_${anno}_Commercialista.pdf`;

  let y = 14;

  // Header Box
  doc.setFillColor(30, 27, 75); // Indigo-950
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`PROSPETTO DI VALORIZZAZIONE DELLE RIMANENZE DI MAGAZZINO AL 31/12/${anno}`, pw / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(224, 231, 255);
  doc.text('Rilevazione Consistenze Finali per Bilancio d’Esercizio e Dichiarazione Fiscale dei Redditi', pw / 2, y + 16, { align: 'center' });

  y += 26;

  // Company and Recipient Info
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Impresa: ${data.ragione_soc || 'Birrificio Artigianale'}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Destinatario: Spett.le Studio Commerciale / Consulente Fiscale', pw - margin, y, { align: 'right' });

  y += 5;
  doc.setTextColor(71, 85, 105);
  const pivaLine = `P.IVA: ${data.piva_az || '-'}   |   C.F.: ${data.cf_az || data.piva_az || '-'}${data.indirizzo_az ? `   |   Sede: ${data.indirizzo_az}` : ''}`;
  doc.text(pivaLine, margin, y);
  doc.text(`Esercizio Fiscale: Anno ${anno} (Chiusura al 31/12)`, pw - margin, y, { align: 'right' });

  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pw - margin, y);
  y += 6;

  // SECTION 1: MATERIE PRIME
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('1. MATERIE PRIME IN GIACENZA (Malti, Luppoli, Lieviti)', margin + 3, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const maltoKg = (data.malto || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const lupKg = (data.luppolo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lievKg = (data.lievito || 0).toLocaleString('it-IT', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  doc.text(
    `Consistenze fisiche verificate: Malto e cereali (${maltoKg} kg) - Luppoli in stock (${lupKg} kg) - Lieviti (${lievKg} kg). Valutati al costo medio ponderato di acquisto (escl. IVA).`,
    margin + 3,
    y + 3
  );
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Valore Fiscale Complessivo Rimanenze Materie Prime al 31/12:', margin + 3, y + 3);
  const valMpFormatted = (data.val_mp || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.text(`EUR  ${valMpFormatted}`, pw - margin - 3, y + 3, { align: 'right' });
  y += 9;

  // SECTION 2: IMBALLAGGI
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('2. IMBALLAGGI E MATERIALI DI CONFEZIONAMENTO', margin + 3, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(
    'Composizione scorte: Bottiglie in vetro vuote (0.33L e 0.75L), fusti in acciaio e a perdere, tappi a corona, scatole in cartone ed etichette a magazzino.',
    margin + 3,
    y + 3
  );
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Valore Fiscale Complessivo Rimanenze Imballaggi al 31/12:', margin + 3, y + 3);
  const valImbFormatted = (data.val_imb || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.text(`EUR  ${valImbFormatted}`, pw - margin - 3, y + 3, { align: 'right' });
  y += 9;

  // SECTION 3: PRODOTTI FINITI
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text('3. PRODOTTI FINITI A MAGAZZINO (Birra Confezionata)', margin + 3, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  const litriPfFormatted = (data.litri_pf || 0).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  doc.text(
    `Volume totale giacente pronto per la vendita: ${litriPfFormatted} Litri confezionati in fusti e bottiglie a temperatura controllata.`,
    margin + 3,
    y + 3
  );
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Valore Fiscale Prodotti Finiti al 31/12 (Costo di produzione industriale):', margin + 3, y + 3);
  const valPfFormatted = (data.val_pf || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.text(`EUR  ${valPfFormatted}`, pw - margin - 3, y + 3, { align: 'right' });
  y += 11;

  // GRAND TOTAL HIGHLIGHT BOX
  doc.setDrawColor(79, 70, 229); // Indigo-600
  doc.setFillColor(238, 242, 255); // Indigo-50
  doc.rect(margin, y, contentWidth, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(49, 46, 129);
  doc.text(`TOTALE RIMANENZE FINALI DI BILANCIO AL 31/12/${anno}:`, margin + 4, y + 8.5);

  const totBilancioFormatted = (data.tot_bilancio || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  doc.setFontSize(13);
  doc.text(`EUR  ${totBilancioFormatted}`, pw - margin - 4, y + 8.5, { align: 'right' });

  y += 20;

  // Declaration & Signature
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    'I valori sopra esposti sono stati calcolati in conformità all’art. 92 del D.P.R. 917/1986 (T.U.I.R.) sulla base delle consistenze fisiche effettive rilevate al 31/12.',
    margin,
    y
  );
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(`Data di Rilevazione: 31/12/${anno}`, margin, y);
  doc.text('Timbro e Firma del Titolare / Legale Rappresentante', pw - margin, y, { align: 'right' });
  y += 6;
  doc.text('____________________________________', margin, y);
  doc.text('________________________________________________', pw - margin, y, { align: 'right' });

  // Generate blob and trigger download
  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');
  const url = URL.createObjectURL(blob);
  const success = triggerBlobDownload(blob, filename);

  return { blob, url, filename, dataUri, success };
}

export interface ClientAnnualReportPdfData {
  anno: number;
  ragione_soc: string;
  piva_az: string;
  totaleLitri: number;
  totaleOrdini: number;
  totaleFatturato: number;
  clientiClassifica: {
    pos: number;
    nome: string;
    tipo: 'B2B' | 'B2C';
    litri: number;
    quotaPerc: number;
    ordini: number;
    fatturato: number;
    stili: { stile: string; litri: number }[];
  }[];
  stiliGlobali: { stile: string; litri: number; quotaPerc: number }[];
}

/**
 * Generate Annual Clients & Beer Styles Consumption Report PDF (A4 Portrait)
 */
export function generateAnnualClientReportPdf(data: ClientAnnualReportPdfData): GeneratedPdfResult {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = 210;
  const margin = 14;
  const contentWidth = pw - margin * 2;
  const anno = data.anno || new Date().getFullYear();
  const filename = `Report_Consumi_Clienti_Fine_Anno_${anno}.pdf`;

  let y = 14;

  // Header Box
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('REPORT DI FINE ANNO: ANALISI CONSUMI E CLASSIFICA CLIENTI', margin + 4, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${data.ragione_soc.toUpperCase()} — P.IVA ${data.piva_az}`, margin + 4, y + 14);
  doc.text(`ESERCIZIO ANNUALE ${anno} • PROSPETTO COMMERCIALE E DIREZIONALE`, margin + 4, y + 19);

  y += 28;

  // KPI Overview Bar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

  const colKpi = contentWidth / 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VOLUME TOTALE VENDUTO', margin + 6, y + 5);
  doc.text('FREQUENZA TOTALE ORDINI', margin + colKpi + 6, y + 5);
  doc.text('FATTURATO COMMERCIALE', margin + colKpi * 2 + 6, y + 5);

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.totaleLitri.toFixed(1)} Litri`, margin + 6, y + 10.5);
  doc.text(`${data.totaleOrdini} Consegne/Spedizioni`, margin + colKpi + 6, y + 10.5);
  doc.text(`EUR ${data.totaleFatturato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, margin + colKpi * 2 + 6, y + 10.5);

  y += 18;

  // Section 1: Top Beer Styles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text('1. DISTRIBUZIONE VOLUMI PER STILE DI BIRRA', margin, y);
  y += 4;

  // Styles Mini Table
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('STILE BIRRA PRODOTTO', margin + 3, y + 4);
  doc.text('LITRI VENDUTI', margin + 90, y + 4, { align: 'right' });
  doc.text('QUOTA % SUL TOTALE', margin + 140, y + 4, { align: 'right' });
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  data.stiliGlobali.forEach((st, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, contentWidth, 5, 'F');
    }
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(st.stile, margin + 3, y + 3.8);
    doc.text(`${st.litri.toFixed(1)} L`, margin + 90, y + 3.8, { align: 'right' });
    doc.text(`${st.quotaPerc.toFixed(1)} %`, margin + 140, y + 3.8, { align: 'right' });
    y += 5;
  });

  y += 4;

  // Section 2: Ranking Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("2. CLASSIFICA CLIENTI PER VOLUME E FREQUENZA D'ACQUISTO", margin, y);
  y += 4;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('#', margin + 2, y + 4.2);
  doc.text('CLIENTE / INTESTAZIONE', margin + 10, y + 4.2);
  doc.text('TIPO', margin + 65, y + 4.2);
  doc.text('LITRI', margin + 92, y + 4.2, { align: 'right' });
  doc.text('QUOTA %', margin + 115, y + 4.2, { align: 'right' });
  doc.text('ORDINI', margin + 138, y + 4.2, { align: 'right' });
  doc.text('STILI PREVALENTI ACQUISTATI', margin + 144, y + 4.2);
  y += 6;

  // Rows
  doc.setFont('helvetica', 'normal');
  data.clientiClassifica.forEach((cl, i) => {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }

    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
    }

    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(String(cl.pos), margin + 2, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.text(cl.nome.slice(0, 30), margin + 10, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.text(cl.tipo === 'B2B' ? 'Locale B2B' : 'Privato B2C', margin + 65, y + 4.5);
    doc.text(`${cl.litri.toFixed(1)} L`, margin + 92, y + 4.5, { align: 'right' });
    doc.text(`${cl.quotaPerc.toFixed(1)}%`, margin + 115, y + 4.5, { align: 'right' });
    doc.text(`${cl.ordini}`, margin + 138, y + 4.5, { align: 'right' });

    // Styles list summary
    const stiliTxt = cl.stili.map((s) => `${s.stile} (${s.litri.toFixed(0)}L)`).join(', ');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(stiliTxt.slice(0, 48), margin + 144, y + 4.5);

    y += 6.5;
  });

  y += 8;
  if (y > 265) {
    doc.addPage();
    y = 14;
  }

  // Footer notes & date
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Report generato da BrewDesk il ${new Date().toLocaleDateString('it-IT')} per uso gestionale, analisi del canale commerciale e bilancio delle vendite.`,
    margin,
    y
  );

  const blob = doc.output('blob');
  const dataUri = doc.output('datauristring');
  const url = URL.createObjectURL(blob);
  const success = triggerBlobDownload(blob, filename);

  return { blob, url, filename, dataUri, success };
}
