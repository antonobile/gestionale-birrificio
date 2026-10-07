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
  aliquota_acc: number;
}

export function generateDoganePdf(data: DoganeData): void {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pw = 210;
  const margin = 15;
  const contentWidth = pw - margin * 2;

  let y = 16;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BILANCIO FINANZIARIO & DI MATERIA ANNUALE', pw / 2, y, { align: 'center' });

  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text(`Rendicontazione Doganale Esercizio Fiscale ${data.anno} (Comunicazione entro il 31 Gennaio)`, pw / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Ditta: ${data.ragione_soc}`, margin, y);
  doc.text(`P.IVA / C.F.: ${data.piva_az}`, pw - margin, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pw - margin, y);
  y += 5;

  // Section 1
  doc.setFillColor(235, 240, 248);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(' 1. VOLUME DI BIRRA PRODOTTA & ATTIVITÀ DI SALA COTTURA', margin + 2, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 110, 6);
  doc.text(`Numero totale di cotte eseguite nell'anno ${data.anno}:`, margin + 2, y + 4.2);
  doc.rect(margin + 110, y, contentWidth - 110, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.cotte_n} cotte`, pw - margin - 2, y + 4.2, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 110, 6);
  doc.text('Volume complessivo di mosto/birra prodotto (Litri):', margin + 2, y + 4.2);
  doc.rect(margin + 110, y, contentWidth - 110, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.litri_cotte.toLocaleString('it-IT', { minimumFractionDigits: 1 })} LT`, pw - margin - 2, y + 4.2, { align: 'right' });
  y += 8;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(`Aliquota accisa applicata: ${data.aliquota_acc.toFixed(3)} EUR / ettolitro / grado Plato (Microbirrifici art. 35 TUA)`, margin, y);
  y += 6;

  // Section 2
  doc.setFillColor(235, 240, 248);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(' 2. BILANCIO ENERGETICO (Combustibili ed Elettricità impiegati)', margin + 2, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 110, 6);
  doc.text('Consumo totale Gas GPL / Metano:', margin + 2, y + 4.2);
  doc.rect(margin + 110, y, contentWidth - 110, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.mc_gpl.toLocaleString('it-IT', { minimumFractionDigits: 2 })} Smc`, pw - margin - 2, y + 4.2, { align: 'right' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.rect(margin, y, 110, 6);
  doc.text('Consumo totale Energia Elettrica:', margin + 2, y + 4.2);
  doc.rect(margin + 110, y, contentWidth - 110, 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.kwh_ele.toLocaleString('it-IT', { minimumFractionDigits: 1 })} kWh`, pw - margin - 2, y + 4.2, { align: 'right' });
  y += 9;

  // Section 3
  doc.setFillColor(235, 240, 248);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(' 3. BILANCIO DI MATERIA (Materie Prime Acquistate vs Utilizzate in Cotta)', margin + 2, y + 4.2);
  y += 7;

  // Table header
  doc.setFillColor(245, 247, 250);
  doc.rect(margin, y, 70, 5, 'FD');
  doc.text('Materia Prima', margin + 2, y + 3.7);
  doc.rect(margin + 70, y, 55, 5, 'FD');
  doc.text(`Acquistato nel ${data.anno}`, margin + 70 + 27.5, y + 3.7, { align: 'center' });
  doc.rect(margin + 125, y, 55, 5, 'FD');
  doc.text(`Impiegato in Cotta (${data.anno})`, margin + 125 + 27.5, y + 3.7, { align: 'center' });
  y += 5;

  const matRows = [
    { nome: "Malto d'orzo & fermentabili", acq: `${data.m_acq.toFixed(1)} kg`, usat: `${data.m_usat.toFixed(1)} kg` },
    { nome: 'Luppolo', acq: `${data.l_acq.toFixed(2)} kg`, usat: `${data.l_usat.toFixed(2)} kg` },
    { nome: 'Lievito', acq: `${data.y_acq_g.toFixed(0)} gr`, usat: `${data.y_usat_g.toFixed(0)} gr` },
  ];

  doc.setFont('helvetica', 'normal');
  for (const r of matRows) {
    doc.rect(margin, y, 70, 6);
    doc.text(r.nome, margin + 2, y + 4.2);
    doc.rect(margin + 70, y, 55, 6);
    doc.text(r.acq, margin + 123, y + 4.2, { align: 'right' });
    doc.rect(margin + 125, y, 55, 6);
    doc.text(r.usat, pw - margin - 2, y + 4.2, { align: 'right' });
    y += 6;
  }
  y += 2;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.text(`Resa media ponderata di sala cottura rilevata nel ciclo produttivo: ${data.resa_media.toFixed(1)}%`, margin, y);
  y += 6;

  // Section 4
  doc.setFillColor(235, 240, 248);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(" 4. BIRRA CONDIZIONATA NEL CORSO DELL'ANNO (Presa in carico)", margin + 2, y + 4.2);
  y += 7;

  const confList = [
    { label: 'N. Bottiglie da 0.33 L', val: data.b33, um: 'pezzi' },
    { label: 'N. Bottiglie da 0.75 L', val: data.b75, um: 'pezzi' },
    { label: 'N. Fusti da 12 L', val: data.f12, um: 'fusti' },
    { label: 'N. Fusti da 20 L', val: data.f20, um: 'fusti' },
    { label: 'N. Fusti da 24 L', val: data.f24, um: 'fusti' },
    { label: 'N. Fusti da 25 L', val: data.f25, um: 'fusti' },
    { label: 'N. Fusti da 30 L', val: data.f30, um: 'fusti' },
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const item of confList) {
    doc.text(` - ${item.label}:`, margin + 2, y + 3.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.val.toLocaleString('it-IT')} ${item.um}`, pw - margin - 2, y + 3.5, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y + 4.5, pw - margin, y + 4.5);
    y += 5;
  }
  y += 3;

  // Section 5
  doc.setFillColor(235, 240, 248);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(` 5. INVENTARIO FISICO DELLE ESISTENZE AL 31/12/${data.anno}`, margin + 2, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(` - Giacenza Materie Prime: Malto/Fermentabili (${data.giac_m.toFixed(1)} kg) | Luppoli (${data.giac_l.toFixed(2)} kg) | Lieviti (${(data.giac_y * 1000).toFixed(0)} gr)`, margin + 2, y);
  y += 4.5;
  doc.text(` - Giacenza Birra Finita a Magazzino: ${data.giac_birra_lt.toFixed(1)} Litri`, margin + 2, y);
  y += 12;

  // Signatures
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Luogo e Data: __________________, 31/01/${data.anno + 1}`, margin, y);
  doc.text('Firma del Titolare / Rappresentante Fiscale', pw - margin, y, { align: 'right' });
  y += 8;
  doc.text('___________________________________', margin, y);
  doc.text('________________________________________', pw - margin, y, { align: 'right' });

  doc.save(`Bilancio_Finanziario_Dogane_${data.anno}.pdf`);
}

