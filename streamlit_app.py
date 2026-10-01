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
                lievito_kg REAL DEFAULT 0
            )
        """)
    # 2. Imballaggi (Tappi, Etichette, Bottiglie vuote, Scatole, Fusti vuoti)
    c.execute("""
            CREATE TABLE IF NOT EXISTS imballaggi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_movimento TEXT,
                data TEXT,
                riferimento TEXT,
                articolo TEXT,
                quantita INTEGER DEFAULT 0
            )
        """)
    # 3. Registro Mosto (Allegato I)
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
    # 4. Birra Condizionata / Deposito Fiscale (Allegato III)
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
                valore_unitario REAL DEFAULT 0.0,
                documento_rif TEXT
            )
        """)
    conn.commit()


init_db()


# --- LOGICA DI RICONOSCIMENTO FATTURE ---
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


st.title("🍺 Gestionale & Registri Fiscali Birrificio")

# --- QUERY DI RIEPILOGO GIACENZE ---
with sqlite3.connect(DB_FILE) as conn:
  c = conn.cursor()
  # Materie Prime
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

  # Mosto
  c.execute("SELECT SUM(litri_mosto) FROM registro_mosto")
  mosto = c.fetchone()[0] or 0.0

  # Deposito Fiscale Birra
  c.execute("""
        SELECT 
            SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END),
            SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END),
            SUM(CASE WHEN tipo='CARICO' THEN (quantita * valore_unitario) ELSE -(quantita * valore_unitario) END)
        FROM birra_condizionata
    """)
  df = c.fetchone()
  tot_confezioni = df[0] or 0
  tot_litri_birra = df[1] or 0.0
  valore_tot_magazzino = df[2] or 0.0

# --- METRICHE RAPIDE IN ALTO ---
st.subheader("📊 Quadro Generale Giacenze")
m_col1, m_col2, m_col3, m_col4 = st.columns(4)
m_col1.metric("Malto Disponibile", f"{malto:.1f} kg")
m_col2.metric("Luppolo Disponibile", f"{luppolo:.2f} kg")
m_col3.metric("Lievito Disponibile", f"{lievito:.2f} kg")
m_col4.metric("Mosto Cotte Anno", f"{mosto:.0f} LT")

f_col1, f_col2, f_col3 = st.columns(3)
f_col1.metric("Giacenza Finiti (Pezzi)", f"{tot_confezioni} pz")
f_col2.metric("Birra a Magazzino", f"{tot_litri_birra:.1f} LT")
f_col3.metric("Valore Economico Deposito", f"{valore_tot_magazzino:,.2f} €")

st.divider()

# --- TABS OPERATIVE ---
tab1, tab2, tab3, tab4, tab5, tab6, tab7 = st.tabs([
    "📥 Carico XML / Acquisti",
    "🏷️ Imballaggi",
    "⚗️ Cotta (Mosto)",
    "📦 Confezionamento",
    "🚚 Vendita / Scarico",
    "🏛️ Deposito Fiscale & Registri",
    "📑 Report 31/12 Commercialista",
])

# 1. CARICO FATTURE
with tab1:
  st.subheader("Carico Automatico da Fattura XML")
  up_xml = st.file_uploader("Trascina qui il file XML della Fattura", type=["xml"])
  if up_xml and st.button("Analizza e Registra Acquisto"):
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
                INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg)
                VALUES ('CARICO', ?, ?, ?, ?, ?, ?)
            """,
          (data_doc, f"Fatt. {num_doc}", mittente, t_m, t_l, t_y),
      )
      conn.commit()
    st.success(
        f"Caricati con successo da {mittente}: {t_m} kg Malto, {t_l} kg"
        f" Luppolo, {t_y} kg Lievito."
    )
    st.rerun()

# 2. GESTIONE IMBALLAGGI
with tab2:
  st.subheader("Carico Forniture Imballaggi")
  with st.form("imb_form"):
    i_data = st.date_input("Data Acquisto/Ricezione").strftime("%Y-%m-%d")
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
    i_qta = st.number_input("Quantità Acquistata (pezzi)", min_value=1, step=50)
    i_doc = st.text_input("Rif. Fattura / Fornitore Imballaggi")
    if st.form_submit_button("Registra Carico Imballaggio"):
      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita)
                    VALUES ('CARICO', ?, ?, ?, ?)
                """,
            (i_data, i_doc, i_art, i_qta),
        )
        conn.commit()
      st.success("Imballaggi caricati a magazzino!")
      st.rerun()

  st.write("---")
  st.write("#### Giacenza Attuale Imballaggi")
  with sqlite3.connect(DB_FILE) as conn:
    df_imb = pd.read_sql_query(
        """
            SELECT articolo, 
                   SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) as giacenza_pz
            FROM imballaggi 
            GROUP BY articolo
        """,
        conn,
    )
    st.dataframe(df_imb, use_container_width=True)

