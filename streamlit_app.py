import io
import re
import sqlite3
import xml.etree.ElementTree as ET
import pandas as pd
import streamlit as st

st.set_page_config(
    page_title="Gestionale Birrificio", page_icon="🍺", layout="centered"
)

DB_FILE = "birrificio.db"


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
                lievito_kg REAL DEFAULT 0
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
                lotto_sfuso TEXT
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


st.title("🍺 Registro Birrificio")

# --- SEZIONE GIACENZE ---
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

col1, col2, col3 = st.columns(3)
col1.metric("Malto", f"{malto:.1f} kg")
col2.metric("Luppolo", f"{luppolo:.2f} kg")
col3.metric("Lievito", f"{lievito:.2f} kg")
st.info(f"Totale Mosto Anno: **{mosto:.0f} Litri**")

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "📥 Carico XML",
    "⚗️ Nuova Cotta",
    "📦 Confezionamento",
    "🚚 Vendita",
    "📋 Registri",
])

with tab1:
  st.subheader("Carico Automatico da Fattura XML")
  up_xml = st.file_uploader("Carica Fattura Elettronica XML", type=["xml"])
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
                INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg)
                VALUES ('CARICO', ?, ?, ?, ?, ?, ?)
            """,
          (data_doc, f"Fatt. {num_doc}", mittente, t_m, t_l, t_y),
      )
      conn.commit()
    st.success(
        f"Caricati: {t_m}kg Malto, {t_l}kg Luppolo da {mittente} (Fatt. {num_doc})"
    )
    st.rerun()

with tab2:
  st.subheader("Registra Cotta")
  with st.form("cotta_form"):
    c_num = st.text_input("N° Cotta (es. C26-01)")
    lotto = st.text_input("Lotto Sfuso")
    stile = st.text_input("Stile / Tipo Birra")
    litri = st.number_input("Litri Mosto Ottenuti", min_value=0.0, step=10.0)
    plato = st.number_input("Grado Plato Reale", min_value=0.0, step=0.1)
    m_usato = st.number_input("Kg Malto Usati", min_value=0.0, step=5.0)
    l_usato = st.number_input("Kg Luppolo Usati", min_value=0.0, step=0.1)
    sub = st.form_submit_button("Salva Cotta e Scarica Materie Prime")
    if sub:
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

with tab3:
  st.subheader("Confezionamento Fusti e Bottiglie")
  with st.form("conf_form"):
    lotto_c = st.text_input("Riferimento Lotto")
    fmt = st.selectbox(
        "Formato", ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L"]
    )
    qta_c = st.number_input("Quantità Confezionata", min_value=1, step=1)
    sub_c = st.form_submit_button("Carica Birra Condizionata")
    if sub_c:
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      l_un = 30.0 if "30L" in fmt else (0.33 if "0.33L" in fmt else 20.0)
      with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            """
                    INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, documento_rif)
                    VALUES ('CARICO', ?, ?, ?, ?, ?, 'CONFEZIONAMENTO')
                """,
            (oggi, lotto_c, fmt, qta_c, qta_c * l_un),
        )
        conn.commit()
      st.success("Carico confezionamento salvato!")
      st.rerun()

with tab4:
  st.subheader("Scarico Vendite")
  with st.form("vendita_form"):
    doc_v = st.text_input("Rif. Documento / Cliente")
    fmt_v = st.selectbox(
        "Formato Venduto",
        ["Fusto 30L", "Fusto 20L", "Bottiglia 0.33L"],
        key="v_fmt",
    )
    qta_v = st.number_input(
        "Quantità Venduta", min_value=1, step=1, key="v_qta"
    )
    sub_v = st.form_submit_button("Scarica Vendita")
    if sub_v:
      oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
      l_un = 30.0 if "30L" in fmt_v else (0.33 if "0.33L" in fmt_v else 20.0)
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

with tab5:
  st.subheader("Visualizzazione Registri Ufficiali")
  with sqlite3.connect(DB_FILE) as conn:
    st.write("**Registro Materie Prime (Carico/Scarico)**")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM materie_prime", conn),
        use_container_width=True,
    )
    st.write("**Registro Mosto (Allegato I)**")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM registro_mosto", conn),
        use_container_width=True,
    )
    st.write("**Registro Birra Condizionata (Allegato III)**")
    st.dataframe(
        pd.read_sql_query("SELECT * FROM birra_condizionata", conn),
        use_container_width=True,
    )
