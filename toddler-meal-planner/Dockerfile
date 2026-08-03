# Toddler Meal Planner - Docker Configuration
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py
ENV FLASK_ENV=production

# Set work directory
WORKDIR /app

# Install system dependencies (curl for healthchecks, gosu to drop privileges)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Non-root user; entrypoint starts as root to chown the data volume, then drops.
RUN useradd --create-home appuser \
    && mkdir -p /app/instance/logs \
    && chown -R appuser:appuser /app \
    && chmod +x /app/docker-entrypoint.sh

# Persist SQLite + uploads via bind mount to /app/instance
# Example: -v ~/meal-data:/app/instance
ENV DATABASE_URL=sqlite:////app/instance/toddler_meals.db

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD curl -fsS http://127.0.0.1:5000/ >/dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "app:app"]
