# Use the official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install build-essential for any C compilation (e.g. for shap/xgboost)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir torch

# Copy the application source code
COPY . .

# Set PYTHONPATH so that 'backend' module is resolvable
ENV PYTHONPATH=/app

# Expose port (standard container configuration)
EXPOSE 8000

# Environment variables
ENV PORT=8000

# Run the web service using uvicorn, binding to the active PORT assigned by the host
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