# 3. NUOVA COTTA
with tab3:
  st.subheader("Registra Cotta e Scarica Materie Prime")
  with st.form("cotta_form"):
    c_num = st.text_input("N° Cotta (es. C26-01)")
    lotto = st.text_input("Lotto Sfuso")
    stile = st.text_input("Stile Birra (es. Blonde, IPA, Dubbel)")
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
                    VALUES ('SCARICO', ?, ?, 'PRODUZIONE COTTA', ?, ?, 0)
                """,
            (oggi, f"Cotta {c_num} - {lotto}", m_usato, l_usato),
        )
        conn.commit()
      st.success("Cotta salvata e materie prime scaricate!")
      st.rerun()

# 4. CONFEZIONAMENTO
with tab4:
  st.subheader("Confezionamento (Carico Deposito Fiscale & Scarico Imballaggi)")
  with st.form("conf_form"):
    lotto_c = st.text_input("Riferimento Lotto Birra")
    fmt = st.selectbox(
        "Formato Confezionamento",
        ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L", "Bottiglia 0.75L"],
    )
    plato_c = st.number_input(
        "Grado Plato Birra", min_value=0.0, step=0.1, value=12.0
    )
    qta_c = st.number_input("Numero Contenitori Prodotti", min_value=1, step=1)
    valore_un = st.number_input(
        "Valore Commerciale Unitario (€ cad.)",
        min_value=0.0,
        step=0.5,
        value=60.0 if "30L" in fmt else 1.8,
    )
    if st.form_submit_button("Carica a Deposito Fiscale"):
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
                    INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, grado_plato, valore_unitario, documento_rif)
                    VALUES ('CARICO', ?, ?, ?, ?, ?, ?, ?, 'CONFEZIONAMENTO')
                """,
            (
                oggi,
                lotto_c,
                fmt,
                qta_c,
                litri_tot,
                plato_c,
                valore_un,
            ),
        )

        # Scarico automatico imballaggi collegati
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
      st.success("Birra caricata a magazzino e imballaggi scalati!")
      st.rerun()

# 5. SCARICO VENDITA
with tab5:
  st.subheader("Scarico Vendite (Fatture / DDT Clienti)")
  with st.form("vendita_form"):
    doc_v = st.text_input("Rif. Documento di Vendita / Cliente")
    fmt_v = st.selectbox(
        "Formato Venduto",
        ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L", "Bottiglia 0.75L"],
    )
    qta_v = st.number_input("Quantità Venduta", min_value=1, step=1)
    valore_vendita_un = st.number_input(
        "Prezzo Vendita Unitario (€ cad.)", min_value=0.0, step=0.5
    )
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
                    INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, valore_unitario, documento_rif)
                    VALUES ('SCARICO', ?, '-', ?, ?, ?, ?, ?)
                """,
            (
                oggi,
                fmt_v,
                qta_v,
                qta_v * l_un,
                valore_vendita_un,
                doc_v,
            ),
        )
        conn.commit()
      st.success("Scarico vendita registrato!")
      st.rerun()

# 6. DEPOSITO FISCALE & REGISTRI
with tab6:
  st.subheader("🏛️ Situazione Deposito Fiscale & Dati Accise")
  with sqlite3.connect(DB_FILE) as conn:
    st.write("#### Giacenza Dettagliata Prodotti Finiti")
    df_dep = pd.read_sql_query(
        """
            SELECT formato, 
                   SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END) as giacenza_pz,
                   SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END) as litri_magazzino,
                   SUM(CASE WHEN tipo='CARICO' THEN (quantita * valore_unitario) ELSE -(quantita * valore_unitario) END) as valore_euro
            FROM birra_condizionata 
            GROUP BY formato
        """,
        conn,
    )
    st.dataframe(df_dep, use_container_width=True)

    st.write("---")
    st.write("#### Registro Mosto Ufficiale (Allegato I)")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM registro_mosto", conn),
        use_container_width=True,
    )

    st.write("#### Registro Birra Condizionata Ufficiale (Allegato III)")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM birra_condizionata", conn),
        use_container_width=True,
    )

# 7. REPORT COMMERCIALE 31/12
with tab7:
  st.subheader("📑 Report Giacenze di Chiusura Esercizio (Commercialista)")
  st.write(
      "Riepilogo fiscale pronto per la dichiarazione delle rimanenze finali."
  )

  with sqlite3.connect(DB_FILE) as conn:
    # Materie prime
    df_mat = pd.DataFrame([{
        "Categoria": "Materie Prime",
        "Articolo": "Malto Amidaceo",
        "Giacenza": f"{malto:.2f} kg",
    }, {
        "Categoria": "Materie Prime",
        "Articolo": "Luppolo",
        "Giacenza": f"{luppolo:.2f} kg",
    }, {
        "Categoria": "Materie Prime",
        "Articolo": "Lievito",
        "Giacenza": f"{lievito:.2f} kg",
    }])

    # Imballaggi
    df_imb_rep = pd.read_sql_query(
        """
            SELECT 'Imballaggi' as Categoria, articolo as Articolo,
                   CAST(SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) AS TEXT) || ' pz' as Giacenza
            FROM imballaggi 
            GROUP BY articolo
        """,
        conn,
    )

    # Birra a Deposito
    df_birra_rep = pd.read_sql_query(
        """
            SELECT 'Birra Pronta' as Categoria, formato as Articolo,
                   CAST(SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END) AS TEXT) || ' pz (' || 
                   CAST(ROUND(SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END), 1) AS TEXT) || ' LT - Valore: ' ||
                   CAST(ROUND(SUM(CASE WHEN tipo='CARICO' THEN (quantita * valore_unitario) ELSE -(quantita * valore_unitario) END), 2) AS TEXT) || ' €)' as Giacenza
            FROM birra_condizionata 
            GROUP BY formato
        """,
        conn,
    )

    report_totale = pd.concat(
        [df_mat, df_imb_rep, df_birra_rep], ignore_index=True
    )
    st.table(report_totale)

    st.download_button(
        label="📥 Scarica Report Inventario in CSV per Commercialista",
        data=report_totale.to_csv(index=False).encode("utf-8"),
        file_name="inventario_fine_anno_birrificio.csv",
        mime="text/csv",
    )