export interface CommData {
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
}

export function generateCommercialistaPdf(data: CommData): void {
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
  const pw = 297;
  const margin = 15;
  const contentWidth = pw - margin * 2;

  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PROSPETTO RIMANENZE DI MAGAZZINO AL 31/12', pw / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.text('BrewDesk Platform - Rilevazione Consistenze e Valutazioni Fiscali', pw / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Attività: ${data.ragione_soc} - P.IVA: ${data.piva_az}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Destinatario: Studio Commerciale', pw - margin, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pw - margin, y);
  y += 7;

  // Section 1: MP
  doc.setFillColor(240, 242, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(' 1. MATERIE PRIME IN GIACENZA', margin + 2, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Consistenze: Malto e fermentabili (${data.malto.toFixed(1)} kg), Luppoli (${data.luppolo.toFixed(2)} kg), Lieviti (${data.lievito.toFixed(3)} kg) - Valutate al costo effettivo escluso IVA.`, margin + 2, y + 3);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Valore Fiscale Materie Prime al 31/12:', margin + 2, y + 3);
  doc.text(`EUR  ${data.val_mp.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, pw - margin - 2, y + 3, { align: 'right' });
  y += 10;

  // Section 2: Imballaggi
  doc.setFillColor(240, 242, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(' 2. IMBALLAGGI IN GIACENZA', margin + 2, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Composizione: Scorte di bottiglie vuote, fusti, tappi a corona, scatole ed etichette - Valutati al costo di acquisto escluso IVA.', margin + 2, y + 3);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Valore Fiscale Imballaggi al 31/12:', margin + 2, y + 3);
  doc.text(`EUR  ${data.val_imb.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, pw - margin - 2, y + 3, { align: 'right' });
  y += 10;

  // Section 3: Prodotti Finiti
  doc.setFillColor(240, 242, 245);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(' 3. PRODOTTI FINITI (Birra Confezionata)', margin + 2, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Volume totale a magazzino: ${data.litri_pf.toFixed(1)} Litri confezionati in fusti e bottiglie.`, margin + 2, y + 3);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Valore Fiscale Prodotti Finiti al 31/12:', margin + 2, y + 3);
  doc.text(`EUR  ${data.val_pf.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, pw - margin - 2, y + 3, { align: 'right' });
  y += 12;

  // Total Box
  doc.setDrawColor(40, 80, 150);
  doc.setFillColor(230, 240, 255);
  doc.rect(margin, y, contentWidth, 12, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTALE RIMANENZE FINALI DI BILANCIO AL 31/12:', margin + 4, y + 7.5);
  doc.text(`EUR  ${data.tot_bilancio.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, pw - margin - 4, y + 7.5, { align: 'right' });
  y += 22;

  // Signatures
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Data: 31/12/2026', margin, y);
  doc.text('Firma Titolare', pw - margin, y, { align: 'right' });
  y += 8;
  doc.text('_______________________', margin, y);
  doc.text('____________________________________', pw - margin, y, { align: 'right' });

  doc.save('Prospetto_Rimanenze_31_12_Commercialista.pdf');
}
