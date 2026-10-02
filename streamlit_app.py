import io
import os
import re
import urllib.parse
from datetime import datetime
import psycopg2
from psycopg2 import pool
import xml.etree.ElementTree as ET
import pandas as pd
import streamlit as st
from fpdf import FPDF
from PIL import Image

# --- CONFIGURAZIONE BRANDING BREWDESK & LOGO ---
LOGO_FILENAME = "brewdesk-icon-concept-1.png"

if os.path.exists(LOGO_FILENAME):
    icona_finestra = Image.open(LOGO_FILENAME)
else:
    icona_finestra = "🍺"

st.set_page_config(
    page_title="BrewDesk - Brewery Management Platform",
    page_icon=icona_finestra,
    layout="wide"
)

st.markdown(
    """
    <head>
        <link rel="icon" type="image/png" href="brewdesk-icon-concept-1.png">
        <link rel="apple-touch-icon" href="brewdesk-icon-concept-1.png">
    </head>
    """,
    unsafe_allow_html=True,
)

# --- DATI FISCALI & PARAMETRI ---
PIVA_AZIENDA = "01822710628"
CF_AZIENDA = "NBLLGU54L09F636V"
RAGIONE_AZIENDA = "Birrificio Nobile"
ALIQUOTA_ACCISA_PLATO = 1.794

# --- PROTEZIONE ACCESSO CON CREDENZIALI ---
UTENTI_VALIDI = {
    "admin": "BirraNobile2026!",
    "birranobile": "BirraNobile2026!"
}

if "autenticato" not in st.session_state:
    st.session_state["autenticato"] = False
    st.session_state["utente_connesso"] = ""

if not st.session_state["autenticato"]:
    col_l1, col_l2, col_l3 = st.columns([1, 2, 1])
    with col_l2:
        if os.path.exists(LOGO_FILENAME):
            st.image(LOGO_FILENAME, width=120)
        st.title("🔒 BrewDesk — Accesso Piattaforma")
        with st.form("login_form"):
            username_inserito = st.text_input("Nome Utente / Username", value="admin")
            pwd_inserita = st.text_input("Password di Accesso", type="password")
            btn_login = st.form_submit_button("Accedi al Gestionale")
            if btn_login:
                if username_inserito in UTENTI_VALIDI and UTENTI_VALIDI[username_inserito] == pwd_inserita:
                    st.session_state["autenticato"] = True
                    st.session_state["utente_connesso"] = username_inserito
                    st.rerun()
                else:
                    st.error("Credenziali non valide. Verifica Nome Utente e Password.")
    st.stop()

# --- BARRA LATERALE ---
if os.path.exists(LOGO_FILENAME):
    st.sidebar.image(LOGO_FILENAME, width=150)
st.sidebar.markdown(f"### **{RAGIONE_AZIENDA}**")
st.sidebar.caption(f"P.IVA: `{PIVA_AZIENDA}`")
st.sidebar.markdown(f"👤 **Operatore:** `{st.session_state['utente_connesso']}`")
if st.sidebar.button("Disconnetti (Logout)"):
    st.session_state["autenticato"] = False
    st.session_state["utente_connesso"] = ""
    st.rerun()

# --- GESTIONE POOL CONNESSIONI ---
@st.cache_resource
def get_db_pool():
    db_url = st.secrets["DATABASE_URL"]
    return pool.SimpleConnectionPool(minconn=1, maxconn=20, dsn=db_url)

class DatabaseConnection:
    def __enter__(self):
        self.pool = get_db_pool()
        self.conn = self.pool.getconn()
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.conn.rollback()
        self.pool.putconn(self.conn)

def get_db_connection():
    return DatabaseConnection()

# --- FUNZIONI CACHE RAPIDE (TUTTI I RECORD SENZA FILTRI) ---
@st.cache_data(ttl=30)
def get_cached_riepilogo():
    with get_db_connection() as conn:
        with conn.cursor() as c:
            c.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo='CARICO' THEN malto_kg ELSE -malto_kg END), 0),
                    COALESCE(SUM(CASE WHEN tipo='CARICO' THEN luppolo_kg ELSE -luppolo_kg END), 0),
                    COALESCE(SUM(CASE WHEN tipo='CARICO' THEN lievito_kg ELSE -lievito_kg END), 0)
                FROM materie_prime;
            """)
            mp = c.fetchone()
            c.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END), 0),
                    COALESCE(SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END), 0)
                FROM birra_condizionata;
            """)
            bc = c.fetchone()
    return float(mp[0]), float(mp[1]), float(mp[2]), int(bc[0]), float(bc[1])

@st.cache_data(ttl=30)
def get_cached_ultimi_costi():
    with get_db_connection() as conn:
        df = pd.read_sql_query("""
            SELECT 
                COALESCE(NULLIF(costo_malto_kg, 0), 1.40) as c_malto,
                COALESCE(NULLIF(costo_luppolo_kg, 0), 28.00) as c_luppolo,
                COALESCE(NULLIF(costo_lievito_kg, 0), 65.00) as c_lievito
            FROM materie_prime 
            WHERE tipo='CARICO' AND (malto_kg > 0 OR luppolo_kg > 0 OR lievito_kg > 0)
            ORDER BY id DESC LIMIT 1;
        """, conn)
    if not df.empty:
        return float(df.iloc[0]["c_malto"]), float(df.iloc[0]["c_luppolo"]), float(df.iloc[0]["c_lievito"])
    return 1.40, 28.00, 65.00

# --- PARSING XML ---
def trova_testo_nodo(elemento, tags):
    if elemento is None:
        return ""
    for tag in tags:
        for el in elemento.iter():
            tag_pulito = el.tag.split("}")[-1] if "}" in el.tag else el.tag
            if tag_pulito.lower() == tag.lower() and el.text:
                return el.text.strip()
    return ""

def estrai_da_descrizione(desc: str, qta_pz: float, prezzo_un: float = 0.0):
    d = desc.upper()
    kg_tot = qta_pz
    m_kg = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:KG|CHILI)", d)
    m_g = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:G|GR|GRAMMI)\b", d)

    if m_kg:
        kg_tot = float(m_kg.group(1).replace(",", ".")) * qta_pz
    elif m_g:
        kg_tot = (float(m_g.group(1).replace(",", ".")) / 1000.0) * qta_pz

    costo_reale_kg = (prezzo_un * qta_pz) / kg_tot if kg_tot > 0 and prezzo_un > 0 else 0.0

    chiavi_lievito = ["LIEVITO", "YEAST", "FERMENTO", "FERMENTIS", "SAFEBREW", "SAFBREW", "SAFALE", "SAFLAGER", "LALLEMAND", "BE-256", "WB-06", "S-04", "US-05", "T-58"]
    if any(k in d for k in chiavi_lievito):
        return ("LIEVITO", kg_tot, costo_reale_kg)

    chiavi_malto = ["MALTO", "PILSNER", "WEYERMANN", "FRUMENTO", "PALE", "CARA", "CRYSTAL", "MUNICH", "ZUCCHERO CANDITO", "SUGAR CANDY", "CANDI SUGAR", "ZUCCHERO BRUNO", "DESTROSIO"]
    if any(k in d for k in chiavi_malto):
        return ("MALTO", kg_tot, costo_reale_kg)

    chiavi_luppolo = ["LUPPOLO", "HOP", "T90", "T-90", "PELLETS", "MAGNUM", "PERLE", "MOSAIC", "CASCADE", "CITRA", "SAAZ", "STYRIAN", "GOLDING"]
    if any(k in d for k in chiavi_luppolo):
        return ("LUPPOLO", kg_tot, costo_reale_kg)

    return ("ALTRO", 0.0, 0.0)

