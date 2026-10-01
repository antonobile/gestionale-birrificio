import io
import re
import sqlite3
import xml.etree.ElementTree as ET
import pandas as pd
import streamlit as st
from fpdf import FPDF

st.set_page_config(
    page_title="Gestionale Birrificio Nobile", page_icon="🍺", layout="wide"
)

# --- PROTEZIONE ACCESSO CON PASSWORD ---
PASSWORD_CORRETTA = "BirraNobile2026!"

if "autenticato" not in st.session_state:
  st.session_state["autenticato"] = False

if not st.session_state["autenticato"]:
  st.title("🔒 Accesso Riservato Birrificio")
  pwd_inserita = st.text_input(
      "Inserisci la Password di Accesso", type="password"
  )
  if st.button("Accedi"):
    if pwd_inserita == PASSWORD_CORRETTA:
      st.session_state["autenticato"] = True
      st.rerun()
    else:
      st.error("Password errata. Riprova.")
  st.stop()

# --- DATI FISCALI BIRRIFICIO NOBILE ---
PIVA_AZIENDA = "01822710628"
CF_AZIENDA = "NBLLGU54L09F636V"

# --- DATABASE SETUP & AUTO-MIGRAZIONE ---
DB_FILE = "birrificio.db"
ALIQUOTA_ACCISA_PLATO = 1.794


def init_db():
  with sqlite3.connect(DB_FILE) as conn:
    c = conn.cursor()
    c.execute("""
            CREATE TABLE IF NOT EXISTS materie_prime (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT,
                data TEXT,
                riferimento TEXT,
                azienda TEXT,
                malto_kg REAL DEFAULT 0,
                luppolo_kg REAL DEFAULT 0,
                lievito_kg REAL DEFAULT 0,
                costo_kg_medio REAL DEFAULT 1.40
            )
        """)
    c.execute("""
            CREATE TABLE IF NOT EXISTS imballaggi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_movimento TEXT,
                data TEXT,
                riferimento TEXT,
                articolo TEXT,
                quantita INTEGER DEFAULT 0,
                costo_unitario REAL DEFAULT 0.0
            )
        """)
    c.execute("""
            CREATE TABLE IF NOT EXISTS registro_mosto (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                cotta_num TEXT,
                tipo_birra TEXT,
                litri_mosto REAL,
                grado_plato REAL,
                lotto_sfuso TEXT,
                note_lievito TEXT DEFAULT ''
            )
        """)
    c.execute("""
            CREATE TABLE IF NOT EXISTS birra_condizionata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT,
                data TEXT,
                lotto TEXT,
                formato TEXT,
                quantita INTEGER,
                litri_totali REAL,
                grado_plato REAL DEFAULT 12.0,
                costo_produzione_litro REAL DEFAULT 1.10,
                documento_rif TEXT
            )
        """)
    conn.commit()

    def aggiungi_colonna_se_manca(tabella, colonna, tipo_sql):
      c.execute(f"PRAGMA table_info({tabella})")
      colonne = [info[1] for info in c.fetchall()]
      if colonna not in colonne:
        c.execute(f"ALTER TABLE {tabella} ADD COLUMN {colonna} {tipo_sql}")
        conn.commit()

    aggiungi_colonna_se_manca("imballaggi", "costo_unitario", "REAL DEFAULT 0.0")
    aggiungi_colonna_se_manca("materie_prime", "costo_kg_medio", "REAL DEFAULT 1.40")
    aggiungi_colonna_se_manca("birra_condizionata", "costo_produzione_litro", "REAL DEFAULT 1.10")
    aggiungi_colonna_se_manca("birra_condizionata", "grado_plato", "REAL DEFAULT 12.0")
    aggiungi_colonna_se_manca("registro_mosto", "note_lievito", "TEXT DEFAULT ''")


init_db()


def trova_testo_nodo(elemento, tags):
  if elemento is None:
    return ""
  for tag in tags:
    for el in elemento.iter():
      tag_pulito = el.tag.split("}")[-1] if "}" in el.tag else el.tag
      if tag_pulito.lower() == tag.lower() and el.text:
        return el.text.strip()
  return ""


