# HuggingFace Spaces Docker image for Agentic SQL Demo Backend
FROM python:3.12-slim

# Create non-root user for security (required by HF Spaces)
RUN useradd -m -u 1000 user

# Install uv for fast dependency management
RUN pip install uv

# Set working directory and give ownership to user
WORKDIR /code
RUN chown user:user /code

# Switch to non-root user before copying files
USER user

# Copy dependency files first for better layer caching
COPY --chown=user:user pyproject.toml uv.lock* ./

# Install production dependencies
RUN uv sync --frozen --no-dev

# Copy application code (backend/app/ arrives as app/ in the staging bundle)
# Root packages (agent/, etl/, sql/, data/, scripts/) are bundled alongside
COPY --chown=user:user . .

# Expose port (must match app_port in README.md for HF Spaces)
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:7860/api/health')" || exit 1

# Start the server
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