def estrai_birra_da_vendita(desc: str):
    d = desc.upper()
    if any(k in d for k in ["CAUZIONE", "TRASPORTO", "SPESE", "BICCHIER", "TEKU", "SPEDIZIONE"]):
        return None
    for l, f in [(30, "Fusto 30L"), (25, "Fusto 25L"), (24, "Fusto 24L"), (20, "Fusto 20L"), (12, "Fusto 12L")]:
        if str(l) in d and any(k in d for k in ["LT", "LITR", "FUST", "POLYKEG", "DOLIUM"]):
            return (f, float(l))
    if "0.33" in d or "33CL" in d or "33 CL" in d or "0,33" in d or "BOTT" in d:
        return ("Bottiglia 0.33L", 0.33)
    if "0.75" in d or "75CL" in d or "75 CL" in d or "0,75" in d:
        return ("Bottiglia 0.75L", 0.75)
    return None

def genera_pdf_bilancio_dogane(anno, cotte_n, litri_cotte, mc_gpl, kwh_ele, 
                               m_acq, m_usat, l_acq, l_usat, y_acq_g, y_usat_g, 
                               b33, b75, f12, f20, f24, f25, f30,
                               giac_m, giac_l, giac_y, giac_birra_lt, resa_media,
                               ragione_soc, piva_az):
    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 12, 15)

    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(180, 8, "BILANCIO FINANZIARIO & DI MATERIA ANNUALE", align="C", ln=1)
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(180, 5, f"Rendicontazione Doganale Esercizio Fiscale {anno} (Comunicazione entro il 31 Gennaio)", align="C", ln=1)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(110, 5, f"Ditta: {ragione_soc}", ln=0)
    pdf.cell(70, 5, f"P.IVA / C.F.: {piva_az}", align="R", ln=1)
    pdf.set_draw_color(160, 160, 160)
    pdf.line(15, pdf.get_y() + 2, 195, pdf.get_y() + 2)
    pdf.ln(4)

    pdf.set_fill_color(235, 240, 248)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(180, 6, " 1. VOLUME DI BIRRA PRODOTTA & ATTIVITÀ DI SALA COTTURA", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(100, 6, f"Numero totale di cotte eseguite nell'anno {anno}:", border=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(80, 6, f"{cotte_n} cotte", align="R", border=1, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(100, 6, "Volume complessivo di mosto/birra prodotto (Litri):", border=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(80, 6, f"{litri_cotte:,.1f} LT", align="R", border=1, ln=1)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(180, 6, " 2. BILANCIO ENERGETICO (Combustibili ed Elettricità impiegati)", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(100, 6, "Consumo totale Gas GPL / Metano:", border=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(80, 6, f"{mc_gpl:,.2f} Smc (Standard mc)", align="R", border=1, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(100, 6, "Consumo totale Energia Elettrica:", border=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(80, 6, f"{kwh_ele:,.1f} kWh", align="R", border=1, ln=1)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(180, 6, " 3. BILANCIO DI MATERIA (Materie Prime Acquistate vs Utilizzate in Cotta)", fill=True, ln=1)
    pdf.set_font("Helvetica", "B", 8)
    pdf.cell(70, 5, "Materia Prima", border=1, align="C", fill=True)
    pdf.cell(55, 5, f"Acquistato nel {anno}", border=1, align="C", fill=True)
    pdf.cell(55, 5, f"Impiegato in Cotta ({anno})", border=1, align="C", fill=True, ln=1)
    
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(70, 6, "Malto d'orzo & fermentabili", border=1)
    pdf.cell(55, 6, f"{m_acq:,.1f} kg", border=1, align="R")
    pdf.cell(55, 6, f"{m_usat:,.1f} kg", border=1, align="R", ln=1)

    pdf.cell(70, 6, "Luppolo", border=1)
    pdf.cell(55, 6, f"{l_acq:,.2f} kg", border=1, align="R")
    pdf.cell(55, 6, f"{l_usat:,.2f} kg", border=1, align="R", ln=1)

    pdf.cell(70, 6, "Lievito", border=1)
    pdf.cell(55, 6, f"{y_acq_g:,.0f} gr", border=1, align="R")
    pdf.cell(55, 6, f"{y_usat_g:,.0f} gr", border=1, align="R", ln=1)
    
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(180, 5, f"Resa media ponderata di sala cottura rilevata nel ciclo produttivo: {resa_media:.1f}%", ln=1)
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(180, 6, " 4. BIRRA CONDIZIONATA NEL CORSO DELL'ANNO (Presa in carico)", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 8)
    
    formati_list = [
        ("N. Bottiglie da 0.33 L", b33, "pezzi"),
        ("N. Bottiglie da 0.75 L", b75, "pezzi"),
        ("N. Fusti da 12 L", f12, "fusti"),
        ("N. Fusti da 20 L", f20, "fusti"),
        ("N. Fusti da 24 L", f24, "fusti"),
        ("N. Fusti da 25 L", f25, "fusti"),
        ("N. Fusti da 30 L", f30, "fusti")
    ]
    for desc_fmt, qta_val, um in formati_list:
        pdf.cell(100, 5, f" - {desc_fmt}:", border="L,R")
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(80, 5, f"{qta_val:,} {um}", align="R", border="L,R", ln=1)
        pdf.set_font("Helvetica", "", 8)
    pdf.cell(180, 1, "", border="T", ln=1)
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(180, 6, f" 5. INVENTARIO FISICO DELLE ESISTENZE AL 31/12/{anno}", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(180, 5, f" - Giacenza Materie Prime: Malto/Fermentabili ({giac_m:,.1f} kg) | Luppoli ({giac_l:,.2f} kg) | Lieviti ({giac_y*1000:,.0f} gr)", ln=1)
    pdf.cell(180, 5, f" - Giacenza Birra Finita a Magazzino: {giac_birra_lt:,.1f} Litri", ln=1)
    pdf.ln(5)

    pdf.set_font("Helvetica", "", 9)
    pdf.cell(90, 5, f"Luogo e Data: __________________, 31/01/{int(anno)+1}", ln=0)
    pdf.cell(90, 5, "Firma del Titolare / Rappresentante Fiscale", align="R", ln=1)
    pdf.ln(5)
    pdf.cell(90, 5, "___________________________________", ln=0)
    pdf.cell(90, 5, "________________________________________", align="R", ln=1)

    return bytes(pdf.output())

def genera_pdf_commercialista(val_mp, val_imb, val_pf, tot_bilancio, malto, luppolo, lievito, litri_pf, costo_ind, accisa_pf, ragione_soc, piva_az):
    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=False)
    pdf.add_page()
    pdf.set_margins(15, 12, 15)

    pdf.set_font("Helvetica", "B", 15)
    pdf.set_xy(15, 12)
    pdf.cell(267, 8, "PROSPETTO RIMANENZE DI MAGAZZINO AL 31/12", align="C", ln=1)

    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(267, 5, "BrewDesk Platform - Rilevazione Consistenze e Valutazioni Fiscali", align="C", ln=1)
    pdf.ln(2)

    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(130, 5, f"Attività: {ragione_soc} - P.IVA: {piva_az}", ln=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(137, 5, "Destinatario: Studio Commerciale", align="R", ln=1)

    pdf.set_draw_color(180, 180, 180)
    pdf.line(15, pdf.get_y() + 2, 282, pdf.get_y() + 2)
    pdf.ln(5)

    pdf.set_fill_color(240, 242, 245)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(267, 6, " 1. MATERIE PRIME IN GIACENZA", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(267, 5, f"Consistenze: Malto e fermentabili ({malto:.1f} kg), Luppoli ({luppolo:.2f} kg), Lieviti ({lievito:.3f} kg) - Valutate al costo effettivo escluso IVA.", ln=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(190, 6, "Valore Fiscale Materie Prime al 31/12:", ln=0)
    pdf.cell(77, 6, f"EUR  {val_mp:,.2f}", align="R", ln=1)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(267, 6, " 2. IMBALLAGGI IN GIACENZA", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(267, 5, "Composizione: Scorte di bottiglie vuote, fusti, tappi a corona, scatole ed etichette - Valutati al costo di acquisto escluso IVA.", ln=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(190, 6, "Valore Fiscale Imballaggi al 31/12:", ln=0)
    pdf.cell(77, 6, f"EUR  {val_imb:,.2f}", align="R", ln=1)
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(267, 6, " 3. PRODOTTI FINITI (Birra Confezionata)", fill=True, ln=1)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(267, 5, f"Volume totale a magazzino: {litri_pf:.1f} Litri confezionati in fusti e bottiglie.", ln=1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(190, 6, "Valore Fiscale Prodotti Finiti al 31/12:", ln=0)
    pdf.cell(77, 6, f"EUR  {val_pf:,.2f}", align="R", ln=1)
    pdf.ln(5)

    y_tot = pdf.get_y()
    pdf.set_draw_color(40, 80, 150)
    pdf.set_fill_color(230, 240, 255)
    pdf.rect(15, y_tot, 267, 12, "DF")
    pdf.set_xy(18, y_tot + 2)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(180, 8, "TOTALE RIMANENZE FINALI DI BILANCIO AL 31/12:", ln=0)
    pdf.cell(80, 8, f"EUR  {tot_bilancio:,.2f}", align="R", ln=1)
    pdf.ln(12)

    pdf.set_font("Helvetica", "", 9)
    pdf.cell(130, 5, "Data: 31/12/2026", ln=0)
    pdf.cell(137, 5, "Firma Titolare", align="R", ln=1)
    pdf.ln(6)
    pdf.cell(130, 5, "_______________________", ln=0)
    pdf.cell(137, 5, "____________________________________", align="R", ln=1)

    return bytes(pdf.output())

# --- HEADER APP ---
col_head1, col_head2 = st.columns([1.2, 8])
with col_head1:
    if os.path.exists(LOGO_FILENAME):
        st.image(LOGO_FILENAME, width=85)
with col_head2:
    st.title("BrewDesk — Microbrewery Management")

malto, luppolo, lievito, tot_confezioni, tot_litri_finiti = get_cached_riepilogo()

col1, col2, col3, col4 = st.columns(4)
col1.metric("Malto & Zuccheri Residui", f"{malto:.1f} kg")
col2.metric("Luppolo Residuo", f"{luppolo:.2f} kg")
col3.metric("Lievito Residuo", f"{lievito:.3f} kg")
col4.metric("Birra a Magazzino", f"{tot_litri_finiti:.1f} LT")

st.divider()

tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs([
    "📥 Carico Acquisti XML",
    "🏷️ Imballaggi",
    "⚗️ Cotta & Sala Cottura",
    "📦 Confezionamento Misto",
    "🚚 Vendite (XML & Manuale)",
    "🏛️ Giacenze Magazzino",
    "⏰ Scadenze Accise (2803 / 2813)",
    "📑 Report 31/12 & Bilancio Dogane",
])

# TAB 1: ACQUISTI XML
with tab1:
    st.subheader("Carico Automatico Materie Prime & Visore Costi da Fatture XML")
    up_xmls = st.file_uploader("Seleziona i file XML fornitori", type=["xml"], accept_multiple_files=True, key="xml_acquisti")
    c_medio = st.number_input("Costo medio stimato indicativo (€/kg)", value=1.40, step=0.1)

    if up_xmls and st.button("Elabora Fatture Acquisto"):
        carichi_mp, tot_m, tot_l, tot_y = 0, 0.0, 0.0, 0.0
        with get_db_connection() as conn:
            with conn.cursor() as c:
                for up_xml in up_xmls:
                    try:
                        content = up_xml.read()
                        root = ET.fromstring(content)
                        cedente = root.find(".//DatiAnagraficiCedente")
                        mittente = trova_testo_nodo(cedente, ["Denominazione", "Cognome"]) if cedente is not None else up_xml.name
                        num_doc = trova_testo_nodo(root, ["Numero"]) or "N.D."
                        data_doc = trova_testo_nodo(root, ["Data"]) or pd.Timestamp.now().strftime("%Y-%m-%d")
                        rif_fattura = f"Fatt. {num_doc}"

                        c.execute("SELECT id FROM materie_prime WHERE riferimento=%s AND azienda=%s LIMIT 1;", (rif_fattura, mittente))
                        if c.fetchone():
                            st.warning(f"⚠️ Documento XML N. {num_doc} ({mittente}) già caricato! Saltato.")
                            continue

                        t_m, t_l, t_y = 0.0, 0.0, 0.0
                        costo_m_kg, costo_l_kg, costo_y_kg = 1.40, 28.00, 65.00
                        for el in root.iter():
                            if el.tag.split("}")[-1] == "DettaglioLinee":
                                desc = trova_testo_nodo(el, ["Descrizione"])
                                qta = float(trova_testo_nodo(el, ["Quantita"]).replace(",", ".") or 0.0)
                                p_un = float(trova_testo_nodo(el, ["PrezzoUnitario"]).replace(",", ".") or 0.0)

                                tipo, p, costo_effettivo = estrai_da_descrizione(desc, qta, p_un)
                                if tipo == "MALTO":
                                    t_m += p
                                    if costo_effettivo > 0: costo_m_kg = costo_effettivo
                                elif tipo == "LUPPOLO":
                                    t_l += p
                                    if costo_effettivo > 0: costo_l_kg = costo_effettivo
                                elif tipo == "LIEVITO":
                                    t_y += p
                                    if costo_effettivo > 0: costo_y_kg = costo_effettivo

                        c.execute("""
                            INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg, costo_malto_kg, costo_luppolo_kg, costo_lievito_kg, costo_kg_medio)
                            VALUES ('CARICO', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """, (data_doc, rif_fattura, mittente, t_m, t_l, t_y, costo_m_kg, costo_l_kg, costo_y_kg, c_medio))
                        carichi_mp += 1; tot_m += t_m; tot_l += t_l; tot_y += t_y
                    except Exception as e:
                        st.error(f"Errore su {up_xml.name}: {e}")
                conn.commit()

        if carichi_mp > 0:
            st.cache_data.clear()
            st.success(f"Caricate {carichi_mp} nuove fatture: +{tot_m:.1f} kg Malto/Zuccheri, +{tot_l:.2f} kg Luppolo, +{tot_y:.3f} kg Lievito.")
            st.rerun()

    st.write("---")
    st.markdown("#### 📋 Storico Movimentazioni & Costi Unitari Rilevati da XML")
    with get_db_connection() as conn:
        df_mp_mov = pd.read_sql_query("""
            SELECT id, data as "Data", tipo as "Tipo Movimento", riferimento as "Riferimento", azienda as "Fornitore / Cotta", 
                   malto_kg as "Kg Malto/Zucchero", ROUND(costo_malto_kg::numeric, 2) as "€/kg Malto",
                   luppolo_kg as "Kg Luppolo", ROUND(costo_luppolo_kg::numeric, 2) as "€/kg Luppolo",
                   lievito_kg as "Kg Lievito", ROUND(costo_lievito_kg::numeric, 2) as "€/kg Lievito"
            FROM materie_prime 
            ORDER BY id DESC;
        """, conn)
    st.dataframe(df_mp_mov, use_container_width=True)

# TAB 2: IMBALLAGGI
with tab2:
    st.subheader("Carico Acquisti Imballaggi")
    with st.form("imb_form"):
        i_data = st.date_input("Data Acquisto").strftime("%Y-%m-%d")
        i_art = st.selectbox("Tipo Imballaggio", ["Bottiglie 0.33L vuote", "Bottiglie 0.75L vuote", "Tappi a corona", "Etichette", "Scatole / Cartoni", "Fusti vuoti 12L", "Fusti vuoti 20L", "Fusti vuoti 24L", "Fusti vuoti 25L", "Fusti vuoti 30L"])
        i_qta = st.number_input("Quantità Acquistata (pz)", min_value=1, step=100)
        i_costo = st.number_input("Costo Unitario Acquisto (€/pz escluso IVA)", min_value=0.001, value=0.25, step=0.01, format="%.3f")
        i_doc = st.text_input("Rif. Fattura / Fornitore")
        if st.form_submit_button("Carica Imballaggi"):
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    c.execute("""
                        INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita, costo_unitario)
                        VALUES ('CARICO', %s, %s, %s, %s, %s);
                    """, (i_data, i_doc, i_art, i_qta, i_costo))
                conn.commit()
            st.cache_data.clear()
            st.success("Imballaggi registrati!")
            st.rerun()

    with get_db_connection() as conn:
        df_imb = pd.read_sql_query("""
            SELECT articolo, 
                   SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) as giacenza_pz,
                   MAX(costo_unitario) as costo_acquisto_unitario_euro,
                   ROUND(SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) * MAX(costo_unitario), 2) as totale_valore_euro
            FROM imballaggi 
            GROUP BY articolo;
        """, conn)
        st.dataframe(df_imb, use_container_width=True)

# TAB 3: SALA COTTURA (ALLEGATO I, CONSUMI & DATA PREVENTIVA)
with tab3:
    st.subheader("⚗️ Sala Cottura: Inserimento Cotta, Allegato I & Consumi Energetici")
    with get_db_connection() as conn:
        df_cotte_all = pd.read_sql_query("SELECT * FROM registro_mosto ORDER BY id DESC;", conn)

    c_m_default, c_l_default, c_y_default = get_cached_ultimi_costi()
    modalita_cotta = st.radio("Azione:", ["➕ Registra Nuova Cotta", "✏️ Modifica Cotta Esistente", "🗑️ Elimina Cotta Errata"], horizontal=True)

    if modalita_cotta == "🗑️️ Elimina Cotta Errata":
        if not df_cotte_all.empty:
            scelte_cotte_del = [f"ID {r['id']} | Cotta {r['cotta_num']} - Lotto {r['lotto_sfuso']} ({r['tipo_birra']}) - {r['data']}" for _, r in df_cotte_all.iterrows()]
            sel_del = st.selectbox("Seleziona la cotta da eliminare:", scelte_cotte_del)
            id_del = int(sel_del.split("|")[0].replace("ID", "").strip())
            if st.button("Conferma ed Elimina Cotta Definitivamente", type="primary"):
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("DELETE FROM registro_mosto WHERE id=%s;", (id_del,))
                    conn.commit()
                st.cache_data.clear()
                st.success(f"Cotta ID {id_del} eliminata con successo!")
                st.rerun()
    else:
        val_data, val_data_prev = datetime.now().date(), datetime.now().date()
        val_c_num, val_lotto, val_stile = "C26-01", f"LOTTO-{datetime.now().strftime('%y%m%d')}", "Blonde"
        val_cl_ini, val_cl_fin, val_litri, val_plato = 0.0, 500.0, 500.0, 12.0
        val_malto, val_luppolo_kg, val_gas, val_kwh = 100.0, 1.00, 14.5, 45.0
        id_cotta_modifica = None

        if modalita_cotta == "✏️ Modifica Cotta Esistente" and not df_cotte_all.empty:
            scelte_cotte = [f"ID {r['id']} | Cotta {r['cotta_num']} - Lotto {r['lotto_sfuso']} ({r['tipo_birra']}) - {r['data']}" for _, r in df_cotte_all.iterrows()]
            sel_mod = st.selectbox("Seleziona cotta da modificare:", scelte_cotte)
            id_cotta_modifica = int(sel_mod.split("|")[0].replace("ID", "").strip())
            r_sel = df_cotte_all[df_cotte_all["id"] == id_cotta_modifica].iloc[0]
            val_c_num = str(r_sel["cotta_num"])
            val_lotto = str(r_sel["lotto_sfuso"])
            val_stile = str(r_sel["tipo_birra"])
            val_litri = float(r_sel["litri_mosto"])
            val_plato = float(r_sel["grado_plato"])
            val_malto = float(r_sel.get("malto_usato_kg", 100.0) or 100.0)
            val_luppolo_kg = float(r_sel.get("luppolo_usato_kg", 1.00) or 1.00)
            val_gas = float(r_sel.get("consumo_gas_mc", 14.5) or 14.5)
            val_kwh = float(r_sel.get("consumo_elettrico_kwh", 45.0) or 45.0)

        col_d1, col_d2, col_d3, col_d4 = st.columns(4)
        with col_d1: data_prev_sel = st.date_input("Data Preventiva Cotta (Dogane)", value=val_data_prev)
        with col_d2: data_cotta_sel = st.date_input("Data Effettiva Cotta", value=val_data)
        with col_d3: c_num = st.text_input("N° Cotta", value=val_c_num)
        with col_d4: lotto_sfuso = st.text_input("Lotto Mosto Sfuso", value=val_lotto)

        stile = st.text_input("Stile Birra", value=val_stile)

        cl1, cl2, cl3 = st.columns(3)
        with cl1: cl_inizio = st.number_input("Lettura Iniziale Contalitri", min_value=0.0, value=val_cl_ini)
        with cl2: cl_fine = st.number_input("Lettura Finale Contalitri", min_value=0.0, value=val_cl_fin)
        with cl3:
            diff_cl = max(0.0, cl_fine - cl_inizio)
            st.metric("Volume Contalitri (LT)", f"{diff_cl:.1f} LT")

        litri_mosto_reali = st.number_input("Litri Mosto Trasferiti in Fermentatore", min_value=0.0, value=val_litri if val_litri > 0 else 500.0)
        plato = st.number_input("Grado Plato (°P)", min_value=0.0, step=0.1, value=val_plato)
        accisa_dovuta_calc = ((litri_mosto_reali * plato) / 100.0) * ALIQUOTA_ACCISA_PLATO

        ce1, ce2, ce3 = st.columns(3)
        with ce1: gas_mc = st.number_input("Consumo GPL / Metano (Smc)", min_value=0.0, value=val_gas)
        with ce2: kwh_consumati = st.number_input("Consumo Elettricità (kWh)", min_value=0.0, value=val_kwh)
        with ce3: st.metric("Accisa Dovuta Cotta", f"€ {accisa_dovuta_calc:.2f}")

        col_m1, col_m2 = st.columns(2)
        with col_m1:
            m_usato = st.number_input("Kg Malto Macinato (kg)", min_value=0.0, value=val_malto)
            l_input_g = st.number_input("Quantità Luppolo (Grammi)", min_value=0.0, value=val_luppolo_kg * 1000.0)
            l_usato = l_input_g / 1000.0
            sg = 1 + (plato / (258.6 - ((plato / 258.2) * 227.1)))
            resa_perc = ((litri_mosto_reali * plato * sg) / 100.0) / m_usato * 100.0 if m_usato > 0 else 0.0
            st.info(f"📊 **Resa Sala Cottura:** {resa_perc:.1f}%")
        with col_m2:
            tipo_y = st.radio("Lievito:", ["Recuperato (Ripitching)", "Nuova Confezione"], index=0)
            y_kg = (st.number_input("Lievito Nuovo (Grammi)", min_value=0.0, value=11.5) / 1000.0) if "Nuova" in tipo_y else 0.0

        subtot_mp = (m_usato * c_m_default) + (l_usato * c_l_default) + (y_kg * c_y_default)
        costo_lt = (subtot_mp / litri_mosto_reali) if litri_mosto_reali > 0 else 0.0
        st.success(f"Costo MP Cotta: € {subtot_mp:.2f} | Costo/LT: € {costo_lt:.3f}")

        if st.button("Salva Cotta in Allegato I & Scarica Magazzino", type="primary"):
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    if modalita_cotta == "✏️ Modifica Cotta Esistente" and id_cotta_modifica:
                        c.execute("""
                            UPDATE registro_mosto
                            SET data=%s, data_preventiva=%s, cotta_num=%s, tipo_birra=%s, litri_mosto=%s, grado_plato=%s, lotto_sfuso=%s,
                                contalitri_inizio=%s, contalitri_fine=%s, malto_usato_kg=%s, luppolo_usato_kg=%s, lievito_usato_kg=%s, resa_perc=%s,
                                consumo_gas_mc=%s, consumo_elettrico_kwh=%s, accisa_dovuta_euro=%s, costo_totale_cotta=%s, costo_litro_mosto=%s
                            WHERE id=%s;
                        """, (data_cotta_sel.strftime("%Y-%m-%d"), data_prev_sel.strftime("%Y-%m-%d"), c_num, stile, litri_mosto_reali, plato, lotto_sfuso,
                              cl_inizio, cl_fine, m_usato, l_usato, y_kg, resa_perc, gas_mc, kwh_consumati, accisa_dovuta_calc, subtot_mp, costo_lt, id_cotta_modifica))
                    else:
                        c.execute("""
                            INSERT INTO registro_mosto (data, data_preventiva, cotta_num, tipo_birra, litri_mosto, grado_plato, lotto_sfuso, note_lievito, contalitri_inizio, contalitri_fine, malto_usato_kg, luppolo_usato_kg, lievito_usato_kg, resa_perc, consumo_gas_mc, consumo_elettrico_kwh, accisa_dovuta_euro, costo_totale_cotta, costo_litro_mosto)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """, (data_cotta_sel.strftime("%Y-%m-%d"), data_prev_sel.strftime("%Y-%m-%d"), c_num, stile, litri_mosto_reali, plato, lotto_sfuso, tipo_y, cl_inizio, cl_fine, m_usato, l_usato, y_kg, resa_perc, gas_mc, kwh_consumati, accisa_dovuta_calc, subtot_mp, costo_lt))
                        c.execute("""
                            INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg)
                            VALUES ('SCARICO', %s, %s, 'COTTA PRODUZIONE', %s, %s, %s);
                        """, (data_cotta_sel.strftime("%Y-%m-%d"), f"Cotta {c_num} - {lotto_sfuso}", m_usato, l_usato, y_kg))
                conn.commit()
            st.cache_data.clear()
            st.success("Cotta salvata in Allegato I!")
            st.rerun()

    st.write("---")
    with get_db_connection() as conn:
        st.dataframe(pd.read_sql_query("""
            SELECT id, data_preventiva as "Data Prev.", data as "Data Cotta", cotta_num as "N° Cotta", tipo_birra as "Stile",
                   litri_mosto as "Litri", grado_plato as "°P", accisa_dovuta_euro as "Accisa (€)",
                   consumo_gas_mc as "Gas (mc)", consumo_elettrico_kwh as "Energia (kWh)", lotto_sfuso as "Lotto"
            FROM registro_mosto ORDER BY id DESC;
        """, conn), use_container_width=True)

# TAB 4: CONFEZIONAMENTO MISTO
with tab4:
    st.subheader("📦 Confezionamento Misto Cotta (Fusti e Bottiglie)")
    with get_db_connection() as conn:
        df_mosti = pd.read_sql_query("SELECT id, cotta_num, lotto_sfuso, tipo_birra, litri_mosto, grado_plato, costo_litro_mosto FROM registro_mosto ORDER BY id DESC LIMIT 25;", conn)

    if not df_mosti.empty:
        opts = [f"ID {r['id']} | Cotta {r['cotta_num']} ({r['tipo_birra']}) - {r['litri_mosto']} LT - °P {r['grado_plato']}" for _, r in df_mosti.iterrows()]
        sel_c = st.selectbox("Seleziona Cotta:", opts)
        id_c = int(sel_c.split("|")[0].replace("ID", "").strip())
        r_sel = df_mosti[df_mosti["id"] == id_c].iloc[0]
        litri_iniziali = float(r_sel["litri_mosto"])
        plato_rif = float(r_sel["grado_plato"])
        lotto_def = str(r_sel["lotto_sfuso"])
        costo_suggerito_lt = float(r_sel.get("costo_litro_mosto", 1.10) or 1.10)
    else:
        litri_iniziali, plato_rif, lotto_def, costo_suggerito_lt = 500.0, 12.0, "LOTTO-2601", 1.10

    with st.form("conf_misto_form"):
        col_gen1, col_gen2, col_gen3 = st.columns(3)
        with col_gen1: data_imb = st.date_input("Data Confezionamento", value=datetime.now())
        with col_gen2: lotto_c = st.text_input("Lotto Confezionato", value=lotto_def)
        with col_gen3: costo_p_lt = st.number_input("Costo Produzione (€/LT)", min_value=0.01, value=costo_suggerito_lt, step=0.05)

        st.markdown("#### 🛢️ Fusti")
        cf1, cf2, cf3, cf4, cf5 = st.columns(5)
        with cf1: q_f12 = st.number_input("Fusti 12L", min_value=0, value=0)
        with cf2: q_f20 = st.number_input("Fusti 20L", min_value=0, value=0)
        with cf3: q_f24 = st.number_input("Fusti 24L", min_value=0, value=0)
        with cf4: q_f25 = st.number_input("Fusti 25L", min_value=0, value=0)
        with cf5: q_f30 = st.number_input("Fusti 30L", min_value=0, value=0)

        st.markdown("#### 🍾 Bottiglie")
        cb1, cb2 = st.columns(2)
        with cb1: q_b33 = st.number_input("Bottiglie 0.33L", min_value=0, step=12, value=0)
        with cb2: q_b75 = st.number_input("Bottiglie 0.75L", min_value=0, step=6, value=0)

        lt_teorici = (q_f12 * 12.0) + (q_f20 * 20.0) + (q_f24 * 24.0) + (q_f25 * 25.0) + (q_f30 * 30.0) + (q_b33 * 0.33) + (q_b75 * 0.75)
        scarto_teorico = max(0.0, litri_iniziali - lt_teorici)

        c_v1, c_v2, c_v3 = st.columns(3)
        with c_v1: litri_effettivi = st.number_input("Litri Totali Confezionati (LT)", min_value=0.0, value=float(lt_teorici))
        with c_v2: st.metric("Ettogradi Totali (°E)", f"{(litri_effettivi * plato_rif) / 100.0:.2f} °E")
        with c_v3: scarto_reale = st.number_input("Scarto Reale (LT)", min_value=0.0, value=float(scarto_teorico))

        if st.form_submit_button("Carica Tutti i Formati a Magazzino", type="primary"):
            if litri_effettivi <= 0:
                st.error("Inserisci almeno un formato confezionato.")
            else:
                d_str = data_imb.strftime("%Y-%m-%d")
                fattore = (litri_effettivi / lt_teorici) if lt_teorici > 0 else 1.0
                movs = []
                if q_f12 > 0: movs.append(("Fusto 12L", q_f12, (q_f12 * 12.0) * fattore, "Fusti vuoti 12L"))
                if q_f20 > 0: movs.append(("Fusto 20L", q_f20, (q_f20 * 20.0) * fattore, "Fusti vuoti 20L"))
                if q_f24 > 0: movs.append(("Fusto 24L", q_f24, (q_f24 * 24.0) * fattore, "Fusti vuoti 24L"))
                if q_f25 > 0: movs.append(("Fusto 25L", q_f25, (q_f25 * 25.0) * fattore, "Fusti vuoti 25L"))
                if q_f30 > 0: movs.append(("Fusto 30L", q_f30, (q_f30 * 30.0) * fattore, "Fusti vuoti 30L"))
                if q_b33 > 0: movs.append(("Bottiglia 0.33L", q_b33, (q_b33 * 0.33) * fattore, "Bottiglie 0.33L vuote"))
                if q_b75 > 0: movs.append(("Bottiglia 0.75L", q_b75, (q_b75 * 0.75) * fattore, "Bottiglie 0.75L vuote"))

                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        for idx, (fmt, qta, lt_r, art_imb) in enumerate(movs):
                            sc = scarto_reale if idx == 0 else 0.0
                            c.execute("""
                                INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, grado_plato, ettogradi, scarto_litri, costo_produzione_litro, documento_rif)
                                VALUES ('CARICO', %s, %s, %s, %s, %s, %s, %s, %s, %s, 'CONFEZIONAMENTO');
                            """, (d_str, lotto_c, fmt, qta, lt_r, plato_rif, (lt_r * plato_rif) / 100.0, sc, costo_p_lt))
                            c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', %s, %s, %s, %s);", (d_str, f"Lotto {lotto_c}", art_imb, qta))
                            if "Bottiglia" in fmt:
                                c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', %s, %s, 'Tappi a corona', %s);", (d_str, f"Lotto {lotto_c}", qta))
                                c.execute("INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita) VALUES ('SCARICO', %s, %s, 'Etichette', %s);", (d_str, f"Lotto {lotto_c}", qta))
                    conn.commit()
                st.cache_data.clear()
                st.success(f"Confezionamento registrato! Caricati {litri_effettivi:.1f} LT a magazzino.")
                st.rerun()

# TAB 5: VENDITE XML E MANUALI
with tab5:
    st.subheader("🚚 Scarico Vendite Birra (Fatture XML)")
    up_vendite_xml = st.file_uploader("Trascina qui le fatture XML emesse", type=["xml"], accept_multiple_files=True, key="xml_vendite")

    if up_vendite_xml and st.button("Elabora e Scarica Fatture Emesse"):
        tot_scarichi, tot_litri = 0, 0.0
        with get_db_connection() as conn:
            with conn.cursor() as c:
                for up_xml in up_vendite_xml:
                    try:
                        content = up_xml.read()
                        root = ET.fromstring(content)
                        cess = root.find(".//DatiAnagraficiCessionario")
                        cliente = trova_testo_nodo(cess, ["Denominazione", "Cognome"]) if cess is not None else "Cliente"
                        num_doc = trova_testo_nodo(root, ["Numero"]) or "N.D."
                        data_doc = trova_testo_nodo(root, ["Data"]) or pd.Timestamp.now().strftime("%Y-%m-%d")
                        rif_vendita = f"Fatt. {num_doc} - {cliente}"

                        c.execute("SELECT id FROM birra_condizionata WHERE documento_rif=%s LIMIT 1;", (rif_vendita,))
                        if c.fetchone():
                            st.warning(f"⚠️ Fattura {num_doc} già elaborata! Saltata.")
                            continue

                        for el in root.iter():
                            if el.tag.split("}")[-1] == "DettaglioLinee":
                                desc = trova_testo_nodo(el, ["Descrizione"])
                                qta = int(float(trova_testo_nodo(el, ["Quantita"]).replace(",", ".") or 1))
                                p_un = float(trova_testo_nodo(el, ["PrezzoUnitario"]).replace(",", ".") or 0.0)
                                b_info = estrai_birra_da_vendita(desc)
                                if b_info:
                                    fmt_v, lt_un = b_info
                                    litri_r = qta * lt_un
                                    c.execute("""
                                        INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, costo_produzione_litro, documento_rif)
                                        VALUES ('SCARICO', %s, '-', %s, %s, %s, %s, %s);
                                    """, (data_doc, fmt_v, qta, litri_r, p_un, rif_vendita))
                                    tot_scarichi += 1
                                    tot_litri += litri_r
                    except Exception as e:
                        st.error(f"Errore su {up_xml.name}: {e}")
                conn.commit()
        if tot_scarichi > 0:
            st.cache_data.clear()
            st.success(f"Registrati {tot_scarichi} scarichi per {tot_litri:.1f} Litri!")
            st.rerun()

    st.write("---")
    st.markdown("### ✍️ Scarico Manuale")
    with st.form("vendita_manuale_form"):
        doc_v = st.text_input("Riferimento DDT / Cliente")
        fmt_v = st.selectbox("Formato Venduto", ["Fusto 12L", "Fusto 20L", "Fusto 24L", "Fusto 25L", "Fusto 30L", "Bottiglia 0.33L", "Bottiglia 0.75L"])
        qta_v = st.number_input("Quantità Venduta", min_value=1, step=1)
        if st.form_submit_button("Registra Scarico Manuale"):
            oggi = pd.Timestamp.now().strftime("%Y-%m-%d")
            l_map = {"Fusto 12L": 12.0, "Fusto 20L": 20.0, "Fusto 24L": 24.0, "Fusto 25L": 25.0, "Fusto 30L": 30.0, "Bottiglia 0.33L": 0.33, "Bottiglia 0.75L": 0.75}
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    c.execute("""
                        INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, documento_rif)
                        VALUES ('SCARICO', %s, '-', %s, %s, %s, %s);
                    """, (oggi, fmt_v, qta_v, qta_v * l_map[fmt_v], doc_v))
                conn.commit()
            st.cache_data.clear()
            st.success("Scarico registrato!")
            st.rerun()

# TAB 6: GIACENZE MAGAZZINO (100% DEI RECORD SENZA ALCUN FILTRO)
with tab6:
    st.subheader("🏛️ Giacenze Magazzino Prodotti Finiti")
    with get_db_connection() as conn:
        df_pf = pd.read_sql_query("""
            SELECT formato as "Formato Contenitore", 
                   COALESCE(SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END), 0) as "Giacenza (Pezzi)",
                   ROUND(COALESCE(SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END), 0)::numeric, 1) as "Giacenza (Litri)",
                   ROUND(AVG(grado_plato)::numeric, 1) as "Grado Plato Medio (°P)"
            FROM birra_condizionata 
            GROUP BY formato ORDER BY formato;
        """, conn)
        st.dataframe(df_pf, use_container_width=True)

        st.markdown("#### 🔍 Dettaglio Movimentazioni & Lotti")
        df_det = pd.read_sql_query("""
            SELECT id, data as "Data", tipo as "Movimento", lotto as "Lotto", formato as "Formato", 
                   quantita as "Pz", litri_totali as "Litri", ettogradi as "°Ettogradi", scarto_litri as "Scarto (LT)", documento_rif as "Riferimento"
            FROM birra_condizionata 
            ORDER BY id DESC;
        """, conn)
        st.dataframe(df_det, use_container_width=True)

        if not df_det.empty:
            col_d1, col_d2 = st.columns([3, 1])
            with col_d1:
                opts_del = [f"ID {r['id']} | {r['Data']} - {r['Movimento']} {r['Pz']} pz ({r['Formato']} - {r['Litri']} LT) - Rif: {r['Riferimento']}" for _, r in df_det.iterrows()]
                sel_m_del = st.selectbox("Seleziona movimento errato da eliminare:", opts_del)
                id_m_del = int(sel_m_del.split("|")[0].replace("ID", "").strip())
            with col_d2:
                st.write("")
                st.write("")
                if st.button("🗑️ Elimina Movimento", type="primary"):
                    with conn.cursor() as c:
                        c.execute("DELETE FROM birra_condizionata WHERE id=%s;", (id_m_del,))
                    conn.commit()
                    st.cache_data.clear()
                    st.success("Movimento eliminato!")
                    st.rerun()

# TAB 7: SCADENZE DOGANE
with tab7:
    st.subheader("⏰ Scadenze Doganali: Tributo 2803 e 2813")
    col_acc1, col_acc2 = st.columns(2)
    with col_acc1:
        with st.form("form_accisa"):
            codice_trib_scelto = st.selectbox("Codice Tributo F24:", ["2803 - Accisa Birra (Mensile entro il 16)", "2813 - Diritto Licenza Annuale"])
            mese_rif = st.selectbox("Mese di Riferimento", ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"])
            anno_rif = st.number_input("Anno", min_value=2024, max_value=2030, value=datetime.now().year)
            d_default = datetime(anno_rif, 12, 16) if "2813" in codice_trib_scelto else datetime(anno_rif, datetime.now().month, 16)
            data_scad = st.date_input("Data Scadenza F24", value=d_default)
            importo_acc = st.number_input("Importo Dovuto (€)", min_value=0.0, step=25.0, value=250.0 if "2803" in codice_trib_scelto else 68.0)
            note_acc = st.text_input("Note", value="Versamento F24 Dogane")
            if st.form_submit_button("Salva Scadenza"):
                cod_p = "2803" if "2803" in codice_trib_scelto else "2813"
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("""
                            INSERT INTO scadenze_accise (periodo_riferimento, data_scadenza, codice_tributo, importo_dovuto, note)
                            VALUES (%s, %s, %s, %s, %s);
                        """, (f"{mese_rif} {anno_rif}", data_scad.strftime("%Y-%m-%d"), cod_p, importo_acc, note_acc))
                    conn.commit()
                st.cache_data.clear()
                st.success("Scadenza registrata!")
                st.rerun()

    with col_acc2:
        st.markdown("#### 📅 Scadenze Dogane Registrate")
        with get_db_connection() as conn:
            df_acc = pd.read_sql_query("SELECT id, periodo_riferimento, data_scadenza, codice_tributo, importo_dovuto FROM scadenze_accise ORDER BY data_scadenza ASC;", conn)
        if not df_acc.empty:
            for _, r in df_acc.iterrows():
                dt_sc = pd.to_datetime(r["data_scadenza"]).date()
                diff_gg = (dt_sc - datetime.now().date()).days
                with st.expander(f"📌 Tributo {r['codice_tributo']} - {dt_sc.strftime('%d/%m/%Y')} (€ {r['importo_dovuto']:.2f})"):
                    st.write(f"Mancano {diff_gg} giorni al versamento.")
                    titolo_g = urllib.parse.quote(f"F24 Trib. {r['codice_tributo']} BrewDesk - € {r['importo_dovuto']:.2f}")
                    gcal_url = f"https://calendar.google.com/calendar/render?action=TEMPLATE&text={titolo_g}&dates={dt_sc.strftime('%Y%m%d')}/{dt_sc.strftime('%Y%m%d')}"
                    st.link_button("🌐 Sincronizza su Google Calendar", gcal_url)

            st.write("---")
            opts_del = [f"ID {r['id']} | Trib. {r['codice_tributo']} - {r['periodo_riferimento']} (€ {r['importo_dovuto']:.2f})" for _, r in df_acc.iterrows()]
            if opts_del:
                sel_s_del = st.selectbox("Seleziona scadenza da cancellare:", opts_del)
                if st.button("🗑️ Elimina Scadenza Selezionata", type="primary"):
                    id_scad_da_eliminare = int(sel_s_del.split("|")[0].replace("ID", "").strip())
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("DELETE FROM scadenze_accise WHERE id=%s;", (id_scad_da_eliminare,))
                        conn.commit()
                    st.cache_data.clear()
                    st.success("Scadenza eliminata!")
                    st.rerun()

# TAB 8: REPORT 31/12 & BILANCIO DOGANE
with tab8:
    st.subheader("📑 Report di Chiusura Esercizio: Bilancio Dogane & Commercialista")
    anno_bilancio = st.selectbox("Seleziona Anno Fiscale di Chiusura:", [2026, 2025, 2024], index=0)

    # Estrazione Dati Bilancio Finanziario Dogane
    with get_db_connection() as conn:
        df_cotte_anno = pd.read_sql_query("""
            SELECT COUNT(id) as num_cotte, 
                   COALESCE(SUM(litri_mosto), 0) as tot_litri,
                   COALESCE(SUM(consumo_gas_mc), 0) as tot_gas,
                   COALESCE(SUM(consumo_elettrico_kwh), 0) as tot_kwh,
                   COALESCE(SUM(malto_usato_kg), 0) as malto_usato,
                   COALESCE(SUM(luppolo_usato_kg), 0) as luppolo_usato,
                   COALESCE(SUM(lievito_usato_kg), 0) as lievito_usato,
                   COALESCE(AVG(NULLIF(resa_perc, 0)), 0) as resa_media
            FROM registro_mosto
            WHERE data LIKE %s;
        """, conn, params=(f"{anno_bilancio}%",))

        df_mp_acq = pd.read_sql_query("""
            SELECT COALESCE(SUM(malto_kg), 0) as malto_acq,
                   COALESCE(SUM(luppolo_kg), 0) as luppolo_acq,
                   COALESCE(SUM(lievito_kg), 0) as lievito_acq
            FROM materie_prime
            WHERE tipo='CARICO' AND data LIKE %s;
        """, conn, params=(f"{anno_bilancio}%",))

        df_conf_anno = pd.read_sql_query("""
            SELECT formato, COALESCE(SUM(quantita), 0) as pz_confezionati
            FROM birra_condizionata
            WHERE tipo='CARICO' AND data LIKE %s
            GROUP BY formato;
        """, conn, params=(f"{anno_bilancio}%",))

    conf_map = {r["formato"]: int(r["pz_confezionati"]) for _, r in df_conf_anno.iterrows()}
    n_b33 = conf_map.get("Bottiglia 0.33L", 0)
    n_b75 = conf_map.get("Bottiglia 0.75L", 0)
    n_f12 = conf_map.get("Fusto 12L", 0)
    n_f20 = conf_map.get("Fusto 20L", 0)
    n_f24 = conf_map.get("Fusto 24L", 0)
    n_f25 = conf_map.get("Fusto 25L", 0)
    n_f30 = conf_map.get("Fusto 30L", 0)

    cotte_tot_n = int(df_cotte_anno.iloc[0]["num_cotte"])
    litri_tot_cotte = float(df_cotte_anno.iloc[0]["tot_litri"])
    tot_mc_gpl = float(df_cotte_anno.iloc[0]["tot_gas"])
    tot_kwh_ele = float(df_cotte_anno.iloc[0]["tot_kwh"])
    m_usato_tot = float(df_cotte_anno.iloc[0]["malto_usato"])
    l_usato_tot = float(df_cotte_anno.iloc[0]["luppolo_usato"])
    y_usato_tot_gr = float(df_cotte_anno.iloc[0]["lievito_usato"]) * 1000.0
    resa_media_val = float(df_cotte_anno.iloc[0]["resa_media"])

    m_acq_tot = float(df_mp_acq.iloc[0]["malto_acq"])
    l_acq_tot = float(df_mp_acq.iloc[0]["luppolo_acq"])
    y_acq_tot_gr = float(df_mp_acq.iloc[0]["lievito_acq"]) * 1000.0

    st.markdown(f"### 🏛️ 1. Prospetto Bilancio Dogane Esercizio {anno_bilancio} (Invio entro 31 Gennaio)")
    b_col1, b_col2, b_col3 = st.columns(3)
    b_col1.metric("Cotte Realizzate", f"{cotte_tot_n}")
    b_col2.metric("Litri Mosto Prodotti", f"{litri_tot_cotte:,.1f} LT")
    b_col3.metric("Resa Media Sala Cottura", f"{resa_media_val:.1f}%")

    be_1, be_2 = st.columns(2)
    be_1.metric("Consumo Gas GPL / Metano", f"{tot_mc_gpl:,.2f} Smc")
    be_2.metric("Consumo Energia Elettrica", f"{tot_kwh_ele:,.1f} kWh")

    df_bmateria = pd.DataFrame([
        {"Materia Prima": "Malto d'orzo & fermentabili", f"Acquistato nel {anno_bilancio}": f"{m_acq_tot:,.1f} kg", f"Utilizzato in Cotta ({anno_bilancio})": f"{m_usato_tot:,.1f} kg"},
        {"Materia Prima": "Luppolo", f"Acquistato nel {anno_bilancio}": f"{l_acq_tot:,.2f} kg", f"Utilizzato in Cotta ({anno_bilancio})": f"{l_usato_tot:,.2f} kg"},
        {"Materia Prima": "Lievito", f"Acquistato nel {anno_bilancio}": f"{y_acq_tot_gr:,.0f} gr", f"Utilizzato in Cotta ({anno_bilancio})": f"{y_usato_tot_gr:,.0f} gr"},
    ])
    st.table(df_bmateria)

    st.markdown(f"##### 📦 Birra Condizionata nell'anno {anno_bilancio}")
    st.write(f"• Bottiglie 0.33L: **{n_b33:,} pz** | • Bottiglie 0.75L: **{n_b75:,} pz**")
    st.write(f"• Fusti 12L: **{n_f12}** | • Fusti 20L: **{n_f20}** | • Fusti 24L: **{n_f24}** | • Fusti 25L: **{n_f25}** | • Fusti 30L: **{n_f30}**")

    pdf_dogane_bytes = genera_pdf_bilancio_dogane(
        anno=str(anno_bilancio),
        cotte_n=cotte_tot_n,
        litri_cotte=litri_tot_cotte,
        mc_gpl=tot_mc_gpl,
        kwh_ele=tot_kwh_ele,
        m_acq=m_acq_tot,
        m_usat=m_usato_tot,
        l_acq=l_acq_tot,
        l_usat=l_usato_tot,
        y_acq_g=y_acq_tot_gr,
        y_usat_g=y_usato_tot_gr,
        b33=n_b33,
        b75=n_b75,
        f12=n_f12,
        f20=n_f20,
        f24=n_f24,
        f25=n_f25,
        f30=n_f30,
        giac_m=malto,
        giac_l=luppolo,
        giac_y=lievito,
        giac_birra_lt=tot_litri_finiti,
        resa_media=resa_media_val,
        ragione_soc=RAGIONE_AZIENDA,
        piva_az=PIVA_AZIENDA,
    )

    st.download_button(
        label="📄 SCARICA BILANCIO FINANZIARIO DOGANE (PDF - Entro 31 Gennaio)",
        data=pdf_dogane_bytes,
        file_name="bilancio_finanziario.pdf",
        mime="application/pdf",
        type="primary"
    )

    st.divider()

    # Prospetto Rimanenze Commercialista
    st.markdown("### 💼 2. Prospetto Rimanenze Finali di Magazzino al 31/12 (Commercialista)")
    costo_kg_m, costo_kg_l, costo_kg_y = 1.35, 28.00, 65.00
    val_m = malto * costo_kg_m
    val_l = luppolo * costo_kg_l
    val_y = lievito * costo_kg_y
    valore_tot_mp = val_m + val_l + val_y

    with get_db_connection() as conn:
        df_imb_ant = pd.read_sql_query("""
            SELECT articolo as "Articolo", SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) as "Giacenza (pz)",
                   ROUND(MAX(costo_unitario)::numeric, 3) as "Costo Unitario (€)",
                   ROUND(SUM(CASE WHEN tipo_movimento='CARICO' THEN quantita ELSE -quantita END) * MAX(costo_unitario)::numeric, 2) as "Valore Totale (€)"
            FROM imballaggi GROUP BY articolo;
        """, conn)

        df_pf_ant = pd.read_sql_query("""
            SELECT formato as "Formato", SUM(CASE WHEN tipo='CARICO' THEN quantita ELSE -quantita END) as "Giacenza (pz)",
                   ROUND(SUM(CASE WHEN tipo='CARICO' THEN litri_totali ELSE -litri_totali END)::numeric, 1) as "Litri Totali",
                   ROUND(SUM(CASE WHEN tipo='CARICO' THEN (litri_totali * costo_produzione_litro + litri_totali * grado_plato / 100.0 * %s) ELSE -(litri_totali * costo_produzione_litro + litri_totali * grado_plato / 100.0 * %s) END)::numeric, 2) as "Valore Fiscale (€)"
            FROM birra_condizionata GROUP BY formato;
        """, conn, params=(ALIQUOTA_ACCISA_PLATO, ALIQUOTA_ACCISA_PLATO))

    val_imb_tot = float(df_imb_ant["Valore Totale (€)"].sum()) if not df_imb_ant.empty else 0.0
    val_pf_tot = float(df_pf_ant["Valore Fiscale (€)"].sum()) if not df_pf_ant.empty else 0.0
    tot_bilancio = valore_tot_mp + val_imb_tot + val_pf_tot

    st.write(f"• Valore Materie Prime: **€ {valore_tot_mp:,.2f}** | • Valore Imballaggi: **€ {val_imb_tot:,.2f}** | • Valore Birra Finita: **€ {val_pf_tot:,.2f}**")
    st.success(f"💰 **TOTALE RIMANENZE FINALI AL 31/12: € {tot_bilancio:,.2f}**")

    pdf_comm_bytes = genera_pdf_commercialista(
        valore_tot_mp, val_imb_tot, val_pf_tot, tot_bilancio,
        malto, luppolo, lievito, tot_litri_finiti, 1.10, ALIQUOTA_ACCISA_PLATO,
        RAGIONE_AZIENDA, PIVA_AZIENDA
    )

    st.download_button(
        label="📄 SCARICA PROSPETTO RIMANENZE 31/12 (PDF Commercialista)",
        data=pdf_comm_bytes,
        file_name="Prospetto_Rimanenze_31_12_Commercialista.pdf",
        mime="application/pdf"
    )