def estrai_da_descrizione(desc: str, qta_pz: float):
  d = desc.upper()
  kg = 0.0
  m_kg = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:KG|CHILI)", d)
  m_g = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:G|GR|GRAMMI)", d)
  if m_kg:
    kg = float(m_kg.group(1).replace(",", ".")) * qta_pz
  elif m_g:
    kg = (float(m_g.group(1).replace(",", ".")) / 1000.0) * qta_pz
  else:
    kg = qta_pz

  if any(k in d for k in ["MALTO", "PILSNER", "WEYERMANN", "FRUMENTO", "ZUCCHERO", "PALE", "CARA"]):
    return ("MALTO", kg)
  if any(k in d for k in ["LUPPOLO", "T90", "MAGNUM", "PERLE", "MOSAIC", "CASCADE", "CITRA", "SAAZ"]):
    return ("LUPPOLO", kg)
  if "LIEVITO" in d or "FERMENTO" in d or "YEAST" in d:
    return ("LIEVITO", kg)
  return ("ALTRO", 0.0)


def estrai_birra_da_vendita(desc: str):
  d = desc.upper()
  # Ignora cauzioni e accessori
  if any(k in d for k in ["CAUZIONE", "TRASPORTO", "SPESE", "BICCHIER", "TEKU", "SPEDIZIONE", "NOLEGGIO"]):
    return None

  # Ricerca Fusti
  if "30" in d and ("LT" in d or "LITR" in d or "FUST" in d or "POLYKEG" in d or "DOLIUM" in d):
    return ("Fusto 30L", 30.0)
  if "20" in d and ("LT" in d or "LITR" in d or "FUST" in d or "POLYKEG" in d or "DOLIUM" in d):
    return ("Fusto 20L", 20.0)
  if "FUST" in d:
    return ("Fusto 30L", 30.0)

  # Ricerca Bottiglie
  if "0.33" in d or "33CL" in d or "33 CL" in d or "0,33" in d or "33" in d:
    return ("Bottiglia 0.33L", 0.33)
  if "0.75" in d or "75CL" in d or "75 CL" in d or "0,75" in d or "75" in d:
    return ("Bottiglia 0.75L", 0.75)
  if "BOTT" in d:
    return ("Bottiglia 0.33L", 0.33)

  # Se è presente genericamente "BIRRA"
  if "BIRRA" in d:
    return ("Bottiglia 0.33L", 0.33)

  return None


