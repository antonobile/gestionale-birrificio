import io
import re
import sqlite3
import xml.etree.ElementTree as ET
import pandas as pd
import streamlit as st

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

# --- DATABASE SETUP ---
DB_FILE = "birrificio.db"

# Aliquota accisa microbirrifici (40% riduzione: 1.794 € per ettolitro/Plato)
ALIQUOTA_ACCISA_PLATO = 1.794


def init_db():
  with sqlite3.connect(DB_FILE) as conn:
    c = conn.cursor()
    # 1. Materie Prime
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
    # 2. Imballaggi
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
    # 3. Registro Mosto
    c.execute("""
            CREATE TABLE IF NOT EXISTS registro_mosto (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT,
                cotta_num TEXT,
                tipo_birra TEXT,
                litri_mosto REAL,
                grado_plato REAL,
                lotto_sfuso TEXT
            )
        """)
    # 4. Birra Condizionata / Prodotti Finiti
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
                costo_produzione_litro REAL DEFAULT 1.20,
                documento_rif TEXT
            )
        """)
    conn.commit()


init_db()


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

  if any(
      k in d for k in ["MALTO", "PILSNER", "WEYERMANN", "FRUMENTO", "ZUCCHERO"]
  ):
    return ("MALTO", kg)
  if any(k in d for k in ["LUPPOLO", "T90", "MAGNUM", "PERLE", "MOSAIC"]):
    return ("LUPPOLO", kg)
  if "LIEVITO" in d or "FERMENTO" in d:
    return ("LIEVITO", kg)
  return ("ALTRO", 0.0)


st.title("🍺 Gestionale Birrificio & Registri Fiscali")

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

# --- METRICHE IN EVIDENZA ---
col1, col2, col3, col4 = st.columns(4)
col1.metric("Malto Residuo", f"{malto:.1f} kg")
col2.metric("Luppolo Residuo", f"{luppolo:.2f} kg")
col3.metric("Lievito Residuo", f"{lievito:.2f} kg")
col4.metric("Birra Pronta a Magazzino", f"{tot_litri_finiti:.1f} LT")

st.divider()

# --- TABS ---
tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "📥 Carico XML / Acquisti",
    "🏷️ Imballaggi",
    "⚗️ Cotta (Mosto)",
    "📦 Confezionamento",
    "🚚 Vendita / Scarico",
    "🏛️ Giacenze Magazzino",
    "📑 Report 31/12 Commercialista",
])

# TAB 1: CARICO XML
with tab1:
  st.subheader("Carico Automatico da Fattura XML")
  up_xml = st.file_uploader("Trascina file XML fattura", type=["xml"])
  c_medio = st.number_input(
      "Costo medio acquisto stimato (€/kg)", value=1.40, step=0.1
  )
  if up_xml and st.button("Analizza e Registra Fattura"):
    content = up_xml.read()
    root = ET.fromstring(content)
    cedente = root.find(".//DatiAnagraficiCedente//Denominazione")
    mittente = (
        cedente.text
        if cedente is not None
        else root.find(".//DatiAnagraficiCedente//Cognome").text
    )
    dati_doc = root.find(".//DatiGeneraliDocumento")
    num_doc = (
        dati_doc.find("Numero").text if dati_doc.find("Numero") is not None else ""
    )
    data_doc = (
        dati_doc.find("Data").text if dati_doc.find("Data") is not None else ""
    )

    t_m, t_l, t_y = 0.0, 0.0, 0.0
    for linea in root.findall(".//DettaglioLinee"):
      desc = (
          linea.find("Descrizione").text
          if linea.find("Descrizione") is not None
          else ""
      )
      qta = (
          float(linea.find("Quantita").text)
          if linea.find("Quantita") is not None
          else 0.0
      )
      tipo, p = estrai_da_descrizione(desc, qta)
      if tipo == "MALTO":
        t_m += p
      elif tipo == "LUPPOLO":
        t_l += p
      elif tipo == "LIEVITO":
        t_y += p

    with sqlite3.connect(DB_FILE) as conn:
      c = conn.cursor()
      c.execute(
          """
                INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg, costo_kg_medio)
                VALUES ('CARICO', ?, ?, ?, ?, ?, ?, ?)
            """,
          (data_doc, f"Fatt. {num_doc}", mittente, t_m, t_l, t_y, c_medio),
      )
      conn.commit()
    st.success(
        f"Registrato da {mittente}: {t_m} kg Malto, {t_l} kg Luppolo, {t_y} kg"
        " Lievito."
    )
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
    st.dataframe(df_imb, use_container_width=True)

# TAB 3: COTTA
with tab3:
  st.subheader("Registra Cotta e Scarica Materie Prime")
  with st.form("cotta_form"):
    c_num = st.text_input("N° Cotta (es. C26-01)")
    lotto = st.text_input("Lotto Sfuso")
    stile = st.text_input("Stile Birra")
    litri = st.number_input("Litri Mosto Ottenuti", min_value=0.0, step=10.0)
    plato = st.number_input(
        "Grado Plato Reale", min_value=0.0, step=0.1, value=12.0
    )
    m_usato = st.number_input("Kg Malto Usati", min_value=0.0, step=5.0)
    l_usato = st.number_input("Kg Luppolo Usati", min_value=0.0, step=0.1)
    if st.form_submit_button("Salva Cotta"):
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO registro_mosto (data, cotta_num, tipo_birra, litri_mosto, grado_plato, lotto_sfuso)
                    VALUES (?, ?, ?, ?, ?, ?)
                """,
            (oggi, c_num, stile, litri, plato, lotto),
        )
        c.execute(
            """
                    INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg)
                    VALUES ('SCARICO', ?, ?, 'COTTA PRODUZIONE', ?, ?, 0)
                """,
            (oggi, f"Cotta {c_num} - {lotto}", m_usato, l_usato),
        )
        conn.commit()
      st.success("Cotta salvata e materie prime scaricate!")
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
        "Mero Costo Industriale Produzione (€/Litro)",
        min_value=0.1,
        value=1.10,
        step=0.05,
    )
    if st.form_submit_button("Carica a Prodotti Finiti"):
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      l_un = (
          30.0
          if "30L" in fmt
          else (
              20.0
              if "20L" in fmt
              else (0.33 if "0.33L" in fmt else 0.75)
          )
      )
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

        # Scarico automatico degli imballaggi
        if "Bottiglia" in fmt:
          art_bot = (
              "Bottiglie 0.33L vuote"
              if "0.33L" in fmt
              else "Bottiglie 0.75L vuote"
          )
          c.execute(
              "INSERT INTO imballaggi (tipo_movimento, data, riferimento,"
              " articolo, quantita) VALUES ('SCARICO', ?, ?, ?, ?)",
              (oggi, f"Lotto {lotto_c}", art_bot, qta_c),
          )
          c.execute(
              "INSERT INTO imballaggi (tipo_movimento, data, riferimento,"
              " articolo, quantita) VALUES ('SCARICO', ?, ?, 'Tappi a corona',"
              " ?)",
              (oggi, f"Lotto {lotto_c}", qta_c),
          )
          c.execute(
              "INSERT INTO imballaggi (tipo_movimento, data, riferimento,"
              " articolo, quantita) VALUES ('SCARICO', ?, ?, 'Etichette', ?)",
              (oggi, f"Lotto {lotto_c}", qta_c),
          )
        elif "Fusto" in fmt:
          art_fusto = "Fusti vuoti 30L" if "30L" in fmt else "Fusti vuoti 20L"
          c.execute(
              "INSERT INTO imballaggi (tipo_movimento, data, riferimento,"
              " articolo, quantita) VALUES ('SCARICO', ?, ?, ?, ?)",
              (oggi, f"Lotto {lotto_c}", art_fusto, qta_c),
          )

        conn.commit()
      st.success("Birra caricata e imballaggi scalati!")
      st.rerun()

