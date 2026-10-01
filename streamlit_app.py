def genera_pdf_commercialista(val_mp, val_imb, val_pf, tot_bilancio, malto, luppolo, lievito, litri_pf, costo_ind, accisa_pf):
    pdf = FPDF(orientation='P', unit='mm', format='A4')
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    
    # Intestazione centrata
    pdf.set_font('Helvetica', 'B', 15)
    pdf.set_xy(15, 15)
    pdf.cell(180, 8, 'PROSPETTO RIMANENZE DI MAGAZZINO AL 31/12', border=0, align='C')
    
    pdf.set_font('Helvetica', 'I', 9)
    pdf.set_xy(15, 23)
    pdf.cell(180, 5, 'Chiusura Esercizio Fiscale - Rilevazione Consistenze e Valutazioni', border=0, align='C')
    
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_xy(15, 31)
    pdf.cell(180, 5, "Attivita': Fabbricazione di birra (Microbirrificio art. 35, c. 3-bis D.Lgs. 504/95)", border=0)
    
    pdf.set_font('Helvetica', '', 9)
    pdf.set_xy(15, 36)
    pdf.cell(180, 5, 'Destinatario: Studio Commerciale / Collegio Sindacale', border=0)
    
    pdf.set_draw_color(180, 180, 180)
    pdf.line(15, 43, 195, 43)
    
    y = 47
    
    # 1. MATERIE PRIME
    pdf.set_fill_color(240, 242, 245)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_xy(15, y)
    pdf.cell(180, 7, ' 1. MATERIE PRIME IN GIACENZA', border=1, fill=True)
    
    pdf.set_font('Helvetica', '', 9)
    pdf.set_xy(17, y + 8)
    pdf.multi_cell(176, 4.5, f"Consistenze: Malto amidaceo ({malto:.1f} kg), Luppoli ({luppolo:.2f} kg), Lieviti ({lievito:.2f} kg).\nCriterio di valutazione: Valutate al costo effettivo di acquisto escluso IVA.")
    
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_xy(15, y + 19)
    pdf.cell(120, 6, "Valore Fiscale Materie Prime al 31/12:", border='T')
    pdf.cell(60, 6, f"EUR  {val_mp:,.2f}", border='T', align='R')
    
    y = 78
    
    # 2. IMBALLAGGI
    pdf.set_fill_color(240, 242, 245)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_xy(15, y)
    pdf.cell(180, 7, ' 2. IMBALLAGGI IN GIACENZA', border=1, fill=True)
    
    pdf.set_font('Helvetica', '', 9)
    pdf.set_xy(17, y + 8)
    pdf.multi_cell(176, 4.5, "Composizione: Scorte di bottiglie vuote (0.33L/0.75L), fusti vuoti, tappi a corona, scatole ed etichette.\nCriterio di valutazione: Valutati al costo di acquisto fatturato escluso IVA.")
    
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_xy(15, y + 19)
    pdf.cell(120, 6, "Valore Fiscale Imballaggi al 31/12:", border='T')
    pdf.cell(60, 6, f"EUR  {val_imb:,.2f}", border='T', align='R')
    
    y = 109
    
    # 3. PRODOTTI FINITI
    pdf.set_fill_color(240, 242, 245)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.set_xy(15, y)
    pdf.cell(180, 7, ' 3. PRODOTTI FINITI (Birra Confezionata)', border=1, fill=True)
    
    pdf.set_font('Helvetica', '', 9)
    pdf.set_xy(17, y + 8)
    pdf.multi_cell(176, 4.2, f"Volume a magazzino: {litri_pf:.1f} Litri condizionati in fusti e bottiglie.\n- Quota Costo Industriale di Produzione: EUR {costo_ind:,.2f}\n- Quota Accisa Dovuta/Assolta liquidata alla produzione: EUR {accisa_pf:,.2f}")
    
    pdf.set_font('Helvetica', 'I', 8)
    pdf.set_xy(17, y + 22)
    pdf.multi_cell(176, 3.8, "Nota per il bilancio: Ai sensi dell'art. 35 D.Lgs. 504/95 e D.M. 138/2019 per i microbirrifici privi di deposito fiscale sospensivo, l'accisa e' assolta/liquidata alla produzione e costituisce costo accessorio certo incorporato nel valore delle giacenze rimaste invendute.")
    
    pdf.set_font('Helvetica', 'B', 9)
    pdf.set_xy(15, y +Nel PDF ci sono due problemi evidenti:

1. **Margine destro tagliato fuori pagina**: la colonna con i valori monetari (si intravedono i testi tronchi *"Valore Fis..."* e *"Nota per..."* a destra) sfora l'area stampabile della pagina A4.
2. **Dati azzerati**: tutti i valori escono a `0.0 kg`, `0.0 Litri` e `EUR 0.00`, segno che le variabili o i filtri del DataFrame passati alla funzione di generazione non stanno agganciando i totali corretti.

### Come risolvere

#### 1. Correzione del layout (Taglio a destra)
Se stai usando **ReportLab** o un template **HTML/CSS (WeasyPrint / pdfkit)**:

* **Se usi ReportLab (`SimpleDocTemplate` / `Table`)**:
  * Assicurati che i margini del documento non siano eccessivi (usa `leftMargin=15*mm, rightMargin=15*mm`).
  * Nelle tabelle (`Table(data, colWidths=[...])`), la somma delle larghezze `colWidths` non deve superare la larghezza utile:
    $$\text{Larghezza utile} = 210\text{ mm} - (\text{leftMargin} + \text{rightMargin}) \approx 180\text{ mm}$$
  * Se hai una tabella a due colonne (descrizione a sinistra, importo a destra), imposta ad esempio:
    ```python
    colWidths=[130 * mm, 50 * mm]
    ```

* **Se generi tramite HTML/CSS**:
  * Imposta nel CSS di stampa:
    ```css
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    table {
      width: 100%;
      table-layout: fixed;
    }
    ```

---

#### 2. Dati a zero
Nel blocco di codice in cui calcoli i totali prima di passarli al render del PDF:
* Verifica che non ci sia un filtro di data o di stato che azzera il DataFrame (ad esempio una query che cerca date successive al 31/12/2026 o che filtra per un magazzino/stato errato).
* Controlla i nomi esatti delle chiavi/colonne nel dizionario passato al compilatore del prospetto (es. `df['giacenza_kg'].sum()` vs `df['quantita'].sum()`).

Mostrami lo snippet in cui costruisci la tabella/pagina del PDF (e dove estrai questi totali) per sistemare direttamente i parametri di larghezza e il mapping dei dati.