def genera_pdf_commercialista(val_mp, val_imb, val_pf, tot_bilancio, malto, luppolo, lievito, litri_pf, costo_ind, accisa_pf):
  pdf = FPDF(orientation="L", unit="mm", format="A4")
  pdf.set_auto_page_break(auto=False)
  pdf.add_page()
  pdf.set_margins(15, 12, 15)

  pdf.set_font("Helvetica", "B", 15)
  pdf.set_xy(15, 12)
  pdf.cell(267, 8, "PROSPETTO RIMANENZE DI MAGAZZINO AL 31/12", align="C", ln=1)

  pdf.set_font("Helvetica", "I", 9)
  pdf.set_x(15)
  pdf.cell(267, 5, "Chiusura Esercizio Fiscale - Rilevazione Consistenze e Valutazioni", align="C", ln=1)
  pdf.ln(2)

  pdf.set_font("Helvetica", "B", 9)
  pdf.set_x(15)
  pdf.cell(130, 5, "Attività: BIRRA NOBILE DI LUIGI NOBILE - P.IVA: 01822710628", ln=0)
  pdf.set_font("Helvetica", "", 9)
  pdf.cell(137, 5, "Destinatario: Studio Commerciale", align="R", ln=1)

  pdf.set_draw_color(180, 180, 180)
  pdf.line(15, pdf.get_y() + 2, 282, pdf.get_y() + 2)
  pdf.ln(5)

  # 1. MATERIE PRIME
  pdf.set_fill_color(240, 242, 245)
  pdf.set_font("Helvetica", "B", 10)
  pdf.set_x(15)
  pdf.cell(267, 6, " 1. MATERIE PRIME IN GIACENZA", fill=True, ln=1)

  pdf.set_font("Helvetica", "", 9)
  pdf.set_x(15)
  pdf.cell(267, 5, f"Consistenze: Malto amidaceo ({malto:.1f} kg), Luppoli ({luppolo:.2f} kg), Lieviti ({lievito:.2f} kg) - Valutate al costo effettivo escluso IVA.", ln=1)

  pdf.set_font("Helvetica", "B", 9)
  pdf.set_x(15)
  pdf.cell(190, 6, "Valore Fiscale Materie Prime al 31/12:", ln=0)
  pdf.cell(77, 6, f"EUR  {val_mp:,.2f}", align="R", ln=1)
  pdf.ln(3)

  # 2. IMBALLAGGI
  pdf.set_font("Helvetica", "B", 10)
  pdf.set_x(15)
  pdf.cell(267, 6, " 2. IMBALLAGGI IN GIACENZA", fill=True, ln=1)

  pdf.set_font("Helvetica", "", 9)
  pdf.set_x(15)
  pdf.cell(267, 5, "Composizione: Scorte di bottiglie vuote, fusti, tappi a corona, scatole ed etichette - Valutati al costo di acquisto escluso IVA.", ln=1)

  pdf.set_font("Helvetica", "B", 9)
  pdf.set_x(15)
  pdf.cell(190, 6, "Valore Fiscale Imballaggi al 31/12:", ln=0)
  pdf.cell(77, 6, f"EUR  {val_imb:,.2f}", align="R", ln=1)
  pdf.ln(3)

  # 3. PRODOTTI FINITI
  pdf.set_font("Helvetica", "B", 10)
  pdf.set_x(15)
  pdf.cell(267, 6, " 3. PRODOTTI FINITI (Birra Confezionata)", fill=True, ln=1)

  pdf.set_font("Helvetica", "", 9)
  pdf.set_x(15)
  pdf.cell(267, 5, f"Volume totale a magazzino: {litri_pf:.1f} Litri confezionati in fusti e bottiglie.", ln=1)

  pdf.set_font("Helvetica", "B", 9)
  pdf.set_x(15)
  pdf.cell(190, 6, "Valore Fiscale Prodotti Finiti al 31/12:", ln=0)
  pdf.cell(77, 6, f"EUR  {val_pf:,.2f}", align="R", ln=1)
  pdf.ln(5)

  # BOX TOTALE
  y_tot = pdf.get_y()
  pdf.set_draw_color(40, 80, 150)
  pdf.set_fill_color(230, 240, 255)
  pdf.rect(15, y_tot, 267, 12, "DF")
  pdf.set_xy(18, y_tot + 2)
  pdf.set_font("Helvetica", "B", 11)
  pdf.cell(180, 8, "TOTALE RIMANENZE FINALI DI BILANCIO AL 31/12:", ln=0)
  pdf.cell(80, 8, f"EUR  {tot_bilancio:,.2f}", align="R", ln=1)
  pdf.ln(12)

  # FIRME
  pdf.set_font("Helvetica", "", 9)
  pdf.set_x(15)
  pdf.cell(130, 5, "Data: 31/12/2026", ln=0)
  pdf.cell(137, 5, "Firma Titolare", align="R", ln=1)
  pdf.ln(6)
  pdf.set_x(15)
  pdf.cell(130, 5, "_______________________", ln=0)
  pdf.cell(137, 5, "____________________________________", align="R", ln=1)

  return bytes(pdf.output())


st.title("🍺 Gestionale Birrificio Nobile & Registri Fiscali")

# --- QUERY DI RIEPILOGO ---
with sqlite3.connect(DB_FILE) as conn:
  c = conn.cursor()
  c.execute("""
        SELECT 
            SUM(CASE WHEN tipo='CARICO' THEN malto_kg ELSE -malto_kg END),
            SUM(CASE WHEN tipo='CARICO' THEN luppolo_kg ELSE -luppolo_kg END),
            SUM(CASE WHEN tipo='CARICO' THEN lievito_kg ELSE -lievito_kg END)
        FROM materie_prime
    """)
  mp = c.fetchone()
  malto = mp[0] or 0.0
  luppolo = mp[1] or 0.0
  lievito = mp[2] or 0.0

  c.execute("SELECT SUM(litri_mosto) FROM registro_mosto")
  mosto = c.fetchone()[0] or 0.0

  c.execute("""
        SELECT 
            SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END),
            SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END)
        FROM birra_condizionata
    """)
  df_finiti = c.fetchone()
  tot_confezioni = df_finiti[0] or 0
  tot_litri_finiti = df_finiti[1] or 0.0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Malto Residuo", f"{malto:.1f} kg")
col2.metric("Luppolo Residuo", f"{luppolo:.2f} kg")
col3.metric("Lievito Residuo", f"{lievito:.2f} kg")
col4.metric("Birra a Magazzino", f"{tot_litri_finiti:.1f} LT")

