import io
import os
import re
import hashlib
import hmac
import secrets
import base64
import json
import urllib.parse
from datetime import datetime
import psycopg2
from psycopg2 import pool, Binary
import xml.etree.ElementTree as ET
import pandas as pd
import streamlit as st
import streamlit.components.v1 as components
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
# --- 1. APPLICAZIONE SFONDO SFUMATO (Ambra, Verde Chiaro, Giallo Chiaro) ---
st.markdown("""
    <style>
    .stApp {
        background: linear-gradient(135deg, #fef3c7 0%, #ecfdf5 50%, #fef9c3 100%);
        background-attachment: fixed;
    }
    div[data-testid="stVerticalBlock"] > div[data-testid="stVerticalBlock"] {
        background-color: rgba(255, 255, 255, 0.65);
        padding: 1.2rem;
        border-radius: 1rem;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(245, 158, 11, 0.2);
    }
    </style>
""", unsafe_allow_html=True)

# --- 2. GESTIONE STATO DI ACCESSO ---
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False

# --- 3. SE NON È LOGGATO: MOSTRA LANDING PAGE + ACCESSO ---
if not st.session_state["logged_in"]:
    # Inserisci qui il codice HTML definitivo della tua landing page
    html_landing = """
    <!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-[#18120b] text-white font-sans">
        <div class="min-h-screen flex flex-col items-center justify-center text-center px-4 py-12">
            <span class="text-6xl mb-4">🍻</span>
            <h1 class="text-5xl font-black tracking-tight text-white mb-4">
                Brew<span class="text-amber-500">Desk</span>
            </h1>
            <p class="text-amber-100/70 max-w-xl text-lg mb-8">
                Il sistema operativo definitivo per il tuo birrificio artigianale.
            </p>
        </div>
    </body>
    </html>
    """
    
    components.html(html_landing, height=500, scrolling=True)
    
    col_l1, col_l2, col_l3 = st.columns([1, 2, 1])
    with col_l2:
        if st.button("🚀 Accedi o Registrati al Gestionale", use_container_width=True):
            st.session_state["mostra_form_accesso"] = True
            st.rerun()

    if st.session_state.get("mostra_form_accesso", False):
        st.divider()
        # Qui sotto continuerà poi il tuo form di login/registrazione esistente
st.markdown(
    """
    <head>
        <link rel="icon" type="image/png" href="brewdesk-icon-concept-1.png">
        <link rel="apple-touch-icon" href="brewdesk-icon-concept-1.png">
    </head>
    """,
    unsafe_allow_html=True,
)

# --- DATI FISCALI & PARAMETRI 2026 ---
PIVA_AZIENDA = "01822710628"
CF_AZIENDA = "NBLLGU54L09F636V"
RAGIONE_AZIENDA = "Birrificio Nobile"
ALIQUOTA_ACCISA_PLATO = 1.490

# --- SICUREZZA MULTI-TENANT & CREDENZIALI ---------------------------------
# Ogni azienda viene identificata dalla propria Partita IVA. Le tabelle operative
# sono protette da PostgreSQL Row Level Security (RLS): le query esistenti non
# devono quindi ricordarsi manualmente di aggiungere WHERE azienda_id=... .
# Il tenant viene impostato sulla connessione PostgreSQL in base alla sessione.

BASE_TENANT_TABLES = [
    "materie_prime",
    "imballaggi",
    "registro_mosto",
    "birra_condizionata",
    "scadenze_accise",
    "ricette",
    "tracciamento_fusti",
    "costi_fissi_utenze",
    "fatture_utenze",
    "configurazione_fermentatori",
    "telemetria_fermentatori",
]
EXTRA_TENANT_TABLES = [
    "annotazioni",
    "promemoria_scadenze",
    "pianificazione_cotte",
]
ALL_TENANT_TABLES = BASE_TENANT_TABLES + EXTRA_TENANT_TABLES

PBKDF2_ITERATIONS = 310_000


def hash_password(password: str) -> str:
    """Hash password con PBKDF2-HMAC-SHA256 e salt casuale.

    Formato: pbkdf2_sha256$iterazioni$salt_b64$digest_b64
    Non richiede dipendenze esterne ed è adatto al login applicativo.
    """
    if not password:
        raise ValueError("La password non può essere vuota.")
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii").rstrip("="),
        base64.urlsafe_b64encode(digest).decode("ascii").rstrip("="),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    """Verifica un hash PBKDF2; supporta temporaneamente anche il vecchio plaintext."""
    if not password or not stored_hash:
        return False
    if not stored_hash.startswith("pbkdf2_sha256$"):
        # Compatibilità una tantum con i vecchi account: init_db li converte.
        return hmac.compare_digest(password, stored_hash)
    try:
        _, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
        iterations = int(iterations)
        salt = base64.urlsafe_b64decode(salt_b64 + "=" * (-len(salt_b64) % 4))
        expected = base64.urlsafe_b64decode(digest_b64 + "=" * (-len(digest_b64) % 4))
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _tenant_from_session() -> str:
    return str(st.session_state.get("azienda_id") or "").strip()


def _set_connection_tenant(conn, tenant_id: str | None):
    """Imposta il tenant solo se il tenant_id è valido e presente."""
    if not tenant_id:
        return
    with conn.cursor() as c:
        c.execute("SET LOCAL app.azienda_id = %s;", (tenant_id,))
def _configure_tenant_security(cursor, tables, legacy_tenant):
    """Aggiunge azienda_id, migra i record legacy e abilita RLS sulle tabelle operative."""
    for table in tables:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS azienda_id TEXT;")
        cursor.execute(
            f"UPDATE {table} SET azienda_id=%s WHERE azienda_id IS NULL OR azienda_id='';",
            (legacy_tenant,),
        )
        cursor.execute(
            f"ALTER TABLE {table} ALTER COLUMN azienda_id SET DEFAULT current_setting('app.azienda_id', true);"
        )
        cursor.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_azienda_id ON {table}(azienda_id);")
        cursor.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        cursor.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")
        policy = f"brewdesk_tenant_{table}"
        cursor.execute(f"DROP POLICY IF EXISTS {policy} ON {table};")
        cursor.execute(
            f"""CREATE POLICY {policy} ON {table}
                USING (azienda_id = current_setting('app.azienda_id', true))
                WITH CHECK (azienda_id = current_setting('app.azienda_id', true));"""
        )


def _migrate_legacy_passwords(cursor):
    """Converte gli eventuali account storici con password in chiaro in PBKDF2."""
    cursor.execute("SELECT id, password FROM utenti;")
    for row in cursor.fetchall():
        user_id, stored = row
        if stored and not str(stored).startswith("pbkdf2_sha256$"):
            cursor.execute(
                "UPDATE utenti SET password=%s WHERE id=%s;",
                (hash_password(str(stored)), user_id),
            )

# --- GESTIONE POOL CONNESSIONI DUAL-MODE (GCP + STREAMLIT) ---
@st.cache_resource
def get_db_pool():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        try:
            db_url = st.secrets["DATABASE_URL"]
        except Exception:
            pass
    if not db_url:
        raise ValueError("DATABASE_URL non configurato! Inseriscilo nelle Variabili d'ambiente di Google Cloud Run.")
    return pool.SimpleConnectionPool(minconn=1, maxconn=20, dsn=db_url)

class DatabaseConnection:
    def __enter__(self):
        self.pool = get_db_pool()
        self.conn = self.pool.getconn()
        try:
            _set_connection_tenant(self.conn, _tenant_from_session())
        except Exception:
            self.pool.putconn(self.conn)
            raise
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is not None:
                self.conn.rollback()
            # Chiude eventuali transazioni lasciate aperte da SELECT. Le scritture
            # esistenti fanno già commit esplicito; un commit ripetuto è innocuo.
            else:
                self.conn.commit()
        finally:
            try:
                self.conn.rollback()
                with self.conn.cursor() as c:
                    c.execute("RESET app.azienda_id;")
                self.conn.commit()
            except Exception:
                try:
                    self.conn.rollback()
                except Exception:
                    pass
            self.pool.putconn(self.conn)

def get_db_connection():
    return DatabaseConnection()

