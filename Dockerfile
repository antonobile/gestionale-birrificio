FROM python:3.11-slim

# Evita file .pyc e forza l'output immediato dei log nella console di Google Cloud
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Installazione librerie di sistema essenziali per compilare moduli C (PostgreSQL/psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copia solo requirements.txt prima per sfruttare la cache di Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia tutto il resto del progetto (codice e immagini)
COPY . .

# Cloud Run assegna la porta tramite la variabile d'ambiente $PORT (predefinita a 8080)
EXPOSE 8080

CMD ["sh", "-c", "streamlit run streamlit_app.py --server.port=${PORT:-8080} --server.address=0.0.0.0 --server.enableCORS=false --server.enableXsrfProtection=true"]