st.divider()

tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "📥 Carico Acquisti XML",
    "🏷️ Imballaggi",
    "⚗️ Cotta (Mosto)",
    "📦 Confezionamento",
    "🚚 Vendite (XML & Manuale)",
    "🏛️ Giacenze Magazzino",
    "📑 Report 31/12 Commercialista",
])

# TAB 1: CARICO ACQUISTI FORNITORI XML
with tab1:
  st.subheader("Carico Automatico Materie Prime da Fatture XML Fornitori")
  st.write("Trascina qui le fatture XML ricevute dai fornitori di malto, luppolo e lievito.")

  up_xmls = st.file_uploader(
      "Seleziona i file XML fornitori",
      type=["xml"],
      accept_multiple_files=True,
      key="xml_acquisti",
  )
  c_medio = st.number_input(
      "Costo medio acquisto stimato materie prime (€/kg)", value=1.40, step=0.1
  )

  if up_xmls and st.button("Elabora Fatture Acquisto"):
    carichi_mp = 0
    tot_m, tot_l, tot_y = 0.0, 0.0, 0.0

    with sqlite3.connect(DB_FILE) as conn:
      c = conn.cursor()
      for up_xml in up_xmls:
        try:
          content = up_xml.read()
          root = ET.fromstring(content)

          cedente_node = None
          for el in root.iter():
            tag_p = el.tag.split("}")[-1] if "}" in el.tag else el.tag
            if tag_p == "DatiAnagraficiCedente":
              cedente_node = el
              break

          mittente = ""
          if cedente_node is not None:
            denominazione = trova_testo_nodo(cedente_node, ["Denominazione"])
            cognome = trova_testo_nodo(cedente_node, ["Cognome"])
            nome = trova_testo_nodo(cedente_node, ["Nome"])
            mittente = denominazione if denominazione else f"{cognome} {nome}".strip()
          if not mittente:
            mittente = up_xml.name

          num_doc = trova_testo_nodo(root, ["Numero"]) or "N.D."
          data_doc = trova_testo_nodo(root, ["Data"]) or pd.Timestamp.now().strftime("%Y-%m-%d")

          t_m, t_l, t_y = 0.0, 0.0, 0.0
          for el in root.iter():
            tag_linea = el.tag.split("}")[-1] if "}" in el.tag else el.tag
            if tag_linea == "DettaglioLinee":
              desc = trova_testo_nodo(el, ["Descrizione"])
              qta_str = trova_testo_nodo(el, ["Quantita"])
              qta = float(qta_str.replace(",", ".")) if qta_str else 0.0

              tipo, p = estrai_da_descrizione(desc, qta)
              if tipo == "MALTO":
                t_m += p
              elif tipo == "LUPPOLO":
                t_l += p
              elif tipo == "LIEVITO":
                t_y += p

          c.execute(
              """
                    INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg, costo_kg_medio)
                    VALUES ('CARICO', ?, ?, ?, ?, ?, ?, ?)
                """,
              (data_doc, f"Fatt. {num_doc}", mittente, t_m, t_l, t_y, c_medio),
          )
          carichi_mp += 1
          tot_m += t_m
          tot_l += t_l
          tot_y += t_y
          conn.commit()
        except Exception as e:
          st.error(f"Errore su {up_xml.name}: {e}")

    st.success(f"Caricate {carichi_mp} fatture: +{tot_m:.1f} kg Malto, +{tot_l:.2f} kg Luppolo, +{tot_y:.2f} kg Lievito.")
    st.rerun()