# --- SETUP E MIGRAZIONE TABELLE DATABASE ---
# Eseguiamo la migrazione una sola volta per processo/sessione Streamlit.
# Questo evita di ripetere CREATE/ALTER TABLE ad ogni rerun dell'app.
@st.cache_resource
def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS utenti (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    ragione_sociale TEXT,
                    piva TEXT
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS materie_prime (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tipo TEXT,
                    data TEXT,
                    riferimento TEXT,
                    azienda TEXT,
                    malto_kg NUMERIC DEFAULT 0,
                    luppolo_kg NUMERIC DEFAULT 0,
                    lievito_kg NUMERIC DEFAULT 0,
                    costo_malto_kg NUMERIC DEFAULT 1.40,
                    costo_luppolo_kg NUMERIC DEFAULT 28.00,
                    costo_lievito_kg NUMERIC DEFAULT 65.00,
                    costo_kg_medio NUMERIC DEFAULT 1.40
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS imballaggi (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tipo_movimento TEXT,
                    data TEXT,
                    riferimento TEXT,
                    articolo TEXT,
                    quantita INTEGER DEFAULT 0,
                    costo_unitario NUMERIC DEFAULT 0.0
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS registro_mosto (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    data TEXT,
                    data_preventiva TEXT DEFAULT '',
                    cotta_num TEXT,
                    tipo_birra TEXT,
                    litri_mosto NUMERIC,
                    grado_plato NUMERIC,
                    lotto_sfuso TEXT,
                    note_lievito TEXT DEFAULT '',
                    contalitri_inizio NUMERIC DEFAULT 0,
                    contalitri_fine NUMERIC DEFAULT 0,
                    malto_usato_kg NUMERIC DEFAULT 0,
                    luppolo_usato_kg NUMERIC DEFAULT 0,
                    lievito_usato_kg NUMERIC DEFAULT 0,
                    altri_ingredienti_note TEXT DEFAULT '',
                    altri_ingredienti_json TEXT DEFAULT '[]',
                    resa_perc NUMERIC DEFAULT 0,
                    consumo_gas_mc NUMERIC DEFAULT 0,
                    consumo_elettrico_kwh NUMERIC DEFAULT 0,
                    accisa_dovuta_euro NUMERIC DEFAULT 0,
                    costo_totale_cotta NUMERIC DEFAULT 0,
                    costo_litro_mosto NUMERIC DEFAULT 0,
                    acqua_lavaggio_litri NUMERIC DEFAULT 0,
                    costo_acqua_lavaggio NUMERIC DEFAULT 0,
                    prodotti_sanificazione_json TEXT DEFAULT '[]',
                    costo_totale_sanificazione NUMERIC DEFAULT 0
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS birra_condizionata (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tipo TEXT,
                    data TEXT,
                    lotto TEXT,
                    formato TEXT,
                    quantita INTEGER,
                    litri_totali NUMERIC,
                    grado_plato NUMERIC DEFAULT 12.0,
                    ettogradi NUMERIC DEFAULT 0,
                    scarto_litri NUMERIC DEFAULT 0,
                    costo_produzione_litro NUMERIC DEFAULT 1.10,
                    documento_rif TEXT
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS scadenze_accise (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    periodo_riferimento TEXT,
                    data_scadenza DATE,
                    codice_tributo TEXT DEFAULT '2803',
                    importo_dovuto NUMERIC,
                    stato TEXT DEFAULT 'DA PAGARE',
                    note TEXT
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS ricette (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    nome_ricetta TEXT NOT NULL,
                    stile_birra TEXT NOT NULL,
                    fermentabili_kg NUMERIC DEFAULT 0,
                    luppoli_gr NUMERIC DEFAULT 0,
                    lieviti_gr NUMERIC DEFAULT 0,
                    altri_ingredienti_nome TEXT DEFAULT '',
                    altri_ingredienti_gr NUMERIC DEFAULT 0,
                    altri_ingredienti_json TEXT DEFAULT '[]',
                    plato_previsto NUMERIC DEFAULT 12.0,
                    litri_previsti NUMERIC DEFAULT 500.0,
                    note TEXT DEFAULT ''
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS tracciamento_fusti (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tipo_movimento TEXT,
                    data TEXT,
                    cliente_pub TEXT,
                    formato_fusto TEXT,
                    quantita INTEGER DEFAULT 1,
                    lotto_birra TEXT DEFAULT '-',
                    valore_cauzione_unitario NUMERIC DEFAULT 0.0,
                    ddt_riferimento TEXT DEFAULT '',
                    note TEXT DEFAULT ''
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS costi_fissi_utenze (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    data_spesa TEXT,
                    categoria TEXT,
                    descrizione TEXT,
                    quantita_consumo NUMERIC DEFAULT 0,
                    unita_misura TEXT DEFAULT '',
                    importo_totale_euro NUMERIC DEFAULT 0.0,
                    periodo_competenza TEXT DEFAULT '',
                    note TEXT DEFAULT ''
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS fatture_utenze (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    tipo_utenza TEXT NOT NULL,
                    fornitore TEXT DEFAULT '',
                    piva_fornitore TEXT DEFAULT '',
                    numero_fattura TEXT DEFAULT '',
                    data_fattura DATE,
                    data_scadenza DATE,
                    periodo_da DATE,
                    periodo_a DATE,
                    imponibile NUMERIC DEFAULT 0,
                    iva NUMERIC DEFAULT 0,
                    totale_fattura NUMERIC DEFAULT 0,
                    consumo NUMERIC DEFAULT 0,
                    unita_misura TEXT DEFAULT '',
                    pod_pdr TEXT DEFAULT '',
                    stato_pagamento TEXT DEFAULT 'DA PAGARE',
                    data_pagamento DATE,
                    note TEXT DEFAULT '',
                    file_xml BYTEA,
                    file_xml_nome TEXT DEFAULT '',
                    file_pdf BYTEA,
                    file_pdf_nome TEXT DEFAULT '',
                    hash_documento TEXT UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_fatture_utenze_data ON fatture_utenze(data_fattura);")
            c.execute("CREATE INDEX IF NOT EXISTS idx_fatture_utenze_tipo ON fatture_utenze(tipo_utenza);")
            c.execute("CREATE INDEX IF NOT EXISTS idx_fatture_utenze_scadenza ON fatture_utenze(data_scadenza);")
            c.execute("""
                CREATE TABLE IF NOT EXISTS configurazione_fermentatori (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    numero_tank INTEGER,
                    nome_tank TEXT,
                    protocollo TEXT,
                    capacita_lt NUMERIC DEFAULT 500.0,
                    setpoint_temperatura NUMERIC DEFAULT 18.0,
                    stato_attivo BOOLEAN DEFAULT TRUE
                );
            """)
            c.execute("""
                CREATE TABLE IF NOT EXISTS telemetria_fermentatori (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    timestamp TEXT,
                    tank_id TEXT,
                    lotto TEXT,
                    temperatura NUMERIC DEFAULT 0,
                    densita NUMERIC DEFAULT 0,
                    pressione NUMERIC DEFAULT 0,
                    setpoint NUMERIC DEFAULT 18.0,
                    stato TEXT DEFAULT 'Fermentazione'
                );
            """)

            # Nessun amministratore/password hardcoded nel sorgente.
            # Gli account esistenti vengono convertiti automaticamente a PBKDF2.
            _migrate_legacy_passwords(c)
            c.execute("ALTER TABLE utenti ADD COLUMN IF NOT EXISTS azienda_id TEXT;")
            c.execute(
                "UPDATE utenti SET azienda_id=COALESCE(NULLIF(piva, ''), %s) WHERE azienda_id IS NULL OR azienda_id='';",
                (PIVA_AZIENDA,),
            )
            c.execute("CREATE INDEX IF NOT EXISTS idx_utenti_azienda_id ON utenti(azienda_id);")

            # Il database storico era single-tenant: tutti i dati già presenti
            # appartengono all'azienda originaria. Da questo momento ogni nuovo
            # record prende automaticamente il tenant della sessione.
            c.execute("SELECT set_config('app.azienda_id', %s, false);", (PIVA_AZIENDA,))
            _configure_tenant_security(c, BASE_TENANT_TABLES, PIVA_AZIENDA)

            # Corregge il vecchio bug: il PrezzoUnitario delle fatture di vendita
            # non è un costo di produzione. I vecchi scarichi palesemente anomali
            # (>20 €/L) vengono riallineati al costo medio dei carichi esistenti.
            c.execute("""
                UPDATE birra_condizionata sc
                SET costo_produzione_litro = COALESCE((
                    SELECT SUM(car.litri_totali * car.costo_produzione_litro)
                           / NULLIF(SUM(car.litri_totali), 0)
                    FROM birra_condizionata car
                    WHERE car.tipo='CARICO' AND car.litri_totali > 0
                ), 1.10)
                WHERE sc.tipo='SCARICO' AND COALESCE(sc.costo_produzione_litro, 0) > 20;
            """)

            # AGGIUNTE AUTOMATICHE COLONNE MANCANTI
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS data_preventiva TEXT DEFAULT '';")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS consumo_gas_mc NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS consumo_elettrico_kwh NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS accisa_dovuta_euro NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS altri_ingredienti_note TEXT DEFAULT '';")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS altri_ingredienti_json TEXT DEFAULT '[]';")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS costo_totale_cotta NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS costo_litro_mosto NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS acqua_lavaggio_litri NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS costo_acqua_lavaggio NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS prodotti_sanificazione_json TEXT DEFAULT '[]';")
            c.execute("ALTER TABLE registro_mosto ADD COLUMN IF NOT EXISTS costo_totale_sanificazione NUMERIC DEFAULT 0;")
            
            c.execute("ALTER TABLE ricette ADD COLUMN IF NOT EXISTS altri_ingredienti_json TEXT DEFAULT '[]';")
            c.execute("ALTER TABLE materie_prime ADD COLUMN IF NOT EXISTS costo_malto_kg NUMERIC DEFAULT 1.40;")
            c.execute("ALTER TABLE materie_prime ADD COLUMN IF NOT EXISTS costo_luppolo_kg NUMERIC DEFAULT 28.00;")
            c.execute("ALTER TABLE materie_prime ADD COLUMN IF NOT EXISTS costo_lievito_kg NUMERIC DEFAULT 65.00;")
            c.execute("ALTER TABLE scadenze_accise ADD COLUMN IF NOT EXISTS codice_tributo TEXT DEFAULT '2803';")
            
            c.execute("ALTER TABLE telemetria_fermentatori ADD COLUMN IF NOT EXISTS densita NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE telemetria_fermentatori ADD COLUMN IF NOT EXISTS pressione NUMERIC DEFAULT 0;")
            c.execute("ALTER TABLE telemetria_fermentatori ADD COLUMN IF NOT EXISTS setpoint NUMERIC DEFAULT 18.0;")
            c.execute("ALTER TABLE telemetria_fermentatori ADD COLUMN IF NOT EXISTS stato TEXT DEFAULT 'Fermentazione';")

        conn.commit()

init_db()

# --- PROTEZIONE ACCESSO & REGISTRAZIONE AZIENDE ---------------------------
if "autenticato" not in st.session_state:
    st.session_state["autenticato"] = False
st.session_state.setdefault("utente_connesso", "")
st.session_state.setdefault("azienda_id", "")
st.session_state.setdefault("ragione_sociale", "")
st.session_state.setdefault("piva_azienda", "")

if not st.session_state["autenticato"]:
    col_l1, col_l2, col_l3 = st.columns([1, 2, 1])
    with col_l2:
        if os.path.exists(LOGO_FILENAME):
            st.image(LOGO_FILENAME, width=120)
        st.title("🔒 BrewDesk — Accesso Piattaforma Pro")

        try:
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    c.execute("SELECT COUNT(*) FROM utenti;")
                    utenti_presenti = int(c.fetchone()[0] or 0)
        except Exception:
            utenti_presenti = 0
         # --- PANNELLO DI ACCESSO INTEGRATO SULLA LANDING ---
    col_i1, col_i2, col_i3 = st.columns([1, 2, 1])
    with col_i2:
        st.markdown("""
            <div style="background: rgba(255, 255, 255, 0.85); padding: 1.5rem; border-radius: 1rem; border: 1px solid rgba(245, 158, 11, 0.3); backdrop-filter: blur(10px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
        """, unsafe_allow_html=True)
        
        if utenti_presenti == 0:
            st.info("👋 Nessun account trovato. Registra la prima azienda.")
            tab_scelta = ["Registrazione Admin"]
        else:
            tab_scelta = ["Accedi", "Registra Nuova Azienda"]

        scelta = st.radio("Seleziona modalità", tab_scelta, horizontal=True, label_visibility="collapsed")
        
        if scelta == "Accedi":
            with st.form("login_form_integrato"):
                username_inserito = st.text_input("Nome Utente / Username")
                pwd_inserita = st.text_input("Password di Accesso", type="password")
                btn_login = st.form_submit_button("🚀 Entrata in Cantina", use_container_width=True, type="primary")
                
                if btn_login:
                    username_norm = username_inserito.strip()
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("SELECT id, azienda_id, password FROM utenti WHERE username = %s;", (username_norm,))
                            row = c.fetchone()
                            if row and verify_password(pwd_inserita, row[2]):
                                st.session_state["autenticato"] = True
                                st.session_state["user_id"] = row[0]
                                st.session_state["azienda_id"] = row[1]
                                st.success("Accesso effettuato con successo!")
                                st.rerun()
                            else:
                                st.error("Credenziali non valide.")
        else:
            with st.form("registrazione_form_integrato"):
                nuova_azienda = st.text_input("Nome Azienda / Birrificio")
                nuovo_user = st.text_input("Username Admin")
                nuova_pwd = st.text_input("Password", type="password")
                btn_reg = st.form_submit_button("Registra Azienda e Account", use_container_width=True)
                
                if btn_reg:
                    if not nuova_azienda or not nuovo_user or not nuova_pwd:
                        st.warning("Compila tutti i campi.")
                    else:
                        pwd_hash = hash_password(nuova_pwd)
                        with get_db_connection() as conn:
                            with conn.cursor() as c:
                                c.execute("INSERT INTO aziende (ragione_sociale) VALUES (%s) RETURNING id;", (nuova_azienda.strip(),))
                                az_id = c.fetchone()[0]
                                c.execute("INSERT INTO utenti (azienda_id, username, password, ruolo) VALUES (%s, %s, %s, 'admin');", 
                                          (az_id, nuovo_user.strip(), pwd_hash))
                                conn.commit()
                                st.success("Azienda registrata! Ora puoi effettuare l'accesso.")
                                st.rerun()
                
        if utenti_presenti == 0:
            st.info("👋 Nessun account trovato. Registra la prima azienda.")
            tab_scelta = ["Registrazione Admin"]
        else:
            tab_scelta = ["Accedi", "Registra Nuova Azienda"]

        scelta = st.radio("Seleziona modalità", tab_scelta, horizontal=True, label_visibility="collapsed")
        
        if scelta == "Accedi" or scelta == "Registrazione Admin":
            with st.form("login_form_integrato"):
                username_inserito = st.text_input("Nome Utente / Username")
                pwd_inserita = st.text_input("Password di Accesso", type="password")
                btn_login = st.form_submit_button("🚀 Entrata in Cantina", use_container_width=True, type="primary")
                
                if btn_login:
                    username_norm = username_inserito.strip()
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("""
                                SELECT id, username, password, ragione_sociale, piva, azienda_id
                                FROM utenti WHERE username=%s LIMIT 1;
                            """, (username_norm,))
                            user_row = c.fetchone()
                    if user_row and verify_password(pwd_inserita, user_row[2]):
                        st.session_state["autenticato"] = True
                        st.session_state["utente_connesso"] = user_row[1]
                        st.session_state["ragione_sociale"] = user_row[3] or ""
                        st.session_state["piva_azienda"] = user_row[4] or ""
                        st.session_state["azienda_id"] = user_row[5] or user_row[4] or ""
                        st.rerun()
                    else:
                        st.error("Credenziali non valide. Verifica Nome Utente e Password.")
        else:
            with st.form("form_registrazione_azienda"):
                reg_user = st.text_input("Scegli Username *")
                reg_pwd = st.text_input("Scegli Password *", type="password")
                reg_ragione = st.text_input("Ragione Sociale Birrificio *", placeholder="es. Birrificio Artigianale...")
                reg_piva = st.text_input("Partita IVA *", placeholder="es. 01234567890")
                btn_reg = st.form_submit_button("Registra Azienda e Accedi", type="primary")
                
                if btn_reg:
                    reg_user = reg_user.strip()
                    reg_ragione = reg_ragione.strip()
                    reg_piva = re.sub(r"\s+", "", reg_piva.strip())
                    if not (reg_user and reg_pwd and reg_ragione and reg_piva):
                        st.error("Tutti i campi contrassegnati sono obbligatori.")
                    elif len(reg_pwd) < 10:
                        st.error("Per sicurezza usa una password di almeno 10 caratteri.")
                    elif len(reg_piva) not in (11, 16):
                        st.error("Inserisci una Partita IVA/codice identificativo valido.")
                    else:
                        try:
                            password_hash = hash_password(reg_pwd)
                            with get_db_connection() as conn:
                                with conn.cursor() as c:
                                    c.execute("""
                                        INSERT INTO utenti (username, password, ragione_sociale, piva, azienda_id)
                                        VALUES (%s, %s, %s, %s, %s)
                                        RETURNING id;
                                    """, (reg_user, password_hash, reg_ragione, reg_piva, reg_piva))
                                    c.fetchone()
                                conn.commit()
                            st.session_state["autenticato"] = True
                            st.session_state["utente_connesso"] = reg_user
                            st.session_state["ragione_sociale"] = reg_ragione
                            st.session_state["piva_azienda"] = reg_piva
                            st.session_state["azienda_id"] = reg_piva
                            st.success("Registrazione completata con successo! Benvenuto in BrewDesk.")
                            st.rerun()
                        except Exception as e:
                            st.error(f"Errore durante la registrazione. Username o Partita IVA potrebbero essere già presenti: {e}")
                            
        st.markdown("</div>", unsafe_allow_html=True)

st.stop()

# Dopo il login questi valori diventano dinamici per report, sidebar e documenti.
RAGIONE_AZIENDA = st.session_state.get("ragione_sociale") or RAGIONE_AZIENDA
PIVA_AZIENDA = st.session_state.get("piva_azienda") or PIVA_AZIENDA

# --- BARRA LATERALE -------------------------------------------------------
if os.path.exists(LOGO_FILENAME):
    st.sidebar.image(LOGO_FILENAME, width=150)
st.sidebar.markdown(f"### **{RAGIONE_AZIENDA}**")
st.sidebar.caption(f"P.IVA: `{PIVA_AZIENDA}`")
st.sidebar.info(f"⚖️ **Accisa configurata:** `{ALIQUOTA_ACCISA_PLATO:.3f} €/hl/°P` — verificare annualmente con consulente/ADM.")
st.sidebar.markdown(f"👤 **Operatore:** `{st.session_state['utente_connesso']}`")
st.sidebar.caption(f"🔐 Tenant: `{st.session_state.get('azienda_id', '')}`")
if st.sidebar.button("Disconnetti (Logout)"):
    for k in ("autenticato", "utente_connesso", "azienda_id", "ragione_sociale", "piva_azienda"):
        st.session_state.pop(k, None)
    st.rerun()

# --- FUNZIONI CACHED A PRESTAZIONI FULMINEE (MILLISECONDI) ---
@st.cache_data(ttl=600)
def get_cached_riepilogo(tenant_id):
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
            c.execute("SELECT COALESCE(SUM(litri_mosto), 0) FROM registro_mosto;")
            tot_mosto_lordo = c.fetchone()[0] or 0.0
            c.execute("""
                SELECT COALESCE(SUM(CASE WHEN tipo_movimento='USCITA_PUB' THEN quantita ELSE -quantita END), 0)
                FROM tracciamento_fusti;
            """)
            fusti_fuori = c.fetchone()[0] or 0
    return float(mp[0]), float(mp[1]), float(mp[2]), int(bc[0]), float(bc[1]), float(tot_mosto_lordo), int(fusti_fuori)

@st.cache_data(ttl=600)
def get_cached_ultimi_costi(tenant_id):
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

def invalidate_caches():
    """Invalidazione mirata: evita di svuotare indiscriminatamente tutta la cache Streamlit."""
    try:
        get_cached_riepilogo.clear()
    except Exception:
        pass
    try:
        get_cached_ultimi_costi.clear()
    except Exception:
        pass


def get_incidenza_costi_fissi_litro():
    """Costo fisso/utenze reale: somma il registro legacy e le fatture strutturate."""
    with get_db_connection() as conn:
        df_spese = pd.read_sql_query("""
            SELECT COALESCE(SUM(importo), 0) AS tot_spese
            FROM (
                SELECT COALESCE(importo_totale_euro, 0) AS importo FROM costi_fissi_utenze
                UNION ALL
                SELECT COALESCE(totale_fattura, 0) AS importo FROM fatture_utenze
            ) AS costi;
        """, conn)
        df_litri = pd.read_sql_query("SELECT COALESCE(SUM(litri_mosto), 0) as tot_litri FROM registro_mosto;", conn)
    tot_spese = float(df_spese.iloc[0]["tot_spese"]) if not df_spese.empty else 0.0
    tot_litri = float(df_litri.iloc[0]["tot_litri"]) if not df_litri.empty else 0.0
    return (tot_spese / tot_litri) if tot_litri > 0 else 0.35

def _xml_date_to_date(value):
    """Converte YYYY-MM-DD o datetime ISO in date; restituisce None se non valido."""
    if not value:
        return None
    value = str(value).strip()
    try:
        return datetime.fromisoformat(value.replace("Z", "")).date()
    except Exception:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except Exception:
            return None


def _xml_decimal(value):
    if value is None or value == "":
        return 0.0
    try:
        return float(str(value).replace(".", "").replace(",", ".")) if "," in str(value) else float(value)
    except Exception:
        return 0.0


def _xml_find_all_text(root, tags):
    values = []
    wanted = {t.lower() for t in tags}
    for el in root.iter():
        local = el.tag.split("}")[-1].lower() if isinstance(el.tag, str) else ""
        if local in wanted and el.text and el.text.strip():
            values.append(el.text.strip())
    return values


def parse_fattura_utenza_xml(xml_bytes):
    """
    Lettura prudente della fattura elettronica italiana.
    Non presume un singolo provider: cerca i campi standard per nome locale XML.
    Il consumo viene ricavato dalle righe descrittive solo quando è chiaramente
    riconoscibile (kWh, Smc, m3/m³). Il risultato viene sempre mostrato all'utente
    prima del salvataggio.
    """
    root = ET.fromstring(xml_bytes)

    def first(tags):
        vals = _xml_find_all_text(root, tags)
        return vals[0] if vals else ""

    fornitore = first(["Denominazione", "Nome", "Cognome"])
    piva_fornitore = first(["IdCodice"])
    numero = first(["Numero"])
    data_fattura = _xml_date_to_date(first(["Data"]))
    imponibile = _xml_decimal(first(["ImponibileImporto"]))
    iva = _xml_decimal(first(["Imposta"]))
    totale = _xml_decimal(first(["ImportoTotaleDocumento"]))

    # Le fatture possono contenere più scadenze. Prendiamo la prima data valida.
    data_scadenza = _xml_date_to_date(first(["DataScadenzaPagamento"]))

    # Periodo di competenza: spesso presente come DatiPeriodo.
    periodo_da = _xml_date_to_date(first(["DataInizioPeriodo"]))
    periodo_a = _xml_date_to_date(first(["DataFinePeriodo"]))

    descrizioni = _xml_find_all_text(root, ["Descrizione"])
    testo = " ".join(descrizioni).upper()

    tipo_utenza = "Altro Costo Fisso"
    if any(k in testo for k in ["ENERGIA ELETTRICA", "ENERGIA ELETTRICA", "KWH", "POD"]):
        tipo_utenza = "Energia Elettrica (Bolletta)"
    elif any(k in testo for k in ["GAS NATURALE", "METANO", "SMC", "PDR"]):
        tipo_utenza = "Gas Metano di Rete"
    elif any(k in testo for k in ["GPL", "GAS PROPANO"]):
        tipo_utenza = "GPL Carico Serbatoio Fisso"
    elif any(k in testo for k in ["ACQUA", "FOGNATURA", "M3", "M³"]):
        tipo_utenza = "Acqua & Fognatura"

    unita = ""
    consumo = 0.0
    if re.search(r"\bKWH\b", testo):
        unita = "kWh"
        m = re.search(r"([0-9][0-9\.,]*)\s*KWH\b", testo)
        if m:
            consumo = _xml_decimal(m.group(1))
    elif re.search(r"\bSMC\b", testo):
        unita = "Smc (Metano)"
        m = re.search(r"([0-9][0-9\.,]*)\s*SMC\b", testo)
        if m:
            consumo = _xml_decimal(m.group(1))
    elif re.search(r"(?:\bM3\b|M³)", testo):
        unita = "mc (Acqua)"
        m = re.search(r"([0-9][0-9\.,]*)\s*(?:M3|M³)\b", testo)
        if m:
            consumo = _xml_decimal(m.group(1))
    elif re.search(r"\bLITRI\b", testo):
        unita = "Litri (GPL)"
        m = re.search(r"([0-9][0-9\.,]*)\s*LITRI\b", testo)
        if m:
            consumo = _xml_decimal(m.group(1))

    pod_pdr = ""
    pod_values = _xml_find_all_text(root, ["CodiceFornitura", "Pod", "POD", "Pdr", "PDR"])
    if pod_values:
        pod_pdr = pod_values[0]
    if not pod_pdr:
        m = re.search(r"\b(?:POD|PDR)\s*[:\-]?\s*([A-Z0-9]{8,})\b", testo)
        if m:
            pod_pdr = m.group(1)

    return {
        "tipo_utenza": tipo_utenza,
        "fornitore": fornitore,
        "piva_fornitore": piva_fornitore,
        "numero_fattura": numero,
        "data_fattura": data_fattura,
        "data_scadenza": data_scadenza,
        "periodo_da": periodo_da,
        "periodo_a": periodo_a,
        "imponibile": imponibile,
        "iva": iva,
        "totale_fattura": totale,
        "consumo": consumo,
        "unita_misura": unita,
        "pod_pdr": pod_pdr,
    }


def genera_ics_scadenza_fattura(invoice_id, fornitore, numero, data_scadenza, totale, tipo_utenza):
    """Genera un evento .ics con promemoria 3 giorni prima e il giorno della scadenza."""
    if not data_scadenza:
        return b""
    dt = data_scadenza.strftime("%Y%m%d")
    uid = f"brewdesk-fattura-{invoice_id}@brewdesk"
    summary = f"Scadenza bolletta {tipo_utenza} - {fornitore or 'Fornitore'}"
    description = f"Fattura {numero or '-'} | Importo € {float(totale or 0):,.2f} | BrewDesk"
    ics = "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//BrewDesk//Utenze//IT",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART;VALUE=DATE:{dt}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        "BEGIN:VALARM",
        "TRIGGER:-P3D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Scadenza bolletta tra 3 giorni",
        "END:VALARM",
        "BEGIN:VALARM",
        "TRIGGER:PT0M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Scadenza bolletta oggi",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
        ""
    ])
    return ics.encode("utf-8")


def formatta_periodo_fattura(data_da, data_a):
    if data_da and data_a:
        return f"{data_da.strftime('%d/%m/%Y')} - {data_a.strftime('%d/%m/%Y')}"
    if data_da:
        return data_da.strftime('%d/%m/%Y')
    if data_a:
        return data_a.strftime('%d/%m/%Y')
    return ""


def get_stato_scadenza(data_scadenza, stato_pagamento):
    if stato_pagamento == "PAGATA":
        return "PAGATA"
    if not data_scadenza:
        return stato_pagamento or "DA PAGARE"
    oggi = oggi_it()
    if data_scadenza < oggi:
        return "SCADUTA"
    if (data_scadenza - oggi).days <= 3:
        return "IN SCADENZA"
    return "DA PAGARE"


def formatta_spezie_stringa(lista_ingredienti):
    if not lista_ingredienti:
        return ""
    parti = []
    for ing in lista_ingredienti:
        n = ing.get("nome", "").strip()
        g = ing.get("grammi", 0)
        if n and g > 0:
            parti.append(f"{n} ({g:g} g)")
    return ", ".join(parti)

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
                               ragione_soc, piva_az, aliquota_acc):
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
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(180, 5, f"Aliquota accisa applicata: {aliquota_acc:.3f} EUR / ettolitro / grado Plato (Microbirrifici art. 35 TUA)", ln=1)
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

# =========================================================================
# ===== NUOVI MODULI BREWDESK =============================================
# Annotazioni rapide & avvisi (Home) | Scadenze & promemoria | Pianificatore
# cotte con export .ics.
# Blocco AGGIUNTO: non modifica nessuna funzione, tabella o logica preesistente.
# Le nuove tabelle (annotazioni, promemoria_scadenze, pianificazione_cotte)
# vengono create da init_db_extra(); le tabelle esistenti sono solo lette
# (fatture_utenze, scadenze_accise, ricette, configurazione_fermentatori).
# =========================================================================
import calendar as _calendar
import html as _html
import math as _math
from datetime import date as _date, timedelta as _timedelta, timezone as _timezone
from psycopg2.extras import RealDictCursor
try:
    from zoneinfo import ZoneInfo as _ZoneInfo
except Exception:
    _ZoneInfo = None

FUSO_ORARIO_APP = "Europe/Rome"
SOGLIA_URGENTE_GG = 3      # scadenze entro 3 giorni = arancione
SOGLIA_IMMINENTE_GG = 7    # scadenze entro 7 giorni = giallo

# Allarmi .ics per eventi "tutto il giorno" (il trigger e' relativo alle 00:00 del giorno)
ALLARME_3GG_PRIMA = "-P2DT15H"    # ore 09:00 di 3 giorni prima
ALLARME_GIORNO_PRIMA = "-PT15H"   # ore 09:00 del giorno prima
ALLARME_STESSO_GIORNO = "PT8H"    # ore 08:00 del giorno stesso

CATEGORIE_NOTE = {
    "Manutenzione":       {"emoji": "🔧", "bg": "#FFE9A8", "bordo": "#D9A400"},
    "Ordinazioni":        {"emoji": "🛒", "bg": "#CFE8FF", "bordo": "#3B8FDB"},
    "Note di brassaggio": {"emoji": "🍺", "bg": "#D8F3C8", "bordo": "#5DAA3A"},
    "Cantina & Qualità":  {"emoji": "🧪", "bg": "#EAD9FF", "bordo": "#8E5BD6"},
    "Generale":           {"emoji": "📝", "bg": "#FFE0D6", "bordo": "#E07A5F"},
}
CATEGORIE_SCADENZE = [
    "Manutenzione", "Bolletta / Utenza", "Accise & Dogane", "Licenze & Certificazioni",
    "Ordinazioni & Fornitori", "Fisco & Tributi", "Altro",
]
RICORRENZE = {"Nessuna": 0, "Mensile": 1, "Trimestrale": 3, "Semestrale": 6, "Annuale": 12}
ORIGINI_SCADENZA = {
    "manuale": "✍️ Manuale",
    "bolletta": "💡 Bolletta (collegata)",
    "accise": "🏛️ Accise (collegata)",
    "nota": "📌 Nota rapida (collegata)",
}
LIVELLI_SCADENZA = {
    "SCADUTA":     ("🔴", "#D62828"),
    "OGGI":        ("🟠", "#E8590C"),
    "URGENTE":     ("🟠", "#E8590C"),
    "IMMINENTE":   ("🟡", "#B58900"),
    "PROGRAMMATA": ("🟢", "#2A9D8F"),
    "NESSUNA":     ("⚪", "#8A8A8A"),
}
STATI_PIANO = ["PIANIFICATA", "IN FERMENTAZIONE", "CONFEZIONATA", "ANNULLATA"]
STATI_PIANO_ATTIVI = ("PIANIFICATA", "IN FERMENTAZIONE")
EMOJI_STATO_PIANO = {"PIANIFICATA": "🗓️", "IN FERMENTAZIONE": "🫧", "CONFEZIONATA": "✅", "ANNULLATA": "❌"}
TIPI_CONTENITORE = ["PolyKeg", "Dolium", "Altro fusto"]
FORMATI_FUSTO_L = [10, 12, 20, 24, 25, 30]


# --- Utilita' generiche ---------------------------------------------------
def oggi_it():
    """Data odierna nel fuso italiano (Cloud Run lavora in UTC)."""
    try:
        if _ZoneInfo is not None:
            return datetime.now(_ZoneInfo(FUSO_ORARIO_APP)).date()
    except Exception:
        pass
    return datetime.now().date()


def _a_data(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, _date):
        return v
    try:
        return datetime.fromisoformat(str(v)[:10]).date()
    except Exception:
        return None


def aggiungi_mesi(d, mesi):
    m = d.month - 1 + mesi
    anno = d.year + m // 12
    mese = m % 12 + 1
    giorno = min(d.day, _calendar.monthrange(anno, mese)[1])
    return _date(anno, mese, giorno)


def testo_giorni(gg):
    if gg is None:
        return ""
    if gg < 0:
        return "scaduta da 1 giorno" if gg == -1 else f"scaduta da {-gg} giorni"
    if gg == 0:
        return "scade oggi"
    if gg == 1:
        return "scade domani"
    return f"tra {gg} giorni"


def livello_scadenza(data_scad, oggi=None):
    oggi = oggi or oggi_it()
    if data_scad is None:
        codice, gg = "NESSUNA", None
    else:
        gg = (data_scad - oggi).days
        if gg < 0:
            codice = "SCADUTA"
        elif gg == 0:
            codice = "OGGI"
        elif gg <= SOGLIA_URGENTE_GG:
            codice = "URGENTE"
        elif gg <= SOGLIA_IMMINENTE_GG:
            codice = "IMMINENTE"
        else:
            codice = "PROGRAMMATA"
    emoji, colore = LIVELLI_SCADENZA[codice]
    return {"codice": codice, "emoji": emoji, "colore": colore, "giorni": gg, "testo": testo_giorni(gg)}


def _h(txt):
    """Escape HTML per i post-it (testo utente) + newline -> <br>. Blocca anche il LaTeX di st.markdown."""
    s = _html.escape(str(txt or ""), quote=True).replace("$", "&#36;")
    return s.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "<br>")


def _md(txt):
    """Escape dei caratteri speciali markdown per testo utente mostrato in st.error/warning/info."""
    return re.sub(r"([\\`*_{}\[\]()#+!|$<>~:])", r"\\\1", str(txt or "").replace("\n", " "))


# --- Accesso al database (usa il pool esistente) ---------------------------
def db_leggi_molti(query_list):
    """Esegue piu' SELECT con una sola connessione. query_list = [(sql, params_o_None), ...]"""
    risultati = []
    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as c:
            for sql, params in query_list:
                c.execute(sql, params)
                risultati.append([dict(r) for r in c.fetchall()])
    return risultati


def db_leggi(sql, params=None):
    return db_leggi_molti([(sql, params)])[0]


def db_scrivi(operazioni):
    """Esegue piu' scritture nella stessa transazione. operazioni = [(sql, params), ...]"""
    with get_db_connection() as conn:
        with conn.cursor() as c:
            for sql, params in operazioni:
                c.execute(sql, params)
        conn.commit()


@st.cache_resource
def init_db_extra():
    with get_db_connection() as conn:
        with conn.cursor() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS annotazioni (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    categoria TEXT NOT NULL DEFAULT 'Generale',
                    titolo TEXT DEFAULT '',
                    testo TEXT DEFAULT '',
                    data_scadenza DATE,
                    completata BOOLEAN DEFAULT FALSE,
                    creato_da TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_annotazioni_scadenza ON annotazioni(data_scadenza);")
            c.execute("""
                CREATE TABLE IF NOT EXISTS promemoria_scadenze (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    titolo TEXT NOT NULL,
                    categoria TEXT DEFAULT 'Altro',
                    data_scadenza DATE NOT NULL,
                    importo NUMERIC,
                    ricorrenza TEXT DEFAULT 'Nessuna',
                    stato TEXT DEFAULT 'APERTA',
                    note TEXT DEFAULT '',
                    completata_il DATE,
                    creato_da TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_promemoria_stato_data ON promemoria_scadenze(stato, data_scadenza);")
            c.execute("""
                CREATE TABLE IF NOT EXISTS pianificazione_cotte (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    nome_birra TEXT NOT NULL,
                    stile TEXT DEFAULT '',
                    litri_stimati NUMERIC DEFAULT 0,
                    data_cotta DATE NOT NULL,
                    data_confezionamento DATE NOT NULL,
                    contenitore TEXT DEFAULT 'PolyKeg',
                    formato_litri NUMERIC DEFAULT 20,
                    calo_stimato_perc NUMERIC DEFAULT 8,
                    n_fusti INTEGER DEFAULT 0,
                    tank TEXT DEFAULT '',
                    stato TEXT DEFAULT 'PIANIFICATA',
                    note TEXT DEFAULT '',
                    creato_da TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)
            c.execute("CREATE INDEX IF NOT EXISTS idx_pianificazione_data ON pianificazione_cotte(data_cotta);")
            _configure_tenant_security(c, EXTRA_TENANT_TABLES, _tenant_from_session() or PIVA_AZIENDA)
        conn.commit()
    return True


try:
    init_db_extra()
    DB_EXTRA_OK = True
except Exception as _e_init_extra:
    DB_EXTRA_OK = False
    st.error(f"Impossibile inizializzare le tabelle dei nuovi moduli (note, scadenze, pianificatore): {_e_init_extra}")


# --- Query condivise -------------------------------------------------------
SQL_NOTE_APERTE = """
    SELECT id, categoria, titolo, testo, data_scadenza, completata, creato_da, created_at
    FROM annotazioni
    WHERE COALESCE(completata, FALSE) = FALSE
    ORDER BY (data_scadenza IS NULL), data_scadenza, id DESC
    LIMIT 300
"""
SQL_NOTE_COMPLETATE = """
    SELECT id, categoria, titolo, testo, data_scadenza, completata, creato_da, created_at
    FROM annotazioni
    WHERE COALESCE(completata, FALSE) = TRUE
    ORDER BY id DESC
    LIMIT 30
"""
SQL_PROMEMORIA_APERTI = """
    SELECT id, titolo, categoria, data_scadenza, importo, ricorrenza, stato, note
    FROM promemoria_scadenze WHERE stato = 'APERTA'
"""
SQL_PROMEMORIA_TUTTI = """
    SELECT id, titolo, categoria, data_scadenza, importo, ricorrenza, stato, note
    FROM promemoria_scadenze
"""
SQL_BOLLETTE_APERTE = """
    SELECT id, tipo_utenza, fornitore, numero_fattura, data_scadenza, totale_fattura
    FROM fatture_utenze
    WHERE data_scadenza IS NOT NULL AND COALESCE(stato_pagamento, 'DA PAGARE') <> 'PAGATA'
"""
SQL_ACCISE_APERTE = """
    SELECT id, periodo_riferimento, data_scadenza, codice_tributo, importo_dovuto, stato, note
    FROM scadenze_accise
    WHERE data_scadenza IS NOT NULL
      AND UPPER(COALESCE(stato, '')) NOT IN ('PAGATA', 'PAGATO')
"""
SQL_PIANI = "SELECT * FROM pianificazione_cotte ORDER BY data_cotta, id"


def _float_o_none(v):
    return float(v) if v is not None else None


def _costruisci_voci(prom, boll, acc, note):
    """Registro unificato delle scadenze: promemoria manuali + bollette + accise + note con scadenza."""
    voci = []
    for r in prom:
        voci.append({
            "origine": "manuale", "ref_id": r["id"], "titolo": r["titolo"] or "(senza titolo)",
            "categoria": r["categoria"] or "Altro", "data": _a_data(r["data_scadenza"]),
            "importo": _float_o_none(r["importo"]), "ricorrenza": r["ricorrenza"] or "Nessuna",
            "chiusa": (r["stato"] or "APERTA") != "APERTA", "note": r["note"] or "",
        })
    for r in boll:
        titolo = f"{r['tipo_utenza']} — {r['fornitore'] or 'fornitore n.d.'}"
        if r["numero_fattura"]:
            titolo += f" (fatt. {r['numero_fattura']})"
        voci.append({
            "origine": "bolletta", "ref_id": r["id"], "titolo": titolo,
            "categoria": "Bolletta / Utenza", "data": _a_data(r["data_scadenza"]),
            "importo": _float_o_none(r["totale_fattura"]), "ricorrenza": "Nessuna",
            "chiusa": False, "note": "",
        })
    for r in acc:
        titolo = f"Accisa {r['periodo_riferimento'] or ''}".strip()
        if r["codice_tributo"]:
            titolo += f" (cod. tributo {r['codice_tributo']})"
        voci.append({
            "origine": "accise", "ref_id": r["id"], "titolo": titolo,
            "categoria": "Accise & Dogane", "data": _a_data(r["data_scadenza"]),
            "importo": _float_o_none(r["importo_dovuto"]), "ricorrenza": "Nessuna",
            "chiusa": False, "note": r["note"] or "",
        })
    for r in note:
        if r["data_scadenza"] is None or r["completata"]:
            continue
        titolo = (r["titolo"] or "").strip() or (r["testo"] or "").strip()[:70] or "(nota)"
        voci.append({
            "origine": "nota", "ref_id": r["id"], "titolo": titolo,
            "categoria": r["categoria"] or "Generale", "data": _a_data(r["data_scadenza"]),
            "importo": None, "ricorrenza": "Nessuna", "chiusa": False, "note": r["testo"] or "",
        })
    voci = [v for v in voci if v["data"] is not None]
    aperte = sorted([v for v in voci if not v["chiusa"]], key=lambda v: (v["data"], v["titolo"]))
    chiuse = sorted([v for v in voci if v["chiusa"]], key=lambda v: v["data"], reverse=True)
    return aperte + chiuse


def _norm_piano(r):
    return {
        "id": r["id"], "nome_birra": r["nome_birra"] or "", "stile": r["stile"] or "",
        "litri": float(r["litri_stimati"] or 0), "data_cotta": _a_data(r["data_cotta"]),
        "data_conf": _a_data(r["data_confezionamento"]), "contenitore": r["contenitore"] or "PolyKeg",
        "formato": float(r["formato_litri"] or 0), "calo": float(r["calo_stimato_perc"] or 0),
        "n_fusti": int(r["n_fusti"] or 0), "tank": r["tank"] or "", "stato": r["stato"] or "PIANIFICATA",
        "note": r["note"] or "", "updated_at": r.get("updated_at"),
    }


def carica_scadenze(includi_chiuse=False):
    q_prom = SQL_PROMEMORIA_TUTTI if includi_chiuse else SQL_PROMEMORIA_APERTI
    prom, boll, acc, note = db_leggi_molti([
        (q_prom, None), (SQL_BOLLETTE_APERTE, None), (SQL_ACCISE_APERTE, None), (SQL_NOTE_APERTE, None),
    ])
    return _costruisci_voci(prom, boll, acc, note)


def carica_piani():
    return [_norm_piano(r) for r in db_leggi(SQL_PIANI)]


def carica_home_dati():
    prom, boll, acc, note, piani = db_leggi_molti([
        (SQL_PROMEMORIA_APERTI, None), (SQL_BOLLETTE_APERTE, None), (SQL_ACCISE_APERTE, None),
        (SQL_NOTE_APERTE, None), (SQL_PIANI, None),
    ])
    return {
        "note": note,
        "voci": _costruisci_voci(prom, boll, acc, note),
        "piani": [_norm_piano(r) for r in piani],
    }


# --- Azioni sulle scadenze --------------------------------------------------
def completa_voce_scadenza(voce):
    oggi = oggi_it()
    if voce["origine"] == "manuale":
        ops = [("UPDATE promemoria_scadenze SET stato='COMPLETATA', completata_il=%s WHERE id=%s",
                (oggi, voce["ref_id"]))]
        mesi = RICORRENZE.get(voce["ricorrenza"], 0)
        if mesi > 0 and voce["data"]:
            prossima = aggiungi_mesi(voce["data"], mesi)
            while prossima <= oggi:
                prossima = aggiungi_mesi(prossima, mesi)
            ops.append((
                "INSERT INTO promemoria_scadenze (titolo, categoria, data_scadenza, importo, ricorrenza, note, creato_da) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (voce["titolo"], voce["categoria"], prossima, voce["importo"], voce["ricorrenza"],
                 voce["note"], st.session_state.get("utente_connesso", "")),
            ))
        db_scrivi(ops)
    elif voce["origine"] == "bolletta":
        db_scrivi([("UPDATE fatture_utenze SET stato_pagamento='PAGATA', data_pagamento=%s WHERE id=%s",
                    (oggi, voce["ref_id"]))])
    elif voce["origine"] == "accise":
        db_scrivi([("UPDATE scadenze_accise SET stato='PAGATA' WHERE id=%s", (voce["ref_id"],))])
    elif voce["origine"] == "nota":
        db_scrivi([("UPDATE annotazioni SET completata=TRUE WHERE id=%s", (voce["ref_id"],))])


# --- Calendario .ics ----------------------------------------------------------
def _ics_testo(valore):
    t = str(valore if valore is not None else "")
    t = t.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    return t.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")


def _ics_piega(riga):
    """RFC 5545: max 75 ottetti per riga, continuazione con uno spazio; non spezza i caratteri multibyte."""
    if len(riga.encode("utf-8")) <= 75:
        return riga
    pezzi, corrente, limite = [], b"", 75
    for ch in riga:
        b = ch.encode("utf-8")
        if len(corrente) + len(b) > limite:
            pezzi.append(corrente.decode("utf-8"))
            corrente, limite = b"", 74
        corrente += b
    pezzi.append(corrente.decode("utf-8"))
    return "\r\n ".join(pezzi)


def genera_ics(eventi, nome_calendario="BrewDesk"):
    """
    eventi: lista di dict {uid, data, data_fine (opz., inclusiva), titolo, descrizione (opz.),
            promemoria (opz.: [(trigger, messaggio)]), sequence (opz.)}
    Eventi 'tutto il giorno', compatibili con Google Calendar, Apple Calendar (iOS/macOS) e Outlook.
    """
    ora = datetime.now(_timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    righe = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BrewDesk//Calendario//IT",
        "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_ics_testo(nome_calendario)}",
    ]
    for ev in eventi:
        inizio = ev["data"]
        fine = ev.get("data_fine") or inizio
        righe += [
            "BEGIN:VEVENT",
            f"UID:{ev['uid']}",
            f"DTSTAMP:{ora}",
            f"SEQUENCE:{int(ev.get('sequence', 0))}",
            f"DTSTART;VALUE=DATE:{inizio.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{(fine + _timedelta(days=1)).strftime('%Y%m%d')}",
            f"SUMMARY:{_ics_testo(ev['titolo'])}",
        ]
        if ev.get("descrizione"):
            righe.append(f"DESCRIPTION:{_ics_testo(ev['descrizione'])}")
        righe.append("TRANSP:TRANSPARENT")
        for trigger, messaggio in ev.get("promemoria", []):
            righe += ["BEGIN:VALARM", f"TRIGGER:{trigger}", "ACTION:DISPLAY",
                      f"DESCRIPTION:{_ics_testo(messaggio)}", "END:VALARM"]
        righe.append("END:VEVENT")
    righe.append("END:VCALENDAR")
    return ("\r\n".join(_ics_piega(r) for r in righe) + "\r\n").encode("utf-8")


def link_google_calendar(titolo, data_ev, descrizione=""):
    """Link 'aggiungi a Google Calendar' con un clic (evento tutto il giorno)."""
    params = {
        "action": "TEMPLATE", "text": titolo,
        "dates": f"{data_ev.strftime('%Y%m%d')}/{(data_ev + _timedelta(days=1)).strftime('%Y%m%d')}",
        "details": descrizione,
    }
    return "https://calendar.google.com/calendar/render?" + urllib.parse.urlencode(params)


def evento_da_voce(v):
    righe_desc = [f"Categoria: {v['categoria']}", f"Origine: {ORIGINI_SCADENZA[v['origine']]}"]
    if v["importo"] is not None:
        righe_desc.append(f"Importo: € {v['importo']:,.2f}")
    if v["note"]:
        righe_desc.append(v["note"])
    righe_desc.append("Promemoria creato con BrewDesk")
    return {
        "uid": f"brewdesk-scad-{v['origine']}-{v['ref_id']}@brewdesk",
        "data": v["data"], "titolo": f"⏰ {v['titolo']}",
        "descrizione": "\n".join(righe_desc),
        "promemoria": [(ALLARME_3GG_PRIMA, "Scadenza tra 3 giorni"), (ALLARME_STESSO_GIORNO, "Scadenza oggi")],
    }


def calcola_fusti(litri, calo_perc, formato_l):
    """Ritorna (fusti_pieni, resto_litri, litri_utili) dopo il calo stimato."""
    utili = max(0.0, float(litri) * (1.0 - float(calo_perc) / 100.0))
    if float(formato_l) <= 0:
        return 0, 0.0, round(utili, 1)
    n = int(_math.floor(utili / float(formato_l) + 1e-9))
    resto = max(0.0, utili - n * float(formato_l))
    return n, round(resto, 1), round(utili, 1)


def eventi_da_piano(p):
    seq = int(p["updated_at"].timestamp() // 60) if p.get("updated_at") else 0
    eventi = []
    base_desc = [f"Birra: {p['nome_birra']}"]
    if p["stile"]:
        base_desc.append(f"Stile: {p['stile']}")
    base_desc.append(f"Litri stimati: {p['litri']:g} L")
    if p["tank"]:
        base_desc.append(f"Fermentatore: {p['tank']}")
    if p["note"]:
        base_desc.append(p["note"])
    base_desc.append("Pianificato con BrewDesk")
    stile_txt = f" ({p['stile']})" if p["stile"] else ""
    if p["stato"] == "PIANIFICATA":
        eventi.append({
            "uid": f"brewdesk-cotta-{p['id']}-brassaggio@brewdesk",
            "data": p["data_cotta"], "sequence": seq,
            "titolo": f"🍺 Cotta: {p['nome_birra']}{stile_txt} – {p['litri']:g} L",
            "descrizione": "\n".join(base_desc),
            "promemoria": [(ALLARME_GIORNO_PRIMA, "Domani cotta in programma"), (ALLARME_STESSO_GIORNO, "Oggi cotta in programma")],
        })
    if p["stato"] in STATI_PIANO_ATTIVI:
        n, resto, utili = calcola_fusti(p["litri"], p["calo"], p["formato"])
        desc_conf = base_desc + [
            f"Confezionamento previsto: {p['n_fusti'] or n} × {p['contenitore']} {p['formato']:g} L",
            f"Litri confezionabili (calo {p['calo']:g}%): {utili:g} L",
        ]
        eventi.append({
            "uid": f"brewdesk-cotta-{p['id']}-confezionamento@brewdesk",
            "data": p["data_conf"], "sequence": seq,
            "titolo": f"📦 Confezionamento: {p['nome_birra']} – {p['n_fusti'] or n} × {p['contenitore']} {p['formato']:g} L",
            "descrizione": "\n".join(desc_conf),
            "promemoria": [(ALLARME_GIORNO_PRIMA, "Domani confezionamento in programma"), (ALLARME_STESSO_GIORNO, "Oggi confezionamento in programma")],
        })
    return eventi


def trova_conflitti_tank(piani, tank, d_inizio, d_fine, escludi_id=None):
    if not tank:
        return []
    return [p for p in piani
            if p["id"] != escludi_id and p["stato"] in STATI_PIANO_ATTIVI and p["tank"] == tank
            and p["data_cotta"] and p["data_conf"]
            and p["data_cotta"] <= d_fine and d_inizio <= p["data_conf"]]


# --- Post-it HTML -------------------------------------------------------------
CSS_POSTIT = """<style>
.bd-postit{border-radius:4px 4px 14px 4px;padding:12px 14px 10px 14px;margin:6px 0 4px 0;min-height:110px;color:#1d1d1f;box-shadow:2px 4px 8px rgba(0,0,0,.22);font-size:.92rem;line-height:1.35;overflow-wrap:anywhere}
.bd-postit .cat{font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.75;margin-bottom:4px}
.bd-postit .tit{font-weight:700;font-size:1rem;margin-bottom:3px}
.bd-postit .bad{display:inline-block;margin-top:8px;padding:2px 9px;border-radius:10px;font-size:.75rem;font-weight:700;color:#fff}
.bd-postit.fatto{opacity:.5}
.bd-postit.fatto .tit,.bd-postit.fatto .txt{text-decoration:line-through}
</style>"""


def html_postit(n, oggi, indice=0):
    cat = CATEGORIE_NOTE.get(n["categoria"], CATEGORIE_NOTE["Generale"])
    data_n = _a_data(n["data_scadenza"])
    completata = bool(n["completata"])
    liv = livello_scadenza(None if completata else data_n, oggi)
    bordo = liv["colore"] if liv["codice"] in ("SCADUTA", "OGGI", "URGENTE", "IMMINENTE") else cat["bordo"]
    rot = "-0.5deg" if indice % 2 == 0 else "0.5deg"
    classi = "bd-postit fatto" if completata else "bd-postit"
    parti = [
        f"<div class='{classi}' style='background:{cat['bg']};border-left:8px solid {bordo};transform:rotate({rot})'>",
        f"<div class='cat'>{cat['emoji']} {_h(n['categoria'])}</div>",
    ]
    if n["titolo"]:
        parti.append(f"<div class='tit'>{_h(n['titolo'])}</div>")
    if n["testo"]:
        parti.append(f"<div class='txt'>{_h(n['testo'])}</div>")
    if data_n and completata:
        parti.append(f"<span class='bad' style='background:#8A8A8A'>✔ completata · scadenza {data_n.strftime('%d/%m/%Y')}</span>")
    elif data_n:
        parti.append(f"<span class='bad' style='background:{liv['colore']}'>{liv['emoji']} {data_n.strftime('%d/%m/%Y')} · {liv['testo']}</span>")
    parti.append("</div>")
    return "".join(parti)


# =========================================================================
# RENDER: ANNOTAZIONI RAPIDE & AVVISI (HOME)
# =========================================================================
def render_home_annotazioni():
    if not DB_EXTRA_OK:
        st.info("Modulo annotazioni non disponibile: tabelle non inizializzate.")
        return
    oggi = oggi_it()
    utente = st.session_state.get("utente_connesso", "")
    st.markdown(CSS_POSTIT, unsafe_allow_html=True)
    st.markdown("### 📌 Annotazioni Rapide & Avvisi")

    dati = carica_home_dati()
    note, voci, piani = dati["note"], dati["voci"], dati["piani"]

    # ---- Avvisi: scadenze (bollette, accise, manutenzioni, note) e attivita' di cantina ----
    scadute, imminenti = [], []
    for v in voci:
        if v["chiusa"]:
            continue
        liv = livello_scadenza(v["data"], oggi)
        riga = f"{_md(v['titolo'])} _({v['data'].strftime('%d/%m')} · {testo_giorni(liv['giorni'])})_"
        if liv["codice"] == "SCADUTA":
            scadute.append((v["data"], riga))
        elif liv["codice"] in ("OGGI", "URGENTE", "IMMINENTE"):
            imminenti.append((v["data"], riga))
    for p in piani:
        if p["stato"] == "PIANIFICATA" and p["data_cotta"]:
            gg = (p["data_cotta"] - oggi).days
            riga = f"🍺 Cotta {_md(p['nome_birra'])} _({p['data_cotta'].strftime('%d/%m')} · {testo_giorni(gg)})_"
            if gg < 0:
                scadute.append((p["data_cotta"], riga + " — non ancora segnata come eseguita"))
            elif gg <= SOGLIA_IMMINENTE_GG:
                imminenti.append((p["data_cotta"], riga))
        if p["stato"] in STATI_PIANO_ATTIVI and p["data_conf"]:
            gg = (p["data_conf"] - oggi).days
            riga = f"📦 Confezionamento {_md(p['nome_birra'])} _({p['data_conf'].strftime('%d/%m')} · {testo_giorni(gg)})_"
            if gg < 0:
                scadute.append((p["data_conf"], riga + " — in ritardo"))
            elif gg <= SOGLIA_IMMINENTE_GG:
                imminenti.append((p["data_conf"], riga))

    def _elenco(lista, massimo=5):
        righe = [r for _, r in sorted(lista, key=lambda x: x[0])]
        testo = " · ".join(righe[:massimo])
        if len(righe) > massimo:
            testo += f" · … e altre {len(righe) - massimo}"
        return testo

    if scadute:
        st.error(f"🔴 **{len(scadute)} scadenz{'a superata' if len(scadute) == 1 else 'e superate'}:** {_elenco(scadute)}")
    if imminenti:
        st.warning(f"🟠 **{len(imminenti)} in arrivo (entro {SOGLIA_IMMINENTE_GG} giorni):** {_elenco(imminenti)}")
    if not scadute and not imminenti:
        st.success(f"✅ Nessuna scadenza superata o in arrivo nei prossimi {SOGLIA_IMMINENTE_GG} giorni.")
    st.caption("I dettagli e il registro completo sono nella scheda ⏰ Scadenze & Promemoria.")

    # ---- Nuova nota ----
    with st.expander("➕ Nuova nota rapida", expanded=False):
        with st.form("ann_form_nuova", clear_on_submit=True):
            f1, f2 = st.columns([1, 2])
            with f1:
                n_cat = st.selectbox("Categoria", list(CATEGORIE_NOTE.keys()), key="ann_cat_in")
                n_ha_scad = st.checkbox("Ha una scadenza", key="ann_has_scad_in")
                n_scad = st.date_input("Scadenza", value=oggi + _timedelta(days=7), key="ann_scad_in")
            with f2:
                n_titolo = st.text_input("Titolo (facoltativo)", max_chars=80, key="ann_tit_in")
                n_testo = st.text_area("Nota", max_chars=600, height=110, key="ann_txt_in",
                                       placeholder="es. Ordinare luppolo Citra 2 kg / Sostituire guarnizione valvola tank 3 / Dry hop dopo 5 giorni...")
            if st.form_submit_button("📌 Appendi la nota", type="primary"):
                if not (n_titolo.strip() or n_testo.strip()):
                    st.error("Scrivi almeno un titolo o un testo.")
                else:
                    db_scrivi([(
                        "INSERT INTO annotazioni (categoria, titolo, testo, data_scadenza, creato_da) VALUES (%s,%s,%s,%s,%s)",
                        (n_cat, n_titolo.strip(), n_testo.strip(), n_scad if n_ha_scad else None, utente),
                    )])
                    st.rerun()

    # ---- Filtri e bacheca ----
    fc1, fc2 = st.columns([4, 1])
    with fc1:
        filtro_cat = st.radio("Categoria", ["Tutte"] + list(CATEGORIE_NOTE.keys()), horizontal=True, key="ann_filtro_cat")
    with fc2:
        mostra_fatte = st.checkbox("Mostra completate", key="ann_mostra_fatte")

    elenco = list(note)
    if mostra_fatte:
        elenco += db_leggi(SQL_NOTE_COMPLETATE)
    if filtro_cat != "Tutte":
        elenco = [n for n in elenco if n["categoria"] == filtro_cat]

    if not elenco:
        st.info("Nessuna nota in bacheca. Aggiungine una con ➕ Nuova nota rapida.")
        return

    MAX_NOTE = 60
    if len(elenco) > MAX_NOTE:
        st.caption(f"Mostrate le prime {MAX_NOTE} note su {len(elenco)} (ordinate per scadenza).")
    colonne = st.columns(3)
    for i, n in enumerate(elenco[:MAX_NOTE]):
        with colonne[i % 3]:
            st.markdown(html_postit(n, oggi, i), unsafe_allow_html=True)
            b1, b2, _sp = st.columns([1, 1, 2])
            if n["completata"]:
                if b1.button("↩️", key=f"ann_riapri_{n['id']}", help="Riapri la nota"):
                    db_scrivi([("UPDATE annotazioni SET completata=FALSE WHERE id=%s", (n["id"],))])
                    st.rerun()
            else:
                if b1.button("✅", key=f"ann_ok_{n['id']}", help="Segna come fatta"):
                    db_scrivi([("UPDATE annotazioni SET completata=TRUE WHERE id=%s", (n["id"],))])
                    st.rerun()
            if b2.button("🗑️", key=f"ann_del_{n['id']}", help="Elimina la nota"):
                db_scrivi([("DELETE FROM annotazioni WHERE id=%s", (n["id"],))])
                st.rerun()


# =========================================================================
# RENDER: TABELLA SCADENZE & PROMEMORIA
# =========================================================================
def render_tab_scadenze():
    if not DB_EXTRA_OK:
        st.info("Modulo scadenze non disponibile: tabelle non inizializzate.")
        return
    oggi = oggi_it()
    utente = st.session_state.get("utente_connesso", "")

    st.subheader("⏰ Scadenze & Promemoria")
    st.caption(
        "Registro unico: promemoria inseriti qui (manutenzioni, licenze, fornitori…) + bollette non pagate "
        "(da 💡 Bollette & Costi Fissi) + scadenze accise + note rapide con scadenza (dalla Home)."
    )

    mostra_chiuse = st.checkbox("Mostra anche i promemoria già completati", key="scd_mostra_chiuse")
    tutte = carica_scadenze(includi_chiuse=mostra_chiuse)
    aperte = [v for v in tutte if not v["chiusa"]]

    n_scadute = sum(1 for v in aperte if livello_scadenza(v["data"], oggi)["codice"] == "SCADUTA")
    n_urgenti = sum(1 for v in aperte if livello_scadenza(v["data"], oggi)["codice"] in ("OGGI", "URGENTE"))
    n_imminenti = sum(1 for v in aperte if livello_scadenza(v["data"], oggi)["codice"] == "IMMINENTE")
    tot_importi = sum(v["importo"] for v in aperte if v["importo"])
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("🔴 Scadute", n_scadute)
    m2.metric(f"🟠 Urgenti (≤ {SOGLIA_URGENTE_GG} gg)", n_urgenti)
    m3.metric(f"🟡 In arrivo (≤ {SOGLIA_IMMINENTE_GG} gg)", n_imminenti)
    m4.metric("💶 Importi aperti", f"€ {tot_importi:,.2f}")

    # ---- Nuovo promemoria ----
    with st.expander("➕ Nuova scadenza / promemoria", expanded=not tutte):
        with st.form("scd_form_nuova", clear_on_submit=True):
            g1, g2, g3 = st.columns(3)
            with g1:
                s_titolo = st.text_input("Cosa scade? *", max_chars=120, key="scd_titolo_in",
                                         placeholder="es. Revisione caldaia / Taratura manometri / Rinnovo licenza UTF")
                s_cat = st.selectbox("Categoria", CATEGORIE_SCADENZE, key="scd_cat_in")
            with g2:
                s_data = st.date_input("Data scadenza", value=oggi + _timedelta(days=30), key="scd_data_in")
                s_ric = st.selectbox("Si ripete?", list(RICORRENZE.keys()), key="scd_ric_in",
                                     help="Quando la segni come completata, viene creata la scadenza successiva.")
            with g3:
                s_importo = st.number_input("Importo previsto (€, 0 = nessuno)", min_value=0.0, value=0.0, step=10.0, key="scd_imp_in")
                s_note = st.text_input("Note", max_chars=200, key="scd_note_in")
            if st.form_submit_button("💾 Salva scadenza", type="primary"):
                if not s_titolo.strip():
                    st.error("Indica cosa scade.")
                else:
                    db_scrivi([(
                        "INSERT INTO promemoria_scadenze (titolo, categoria, data_scadenza, importo, ricorrenza, note, creato_da) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (s_titolo.strip(), s_cat, s_data, s_importo if s_importo > 0 else None, s_ric, s_note.strip(), utente),
                    )])
                    st.rerun()

    if not tutte:
        st.info("Nessuna scadenza registrata. Le bollette non pagate e le note con scadenza compariranno qui automaticamente.")
        return

    # ---- Filtri ----
    cat_presenti = sorted({v["categoria"] for v in tutte})
    fl1, fl2 = st.columns(2)
    with fl1:
        f_cat = st.multiselect("Categorie", cat_presenti, default=cat_presenti, key="scd_f_cat")
    with fl2:
        f_orizz = st.selectbox("Orizzonte", ["Tutte", "Scadute + prossimi 7 giorni", "Scadute + prossimi 30 giorni", "Solo scadute"], key="scd_f_orizz")

    visibili = []
    for v in tutte:
        if v["categoria"] not in f_cat:
            continue
        if not v["chiusa"]:
            gg = livello_scadenza(v["data"], oggi)["giorni"]
            if f_orizz == "Scadute + prossimi 7 giorni" and gg > 7:
                continue
            if f_orizz == "Scadute + prossimi 30 giorni" and gg > 30:
                continue
            if f_orizz == "Solo scadute" and gg >= 0:
                continue
        elif f_orizz != "Tutte":
            continue
        visibili.append(v)

    if not visibili:
        st.info("Nessuna voce con i filtri selezionati.")
        return

    righe = []
    for v in visibili:
        liv = livello_scadenza(v["data"], oggi)
        righe.append({
            "Stato": "✅" if v["chiusa"] else liv["emoji"],
            "Scadenza": v["data"].strftime("%d/%m/%Y"),
            "Giorni": None if v["chiusa"] else liv["giorni"],
            "Voce": v["titolo"],
            "Categoria": v["categoria"],
            "Origine": ORIGINI_SCADENZA[v["origine"]],
            "Importo (€)": v["importo"],
            "Ricorrenza": v["ricorrenza"] if v["origine"] == "manuale" else "-",
            "Note": v["note"],
        })
    st.dataframe(pd.DataFrame(righe), use_container_width=True, hide_index=True)

    # ---- Azioni sulla voce selezionata ----
    st.markdown("#### ⚙️ Gestisci una voce")

    def _etichetta(i):
        v = visibili[i]
        icona = "✅" if v["chiusa"] else livello_scadenza(v["data"], oggi)["emoji"]
        return f"{icona} {v['data'].strftime('%d/%m/%Y')} — {v['titolo']}  [{ORIGINI_SCADENZA[v['origine']]}]"

    idx = st.selectbox("Seleziona", list(range(len(visibili))), format_func=_etichetta, key="scd_sel")
    v = visibili[idx]
    chiave = f"{v['origine']}_{v['ref_id']}"
    a1, a2, a3 = st.columns(3)
    with a1:
        if not v["chiusa"]:
            etichetta_ok = "✅ Segna come pagata" if v["origine"] in ("bolletta", "accise") else "✅ Segna come completata"
            if st.button(etichetta_ok, key=f"scd_ok_{chiave}", type="primary"):
                completa_voce_scadenza(v)
                st.rerun()
        if v["origine"] == "manuale":
            if st.button("🗑️ Elimina", key=f"scd_del_{chiave}"):
                db_scrivi([("DELETE FROM promemoria_scadenze WHERE id=%s", (v["ref_id"],))])
                st.rerun()
    with a2:
        if v["origine"] == "manuale" and not v["chiusa"]:
            nuova = st.date_input("Sposta la scadenza al", value=v["data"], key=f"scd_newdate_{chiave}")
            if st.button("📆 Aggiorna data", key=f"scd_move_{chiave}"):
                db_scrivi([("UPDATE promemoria_scadenze SET data_scadenza=%s WHERE id=%s", (nuova, v["ref_id"]))])
                st.rerun()
        elif v["origine"] == "bolletta":
            st.caption("🔗 Collegata a 💡 Bollette & Costi Fissi: segnarla pagata qui la aggiorna anche lì.")
        elif v["origine"] == "accise":
            st.caption("🔗 Collegata alla tabella scadenze accise.")
        elif v["origine"] == "nota":
            st.caption("🔗 Nota rapida della Home: completarla qui la toglie anche dalla bacheca.")
    with a3:
        st.download_button("📅 Scarica .ics di questa scadenza", data=genera_ics([evento_da_voce(v)], "BrewDesk – Scadenza"),
                           file_name=f"scadenza_{chiave}.ics", mime="text/calendar", key=f"scd_ics_{chiave}")
        st.markdown(f"[📆 Aggiungi a Google Calendar]({link_google_calendar(v['titolo'], v['data'], v['note'])})")

    st.divider()
    future = [v for v in aperte if v["data"] >= oggi]
    if future:
        st.download_button(
            f"📅 Esporta tutte le scadenze aperte da oggi (.ics) — {len(future)} eventi",
            data=genera_ics([evento_da_voce(x) for x in future], "BrewDesk – Scadenze"),
            file_name="brewdesk_scadenze.ics", mime="text/calendar", key="scd_ics_tutte",
        )
        st.caption("iPhone/iPad: tocca il file scaricato → «Aggiungi tutto». Google Calendar: calendar.google.com → Impostazioni → Importa/Esporta → Importa.")


# =========================================================================
# RENDER: PIANIFICATORE COTTE (con export .ics)
# =========================================================================
def render_tab_pianificatore():
    if not DB_EXTRA_OK:
        st.info("Modulo pianificatore non disponibile: tabelle non inizializzate.")
        return
    oggi = oggi_it()
    utente = st.session_state.get("utente_connesso", "")

    st.subheader("🗓️ Pianificatore Cotte")
    st.caption("Programma le cotte (stile, litri, data) e il confezionamento in fusti PolyKeg/Dolium; esporta tutto nel calendario del telefono.")

    piani = carica_piani()
    ricette = db_leggi("SELECT id, nome_ricetta, stile_birra, litri_previsti FROM ricette ORDER BY nome_ricetta ASC")
    tanks = db_leggi("SELECT numero_tank, nome_tank, capacita_lt FROM configurazione_fermentatori WHERE COALESCE(stato_attivo, TRUE) ORDER BY numero_tank ASC")
    cap_tank = {t["nome_tank"]: float(t["capacita_lt"] or 0) for t in tanks}

    # ---- Riepilogo ----
    attive = [p for p in piani if p["stato"] in STATI_PIANO_ATTIVI]
    prossime_cotte = sorted([p for p in piani if p["stato"] == "PIANIFICATA" and p["data_cotta"] >= oggi], key=lambda p: p["data_cotta"])
    prossime_conf = sorted([p for p in attive if p["data_conf"] >= oggi], key=lambda p: p["data_conf"])
    litri_30 = sum(p["litri"] for p in piani if p["stato"] == "PIANIFICATA" and 0 <= (p["data_cotta"] - oggi).days <= 30)
    r1, r2, r3 = st.columns(3)
    r1.metric("Litri in cotta (prossimi 30 gg)", f"{litri_30:,.0f} L")
    if prossime_cotte:
        pc = prossime_cotte[0]
        r2.metric("Prossima cotta", pc["data_cotta"].strftime("%d/%m"), delta=f"{pc['nome_birra']} · {testo_giorni((pc['data_cotta'] - oggi).days)}", delta_color="off")
    else:
        r2.metric("Prossima cotta", "—")
    if prossime_conf:
        pf = prossime_conf[0]
        r3.metric("Prossimo confezionamento", pf["data_conf"].strftime("%d/%m"), delta=f"{pf['nome_birra']} · {testo_giorni((pf['data_conf'] - oggi).days)}", delta_color="off")
    else:
        r3.metric("Prossimo confezionamento", "—")

    # ---- Nuova pianificazione ----
    with st.expander("➕ Pianifica una nuova cotta", expanded=not piani):
        ver = st.session_state.get("plan_ver", 0)
        opz_ric = ["— Nessuna (inserimento libero) —"] + [f"{r['nome_ricetta']} ({r['stile_birra']})" for r in ricette]
        sel_ric = st.selectbox("Parti da una ricetta salvata (facoltativo)", list(range(len(opz_ric))),
                               format_func=lambda i: opz_ric[i], key=f"plan_ric_{ver}")
        ric = ricette[sel_ric - 1] if sel_ric > 0 else None
        k = f"{ver}_{ric['id'] if ric else 0}"

        p1, p2, p3 = st.columns(3)
        with p1:
            nome = st.text_input("Nome birra / lotto *", value=ric["nome_ricetta"] if ric else "", key=f"plan_nome_{k}", max_chars=80)
        with p2:
            stile = st.text_input("Stile", value=ric["stile_birra"] if ric else "", key=f"plan_stile_{k}", max_chars=60)
        with p3:
            litri_def = max(10.0, float(ric["litri_previsti"] or 500.0)) if ric else 500.0
            litri = st.number_input("Litri stimati (mosto)", min_value=10.0, step=50.0, value=litri_def, key=f"plan_litri_{k}")

        q1, q2, q3 = st.columns(3)
        with q1:
            data_cotta = st.date_input("Data cotta", value=oggi + _timedelta(days=1), key=f"plan_dc_{ver}")
        with q2:
            giorni_mat = st.number_input("Giorni di maturazione stimati", min_value=1, max_value=180, value=14, step=1, key=f"plan_gg_{ver}")
        with q3:
            manuale = st.checkbox("Imposto io la data di confezionamento", key=f"plan_man_{ver}")
        data_conf_auto = data_cotta + _timedelta(days=int(giorni_mat))
        if manuale:
            data_conf = st.date_input("Data prevista confezionamento", value=data_conf_auto, key=f"plan_dcf_{ver}_{data_cotta}_{giorni_mat}")
        else:
            data_conf = data_conf_auto
            st.caption(f"📦 Confezionamento previsto: **{data_conf.strftime('%d/%m/%Y')}** (cotta + {int(giorni_mat)} giorni)")

        s1, s2, s3, s4 = st.columns(4)
        with s1:
            contenitore = st.selectbox("Contenitore", TIPI_CONTENITORE, key=f"plan_cont_{ver}")
        with s2:
            formato = st.selectbox("Formato fusto (L)", FORMATI_FUSTO_L, index=FORMATI_FUSTO_L.index(20), key=f"plan_fmt_{ver}")
        with s3:
            calo = st.number_input("Calo stimato (%)", min_value=0.0, max_value=40.0, value=8.0, step=1.0, key=f"plan_calo_{ver}",
                                   help="Stima delle perdite tra fermentatore e fusto (trub, travaso). Modificala in base alla tua esperienza.")
        with s4:
            tank = st.selectbox("Fermentatore", ["— non assegnato —"] + [t["nome_tank"] for t in tanks], key=f"plan_tank_{ver}")
        tank_val = "" if tank.startswith("—") else tank

        n_pieni, resto, utili = calcola_fusti(litri, calo, formato)
        x1, x2, x3 = st.columns(3)
        x1.metric("Litri confezionabili", f"{utili:,.1f} L")
        x2.metric(f"{contenitore} da {formato} L (pieni)", f"{n_pieni}")
        x3.metric("Resto", f"{resto:,.1f} L")

        note_piano = st.text_input("Note (luppolatura, dry hop, lotto…)", key=f"plan_note_{ver}", max_chars=200)

        data_ok = data_conf >= data_cotta
        if not data_ok:
            st.error("La data di confezionamento non può precedere la data di cotta.")
        if data_cotta < oggi:
            st.info("La data di cotta è nel passato: ok se stai registrando una cotta già fatta.")
        if tank_val and cap_tank.get(tank_val, 0) and litri > cap_tank[tank_val]:
            st.warning(f"⚠️ {litri:,.0f} L superano la capacità di «{tank_val}» ({cap_tank[tank_val]:,.0f} L).")
        if data_ok:
            for cf in trova_conflitti_tank(piani, tank_val, data_cotta, data_conf):
                st.warning(f"⚠️ «{tank_val}» risulta già occupato da {cf['nome_birra']} "
                           f"({cf['data_cotta'].strftime('%d/%m')} → {cf['data_conf'].strftime('%d/%m')}).")

        if st.button("💾 Salva pianificazione", type="primary", key=f"plan_save_{ver}", disabled=not data_ok):
            if not nome.strip():
                st.error("Inserisci il nome della birra o del lotto.")
            else:
                db_scrivi([(
                    "INSERT INTO pianificazione_cotte (nome_birra, stile, litri_stimati, data_cotta, data_confezionamento, "
                    "contenitore, formato_litri, calo_stimato_perc, n_fusti, tank, note, creato_da) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (nome.strip(), stile.strip(), litri, data_cotta, data_conf, contenitore, float(formato), calo,
                     n_pieni, tank_val, note_piano.strip(), utente),
                )])
                st.session_state["plan_ver"] = ver + 1
                st.rerun()

    if not piani:
        st.info("Nessuna cotta pianificata.")
        return

    # ---- Programma ----
    st.markdown("#### 📆 Programma")
    vista = st.radio("Mostra", ["Attive", "Tutte"], horizontal=True, key="plan_vista")
    elenco = [p for p in piani if vista == "Tutte" or p["stato"] in STATI_PIANO_ATTIVI]
    if not elenco:
        st.info("Nessuna cotta attiva. Seleziona «Tutte» per vedere anche quelle concluse o annullate.")
    else:
        righe = []
        for p in elenco:
            righe.append({
                "Stato": f"{EMOJI_STATO_PIANO.get(p['stato'], '')} {p['stato'].title()}",
                "Birra": p["nome_birra"], "Stile": p["stile"], "Litri": p["litri"],
                "Cotta": p["data_cotta"].strftime("%d/%m/%Y"),
                "Confezionamento": p["data_conf"].strftime("%d/%m/%Y"),
                "Fusti": f"{p['n_fusti']} × {p['contenitore']} {p['formato']:g} L",
                "Fermentatore": p["tank"] or "-", "Note": p["note"],
            })
        st.dataframe(pd.DataFrame(righe), use_container_width=True, hide_index=True)

        # ---- Export calendario completo ----
        eventi_tutti = [e for p in attive for e in eventi_da_piano(p)]
        if eventi_tutti:
            st.download_button(
                f"📅 Scarica calendario cotte (.ics) — {len(eventi_tutti)} eventi",
                data=genera_ics(eventi_tutti, "BrewDesk – Cotte e confezionamento"),
                file_name="brewdesk_cotte.ics", mime="text/calendar", type="primary", key="plan_ics_tutti",
            )
            st.caption(
                "iPhone/iPad: tocca il file scaricato → «Aggiungi tutto». Google Calendar: calendar.google.com → Impostazioni → "
                "Importa/Esporta → Importa (oppure usa il link «Google Calendar» sulla singola attività qui sotto). "
                "Gli eventi hanno un identificativo stabile: reimportando dopo una modifica la maggior parte dei calendari aggiorna "
                "gli eventi invece di duplicarli. Google applica le sue notifiche predefinite, iOS usa quelle incluse nel file."
            )

        # ---- Gestione singola cotta ----
        st.markdown("#### ⚙️ Gestisci una cotta")
        ids = [p["id"] for p in elenco]
        mappa = {p["id"]: p for p in elenco}
        sel_id = st.selectbox(
            "Seleziona", ids, key="plan_sel",
            format_func=lambda i: f"{EMOJI_STATO_PIANO.get(mappa[i]['stato'], '')} {mappa[i]['data_cotta'].strftime('%d/%m/%Y')} — {mappa[i]['nome_birra']} ({mappa[i]['litri']:g} L)",
        )
        p = mappa[sel_id]
        ev_p = eventi_da_piano(p)
        e1, e2 = st.columns(2)
        with e1:
            if ev_p:
                st.download_button("📅 Scarica .ics di questa cotta", data=genera_ics(ev_p, f"BrewDesk – {p['nome_birra']}"),
                                   file_name=f"cotta_{p['id']}.ics", mime="text/calendar", key=f"plan_ics_{p['id']}")
        with e2:
            for e in ev_p:
                st.markdown(f"[📆 Google Calendar: {_md(e['titolo'])}]({link_google_calendar(e['titolo'], e['data'], e['descrizione'])})")

        with st.form(f"plan_form_edit_{p['id']}"):
            h1, h2, h3 = st.columns(3)
            with h1:
                ed_stato = st.selectbox("Stato", STATI_PIANO, index=STATI_PIANO.index(p["stato"]) if p["stato"] in STATI_PIANO else 0, key=f"plan_ed_stato_{p['id']}")
                ed_litri = st.number_input("Litri stimati", min_value=10.0, step=50.0, value=max(10.0, p["litri"]), key=f"plan_ed_litri_{p['id']}")
            with h2:
                ed_cotta = st.date_input("Data cotta", value=p["data_cotta"], key=f"plan_ed_dc_{p['id']}")
                ed_conf = st.date_input("Data confezionamento", value=p["data_conf"], key=f"plan_ed_dcf_{p['id']}")
            with h3:
                ed_note = st.text_input("Note", value=p["note"], key=f"plan_ed_note_{p['id']}", max_chars=200)
            salva_mod = st.form_submit_button("💾 Salva modifiche", type="primary")
        if salva_mod:
            if ed_conf < ed_cotta:
                st.error("La data di confezionamento non può precedere la data di cotta.")
            else:
                n_new, _r, _u = calcola_fusti(ed_litri, p["calo"], p["formato"])
                db_scrivi([(
                    "UPDATE pianificazione_cotte SET stato=%s, litri_stimati=%s, data_cotta=%s, data_confezionamento=%s, "
                    "note=%s, n_fusti=%s, updated_at=CURRENT_TIMESTAMP WHERE id=%s",
                    (ed_stato, ed_litri, ed_cotta, ed_conf, ed_note.strip(), n_new, p["id"]),
                )])
                st.rerun()
        for cf in trova_conflitti_tank(piani, p["tank"], p["data_cotta"], p["data_conf"], escludi_id=p["id"]):
            st.warning(f"⚠️ «{p['tank']}» è occupato anche da {cf['nome_birra']} ({cf['data_cotta'].strftime('%d/%m')} → {cf['data_conf'].strftime('%d/%m')}).")

        conferma = st.checkbox("Confermo di voler eliminare questa pianificazione", key=f"plan_delconf_{p['id']}")
        if st.button("🗑️ Elimina pianificazione", key=f"plan_del_{p['id']}", disabled=not conferma):
            db_scrivi([("DELETE FROM pianificazione_cotte WHERE id=%s", (p["id"],))])
            st.rerun()
        st.caption("Dopo la cotta reale, registrala in ⚗️ Cotta & Sanificazione CIP (qui puoi solo cambiare lo stato in «In fermentazione» / «Confezionata»).")

# --- HEADER CRUSCOTTO PRINCIPALE ---
col_head1, col_head2 = st.columns([1.2, 8])
with col_head1:
    if os.path.exists(LOGO_FILENAME):
        st.image(LOGO_FILENAME, width=85)
with col_head2:
    st.title("BrewDesk Pro — Microbrewery Management Platform")

malto, luppolo, lievito, tot_confezioni, tot_litri_finiti, tot_mosto_lordo, tot_fusti_fuori = get_cached_riepilogo(st.session_state.get("azienda_id", ""))

# --- BLOCCO CONTALITRI & VOLUMI IN PRIMO PIANO ---
st.markdown("### 🎛️ Contalitri Produzione & Giacenze Volumi")
cv1, cv2, cv3, cv4 = st.columns(4)

calo_tot_litri = max(0.0, tot_mosto_lordo - tot_litri_finiti)
perc_resa_vol = (tot_litri_finiti / tot_mosto_lordo * 100.0) if tot_mosto_lordo > 0 else 0.0

cv1.metric("💧 Contalitri Mosto Lordo (Totale Cotte)", f"{tot_mosto_lordo:,.1f} LT")
cv2.metric("🍺 Birra Effettiva a Magazzino", f"{tot_litri_finiti:,.1f} LT")
cv3.metric("📉 Calo / Scarto Cantina Complessivo", f"{calo_tot_litri:,.1f} LT", delta=f"{perc_resa_vol:.1f}% resa vol.")
cv4.metric("🛢️ Fusti nei Pub (Vuoti da Rendere)", f"{tot_fusti_fuori} fusti", delta=f"{tot_fusti_fuori} fusti fuori" if tot_fusti_fuori > 0 else "Nessun fusto fuori")

st.markdown("##### 🌾 Giacenze Materie Prime")
c1, c2, c3 = st.columns(3)
c1.metric("Malto Residuo", f"{malto:.1f} kg")
c2.metric("Luppolo Residuo", f"{luppolo:.2f} kg")
c3.metric("Lievito Residuo", f"{lievito:.3f} kg")

st.divider()

# --- NUOVO: ANNOTAZIONI RAPIDE & AVVISI (HOME/DASHBOARD) ---
try:
    render_home_annotazioni()
except Exception as _e_home_ann:
    st.warning(f"Sezione Annotazioni non disponibile: {_e_home_ann}")

st.divider()

# --- DEFINIZIONE SCHEDE APPLICATIVE ---
tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8, tab9, tab10, tab11, tab12, tab13 = st.tabs([
    "⚗️ Cotta & Sanificazione CIP",
    "📡 Cantina IoT & Multi-Protocollo",
    "🍻 Fusti & Vuoti nei Pub",
    "💡 Bollette & Costi Fissi",
    "💰 Costo Reale & Margini",
    "📥 Carico Acquisti XML",
    "🏷️ Imballaggi",
    "📦 Confezionamento Misto",
    "🚚 Vendite (XML & Manuale)",
    "🏛️ Giacenze Magazzino",
    "📑 Report 31/12 & Dogane",
    "⏰ Scadenze & Promemoria",
    "🗓️ Pianificatore Cotte",
])

# =========================================================================
# TAB 1: SALA COTTURA, RICETTE & SANIFICAZIONE CIP INTEGRATA
# =========================================================================
with tab1:
    st.subheader("⚗️ Sala Cottura: Gestione Ricette, Inserimento Cotta, CIP Sanificazione & Allegato I")
    
    with get_db_connection() as conn:
        df_cotte_all = pd.read_sql_query("SELECT * FROM registro_mosto ORDER BY id DESC;", conn)
        df_ricette_all = pd.read_sql_query("SELECT * FROM ricette ORDER BY nome_ricetta ASC;", conn)

    c_m_default, c_l_default, c_y_default = get_cached_ultimi_costi(st.session_state.get("azienda_id", ""))

    modalita_cotta = st.radio(
        "Azione:", 
        ["➕ Registra Nuova Cotta (Manuale o da Ricetta)", "📖 Gestione Ricette (Crea/Salva Nuova Ricetta)", "✏️ Modifica Cotta Esistente", "🗑 Elimina Cotta Errata"], 
        horizontal=True
    )

    if "ingredienti_temp_ricetta" not in st.session_state:
        st.session_state["ingredienti_temp_ricetta"] = []
    if "ingredienti_temp_cotta" not in st.session_state:
        st.session_state["ingredienti_temp_cotta"] = []
    if "sanificanti_temp_cotta" not in st.session_state:
        st.session_state["sanificanti_temp_cotta"] = []

    if modalita_cotta == "📖 Gestione Ricette (Crea/Salva Nuova Ricetta)":
        st.markdown("### 📖 Crea e Salva una Nuova Ricetta nel Database")
        rc1, rc2 = st.columns(2)
        with rc1:
            r_nome = st.text_input("Nome della Ricetta / Birra *", placeholder="es. Bionda Belga Speciale", key="r_nome_in")
            r_stile = st.text_input("Stile Birra *", value="Bionda Belga", key="r_stile_in")
            r_litri = st.number_input("Litri Mosto Previsti (LT)", min_value=10.0, step=50.0, value=500.0, key="r_litri_in")
            r_plato = st.number_input("Grado Plato Previsto (°P)", min_value=1.0, step=0.1, value=12.5, key="r_plato_in")

        with rc2:
            r_malto = st.number_input("Fermentabili / Malto Totale (kg) *", min_value=0.0, step=1.0, value=26.0, key="r_malto_in")
            r_lup_g = st.number_input("Luppoli Totali (Grammi) *", min_value=0.0, step=5.0, value=170.0, key="r_lup_in")
            r_liev_g = st.number_input("Lieviti Totali (Grammi) *", min_value=0.0, step=1.0, value=60.0, key="r_liev_in")

        st.write("---")
        st.markdown("#### 🌿 Aromatizzazioni, Spezie e Altri Ingredienti Multipli")
        col_add_ing1, col_add_ing2, col_add_ing3 = st.columns([3, 2, 2])
        with col_add_ing1:
            spezia_scelta = st.selectbox(
                "Seleziona Ingrediente / Spezia:",
                ["Buccia arancia dolce", "Buccia arancia amara", "Coriandolo", "Zenzero", "Liquirizia", "Anice", "+ Aggiungi altro ingrediente personalizzato"],
                key="sel_spezia_add"
            )
            nome_custom_spezia = ""
            if spezia_scelta == "+ Aggiungi altro ingrediente personalizzato":
                nome_custom_spezia = st.text_input("Nome ingrediente personalizzato:", placeholder="es. Cardamomo...", key="custom_spz")
        with col_add_ing2:
            grammi_spezia_add = st.number_input("Quantità (Grammi)", min_value=1.0, step=5.0, value=25.0, key="gr_spz_add")
        with col_add_ing3:
            st.write("")
            st.write("")
            if st.button("➕ Aggiungi alla Lista", key="btn_add_spezia_ric"):
                nome_da_aggiungere = nome_custom_spezia.strip() if spezia_scelta == "+ Aggiungi altro ingrediente personalizzato" else spezia_scelta
                if nome_da_aggiungere:
                    st.session_state["ingredienti_temp_ricetta"].append({"nome": nome_da_aggiungere, "grammi": float(grammi_spezia_add)})
                    st.rerun()

        if st.session_state["ingredienti_temp_ricetta"]:
            for idx_ing, item in enumerate(st.session_state["ingredienti_temp_ricetta"]):
                ci1, ci2, ci3 = st.columns([4, 3, 1])
                ci1.write(f"🌿 **{item['nome']}**")
                ci2.write(f"{item['grammi']} g")
                if ci3.button("🗑️️", key=f"del_ing_ric_{idx_ing}"):
                    st.session_state["ingredienti_temp_ricetta"].pop(idx_ing)
                    st.rerun()

        r_note = st.text_area("Note Tecniche di Ammostamento / Luppolatura", key="r_note_in")

        if st.button("💾 Salva Ricetta Completa nel Database", type="primary", key="btn_salva_ricetta_def"):
            if not (r_nome and r_stile and r_malto > 0):
                st.error("Inserisci almeno Nome Ricetta, Stile e Quantità Malto.")
            else:
                json_spezie = json.dumps(st.session_state["ingredienti_temp_ricetta"])
                stringa_spezie = formatta_spezie_stringa(st.session_state["ingredienti_temp_ricetta"])
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("""
                            INSERT INTO ricette (nome_ricetta, stile_birra, fermentabili_kg, luppoli_gr, lieviti_gr, altri_ingredienti_nome, altri_ingredienti_gr, altri_ingredienti_json, plato_previsto, litri_previsti, note)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """, (r_nome, r_stile, r_malto, r_lup_g, r_liev_g, stringa_spezie, 0, json_spezie, r_plato, r_litri, r_note))
                    conn.commit()
                st.session_state["ingredienti_temp_ricetta"] = []
                invalidate_caches()
                st.success(f"Ricetta '{r_nome}' salvata con successo!")
                st.rerun()

        st.write("---")
        if not df_ricette_all.empty:
            st.dataframe(df_ricette_all[["id", "nome_ricetta", "stile_birra", "fermentabili_kg", "luppoli_gr", "lieviti_gr", "altri_ingredienti_nome", "plato_previsto", "litri_previsti"]], use_container_width=True)

    elif modalita_cotta == "🗑️ Elimina Cotta Errata":
        if not df_cotte_all.empty:
            scelte_cotte_del = [f"ID {r['id']} | Cotta {r['cotta_num']} - Lotto {r['lotto_sfuso']} ({r['tipo_birra']}) - {r['data']}" for _, r in df_cotte_all.iterrows()]
            sel_del = st.selectbox("Seleziona la cotta da eliminare:", scelte_cotte_del, key="sel_cot_del")
            id_del = int(sel_del.split("|")[0].replace("ID", "").strip())
            if st.button("Conferma ed Elimina Cotta Definitivamente", type="primary", key="btn_del_cotta_conf"):
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("DELETE FROM registro_mosto WHERE id=%s;", (id_del,))
                    conn.commit()
                invalidate_caches()
                st.success(f"Cotta ID {id_del} eliminata con successo!")
                st.rerun()

    else:
        val_data, val_data_prev = oggi_it(), oggi_it()
        val_c_num, val_lotto = "C26-01", f"LOTTO-{oggi_it().strftime('%y%m%d')}"
        val_stile = "Blonde"
        val_cl_ini, val_cl_fin = 0.0, 500.0
        val_litri = 500.0
        val_plato = 12.0
        val_malto = 100.0
        val_luppolo_g = 1000.0
        val_lievito_g = 11.5
        val_gas, val_kwh = 14.5, 45.0
        val_acqua_lavaggio = 350.0
        val_costo_mc_acqua = 2.50
        id_cotta_modifica = None

        if modalita_cotta == "✏️ Modifica Cotta Esistente" and not df_cotte_all.empty:
            scelte_cotte = [f"ID {r['id']} | Cotta {r['cotta_num']} - Lotto {r['lotto_sfuso']} ({r['tipo_birra']}) - {r['data']}" for _, r in df_cotte_all.iterrows()]
            sel_mod = st.selectbox("Seleziona cotta da modificare:", scelte_cotte, key="sel_cot_mod")
            id_cotta_modifica = int(sel_mod.split("|")[0].replace("ID", "").strip())
            r_sel = df_cotte_all[df_cotte_all["id"] == id_cotta_modifica].iloc[0]
            val_c_num = str(r_sel["cotta_num"])
            val_lotto = str(r_sel["lotto_sfuso"])
            val_stile = str(r_sel["tipo_birra"])
            val_litri = float(r_sel["litri_mosto"])
            val_plato = float(r_sel["grado_plato"])
            val_malto = float(r_sel.get("malto_usato_kg", 100.0) or 100.0)
            val_luppolo_g = float(r_sel.get("luppolo_usato_kg", 1.00) or 1.00) * 1000.0
            val_lievito_g = float(r_sel.get("lievito_usato_kg", 0.0) or 0.0) * 1000.0
            val_gas = float(r_sel.get("consumo_gas_mc", 14.5) or 14.5)
            val_kwh = float(r_sel.get("consumo_elettrico_kwh", 45.0) or 45.0)
            val_acqua_lavaggio = float(r_sel.get("acqua_lavaggio_litri", 350.0) or 350.0)

            json_str = str(r_sel.get("altri_ingredienti_json", "[]") or "[]")
            try:
                st.session_state["ingredienti_temp_cotta"] = json.loads(json_str)
            except Exception:
                st.session_state["ingredienti_temp_cotta"] = []

            json_san = str(r_sel.get("prodotti_sanificazione_json", "[]") or "[]")
            try:
                st.session_state["sanificanti_temp_cotta"] = json.loads(json_san)
            except Exception:
                st.session_state["sanificanti_temp_cotta"] = []

        elif modalita_cotta == "➕ Registra Nuova Cotta (Manuale o da Ricetta)":
            opzioni_ricette = ["-- Nessuna (Inserimento Manuale Libero) --"]
            if not df_ricette_all.empty:
                opzioni_ricette.extend([f"ID {r['id']} | {r['nome_ricetta']} ({r['stile_birra']})" for _, r in df_ricette_all.iterrows()])
            
            scelta_ricetta = st.selectbox("Carica ingredienti e dosi da una ricetta:", opzioni_ricette, key="sel_ricetta_cotta")

            if scelta_ricetta != "-- Nessuna (Inserimento Manuale Libero) --":
                id_ric_scelta = int(scelta_ricetta.split("|")[0].replace("ID", "").strip())
                r_scelta = df_ricette_all[df_ricette_all["id"] == id_ric_scelta].iloc[0]
                val_stile = str(r_scelta["stile_birra"])
                val_malto = float(r_scelta["fermentabili_kg"])
                val_luppolo_g = float(r_scelta["luppoli_gr"])
                val_lievito_g = float(r_scelta["lieviti_gr"])
                val_plato = float(r_scelta["plato_previsto"])
                val_litri = float(r_scelta["litri_previsti"])
                
                json_spezie_ric = str(r_scelta.get("altri_ingredienti_json", "[]") or "[]")
                try:
                    st.session_state["ingredienti_temp_cotta"] = json.loads(json_spezie_ric)
                except Exception:
                    st.session_state["ingredienti_temp_cotta"] = []

        col_d1, col_d2, col_d3, col_d4 = st.columns(4)
        with col_d1: data_prev_sel = st.date_input("Data Preventiva (Dogane)", value=val_data_prev, key="cot_d_prev")
        with col_d2: data_cotta_sel = st.date_input("Data Effettiva Cotta", value=val_data, key="cot_d_eff")
        with col_d3: c_num = st.text_input("N° Cotta", value=val_c_num, key="cot_num")
        with col_d4: lotto_sfuso = st.text_input("Lotto Mosto Sfuso", value=val_lotto, key="cot_lotto")

        stile = st.text_input("Stile Birra", value=val_stile, key="cot_stile")

        cl1, cl2, cl3 = st.columns(3)
        with cl1: cl_inizio = st.number_input("Lettura Iniziale Contalitri", min_value=0.0, value=val_cl_ini, key="cot_cl_i")
        with cl2: cl_fine = st.number_input("Lettura Finale Contalitri", min_value=0.0, value=val_cl_fin, key="cot_cl_f")
        with cl3:
            diff_cl = max(0.0, cl_fine - cl_inizio)
            st.metric("Volume Rilevato da Contalitri", f"{diff_cl:.1f} LT")

        litri_mosto_reali = st.number_input("Litri Mosto Reali in Fermentatore (LT)", min_value=0.0, value=val_litri if val_litri > 0 else 500.0, key="cot_lt_reali")
        plato = st.number_input("Grado Plato (°P)", min_value=0.0, step=0.1, value=val_plato, key="cot_plato")
        accisa_dovuta_calc = ((litri_mosto_reali * plato) / 100.0) * ALIQUOTA_ACCISA_PLATO

        ce1, ce2, ce3 = st.columns(3)
        with ce1: gas_mc = st.number_input("Consumo GPL / Metano (Smc)", min_value=0.0, value=val_gas, key="cot_gas")
        with ce2: kwh_consumati = st.number_input("Consumo Energia Elettrica (kWh)", min_value=0.0, value=val_kwh, key="cot_kwh")
        with ce3: st.metric(f"Accisa Dovuta (@ {ALIQUOTA_ACCISA_PLATO:.2f} €)", f"€ {accisa_dovuta_calc:.2f}")

        st.write("---")
        st.markdown("#### 🌾 Materie Prime Impiegate nella Cotta")
        col_m1, col_m2 = st.columns(2)
        with col_m1:
            m_usato = st.number_input("Fermentabili / Malto (kg)", min_value=0.0, step=0.5, value=val_malto, key="cot_malto")
            l_input_g = st.number_input("Luppoli (Grammi)", min_value=0.0, step=5.0, value=val_luppolo_g, key="cot_lup_g")
            l_usato_kg = l_input_g / 1000.0

            sg = 1 + (plato / (258.6 - ((plato / 258.2) * 227.1)))
            resa_perc = ((litri_mosto_reali * plato * sg) / 100.0) / m_usato * 100.0 if m_usato > 0 else 0.0
            st.info(f"📊 **Resa Sala Cottura:** {resa_perc:.1f}%")

        with col_m2:
            tipo_y = st.radio("Lievito:", ["Nuovo (SCARICA magazzino)", "Recuperato / Ripitching (NO scarico)"], index=0 if val_lievito_g > 0 else 1, key="cot_tipo_y")
            if "Nuovo" in tipo_y:
                y_input_g = st.number_input("Lievito (Grammi)", min_value=0.0, step=1.0, value=val_lievito_g if val_lievito_g > 0 else 11.5, key="cot_y_g")
                y_usato_kg = y_input_g / 1000.0
                nota_lievito = f"Nuovo ({y_input_g} g)"
            else:
                y_usato_kg = 0.0
                nota_lievito = "Recuperato"

        st.markdown("#### 🍊 Spezie & Aromatizzazioni (Multipli)")
        ca_c1, ca_c2, ca_c3 = st.columns([3, 2, 2])
        with ca_c1:
            spezia_cotta_sel = st.selectbox(
                "Ingrediente / Spezia da aggiungere:",
                ["Buccia arancia dolce", "Buccia arancia amara", "Coriandolo", "Zenzero", "Liquirizia", "Anice", "+ Aggiungi altro ingrediente personalizzato"],
                key="sel_spz_cotta_add"
            )
            nome_custom_cotta = ""
            if spezia_cotta_sel == "+ Aggiungi altro ingrediente personalizzato":
                nome_custom_cotta = st.text_input("Ingrediente personalizzato:", placeholder="es. Pepe, Ginepro...", key="custom_spz_cot")
        with ca_c2:
            gr_cotta_add = st.number_input("Grammi (g)", min_value=1.0, step=5.0, value=25.0, key="gr_spz_cot_add")
        with ca_c3:
            st.write("")
            st.write("")
            if st.button("➕ Aggiungi alla Cotta", key="btn_add_spz_cot"):
                nome_fin = nome_custom_cotta.strip() if spezia_cotta_sel == "+ Aggiungi altro ingrediente personalizzato" else spezia_cotta_sel
                if nome_fin:
                    st.session_state["ingredienti_temp_cotta"].append({"nome": nome_fin, "grammi": float(gr_cotta_add)})
                    st.rerun()

        if st.session_state["ingredienti_temp_cotta"]:
            for idx_c_ing, c_item in enumerate(st.session_state["ingredienti_temp_cotta"]):
                cic1, cic2, cic3 = st.columns([4, 3, 1])
                cic1.write(f"🌿 **{c_item['nome']}**")
                cic2.write(f"{c_item['grammi']} g")
                if cic3.button("🗑️", key=f"del_ing_cotta_{idx_c_ing}"):
                    st.session_state["ingredienti_temp_cotta"].pop(idx_c_ing)
                    st.rerun()

        stringa_aromi_cotta = formatta_spezie_stringa(st.session_state["ingredienti_temp_cotta"])
        json_aromi_cotta = json.dumps(st.session_state["ingredienti_temp_cotta"])

        st.write("---")
        st.markdown("#### 🧼 Sanificazione, Lavaggi CIP & Acqua di Processo")
        col_w1, col_w2, col_w3 = st.columns(3)
        with col_w1:
            acqua_lavaggio_lt = st.number_input("Acqua Lavaggio / CIP Sala Cottura (Litri)", min_value=0.0, step=50.0, value=val_acqua_lavaggio, key="cot_acqua_lav")
        with col_w2:
            costo_mc_acqua_in = st.number_input("Tariffa Acqua Acquedotto (€/mc)", min_value=0.0, step=0.20, value=val_costo_mc_acqua, key="cot_costo_acqua_mc")
        with col_w3:
            costo_acqua_tot = (acqua_lavaggio_lt / 1000.0) * costo_mc_acqua_in
            st.metric("Costo Acqua di Lavaggio", f"€ {costo_acqua_tot:.3f}")

        st.markdown("##### 🧪 Prodotti Chimici e Sanificanti (Multipli)")
        col_san1, col_san2, col_san3, col_san4, col_san5 = st.columns([2.5, 1.8, 1.8, 1.5, 1.5])
        with col_san1:
            prod_san_sel = st.selectbox(
                "Prodotto Sanificante / Lavaggio:",
                ["Acido Peracetico (15%)", "Soda Caustica Liquida (30%)", "Acido Nitrico / Fosforico (Disincrostante)", "Detergente Enzimatico", "Oxisan / Sanificante No-Rinse", "+ Aggiungi altro prodotto"],
                key="sel_prod_san_in"
            )
            nome_custom_san = ""
            if prod_san_sel == "+ Aggiungi altro prodotto":
                nome_custom_san = st.text_input("Nome Prodotto Chimico:", placeholder="es. Star San, Soda in scaglie...", key="custom_san_nome")
        with col_san2:
            costo_tanica = st.number_input("Costo Acquisto Tanica (€)", min_value=1.0, step=5.0, value=25.0, key="san_costo_tanica")
        with col_san3:
            formato_tanica_lt = st.number_input("Volume Tanica (Litri / Kg)", min_value=0.5, step=1.0, value=5.0, key="san_vol_tanica")
        with col_san4:
            dose_val = st.number_input("Dose Usata", min_value=0.1, step=1.0, value=15.0, key="san_dose_val")
        with col_san5:
            dose_um = st.selectbox("Unità Misura:", ["cl (centilitri)", "dl (decilitri)", "ml (millilitri)", "lt (litri)"], key="san_dose_um")

        fattore_a_litro = {"cl (centilitri)": 0.01, "dl (decilitri)": 0.10, "ml (millilitri)": 0.001, "lt (litri)": 1.0}[dose_um]
        litri_usati = dose_val * fattore_a_litro
        costo_al_litro_tanica = costo_tanica / formato_tanica_lt if formato_tanica_lt > 0 else 0.0
        costo_dose_euro = litri_usati * costo_al_litro_tanica

        st.caption(f"💡 Costo calcolato per questa dose ({dose_val:g} {dose_um}): **€ {costo_dose_euro:.3f}**")

        if st.button("➕ Aggiungi Prodotto Sanificante alla Cotta", key="btn_add_san_cot"):
            nome_san_finale = nome_custom_san.strip() if prod_san_sel == "+ Aggiungi altro prodotto" else prod_san_sel
            if nome_san_finale:
                st.session_state["sanificanti_temp_cotta"].append({
                    "nome": nome_san_finale,
                    "dose_usata": float(dose_val),
                    "unita_misura": dose_um.split(" ")[0],
                    "costo_tanica": float(costo_tanica),
                    "formato_tanica_lt": float(formato_tanica_lt),
                    "costo_euro": float(costo_dose_euro)
                })
                st.rerun()

        costo_totale_sanificanti = 0.0
        if st.session_state["sanificanti_temp_cotta"]:
            for idx_s, s_item in enumerate(st.session_state["sanificanti_temp_cotta"]):
                cs1, cs2, cs3, cs4 = st.columns([4, 3, 2, 1])
                cs1.write(f"🧪 **{s_item['nome']}**")
                cs2.write(f"{s_item['dose_usata']:g} {s_item['unita_misura']}")
                cs3.write(f"€ {s_item['costo_euro']:.3f}")
                costo_totale_sanificanti += s_item['costo_euro']
                if cs4.button("🗑️", key=f"del_san_item_{idx_s}"):
                    st.session_state["sanificanti_temp_cotta"].pop(idx_s)
                    st.rerun()

        costo_totale_cip = costo_acqua_tot + costo_totale_sanificanti
        st.info(f"🧼 **Incidenza Totale Lavaggi CIP & Sanificazione per la Cotta:** € {costo_totale_cip:.2f}")

        json_sanificanti_cotta = json.dumps(st.session_state["sanificanti_temp_cotta"])

        st.write("---")
        subtot_mp = (m_usato * c_m_default) + (l_usato_kg * c_l_default) + (y_usato_kg * c_y_default)
        costo_totale_industriale_cotta = subtot_mp + costo_totale_cip
        costo_lt = (costo_totale_industriale_cotta / litri_mosto_reali) if litri_mosto_reali > 0 else 0.0

        col_riep1, col_riep2, col_riep3 = st.columns(3)
        col_riep1.metric("Materie Prime", f"€ {subtot_mp:.2f}")
        col_riep2.metric("CIP & Sanificazione", f"€ {costo_totale_cip:.2f}")
        col_riep3.metric("Costo Vivo Mosto / Litro", f"€ {costo_lt:.3f} / LT", delta=f"{litri_mosto_reali:,.0f} LT")

        lbl_btn = "Aggiorna Cotta Selezionata" if modalita_cotta == "✏ Modifica Cotta Esistente" else "Salva Cotta in Allegato I & Scarica Materie Prime"

        if st.button(lbl_btn, type="primary", key="btn_salva_cotta_allegato1"):
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    if modalita_cotta == "✏️ Modifica Cotta Esistente" and id_cotta_modifica:
                        c.execute("""
                            UPDATE registro_mosto
                            SET data=%s, data_preventiva=%s, cotta_num=%s, tipo_birra=%s, litri_mosto=%s, grado_plato=%s, lotto_sfuso=%s, note_lievito=%s,
                                contalitri_inizio=%s, contalitri_fine=%s, malto_usato_kg=%s, luppolo_usato_kg=%s, lievito_usato_kg=%s,
                                altri_ingredienti_note=%s, altri_ingredienti_json=%s, resa_perc=%s, consumo_gas_mc=%s, consumo_elettrico_kwh=%s, accisa_dovuta_euro=%s,
                                costo_totale_cotta=%s, costo_litro_mosto=%s,
                                acqua_lavaggio_litri=%s, costo_acqua_lavaggio=%s, prodotti_sanificazione_json=%s, costo_totale_sanificazione=%s
                            WHERE id=%s;
                        """, (data_cotta_sel.strftime("%Y-%m-%d"), data_prev_sel.strftime("%Y-%m-%d"), c_num, stile, litri_mosto_reali, plato, lotto_sfuso, nota_lievito,
                              cl_inizio, cl_fine, m_usato, l_usato_kg, y_usato_kg, stringa_aromi_cotta, json_aromi_cotta, resa_perc, gas_mc, kwh_consumati, accisa_dovuta_calc,
                              costo_totale_industriale_cotta, costo_lt,
                              acqua_lavaggio_lt, costo_acqua_tot, json_sanificanti_cotta, costo_totale_sanificanti,
                              id_cotta_modifica))
                        st.success(f"Cotta {c_num} aggiornata!")
                    else:
                        c.execute("""
                            INSERT INTO registro_mosto (data, data_preventiva, cotta_num, tipo_birra, litri_mosto, grado_plato, lotto_sfuso, note_lievito, contalitri_inizio, contalitri_fine, malto_usato_kg, luppolo_usato_kg, lievito_usato_kg, altri_ingredienti_note, altri_ingredienti_json, resa_perc, consumo_gas_mc, consumo_elettrico_kwh, accisa_dovuta_euro, costo_totale_cotta, costo_litro_mosto, acqua_lavaggio_litri, costo_acqua_lavaggio, prodotti_sanificazione_json, costo_totale_sanificazione)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """, (data_cotta_sel.strftime("%Y-%m-%d"), data_prev_sel.strftime("%Y-%m-%d"), c_num, stile, litri_mosto_reali, plato, lotto_sfuso, nota_lievito, cl_inizio, cl_fine, m_usato, l_usato_kg, y_usato_kg, stringa_aromi_cotta, json_aromi_cotta, resa_perc, gas_mc, kwh_consumati, accisa_dovuta_calc, costo_totale_industriale_cotta, costo_lt, acqua_lavaggio_lt, costo_acqua_tot, json_sanificanti_cotta, costo_totale_sanificanti))
                        
                        c.execute("""
                            INSERT INTO materie_prime (tipo, data, riferimento, azienda, malto_kg, luppolo_kg, lievito_kg)
                            VALUES ('SCARICO', %s, %s, 'COTTA PRODUZIONE', %s, %s, %s);
                        """, (data_cotta_sel.strftime("%Y-%m-%d"), f"Cotta {c_num} - {lotto_sfuso} ({stile})", m_usato, l_usato_kg, y_usato_kg))
                        st.success(f"Cotta {c_num} registrata con successo con sanificazione integrata!")
                conn.commit()
            st.session_state["ingredienti_temp_cotta"] = []
            st.session_state["sanificanti_temp_cotta"] = []
            invalidate_caches()
            st.rerun()

    st.write("---")
    st.markdown("#### 📜 Registro Cotte Ufficiale (Allegato I) con Tracciamento CIP")
    with get_db_connection() as conn:
        st.dataframe(pd.read_sql_query("""
            SELECT id, data as "Data Cotta", cotta_num as "N° Cotta", tipo_birra as "Stile",
                   litri_mosto as "Litri", grado_plato as "°P", accisa_dovuta_euro as "Accisa (€)",
                   malto_usato_kg as "Malto (kg)", ROUND(luppolo_usato_kg * 1000, 0) as "Luppolo (g)", ROUND(lievito_usato_kg * 1000, 0) as "Lievito (g)",
                   acqua_lavaggio_litri as "Acqua CIP (LT)", costo_totale_sanificazione as "Costo Sanificanti (€)",
                   consumo_gas_mc as "Gas (mc)", consumo_elettrico_kwh as "Energia (kWh)", lotto_sfuso as "Lotto"
            FROM registro_mosto ORDER BY id DESC;
        """, conn), use_container_width=True)

# =========================================================================
# TAB 2: CANTINA IOT & MULTI-PROTOCOLLO
# =========================================================================
with tab2:
    st.subheader("📡 Cantina Pro: Setup Fermentatori & Controllo Multi-Protocollo")
    st.info("Configura i tuoi fermentatori, assegna un nome, un numero e scegli se abbinarli a protocolli standard (MQTT, Modbus RTU/TCP, OPC UA, iSpindel o Inkbird bridge).")

    sub_iot = st.radio("Sezione:", ["⚙ Configurazione & Aggiunta Fermentatori", "🎛️ Monitoraggio & Controllo Remoto Setpoint", "🧪 Test / Simulatore Telemetria"], horizontal=True)

    with get_db_connection() as conn:
        df_conf_fermentatori = pd.read_sql_query("SELECT * FROM configurazione_fermentatori ORDER BY numero_tank ASC;", conn)

    if sub_iot == "⚙️ Configurazione & Aggiunta Fermentatori":
        st.markdown("#### ⚙️ Gestione e Abbinamento Fermentatori Cantina")
        with st.form("form_aggiungi_tank"):
            col_cf1, col_cf2 = st.columns(2)
            with col_cf1:
                num_t = st.number_input("Numero Progressivo Tank", min_value=1, step=1, value=len(df_conf_fermentatori) + 1)
                nome_t = st.text_input("Nome Personalizzato Tank", placeholder="es. Tank 01 - Bionda")
                cap_t = st.number_input("Capacità Serbatoio (Litri)", min_value=50.0, step=50.0, value=1000.0)
            with col_cf2:
                proto_t = st.selectbox("Protocollo / Dispositivo Abbinato:", [
                    "MQTT (Broker Locale / Node-RED)",
                    "iSpindel (WiFi / HTTP Webhook)",
                    "Modbus TCP / RTU (PLC Industriale)",
                    "OPC UA (Standard Industria 4.0)",
                    "Inkbird (Cloud / API Bridge)"
                ])
                set_t = st.number_input("Setpoint Temperatura Iniziale (°C)", min_value=-2.0, max_value=30.0, step=0.5, value=18.0)

            if st.form_submit_button("➕ Salva / Aggiungi Fermentatore", type="primary"):
                if not nome_t:
                    st.error("Inserisci un nome per il fermentatore!")
                else:
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("""
                                INSERT INTO configurazione_fermentatori (numero_tank, nome_tank, protocollo, capacita_lt, setpoint_temperatura, stato_attivo)
                                VALUES (%s, %s, %s, %s, %s, TRUE);
                            """, (num_t, nome_t, proto_t, cap_t, set_t))
                        conn.commit()
                    invalidate_caches()
                    st.success(f"Fermentatore '{nome_t}' aggiunto con successo!")
                    st.rerun()

        st.write("---")
        st.markdown("#### 📋 Elenco Fermentatori Configurati")
        if not df_conf_fermentatori.empty:
            st.dataframe(df_conf_fermentatori[["numero_tank", "nome_tank", "protocollo", "capacita_lt", "setpoint_temperatura", "stato_attivo"]], use_container_width=True)
            
            tank_da_del = st.selectbox("Seleziona tank da rimuovere:", [f"Tank #{r['numero_tank']} - {r['nome_tank']}" for _, r in df_conf_fermentatori.iterrows()])
            if st.button("🗑️ Rimuovi Tank Selezionato", type="primary"):
                num_estratto = int(tank_da_del.split(" - ")[0].replace("Tank #", "").strip())
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("DELETE FROM configurazione_fermentatori WHERE numero_tank=%s;", (num_estratto,))
                    conn.commit()
                invalidate_caches()
                st.success("Tank rimosso!")
                st.rerun()
        else:
            st.info("Nessun fermentatore configurato.")

    elif sub_iot == "🎛️ Monitoraggio & Controllo Remoto Setpoint":
        st.markdown("#### 🎛 Dashboard Live & Controllo Remoto Setpoint")
        with get_db_connection() as conn:
            df_live = pd.read_sql_query("""
                SELECT DISTINCT ON (tank_id) 
                       tank_id as "Tank",
                       timestamp as "Ultimo Aggiornamento",
                       lotto as "Lotto",
                       temperatura as "Temp (°C)",
                       setpoint as "Setpoint (°C)",
                       densita as "Densità (°P)",
                       pressione as "Pressione (bar)",
                       stato as "Stato"
                FROM telemetria_fermentatori
                ORDER BY tank_id, id DESC;
            """, conn)

        if not df_live.empty:
            st.dataframe(df_live, use_container_width=True)
        else:
            st.info("Nessun dato di telemetria ricevuto.")

        st.write("---")
        st.markdown("#### ⚙️ Imposta Setpoint Temperatura da Remoto")
        with st.form("form_setpoint_remoto"):
            if not df_conf_fermentatori.empty:
                lista_tanks = [f"{r['nome_tank']} (Protocollo: {r['protocollo']})" for _, r in df_conf_fermentatori.iterrows()]
                tank_scelto = st.selectbox("Seleziona Fermentatore:", lista_tanks)
                nuovo_setpoint = st.number_input("Nuovo Setpoint Temperatura (°C):", min_value=-2.0, max_value=30.0, step=0.5, value=12.0)
                
                if st.form_submit_button("🚀 Invia Comando Setpoint al Fermentatore", type="primary"):
                    nome_t_pulito = tank_scelto.split(" (Protocollo:")[0].strip()
                    ts_ora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("""
                                UPDATE configurazione_fermentatori SET setpoint_temperatura=%s WHERE nome_tank=%s;
                            """, (nuovo_setpoint, nome_t_pulito))
                            
                            c.execute("""
                                INSERT INTO telemetria_fermentatori (timestamp, tank_id, lotto, temperatura, setpoint, stato)
                                VALUES (%s, %s, 'AGGIORNAMENTO_SETPOINT', 0, %s, 'Setpoint Aggiornato');
                            """, (ts_ora, nome_t_pulito, nuovo_setpoint))
                        conn.commit()
                    st.success(f"Comando inviato! Setpoint impostato a {nuovo_setpoint}°C per {nome_t_pulito}.")
                    st.rerun()
            else:
                st.warning("Configura prima almeno un fermentatore.")

    else:
        st.markdown("#### 🧪 Simulatore Telemetria per Test Protocolli")
        with st.form("form_sim_proto"):
            tank_sim = st.text_input("ID o Nome Tank:", value="Tank 01 - Bionda")
            proto_sim = st.selectbox("Simula Protocollo:", ["MQTT", "iSpindel", "Modbus", "OPC UA", "Inkbird"])
            lotto_sim = st.text_input("Lotto:", value="LOTTO-2601")
            temp_sim = st.number_input("Temperatura (°C):", value=14.2, step=0.1)
            dens_sim = st.number_input("Densità (°P):", value=6.5, step=0.1)
            press_sim = st.number_input("Pressione (bar):", value=1.2, step=0.1)

            if st.form_submit_button("Simula Arrivo Pacchetto Dati", type="primary"):
                ts_ora = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("""
                            INSERT INTO telemetria_fermentatori (timestamp, tank_id, lotto, temperatura, densita, pressione, stato)
                            VALUES (%s, %s, %s, %s, %s, %s, %s);
                        """, (ts_ora, f"{tank_sim} [{proto_sim}]", lotto_sim, temp_sim, dens_sim, press_sim, "In fermentazione"))
                    conn.commit()
                st.success("Pacchetto telemetria simulato e registrato con successo!")
                st.rerun()

        st.write("---")
        st.markdown("#### 🗑️ Pulizia Dati di Test")
        if st.button("Elimina Tutti i Dati di Telemetria Fittizi", type="primary"):
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    c.execute("DELETE FROM telemetria_fermentatori;")
                conn.commit()
            invalidate_caches()
            st.success("Tabella telemetria ripulita con successo!")
            st.rerun()

# =========================================================================
# TAB 3: GESTIONE FUSTI NEI PUB & CAUZIONI
# =========================================================================
with tab3:
    st.subheader("🍻 Tracciamento Fusti & Gestione Cauzioni nei Pub")
    col_tf1, col_tf2 = st.columns(2)
    with col_tf1:
        st.markdown("#### 🚚 Registra Consegna Fusti a un Pub")
        with st.form("form_consegna_fusti"):
            tf_data = st.date_input("Data Consegna", value=datetime.now(_ZoneInfo(FUSO_ORARIO_APP)) if _ZoneInfo else datetime.now())
            tf_pub = st.text_input("Nome Pub / Locale *", placeholder="es. Birroteca Centrale...")
            tf_formato = st.selectbox("Formato Fusto:", ["Fusto 20L", "Fusto 24L", "Fusto 25L", "Fusto 30L", "Fusto 12L"])
            tf_qta = st.number_input("Quantità Consegnata (pz)", min_value=1, step=1, value=2)
            tf_lotto = st.text_input("Lotto Birra", value="L-")
            tf_cauz = st.number_input("Cauzione per Fusto (€/pz)", min_value=0.0, step=5.0, value=30.0)
            tf_ddt = st.text_input("N° DDT / Bolla", placeholder="es. DDT 12/2026")
            
            if st.form_submit_button("Registra Consegna al Pub", type="primary"):
                if not tf_pub:
                    st.error("Inserisci il nome del Pub o Locale!")
                else:
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("""
                                INSERT INTO tracciamento_fusti (tipo_movimento, data, cliente_pub, formato_fusto, quantita, lotto_birra, valore_cauzione_unitario, ddt_riferimento)
                                VALUES ('USCITA_PUB', %s, %s, %s, %s, %s, %s, %s);
                            """, (tf_data.strftime("%Y-%m-%d"), tf_pub.strip(), tf_formato, tf_qta, tf_lotto, tf_cauz, tf_ddt))
                        conn.commit()
                    invalidate_caches()
                    st.success(f"Consegna registrata!")
                    st.rerun()

    with col_tf2:
        st.markdown("#### 🔄 Registra Rientro Fusti Vuoti dal Pub")
        with get_db_connection() as conn:
            df_pub_attivi = pd.read_sql_query("""
                SELECT cliente_pub, 
                       SUM(CASE WHEN tipo_movimento='USCITA_PUB' THEN quantita ELSE -quantita END) as fusti_ancora_fuori
                FROM tracciamento_fusti 
                GROUP BY cliente_pub 
                HAVING SUM(CASE WHEN tipo_movimento='USCITA_PUB' THEN quantita ELSE -quantita END) > 0
                ORDER BY cliente_pub ASC;
            """, conn)

        if not df_pub_attivi.empty:
            with st.form("form_rientro_fusti"):
                lista_pub = [f"{r['cliente_pub']} ({r['fusti_ancora_fuori']} fusti fuori)" for _, r in df_pub_attivi.iterrows()]
                pub_selezionato = st.selectbox("Seleziona Pub che rende i fusti vuoti:", lista_pub)
                pub_nome_pulito = pub_selezionato.split(" (")[0].strip()
                
                rf_data = st.date_input("Data Rientro Fusti", value=datetime.now(_ZoneInfo(FUSO_ORARIO_APP)) if _ZoneInfo else datetime.now())
                rf_formato = st.selectbox("Formato Fusto Restituito:", ["Fusto 20L", "Fusto 24L", "Fusto 25L", "Fusto 30L", "Fusto 12L"])
                rf_qta = st.number_input("Numero Fusti Vuoti Restituiti (pz)", min_value=1, step=1, value=1)
                rf_note = st.text_input("Note / Ritiro", placeholder="es. Ritiro furgone")

                if st.form_submit_button("Scarica Fusti & Segna Rientro a Magazzino", type="primary"):
                    with get_db_connection() as conn:
                        with conn.cursor() as c:
                            c.execute("""
                                INSERT INTO tracciamento_fusti (tipo_movimento, data, cliente_pub, formato_fusto, quantita, note)
                                VALUES ('RIENTRO_VUOTO', %s, %s, %s, %s, %s);
                            """, (rf_data.strftime("%Y-%m-%d"), pub_nome_pulito, rf_formato, rf_qta, rf_note))
                            
                            art_imb_mappato = f"Fusti vuoti {rf_formato.replace('Fusto ', '')}"
                            c.execute("""
                                INSERT INTO imballaggi (tipo_movimento, data, riferimento, articolo, quantita, costo_unitario)
                                VALUES ('CARICO', %s, %s, %s, %s, 0.0);
                            """, (rf_data.strftime("%Y-%m-%d"), f"Reso da {pub_nome_pulito}", art_imb_mappato, rf_qta))
                        conn.commit()
                    invalidate_caches()
                    st.success(f"Rientro registrato! {rf_qta} fusti scaricati dal locale.")
                    st.rerun()
        else:
            st.info("Tutti i fusti sono rientrati nei magazzini!")

    st.write("---")
    st.markdown("### 📊 Bilancio Situazione Fusti Fuori per Singolo Pub")
    with get_db_connection() as conn:
        df_bilancio_fusti = pd.read_sql_query("""
            SELECT cliente_pub as "Locale / Pub",
                   SUM(CASE WHEN tipo_movimento='USCITA_PUB' THEN quantita ELSE -quantita END) as "Fusti Fuori (pz)",
                   SUM(CASE WHEN tipo_movimento='USCITA_PUB' THEN quantita * valore_cauzione_unitario ELSE 0 END) as "Valore Cauzioni Trattenute (€)",
                   MAX(data) as "Ultimo Movimento"
            FROM tracciamento_fusti
            GROUP BY cliente_pub
            HAVING SUM(CASE WHEN tipo_movimento='USCITA_PUB' THEN quantita ELSE -quantita END) > 0
            ORDER BY "Fusti Fuori (pz)" DESC;
        """, conn)
    
    if not df_bilancio_fusti.empty:
        st.dataframe(df_bilancio_fusti, use_container_width=True)
    else:
        st.write("Nessun fusto attualmente fuori sede.")

# =========================================================================
# TAB 4: BOLLETTE, UTENZE & SPESE FISSE
# =========================================================================
with tab4:
    st.subheader("💡 Bollette, Utenze & Costi Fissi")
    st.caption("Gestisci fatture energia, gas/metano, acqua e GPL, allegando XML/PDF e monitorando scadenze e consumi.")

    tab_bol, tab_storico, tab_analisi = st.tabs([
        "➕ Nuova Bolletta / Spesa",
        "📋 Storico & Scadenze",
        "📈 Consumi & Costi"
    ])

    with tab_bol:
        st.markdown("### 🧾 Inserimento bolletta")
        xml_upload = st.file_uploader("Fattura elettronica XML (consigliato)", type=["xml"], key="utenza_xml_upload")
        pdf_upload = st.file_uploader("PDF della bolletta / fattura", type=["pdf"], key="utenza_pdf_upload")

        xml_dati = {}
        if xml_upload is not None:
            try:
                xml_dati = parse_fattura_utenza_xml(xml_upload.getvalue())
                st.success("XML letto correttamente. Controlla i dati estratti prima del salvataggio.")
            except Exception as e:
                st.error(f"Impossibile leggere l'XML: {e}")
                xml_dati = {}

        with st.form("form_fattura_utenza", clear_on_submit=False):
            col_s1, col_s2, col_s3 = st.columns(3)
            with col_s1:
                tipi_utenza = [
                    "Energia Elettrica (Bolletta)",
                    "Gas Metano di Rete",
                    "GPL Carico Serbatoio Fisso",
                    "Acqua & Fognatura",
                    "Bombole Gas / Pacchi Bombole",
                    "Affitto / Canone Capannone",
                    "Rata Mutuo Immobile/Impianto",
                    "Consulenze / Laboratorio / HACCP",
                    "Altro Costo Fisso"
                ]
                tipo_default = xml_dati.get("tipo_utenza", "Energia Elettrica (Bolletta)")
                tipo_idx = tipi_utenza.index(tipo_default) if tipo_default in tipi_utenza else 0
                tipo_utenza = st.selectbox("Tipo utenza / costo", tipi_utenza, index=tipo_idx)
                fornitore = st.text_input("Fornitore", value=xml_dati.get("fornitore", ""))
                piva_fornitore = st.text_input("P.IVA fornitore", value=xml_dati.get("piva_fornitore", ""))
                numero_fattura = st.text_input("Numero fattura", value=xml_dati.get("numero_fattura", ""))

            with col_s2:
                data_default = xml_dati.get("data_fattura") or oggi_it()
                scad_default = xml_dati.get("data_scadenza") or oggi_it()
                data_fattura = st.date_input("Data fattura", value=data_default)
                data_scadenza = st.date_input("Data scadenza", value=scad_default)
                periodo_da = st.date_input("Periodo dal", value=xml_dati.get("periodo_da") or oggi_it(), key="utenza_periodo_da")
                periodo_a = st.date_input("Periodo al", value=xml_dati.get("periodo_a") or oggi_it(), key="utenza_periodo_a")
                stato_pagamento = st.selectbox("Stato", ["DA PAGARE", "PAGATA"], index=0)

            with col_s3:
                imponibile = st.number_input("Imponibile (€)", min_value=0.0, value=float(xml_dati.get("imponibile", 0.0) or 0.0), step=10.0)
                iva = st.number_input("IVA (€)", min_value=0.0, value=float(xml_dati.get("iva", 0.0) or 0.0), step=5.0)
                totale_fattura = st.number_input("Totale fattura (€)", min_value=0.0, value=float(xml_dati.get("totale_fattura", 0.0) or 0.0), step=10.0)
                consumo = st.number_input("Consumo", min_value=0.0, value=float(xml_dati.get("consumo", 0.0) or 0.0), step=1.0)
                unita_options = ["Nessuna", "kWh", "Smc (Metano)", "Litri (GPL)", "mc (Acqua)", "Numero Bombole"]
                unita_default = xml_dati.get("unita_misura") or "Nessuna"
                unita_idx = unita_options.index(unita_default) if unita_default in unita_options else 0
                unita_misura = st.selectbox("Unità di misura", unita_options, index=unita_idx)
                pod_pdr = st.text_input("POD / PDR / riferimento contatore", value=xml_dati.get("pod_pdr", ""))

            note = st.text_area("Note", placeholder="Annotazioni, letture, conguagli, ecc.")

            salva_fattura = st.form_submit_button("💾 Salva Bolletta / Fattura", type="primary", use_container_width=True)

            if salva_fattura:
                if totale_fattura <= 0 and imponibile <= 0:
                    st.error("Inserisci almeno un importo valido.")
                elif not fornitore.strip() and not numero_fattura.strip():
                    st.error("Inserisci almeno il fornitore oppure il numero fattura.")
                else:
                    try:
                        xml_bytes = xml_upload.getvalue() if xml_upload is not None else None
                        pdf_bytes = pdf_upload.getvalue() if pdf_upload is not None else None
                        hash_source = xml_bytes if xml_bytes else pdf_bytes
                        hash_documento = hashlib.sha256(hash_source).hexdigest() if hash_source else None

                        with get_db_connection() as conn:
                            with conn.cursor() as c:
                                if hash_documento:
                                    c.execute("SELECT id FROM fatture_utenze WHERE hash_documento=%s LIMIT 1;", (hash_documento,))
                                    duplicato = c.fetchone()
                                    if duplicato:
                                        raise ValueError(f"Documento già presente nel gestionale (ID {duplicato[0]}).")

                                c.execute("""
                                    INSERT INTO fatture_utenze (
                                        tipo_utenza, fornitore, piva_fornitore, numero_fattura,
                                        data_fattura, data_scadenza, periodo_da, periodo_a,
                                        imponibile, iva, totale_fattura, consumo, unita_misura,
                                        pod_pdr, stato_pagamento, note,
                                        file_xml, file_xml_nome, file_pdf, file_pdf_nome, hash_documento
                                    ) VALUES (
                                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                                    );
                                """, (
                                    tipo_utenza, fornitore.strip(), piva_fornitore.strip(), numero_fattura.strip(),
                                    data_fattura, data_scadenza, periodo_da, periodo_a,
                                    imponibile, iva, totale_fattura, consumo,
                                    "" if unita_misura == "Nessuna" else unita_misura,
                                    pod_pdr.strip(), stato_pagamento, note.strip(),
                                    Binary(xml_bytes) if xml_bytes else None,
                                    xml_upload.name if xml_upload is not None else "",
                                    Binary(pdf_bytes) if pdf_bytes else None,
                                    pdf_upload.name if pdf_upload is not None else "",
                                    hash_documento
                                ))
                            conn.commit()

                        st.success("✅ Bolletta/fattura salvata correttamente nel gestionale.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Errore nel salvataggio della bolletta: {e}")

        st.info("💡 L'XML viene usato come fonte strutturata. Il PDF viene conservato come allegato; se l'XML non è disponibile puoi inserire i dati manualmente.")

        # Inserimento rapido delle vecchie spese fisse, mantenuto per compatibilità.
        st.divider()
        st.markdown("### 🧮 Inserimento rapido costo fisso")
        with st.form("form_spese_fisse_legacy"):
            col_s1, col_s2, col_s3 = st.columns(3)
            with col_s1:
                sp_data = st.date_input("Data spesa", value=oggi_it(), key="legacy_sp_data")
                sp_cat = st.selectbox("Categoria", [
                    "Energia Elettrica (Bolletta)", "Gas Metano di Rete", "GPL Carico Serbatoio Fisso",
                    "Bombole Gas / Pacchi Bombole", "Acqua & Fognatura", "Affitto / Canone Capannone",
                    "Rata Mutuo Immobile/Impianto", "Consulenze / Laboratorio / HACCP", "Altro Costo Fisso"
                ], key="legacy_sp_cat")
            with col_s2:
                sp_desc = st.text_input("Descrizione / Fornitore", key="legacy_sp_desc")
                sp_importo = st.number_input("Importo (€ escluso IVA)", min_value=0.0, step=50.0, value=350.0, key="legacy_sp_importo")
            with col_s3:
                sp_qta = st.number_input("Consumo", min_value=0.0, step=10.0, value=0.0, key="legacy_sp_qta")
                sp_um = st.selectbox("Unità", ["Nessuna", "kWh", "Smc (Metano)", "Litri (GPL)", "Numero Bombole", "mc (Acqua)"], key="legacy_sp_um")
                sp_periodo = st.text_input("Mese / Periodo", key="legacy_sp_periodo")

            if st.form_submit_button("Salva costo fisso", type="secondary"):
                with get_db_connection() as conn:
                    with conn.cursor() as c:
                        c.execute("""
                            INSERT INTO costi_fissi_utenze
                            (data_spesa, categoria, descrizione, quantita_consumo, unita_misura, importo_totale_euro, periodo_competenza)
                            VALUES (%s,%s,%s,%s,%s,%s,%s);
                        """, (sp_data.strftime("%Y-%m-%d"), sp_cat, sp_desc, sp_qta, sp_um, sp_importo, sp_periodo))
                    conn.commit()
                st.success("Costo fisso registrato.")
                st.rerun()

    with tab_storico:
        st.markdown("### 📋 Bollette registrate")
        colf1, colf2, colf3 = st.columns(3)
        filtro_tipo = colf1.selectbox("Filtra utenza", ["Tutte", "Energia Elettrica (Bolletta)", "Gas Metano di Rete", "GPL Carico Serbatoio Fisso", "Acqua & Fognatura", "Altro Costo Fisso"])
        filtro_stato = colf2.selectbox("Filtra stato", ["Tutti", "DA PAGARE", "IN SCADENZA", "SCADUTA", "PAGATA"])
        mostra_n = colf3.number_input("Record", min_value=10, max_value=200, value=50, step=10)

        where = []
        params = []
        if filtro_tipo != "Tutte":
            where.append("tipo_utenza=%s")
            params.append(filtro_tipo)
        if filtro_stato != "Tutti":
            if filtro_stato == "PAGATA":
                where.append("stato_pagamento=%s")
                params.append("PAGATA")
            elif filtro_stato in ("DA PAGARE", "IN SCADENZA", "SCADUTA"):
                # Stato calcolato lato Python: recuperiamo comunque i record non pagati.
                where.append("stato_pagamento <> %s")
                params.append("PAGATA")

        where_sql = ("WHERE " + " AND ".join(where)) if where else ""
        with get_db_connection() as conn:
            df_fatture = pd.read_sql_query(f"""
                SELECT id, tipo_utenza, fornitore, piva_fornitore, numero_fattura,
                       data_fattura, data_scadenza, periodo_da, periodo_a,
                       imponibile, iva, totale_fattura, consumo, unita_misura,
                       pod_pdr, stato_pagamento, data_pagamento, note,
                       file_xml_nome, file_pdf_nome
                FROM fatture_utenze
                {where_sql}
                ORDER BY COALESCE(data_scadenza, data_fattura) DESC NULLS LAST, id DESC
                LIMIT %s;
            """, conn, params=(*params, int(mostra_n)))

        if not df_fatture.empty:
            df_fatture["Stato"] = [get_stato_scadenza(r.data_scadenza, r.stato_pagamento) for r in df_fatture.itertuples()]
            if filtro_stato != "Tutti":
                df_fatture = df_fatture[df_fatture["Stato"] == filtro_stato].copy()

            # Il filtro dello stato viene calcolato lato Python: può trasformare
            # un DataFrame inizialmente non vuoto in uno completamente vuoto.
            if df_fatture.empty:
                st.info("Nessuna bolletta trovata per il filtro selezionato.")
            else:
                df_fatture["Periodo"] = [formatta_periodo_fattura(r.periodo_da, r.periodo_a) for r in df_fatture.itertuples()]
                df_view = df_fatture[["id", "tipo_utenza", "fornitore", "numero_fattura", "data_fattura", "data_scadenza", "Periodo", "consumo", "unita_misura", "totale_fattura", "Stato"]].copy()
                df_view.columns = ["ID", "Utenza", "Fornitore", "Fattura", "Data", "Scadenza", "Periodo", "Consumo", "U.M.", "Totale (€)", "Stato"]
                st.dataframe(df_view, use_container_width=True, hide_index=True)

                totale_storico = float(df_fatture["totale_fattura"].fillna(0).sum())
                da_pagare = float(df_fatture.loc[df_fatture["stato_pagamento"] != "PAGATA", "totale_fattura"].fillna(0).sum())
                scadute = sum(1 for r in df_fatture.itertuples() if get_stato_scadenza(r.data_scadenza, r.stato_pagamento) == "SCADUTA")
                in_scadenza = sum(1 for r in df_fatture.itertuples() if get_stato_scadenza(r.data_scadenza, r.stato_pagamento) == "IN SCADENZA")
                m1, m2, m3, m4 = st.columns(4)
                m1.metric("Totale visualizzato", f"€ {totale_storico:,.2f}")
                m2.metric("Da pagare", f"€ {da_pagare:,.2f}")
                m3.metric("Scadute", scadute)
                m4.metric("In scadenza ≤ 3 gg", in_scadenza)

                st.markdown("### 🔎 Dettaglio documento")
                id_scelto = st.selectbox("Seleziona fattura", df_fatture["id"].tolist(), format_func=lambda x: f"ID {x} — {df_fatture.loc[df_fatture['id']==x, 'fornitore'].iloc[0]} — € {float(df_fatture.loc[df_fatture['id']==x, 'totale_fattura'].iloc[0] or 0):,.2f}")
                riga = df_fatture[df_fatture["id"] == id_scelto].iloc[0]

                dc1, dc2, dc3 = st.columns(3)
                with dc1:
                    st.write(f"**Fornitore:** {riga['fornitore'] or '-'}")
                    st.write(f"**P.IVA:** {riga['piva_fornitore'] or '-'}")
                    st.write(f"**Fattura:** {riga['numero_fattura'] or '-'}")
                with dc2:
                    st.write(f"**Scadenza:** {riga['data_scadenza'] or '-'}")
                    st.write(f"**POD/PDR:** {riga['pod_pdr'] or '-'}")
                    st.write(f"**Consumo:** {float(riga['consumo'] or 0):,.2f} {riga['unita_misura'] or ''}")
                with dc3:
                    st.write(f"**Totale:** € {float(riga['totale_fattura'] or 0):,.2f}")
                    st.write(f"**Stato:** {get_stato_scadenza(riga['data_scadenza'], riga['stato_pagamento'])}")
                    if riga["data_scadenza"]:
                        ics = genera_ics_scadenza_fattura(int(id_scelto), riga["fornitore"], riga["numero_fattura"], riga["data_scadenza"], riga["totale_fattura"], riga["tipo_utenza"])
                        st.download_button("📅 Scarica promemoria .ICS", data=ics, file_name=f"scadenza_bolletta_{id_scelto}.ics", mime="text/calendar", key=f"ics_{id_scelto}")

                az1, az2 = st.columns(2)
                with az1:
                    if riga["file_xml_nome"]:
                        with get_db_connection() as conn:
                            doc = pd.read_sql_query("SELECT file_xml FROM fatture_utenze WHERE id=%s", conn, params=(int(id_scelto),))
                        if not doc.empty and doc.iloc[0]["file_xml"] is not None:
                            st.download_button("⬇️ Scarica XML", data=bytes(doc.iloc[0]["file_xml"]), file_name=riga["file_xml_nome"], mime="application/xml", key=f"xml_{id_scelto}")
                with az2:
                    if riga["file_pdf_nome"]:
                        with get_db_connection() as conn:
                            doc = pd.read_sql_query("SELECT file_pdf FROM fatture_utenze WHERE id=%s", conn, params=(int(id_scelto),))
                        if not doc.empty and doc.iloc[0]["file_pdf"] is not None:
                            st.download_button("⬇️ Scarica PDF", data=bytes(doc.iloc[0]["file_pdf"]), file_name=riga["file_pdf_nome"], mime="application/pdf", key=f"pdf_{id_scelto}")

                st.markdown("### ✏️ Aggiorna stato pagamento")
                with st.form(f"form_pagamento_{id_scelto}"):
                    nuovo_stato = st.selectbox("Stato pagamento", ["DA PAGARE", "PAGATA"], index=1 if riga["stato_pagamento"] == "PAGATA" else 0)
                    nuova_data_pag = st.date_input("Data pagamento", value=(riga["data_pagamento"] or oggi_it()), key=f"data_pag_{id_scelto}")
                    if st.form_submit_button("Aggiorna pagamento"):
                        with get_db_connection() as conn:
                            with conn.cursor() as c:
                                c.execute("UPDATE fatture_utenze SET stato_pagamento=%s, data_pagamento=%s WHERE id=%s", (nuovo_stato, nuova_data_pag if nuovo_stato == "PAGATA" else None, int(id_scelto)))
                            conn.commit()
                        st.success("Stato aggiornato.")
                        st.rerun()
        else:
            st.info("Nessuna bolletta presente con i filtri selezionati.")

        st.divider()
        st.markdown("### 🧾 Vecchio registro Spese Fisse")
        with get_db_connection() as conn:
            df_spese_tot = pd.read_sql_query("""
                SELECT id, data_spesa as "Data", categoria as "Categoria", descrizione as "Descrizione",
                       importo_totale_euro as "Importo (€)", quantita_consumo as "Consumo", unita_misura as "U.M.",
                       periodo_competenza as "Periodo"
                FROM costi_fissi_utenze ORDER BY id DESC LIMIT 100;
            """, conn)
        if not df_spese_tot.empty:
            st.dataframe(df_spese_tot, use_container_width=True, hide_index=True)
            st.metric("Totale registro spese fisse", f"€ {float(df_spese_tot['Importo (€)'].sum()):,.2f}")

    with tab_analisi:
        st.markdown("### 📈 Andamento consumi")
        tipo_analisi = st.selectbox("Utenza da analizzare", ["Energia Elettrica (Bolletta)", "Gas Metano di Rete", "GPL Carico Serbatoio Fisso", "Acqua & Fognatura"], key="analisi_utenza")
        with get_db_connection() as conn:
            df_consumi = pd.read_sql_query("""
                SELECT DATE_TRUNC('month', data_fattura) AS mese,
                       SUM(consumo) AS consumo,
                       SUM(totale_fattura) AS costo
                FROM fatture_utenze
                WHERE tipo_utenza=%s AND consumo > 0
                GROUP BY DATE_TRUNC('month', data_fattura)
                ORDER BY mese;
            """, conn, params=(tipo_analisi,))

        if not df_consumi.empty:
            df_consumi["mese"] = pd.to_datetime(df_consumi["mese"])
            df_consumi = df_consumi.set_index("mese")
            st.line_chart(df_consumi[["consumo"]], use_container_width=True)
            st.dataframe(df_consumi.reset_index(), use_container_width=True, hide_index=True)
            st.metric("Costo totale registrato", f"€ {float(df_consumi['costo'].sum()):,.2f}")
        else:
            st.info("Non ci sono ancora consumi registrati per questa utenza.")

        st.markdown("### 💶 Prezzo medio dell'unità")
        with get_db_connection() as conn:
            df_prezzo = pd.read_sql_query("""
                SELECT tipo_utenza, unita_misura,
                       SUM(consumo) AS consumo_totale,
                       SUM(totale_fattura) AS costo_totale
                FROM fatture_utenze
                WHERE consumo > 0 AND totale_fattura > 0
                GROUP BY tipo_utenza, unita_misura
                ORDER BY tipo_utenza;
            """, conn)
        if not df_prezzo.empty:
            df_prezzo["Costo medio"] = df_prezzo["costo_totale"] / df_prezzo["consumo_totale"]
            st.dataframe(df_prezzo, use_container_width=True, hide_index=True)

# =========================================================================
# TAB 5: CALCOLO COSTO REALE INDUSTRIALE & MARGINI
# =========================================================================
with tab5:
    st.subheader("💰 Costo Reale Industriale & Marginalità al Litro")
    quota_fissa_litro = get_incidenza_costi_fissi_litro()

    col_cg1, col_cg2 = st.columns(2)
    col_cg1.metric("Quota Costi Fissi/Utenze", f"€ {quota_fissa_litro:.3f} / LT")
    col_cg2.metric("Aliquota Accisa Microbirrificio", f"{ALIQUOTA_ACCISA_PLATO:.3f} €/hl/°P")

    with get_db_connection() as conn:
        df_cotte_calc = pd.read_sql_query("SELECT id, cotta_num, tipo_birra, litri_mosto, grado_plato, costo_litro_mosto FROM registro_mosto ORDER BY id DESC LIMIT 20;", conn)

    if not df_cotte_calc.empty:
        scelte_cotte_marg = [f"Cotta {r['cotta_num']} - {r['tipo_birra']} (Plato: {r['grado_plato']}°P - Costo mosto base: € {r['costo_litro_mosto']:.3f}/LT)" for _, r in df_cotte_calc.iterrows()]
        sel_c_m = st.selectbox("Seleziona la cotta da analizzare:", scelte_cotte_marg)
        num_c_estratto = sel_c_m.split(" - ")[0].replace("Cotta ", "").strip()
        row_c = df_cotte_calc[df_cotte_calc["cotta_num"] == num_c_estratto].iloc[0]
        costo_mp_lt = float(row_c["costo_litro_mosto"])
        plato_analizzato = float(row_c["grado_plato"])
    else:
        costo_mp_lt, plato_analizzato = 0.45, 12.5

    accisa_per_litro = (plato_analizzato / 100.0) * ALIQUOTA_ACCISA_PLATO
    costo_industriale_totale_litro = costo_mp_lt + accisa_per_litro + quota_fissa_litro

    col_det1, col_det2, col_det3, col_det4 = st.columns(4)
    col_det1.metric("1. Mosto + Sanificazione", f"€ {costo_mp_lt:.3f} / LT")
    col_det2.metric("2. Accisa Dogane", f"€ {accisa_per_litro:.3f} / LT")
    col_det3.metric("3. Bollette & Fissi", f"€ {quota_fissa_litro:.3f} / LT")
    col_det4.metric("💥 COSTO PIENO REALE", f"€ {costo_industriale_totale_litro:.3f} / LT")

    st.write("---")
    st.markdown("#### 🍺 Analisi Margine su Formato di Vendita al Pub")
    col_fm1, col_fm2, col_fm3 = st.columns(3)
    with col_fm1:
        formato_sim = st.selectbox("Formato Venduto:", ["Fusto 20L", "Fusto 24L", "Fusto 25L", "Fusto 30L", "Fusto 12L", "Bottiglia 0.33L", "Bottiglia 0.75L"])
        litri_formato = {"Fusto 20L": 20.0, "Fusto 24L": 24.0, "Fusto 25L": 25.0, "Fusto 30L": 30.0, "Fusto 12L": 12.0, "Bottiglia 0.33L": 0.33, "Bottiglia 0.75L": 0.75}[formato_sim]
    with col_fm2:
        costo_imb_singolo = st.number_input("Costo Imballaggio/Fusto a perdere (€/pz)", min_value=0.0, value=0.30 if "Bottiglia" in formato_sim else 1.50, step=0.10)
    with col_fm3:
        prezzo_vendita_pub = st.number_input("Prezzo di Vendita Netto al Pub (€)", min_value=1.0, value=75.0 if "Fusto" in formato_sim else 2.50, step=1.0)

    costo_formato_pieno = (costo_industriale_totale_litro * litri_formato) + costo_imb_singolo
    margine_netto_euro = prezzo_vendita_pub - costo_formato_pieno
    margine_perc = (margine_netto_euro / prezzo_vendita_pub * 100.0) if prezzo_vendita_pub > 0 else 0.0

    col_res1, col_res2, col_res3 = st.columns(3)
    col_res1.metric(f"Costo Produzione {formato_sim}", f"€ {costo_formato_pieno:.2f}")
    col_res2.metric("Guadagno Netto a Pezzo", f"€ {margine_netto_euro:.2f}", delta=f"+{margine_netto_euro:.2f} €")
    col_res3.metric("Margine di Profitto", f"{margine_perc:.1f}%")

# =========================================================================
# TAB 6: ACQUISTI XML
# =========================================================================
with tab6:
    st.subheader("Carico Automatico Materie Prime da Fatture XML Fornitori")
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
                        data_doc = trova_testo_nodo(root, ["Data"]) or oggi_it().strftime("%Y-%m-%d")
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
            invalidate_caches()
            st.success(f"Caricate {carichi_mp} nuove fatture!")
            st.rerun()

    st.write("---")
    st.markdown("#### 📋 Storico Movimentazioni Materie Prime")
    with get_db_connection() as conn:
        df_mp_mov = pd.read_sql_query("""
            SELECT id, data as "Data", tipo as "Tipo", riferimento as "Riferimento", azienda as "Fornitore / Cotta", 
                   malto_kg as "Kg Malto", ROUND(costo_malto_kg::numeric, 2) as "€/kg Malto",
                   luppolo_kg as "Kg Luppolo", ROUND(costo_luppolo_kg::numeric, 2) as "€/kg Luppolo",
                   lievito_kg as "Kg Lievito", ROUND(costo_lievito_kg::numeric, 2) as "€/kg Lievito"
            FROM materie_prime 
            ORDER BY id DESC;
        """, conn)
    st.dataframe(df_mp_mov, use_container_width=True)

# =========================================================================
# TAB 7: IMBALLAGGI
# =========================================================================
with tab7:
    st.subheader("Carico Imballaggi")
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
            invalidate_caches()
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

# =========================================================================
# TAB 8: CONFEZIONAMENTO MISTO
# =========================================================================
with tab8:
    st.subheader("📦 Confezionamento Misto Cotta (Fusti e Bottiglie)")
    with get_db_connection() as conn:
        df_mosti = pd.read_sql_query("SELECT id, cotta_num, lotto_sfuso, tipo_birra, litri_mosto, grado_plato, costo_litro_mosto FROM registro_mosto ORDER BY id DESC LIMIT 25;", conn)

    if not df_mosti.empty:
        opts = [f"ID {r['id']} | Cotta {r['cotta_num']} ({r['tipo_birra']}) - {r['litri_mosto']} LT - °P {r['grado_plato']}" for _, r in df_mosti.iterrows()]
        sel_c = st.selectbox("Seleziona Cotta da Confezionare:", opts)
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
        with col_gen1: data_imb = st.date_input("Data Confezionamento", value=oggi_it())
        with col_gen2: lotto_c = st.text_input("Lotto Confezionato", value=lotto_def)
        with col_gen3: costo_p_lt = st.number_input("Costo Produzione Mosto (€/LT)", min_value=0.01, value=costo_suggerito_lt, step=0.05)

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
                invalidate_caches()
                st.success(f"Confezionamento registrato! Caricati {litri_effettivi:.1f} LT a magazzino.")
                st.rerun()

# =========================================================================
# TAB 9: VENDITE XML E MANUALI
# =========================================================================
with tab9:
    st.subheader("🚚 Scarico Vendite Birra (Fatture XML & Manuale)")
    st.caption("Nota contabile: il PrezzoUnitario della fattura di vendita è il prezzo di vendita, NON il costo industriale. Il costo dello scarico viene valorizzato al costo medio ponderato del magazzino.")
    up_vendite_xml = st.file_uploader("Trascina qui le fatture XML emesse", type=["xml"], accept_multiple_files=True, key="xml_vendite")

    if up_vendite_xml and st.button("Elabora e Scarica Fatture Emesse"):
        tot_scarichi, tot_litri = 0, 0.0
        with get_db_connection() as conn:
            with conn.cursor() as c:
                c.execute("""
                    SELECT COALESCE(
                        SUM(litri_totali * costo_produzione_litro) / NULLIF(SUM(litri_totali), 0),
                        1.10
                    )
                    FROM birra_condizionata
                    WHERE tipo='CARICO' AND litri_totali > 0;
                """)
                costo_medio_stock_litro = float(c.fetchone()[0] or 1.10)

                for up_xml in up_vendite_xml:
                    try:
                        content = up_xml.read()
                        root = ET.fromstring(content)
                        cess = root.find(".//DatiAnagraficiCessionario")
                        cliente = trova_testo_nodo(cess, ["Denominazione", "Cognome"]) if cess is not None else "Cliente"
                        num_doc = trova_testo_nodo(root, ["Numero"]) or "N.D."
                        data_doc = trova_testo_nodo(root, ["Data"]) or oggi_it().strftime("%Y-%m-%d")
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
            invalidate_caches()
            st.success(f"Registrati {tot_scarichi} scarichi per {tot_litri:.1f} Litri!")
            st.rerun()

    st.write("---")
    st.markdown("### ✍️ Scarico Vendita Manuale")
    with st.form("vendita_manuale_form"):
        doc_v = st.text_input("Riferimento DDT / Pub / Cliente")
        fmt_v = st.selectbox("Formato Venduto", ["Fusto 12L", "Fusto 20L", "Fusto 24L", "Fusto 25L", "Fusto 30L", "Bottiglia 0.33L", "Bottiglia 0.75L"])
        qta_v = st.number_input("Quantità Venduta", min_value=1, step=1)
        if st.form_submit_button("Registra Scarico Magazzino"):
            oggi = oggi_it().strftime("%Y-%m-%d")
            l_map = {"Fusto 12L": 12.0, "Fusto 20L": 20.0, "Fusto 24L": 24.0, "Fusto 25L": 25.0, "Fusto 30L": 30.0, "Bottiglia 0.33L": 0.33, "Bottiglia 0.75L": 0.75}
            with get_db_connection() as conn:
                with conn.cursor() as c:
                    c.execute("""
                        INSERT INTO birra_condizionata (tipo, data, lotto, formato, quantita, litri_totali, documento_rif)
                        VALUES ('SCARICO', %s, '-', %s, %s, %s, %s);
                    """, (oggi, fmt_v, qta_v, qta_v * l_map[fmt_v], doc_v))
                conn.commit()
            invalidate_caches()
            st.success("Scarico birra registrato!")
            st.rerun()

# =========================================================================
# TAB 10: GIACENZE MAGAZZINO
# =========================================================================
with tab10:
    st.subheader("🏛 Giacenze Magazzino Prodotti Finiti")
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
                    invalidate_caches()
                    st.success("Movimento eliminato!")
                    st.rerun()

# =========================================================================
# TAB 11: REPORT 31/12 & DOGANE
# =========================================================================
with tab11:
    st.subheader("📑 Report di Chiusura Esercizio: Bilancio Dogane & Commercialista")
    
    col_ab1, col_ab2 = st.columns([2, 2])
    with col_ab1:
        anno_bilancio = st.selectbox("Seleziona Anno Fiscale di Chiusura:", [2026, 2025, 2024], index=0)
    with col_ab2:
        tipo_aliquota_sel = st.radio("Regime Accisa Applicato:", ["Microbirrificio Ridotto 50% (1,490 €/hl/°P)", "Ordinario (2,980 €/hl/°P)"], index=0)
        aliquota_calcolo = 1.490 if "50%" in tipo_aliquota_sel else 2.980

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

    st.markdown(f"### 🏛️ 1. Prospetto Bilancio Dogane Esercizio {anno_bilancio}")
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
        aliquota_acc=aliquota_calcolo
    )

    st.download_button(
        label="📄 SCARICA BILANCIO FINANZIARIO DOGANE (PDF)",
        data=pdf_dogane_bytes,
        file_name="bilancio_finanziario.pdf",
        mime="application/pdf",
        type="primary"
    )

    st.divider()

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
        """, conn, params=(aliquota_calcolo, aliquota_calcolo))

    val_imb_tot = float(df_imb_ant["Valore Totale (€)"].sum()) if not df_imb_ant.empty else 0.0
    val_pf_tot = float(df_pf_ant["Valore Fiscale (€)"].sum()) if not df_pf_ant.empty else 0.0
    tot_bilancio = valore_tot_mp + val_imb_tot + val_pf_tot

    st.write(f"• Valore Materie Prime: **€ {valore_tot_mp:,.2f}** | • Valore Imballaggi: **€ {val_imb_tot:,.2f}** | • Valore Birra Finita: **€ {val_pf_tot:,.2f}**")
    st.success(f"💰 **TOTALE RIMANENZE FINALI AL 31/12: € {tot_bilancio:,.2f}**")

    pdf_comm_bytes = genera_pdf_commercialista(
        valore_tot_mp, val_imb_tot, val_pf_tot, tot_bilancio,
        malto, luppolo, lievito, tot_litri_finiti, 1.10, aliquota_calcolo,
        RAGIONE_AZIENDA, PIVA_AZIENDA
    )

    st.download_button(
        label="📄 SCARICA PROSPETTO RIMANENZE 31/12 (PDF)",
        data=pdf_comm_bytes,
        file_name="Prospetto_Rimanenze_31_12_Commercialista.pdf",
        mime="application/pdf"
    )


# =========================================================================
# TAB 12: SCADENZE & PROMEMORIA (NUOVO)
# =========================================================================
with tab12:
    try:
        render_tab_scadenze()
    except Exception as _e_tab12:
        st.error(f"Errore nella scheda Scadenze & Promemoria: {_e_tab12}")

# =========================================================================
# TAB 13: PIANIFICATORE COTTE CON EXPORT .ICS (NUOVO)
# =========================================================================
with tab13:
    try:
        render_tab_pianificatore()
    except Exception as _e_tab13:
        st.error(f"Errore nel Pianificatore Cotte: {_e_tab13}")