# TAB 5: VENDITA
with tab5:
  st.subheader("Scarico Vendite")
  with st.form("vendita_form"):
    doc_v = st.text_input("Rif. Fattura / DDT Vendita")
    fmt_v = st.selectbox(
        "Formato Venduto",
        ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L", "Bottiglia 0.75L"],
    )
    qta_v = st.number_input("Quantità Venduta", min_value=1, step=1)
    if st.form_submit_button("Scarica da Magazzino"):
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      l_un = (
          30.0
          if "30L" in fmt_v
          else (
              20.0
              if "20L" in fmt_v
              else (0.33 if "0.33L" in fmt_v else 0.75)
          )
      )
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
      st.success("Vendita registrata!")
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
    st.dataframe(df_pf, use_container_width=True)

    st.write("---")
    st.write("#### Registro Mosto (Allegato I)")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM registro_mosto", conn),
        use_container_width=True,
    )

    st.write("#### Registro Birra Condizionata (Allegato III)")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM birra_condizionata", conn),
        use_container_width=True,
    )

# TAB 7: REPORT 31/12 COMMERCIALISTA
with tab7:
  st.subheader("📑 Riepilogo Ufficiale al 31 Dicembre per Commercialista")

  costo_kg_m = 1.35
  costo_kg_l = 28.00
  costo_kg_y = 65.00

  valore_tot_mp = (malto * costo_kg_m) + (luppolo * costo_kg_l) + (lievito * costo_kg_y)

  with sqlite3.connect(DB_FILE) as conn:
    c = conn.cursor()
    # Calcolo totale imballaggi
    c.execute("""
            SELECT SUM(giacenza * costo) FROM (
                SELECT SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) as giacenza,
                       MAX(costo_unitario) as costo
                FROM imballaggi 
                GROUP BY articolo
            )
        """)
    valore_tot_imb = c.fetchone()[0] or 0.0

    # Calcolo prodotti finiti: (Litri * costo_produzione) + Accisa assolta (Litri * Plato / 100 * 1.794)
    c.execute("""
            SELECT 
                SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END),
                SUM(CASE WHEN tipo='CARICO' THEN (litri_totali * costo_produzione_litro) ELSE -(litri_totali * costo_produzione_litro) END),
                SUM(CASE WHEN tipo='CARICO' THEN (litri_totali * grado_plato / 100.0 * ?) ELSE -(litri_totali * grado_plato / 100.0 * ?) END)
            FROM birra_condizionata
        """, (ALIQUOTA_ACCISA_PLATO, ALIQUOTA_ACCISA_PLATO))
    res_finiti = c.fetchone()
    litri_rimasti_pf = res_finiti[0] or 0.0
    costo_ind_pf = res_finiti[1] or 0.0
    accisa_assolta_pf = res_finiti[2] or 0.0
    valore_tot_pf = costo_ind_pf + accisa_assolta_pf

  totale_bilancio_complessivo = valore_tot_mp + valore_tot_imb + valore_tot_pf

  # Visualizzazione formattata richiesta
  st.markdown(f"""
    ### **Valori di Riepilogo al 31 Dicembre:**

    * **MATERIE PRIME IN GIACENZA: € {valore_tot_mp:,.2f}**  
      *(Valutate al costo effettivo di acquisto escluso IVA: {malto:.1f} kg malto, {luppolo:.2f} kg luppolo, {lievito:.2f} kg lievito)*

    * **IMBALLAGGI IN GIACENZA: € {valore_tot_imb:,.2f}**  
      *(Valutati al costo di acquisto escluso IVA: bottiglie vuote, fusti, tappi, scatole ed etichette)*

    * **PRODOTTI FINITI (Birra confezionata): € {valore_tot_pf:,.2f}**  
      *(Litri totali a magazzino: {litri_rimasti_pf:.1f} LT | Costo industriale: € {costo_ind_pf:,.2f} | Accisa assolta: € {accisa_assolta_pf:,.2f})*  
      > **Nota per il bilancio:** Questo valore è comprensivo sia del mero costo industriale di produzione, sia dell'accisa effettiva già assolta/liquidata sui litri rimasti in giacenza, in quanto merce non in regime sospensivo (art. 35 D.Lgs. 504/95 e D.M. 138/2019).

    ---
    ### 💰 **TOTALE RIMANENZE FINALI DI BILANCIO AL 31/12: € {totale_bilancio_complessivo:,.2f}**
    """)

  # Tabella per export CSV
  dati_export = [
      {
          "Macro-Voce": "MATERIE PRIME",
          "Dettaglio": "Malti, Luppoli, Lieviti a magazzino",
          "Criterio Valutazione": "Costo di acquisto escluso IVA",
          "Valore (€)": round(valore_tot_mp, 2),
          "Note di Bilancio": "Giacenze fisiche non utilizzate al 31/12",
      },
      {
          "Macro-Voce": "IMBALLAGGI",
          "Dettaglio": "Bottiglie vuote, fusti, tappi, scatole, etichette",
          "Criterio Valutazione": "Costo di acquisto escluso IVA",
          "Valore (€)": round(valore_tot_imb, 2),
          "Note di Bilancio": "Scorte imballaggi al 31/12",
      },
      {
          "Macro-Voce": "PRODOTTI FINITI",
          "Dettaglio": f"Birra confezionata ({litri_rimasti_pf:.1f} Litri)",
          "Criterio Valutazione": (
              f"Costo industriale (€{costo_ind_pf:.2f}) + Accisa assolta"
              f" (€{accisa_assolta_pf:.2f})"
          ),
          "Valore (€)": round(valore_tot_pf, 2),
          "Note di Bilancio": (
              "Comprensivo di costo industriale e accisa già assolta/liquidata"
              " (merce non in sospensione)"
          ),
      },
      {
          "Macro-Voce": "TOTALE BILANCIO",
          "Dettaglio": "Somma rimanenze finali al 31/12",
          "Criterio Valutazione": "Totale civilistico e fiscale",
          "Valore (€)": round(totale_bilancio_complessivo, 2),
          "Note di Bilancio": "Valore da iscrivere a bilancio di chiusura",
      },
  ]

  df_exp = pd.DataFrame(dati_export)
  st.dataframe(df_exp, use_container_width=True)

  csv_out = io.StringIO()
  df_exp.to_csv(csv_out, index=False)
  st.download_button(
      label="📥 SCARICA PROSPETTO 31/12 PER IL COMMERCIALISTA (CSV)",
      data=csv_out.getvalue().encode("utf-8"),
      file_name="Prospetto_Rimanenze_31_12_Commercialista.csv",
      mime="text/csv",
  )