# TAB 2: IMBALLAGGI
with tab2:
  st.subheader("Carico Acquisti Imballaggi")
  with st.form("imb_form"):
    i_data = st.date_input("Data Acquisto").strftime("%Y-%m-%d")
    i_art = st.selectbox(
        "Tipo Imballaggio",
        [
            "Bottiglie 0.33L vuote",
            "Bottiglie 0.75L vuote",
            "Tappi a corona",
            "Etichette",
            "Scatole / Cartoni",
            "Fusti vuoti 30L",
            "Fusti vuoti 20L",
        ],
    )
    i_qta = st.number_input("Quantità Acquistata (pz)", min_value=1, step=100)
    i_costo = st.number_input(
        "Costo Unitario Acquisto (€/pz escluso IVA)",
        min_value=0.001,
        value=0.25,
        step=0.01,
        format="%.3f",
    )
    i_doc = st.text_input("Rif. Fattura / Fornitore")
    if st.form_submit_button("Carica Imballaggi"):
      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita, costo_unitario)
                    VALUES ('CARICO', ?, ?, ?, ?, ?)
                """,
            (i_data, i_doc, i_art, i_qta, i_costo),
        )
        conn.commit()
      st.success("Imballaggi registrati!")
      st.rerun()

  st.write("---")
  st.write("#### Giacenza Attuale Imballaggi")
  with sqlite3.connect(DB_FILE) as conn:
    df_imb = pd.read_sql_query(
        """
            SELECT articolo, 
                   SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) as giacenza_pz,
                   MAX(costo_unitario) as costo_acquisto_unitario_euro,
                   ROUND(SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) * MAX(costo_unitario), 2) as totale_valore_euro
            FROM imballaggi 
            GROUP BY articolo
        """,
        conn,
    )
    st.dataframe(df_imb, width="stretch")

# TAB 3: COTTA CON OPZIONE LIEVITO
with tab3:
  st.subheader("Registra Cotta e Scarica Materie Prime")
  with st.form("cotta_form"):
    col_c1, col_c2 = st.columns(2)
    with col_c1:
      c_num = st.text_input("N° Cotta (es. C26-01)")
      lotto = st.text_input("Lotto Sfuso")
      stile = st.text_input("Stile Birra (es. Blonde, APA, Pilsner, Dubbel)")
    with col_c2:
      litri = st.number_input("Litri Mosto Ottenuti", min_value=0.0, step=10.0, value=500.0)
      plato = st.number_input("Grado Plato Reale", min_value=0.0, step=0.1, value=12.0)

    st.write("---")
    st.write("#### Materie Prime Utilizzate per la Cotta")
    col_mp1, col_mp2 = st.columns(2)
    with col_mp1:
      m_usato = st.number_input("Kg Malto Macinato", min_value=0.0, step=5.0, value=100.0)
      l_usato = st.number_input("Kg Luppolo Impiegato", min_value=0.0, step=0.05, value=1.00)

    with col_mp2:
      tipo_lievito = st.radio(
          "Origine del Lievito:",
          ["Lievito recuperato / Ripitching (NESSUNO scarico magazzino)", "Nuova confezione da fattura (SCARICA magazzino)"],
      )
      if "Nuova confezione" in tipo_lievito:
        y_usato = st.number_input("Kg Lievito da Scaricare dallo Stock", min_value=0.0, step=0.1, value=0.5)
        nota_lievito = f"Nuovo da fattura ({y_usato:.2f} kg)"
      else:
        y_usato = 0.0
        nota_lievito = "Recuperato da cotta precedente (Ripitching)"

    if st.form_submit_button("Salva Cotta e Scarica Magazzino"):
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO registro_mosto (data, cotta_num, tipo_birra, litri_mosto, grado_plato, lotto_sfuso, note_lievito)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
            (oggi, c_num, stile, litri, plato, lotto, nota_lievito),
        )
        c.execute(
            """
                    INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg)
                    VALUES ('SCARICO', ?, ?, 'COTTA PRODUZIONE', ?, ?, ?)
                """,
            (oggi, f"Cotta {c_num} - {lotto}", m_usato, l_usato, y_usato),
        )
        conn.commit()

      msg_lievito = "senza intaccare il magazzino lievito" if y_usato == 0.0 else f"scaricati {y_usato:.2f} kg di lievito"
      st.success(f"Cotta salvata! Scaricati {m_usato:.1f} kg malto, {l_usato:.2f} kg luppolo ({msg_lievito}).")
      st.rerun()

# TAB 4: CONFEZIONAMENTO
with tab4:
  st.subheader("Confezionamento (Birra Pronta + Scarico Imballaggi)")
  with st.form("conf_form"):
    lotto_c = st.text_input("Riferimento Lotto Birra")
    fmt = st.selectbox(
        "Formato",
        ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L", "Bottiglia 0.75L"],
    )
    plato_c = st.number_input(
        "Grado Plato Reale", min_value=0.0, step=0.1, value=12.0
    )
    qta_c = st.number_input("Pezzi Prodotti", min_value=1, step=1)
    costo_prod_lt = st.number_input(
        "Costo Unitario Produzione (€/Litro)",
        min_value=0.1,
        value=1.10,
        step=0.05,
    )
    if st.form_submit_button("Carica a Prodotti Finiti"):
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      l_un = 30.0 if "30L" in fmt else (20.0 if "20L" in fmt else (0.33 if "0.33L" in fmt else 0.75))
      litri_tot = qta_c * l_un

      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, grado_plato, costo_produzione_litro, documento_rif)
                    VALUES ('CARICO', ?, ?, ?, ?, ?, ?, ?, 'CONFEZIONAMENTO')
                """,
            (
                oggi,
                lotto_c,
                fmt,
                qta_c,
                litri_tot,
                plato_c,
                costo_prod_lt,
            ),
        )

        if "Bottiglia" in fmt:
          art_bot = "Bottiglie 0.33L vuote" if "0.33L" in fmt else "Bottiglie 0.75L vuote"
          c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', ?, ?, ?, ?)", (oggi, f"Lotto {lotto_c}", art_bot, qta_c))
          c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', ?, ?, 'Tappi a corona', ?)", (oggi, f"Lotto {lotto_c}", qta_c))
          c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', ?, ?, 'Etichette', ?)", (oggi, f"Lotto {lotto_c}", qta_c))
        elif "Fusto" in fmt:
          art_fusto = "Fusti vuoti 30L" if "30L" in fmt else "Fusti vuoti 20L"
          c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', ?, ?, ?, ?)", (oggi, f"Lotto {lotto_c}", art_fusto, qta_c))

        conn.commit()
      st.success("Birra caricata e imballaggi scalati!")
      st.rerun()

