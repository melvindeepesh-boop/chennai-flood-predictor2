# Use the official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install build dependencies for scientific packages if necessary
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application source code
COPY . .

# Pre-train the model during image build so the pickle binary is ready at launch
RUN python generate_model.py

# Expose port (standard container configuration)
EXPOSE 5000

# Environment variables
ENV FLASK_APP=app.py
ENV PORT=5000

# Run the web service using Gunicorn, binding to the active PORT assigned by the host
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} app:app"]