# TAB 5: VENDITE (CARICAMENTO XML EMESSE + INSERIMENTO MANUALE)
with tab5:
  st.subheader("🚚 Scarico Vendite Birra")

  # SEZIONE A: CARICA FATTURE EMESSE XML
  st.markdown("### 📥 1. Carica Fatture di Vendita Elettroniche (XML)")
  st.write("Trascina qui le fatture XML emesse da Birra Nobile verso clienti, pub o distributori per scaricare in automatico fusti e bottiglie.")

  up_vendite_xml = st.file_uploader(
      "Trascina qui uno o più XML delle fatture emesse",
      type=["xml"],
      accept_multiple_files=True,
      key="xml_vendite",
  )

  if up_vendite_xml and st.button("Elabora e Scarica Fatture Emesse"):
    tot_scarichi = 0
    tot_litri = 0.0
    righe_elaborate = []

    with sqlite3.connect(DB_FILE) as conn:
      c = conn.cursor()
      for up_xml in up_vendite_xml:
        try:
          content = up_xml.read()
          root = ET.fromstring(content)

          cessionario_node = None
          for el in root.iter():
            tag_p = el.tag.split("}")[-1] if "}" in el.tag else el.tag
            if tag_p == "DatiAnagraficiCessionario":
              cessionario_node = el
              break

          cliente = ""
          if cessionario_node is not None:
            den_c = trova_testo_nodo(cessionario_node, ["Denominazione"])
            cog_c = trova_testo_nodo(cessionario_node, ["Cognome"])
            nom_c = trova_testo_nodo(cessionario_node, ["Nome"])
            cliente = den_c if den_c else f"{cog_c} {nom_c}".strip()
          if not cliente:
            cliente = "Cliente"

          num_doc = trova_testo_nodo(root, ["Numero"]) or "N.D."
          data_doc = trova_testo_nodo(root, ["Data"]) or pd.Timestamp.now().strftime("%Y-%m-%d")

          for el in root.iter():
            tag_linea = el.tag.split("}")[-1] if "}" in el.tag else el.tag
            if tag_linea == "DettaglioLinee":
              desc = trova_testo_nodo(el, ["Descrizione"])
              qta_str = trova_testo_nodo(el, ["Quantita"])
              qta = int(float(qta_str.replace(",", "."))) if qta_str else 1
              prezzo_str = trova_testo_nodo(el, ["PrezzoUnitario"])
              prezzo_un = float(prezzo_str.replace(",", ".")) if prezzo_str else 0.0

              info_birra = estrai_birra_da_vendita(desc)
              if info_birra:
                formato_v, litri_un = info_birra
                litri_riga = qta * litri_un
                rif_vendita = f"Fatt. {num_doc} - {cliente}"

                c.execute(
                    """
                          INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, costo_produzione_litro, documento_rif)
                          VALUES ('SCARICO', ?, '-', ?, ?, ?, ?, ?)
                      """,
                    (data_doc, formato_v, qta, litri_riga, prezzo_un, rif_vendita),
                )
                tot_scarichi += 1
                tot_litri += litri_riga
                righe_elaborate.append({
                    "Data": data_doc,
                    "Riferimento": rif_vendita,
                    "Articolo": desc,
                    "Formato Riconosciuto": formato_v,
                    "Quantità (pz)": qta,
                    "Litri Scaricati": litri_riga,
                })

          conn.commit()
        except Exception as e:
          st.error(f"Errore su {up_xml.name}: {e}")

    if righe_elaborate:
      st.success(f"Registrati con successo {tot_scarichi} scarichi per complessivi {tot_litri:.1f} Litri venduti!")
      st.dataframe(pd.DataFrame(righe_elaborate), width="stretch")
      st.rerun()
    else:
      st.warning("Nessuna riga di birra riconosciuta nei file XML caricati. Controlla le descrizioni delle fatture.")

  st.write("---")

  # SEZIONE B: INSERIMENTO MANUALE
  st.markdown("### ✍️ 2. Scarico Vendita Manuale (Senza Fattura XML)")
  with st.form("vendita_manuale_form"):
    doc_v = st.text_input("Rif. Fattura / DDT / Cliente")
    fmt_v = st.selectbox(
        "Formato Venduto",
        ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L", "Bottiglia 0.75L"],
    )
    qta_v = st.number_input("Quantità Venduta", min_value=1, step=1)
    if st.form_submit_button("Registra Scarico Manuale"):
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      l_un = 30.0 if "30L" in fmt_v else (20.0 if "20L" in fmt_v else (0.33 if "0.33L" in fmt_v else 0.75))
      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, documento_rif)
                    VALUES ('SCARICO', ?, '-', ?, ?, ?, ?)
                """,
            (oggi, fmt_v, qta_v, qta_v * l_un, doc_v),
        )
        conn.commit()
      st.success("Scarico vendita registrato!")
      st.rerun()

# TAB 6: REGISTRI E MAGAZZINO
with tab6:
  st.subheader("🏛️ Situazione Prodotti Finiti a Magazzino")
  with sqlite3.connect(DB_FILE) as conn:
    df_pf = pd.read_sql_query(
        """
            SELECT formato, 
                   SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END) as giacenza_pz,
                   SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END) as litri_magazzino,
                   AVG(grado_plato) as plato_medio
            FROM birra_condizionata 
            GROUP BY formato
        """,
        conn,
    )
    st.dataframe(df_pf, width="stretch")

    st.write("---")
    st.write("#### Registro Mosto (Allegato I)")
    st.dataframe(pd.read_sql_query("SELECT * FROM registro_mosto", conn), width="stretch")

    st.write("#### Registro Birra Condizionata (Allegato III)")
    st.dataframe(pd.read_sql_query("SELECT * FROM birra_condizionata", conn), width="stretch")

# TAB 7: REPORT 31/12
with tab7:
  st.subheader("📑 Riepilogo al 31 Dicembre")

  costo_kg_m = 1.35
  costo_kg_l = 28.00
  costo_kg_y = 65.00

  val_m = malto * costo_kg_m
  val_l = luppolo * costo_kg_l
  val_y = lievito * costo_kg_y
  valore_tot_mp = val_m + val_l + val_y

  # 1. ANTEPRIMA MATERIE PRIME
  st.markdown("### 🌾 1. Materie Prime in Giacenza")
  df_mp_anteprima = pd.DataFrame([
      {"Articolo": "Malto Amidaceo", "Giacenza Fisica (kg)": f"{malto:.2f}", "Costo Unitario (€/kg)": f"{costo_kg_m:.2f}", "Valore Totale (€)": round(val_m, 2)},
      {"Articolo": "Luppoli", "Giacenza Fisica (kg)": f"{luppolo:.2f}", "Costo Unitario (€/kg)": f"{costo_kg_l:.2f}", "Valore Totale (€)": round(val_l, 2)},
      {"Articolo": "Lieviti", "Giacenza Fisica (kg)": f"{lievito:.2f}", "Costo Unitario (€/kg)": f"{costo_kg_y:.2f}", "Valore Totale (€)": round(val_y, 2)},
  ])
  st.dataframe(df_mp_anteprima, width="stretch")
  st.info(f"**Subtotale Materie Prime: € {valore_tot_mp:,.2f}**")

  # 2. ANTEPRIMA IMBALLAGGI
  st.markdown("### 📦 2. Imballaggi in Giacenza")
  with sqlite3.connect(DB_FILE) as conn:
    df_imb_anteprima = pd.read_sql_query("""
        SELECT 
            articolo as "Articolo Imballaggio",
            SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) as "Giacenza (pz)",
            ROUND(MAX(costo_unitario), 3) as "Costo Unitario (€)",
            ROUND(SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) * MAX(costo_unitario), 2) as "Valore Totale (€)"
        FROM imballaggi
        GROUP BY articolo
    """, conn)
  valore_tot_imb = df_imb_anteprima["Valore Totale (€)"].sum() if not df_imb_anteprima.empty else 0.0
  st.dataframe(df_imb_anteprima, width="stretch")
  st.info(f"**Subtotale Imballaggi: € {valore_tot_imb:,.2f}**")

  # 3. ANTEPRIMA PRODOTTI FINITI
  st.markdown("### 🍺 3. Prodotti Finiti")
  with sqlite3.connect(DB_FILE) as conn:
    df_pf_anteprima = pd.read_sql_query("""
        SELECT 
            formato as "Formato",
            SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END) as "Giacenza (pz)",
            ROUND(SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END), 1) as "Litri Totali",
            ROUND(SUM(CASE WHEN tipo='CARICO' THEN (litri_totali * costo_produzione_litro) ELSE -(litri_totali * costo_produzione_litro) END), 2) as "Costo Produzione (€)",
            ROUND(SUM(CASE WHEN tipo='CARICO' THEN (litri_totali * grado_plato / 100.0 * ?) ELSE -(litri_totali * grado_plato / 100.0 * ?) END), 2) as "Quota Accisa (€)",
            ROUND(SUM(CASE WHEN tipo='CARICO' THEN (litri_totali * costo_produzione_litro + litri_totali * grado_plato / 100.0 * ?) ELSE -(litri_totali * costo_produzione_litro + litri_totali * grado_plato / 100.0 * ?) END), 2) as "Valore Fiscale (€)"
        FROM birra_condizionata
        GROUP BY formato
    """, conn, params=(ALIQUOTA_ACCISA_PLATO, ALIQUOTA_ACCISA_PLATO, ALIQUOTA_ACCISA_PLATO, ALIQUOTA_ACCISA_PLATO))

  litri_pf_val = df_pf_anteprima["Litri Totali"].sum() if not df_pf_anteprima.empty else 0.0
  costo_ind_val = df_pf_anteprima["Costo Produzione (€)"].sum() if not df_pf_anteprima.empty else 0.0
  accisa_assolta_val = df_pf_anteprima["Quota Accisa (€)"].sum() if not df_pf_anteprima.empty else 0.0
  valore_tot_pf = df_pf_anteprima["Valore Fiscale (€)"].sum() if not df_pf_anteprima.empty else 0.0

  st.dataframe(df_pf_anteprima, width="stretch")
  st.info(f"**Subtotale Prodotti Finiti: € {valore_tot_pf:,.2f}**")

  # TOTALE GENERALE
  totale_bilancio_complessivo = valore_tot_mp + valore_tot_imb + valore_tot_pf

  st.divider()
  st.markdown(f"""
    ### 💰 **TOTALE RIMANENZE FINALI AL 31/12: € {totale_bilancio_complessivo:,.2f}**
    * **Materie Prime:** € {valore_tot_mp:,.2f}
    * **Imballaggi:** € {valore_tot_imb:,.2f}
    * **Prodotti Finiti:** € {valore_tot_pf:,.2f}
  """)

  pdf_bytes = genera_pdf_commercialista(
      valore_tot_mp,
      valore_tot_imb,
      valore_tot_pf,
      totale_bilancio_complessivo,
      malto,
      luppolo,
      lievito,
      litri_pf_val,
      costo_ind_val,
      accisa_assolta_val,
  )

  st.download_button(
      label="📄 SCARICA REPORT UFFICIALE 31/12 (PDF)",
      data=pdf_bytes,
      file_name="Prospetto_Rimanenze_31_12_Commercialista.pdf",
      mime="application/pdf",
  )
