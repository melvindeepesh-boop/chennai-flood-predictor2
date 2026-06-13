import os
import time
import requests
import numpy as np
import urllib.parse
from collections import defaultdict
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from backend.model.predict import run_prediction, load_models

# Load env variables from .env
load_dotenv()

app = FastAPI(title="Chennai Flood Predictor API", version="1.4.0")

# Enable CORS for all origins (no credentials allowed for wildcard to prevent CORS hijacking)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory rate limiting configuration
RATE_LIMIT_WINDOW = 60  # 1 minute
RATE_LIMIT_MAX_REQUESTS = 30
request_history = defaultdict(list)
LIMITED_PATHS = {"/predict", "/geocode", "/geocode/ip", "/weather/live"}

@app.middleware("http")
async def rate_limiting_middleware(request: Request, call_next):
    # Only rate limit target endpoints
    path = request.url.path
    if path in LIMITED_PATHS:
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Filter request timestamps in the current window
        request_history[client_ip] = [
            t for t in request_history[client_ip]
            if current_time - t < RATE_LIMIT_WINDOW
        ]
        
        if len(request_history[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
        
        request_history[client_ip].append(current_time)
        
        # Periodic cleanup of empty list entries to avoid memory growth (1% chance)
        import random
        if random.random() < 0.01:
            for ip in list(request_history.keys()):
                request_history[ip] = [t for t in request_history[ip] if current_time - t < RATE_LIMIT_WINDOW]
                if not request_history[ip]:
                    request_history.pop(ip, None)
                    
    response = await call_next(request)
    return response

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://*.basemaps.cartocdn.com https://unpkg.com; "
        "media-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    return response

# Hardcoded database containing geological and coordinate values for Chennai areas
AREAS_DB = {
    # Existing 20
    "Velachery": {"elevation": 5.0, "drainage": 0.30, "river_dist": 1.5, "lat": 12.9815, "lon": 80.2180},
    "Adyar": {"elevation": 4.0, "drainage": 0.25, "river_dist": 0.2, "lat": 13.0012, "lon": 80.2565},
    "T. Nagar": {"elevation": 12.0, "drainage": 0.55, "river_dist": 2.2, "lat": 13.0418, "lon": 80.2337},
    "Anna Nagar": {"elevation": 14.0, "drainage": 0.60, "river_dist": 1.8, "lat": 13.0850, "lon": 80.2101},
    "Tambaram": {"elevation": 20.0, "drainage": 0.65, "river_dist": 4.5, "lat": 12.9249, "lon": 80.1467},
    "Sholinganallur": {"elevation": 3.0, "drainage": 0.20, "river_dist": 0.8, "lat": 12.9010, "lon": 80.2279},
    "Porur": {"elevation": 10.0, "drainage": 0.50, "river_dist": 1.2, "lat": 13.0382, "lon": 80.1561},
    "Perambur": {"elevation": 8.0, "drainage": 0.40, "river_dist": 0.5, "lat": 13.1085, "lon": 80.2443},
    "Chromepet": {"elevation": 16.0, "drainage": 0.58, "river_dist": 3.8, "lat": 12.9616, "lon": 80.1374},
    "Kodambakkam": {"elevation": 9.0, "drainage": 0.45, "river_dist": 1.6, "lat": 13.0473, "lon": 80.2158},
    "Mylapore": {"elevation": 6.0, "drainage": 0.32, "river_dist": 1.1, "lat": 13.0330, "lon": 80.2677},
    "Guindy": {"elevation": 11.0, "drainage": 0.48, "river_dist": 1.4, "lat": 13.0067, "lon": 80.2206},
    "Nungambakkam": {"elevation": 13.0, "drainage": 0.52, "river_dist": 2.0, "lat": 13.0580, "lon": 80.2423},
    "Madipakkam": {"elevation": 7.0, "drainage": 0.35, "river_dist": 1.9, "lat": 12.9623, "lon": 80.1986},
    "Pallikaranai": {"elevation": 2.0, "drainage": 0.18, "river_dist": 0.4, "lat": 12.9349, "lon": 80.2137},
    "Besant Nagar": {"elevation": 5.0, "drainage": 0.30, "river_dist": 0.9, "lat": 13.0003, "lon": 80.2702},
    "Thiruvanmiyur": {"elevation": 4.0, "drainage": 0.28, "river_dist": 0.7, "lat": 12.9830, "lon": 80.2594},
    "Ambattur": {"elevation": 9.0, "drainage": 0.42, "river_dist": 2.5, "lat": 13.1143, "lon": 80.1548},
    "Avadi": {"elevation": 18.0, "drainage": 0.60, "river_dist": 3.0, "lat": 13.1181, "lon": 80.1036},
    "Manali": {"elevation": 3.0, "drainage": 0.22, "river_dist": 0.3, "lat": 13.1672, "lon": 80.2592},

    # North Chennai New Areas
    "Ennore": {"elevation": 2.0, "drainage": 0.20, "river_dist": 0.1, "lat": 13.2161, "lon": 80.3247},
    "Tiruvottiyur": {"elevation": 3.0, "drainage": 0.25, "river_dist": 0.4, "lat": 13.1612, "lon": 80.3032},
    "Madhavaram": {"elevation": 9.0, "drainage": 0.45, "river_dist": 1.8, "lat": 13.1482, "lon": 80.2307},
    "Puzhal": {"elevation": 12.0, "drainage": 0.50, "river_dist": 2.0, "lat": 13.1601, "lon": 80.2012},
    "Kodungaiyur": {"elevation": 4.0, "drainage": 0.30, "river_dist": 0.8, "lat": 13.1385, "lon": 80.2510},
    "Tondiarpet": {"elevation": 3.0, "drainage": 0.35, "river_dist": 0.6, "lat": 13.1252, "lon": 80.2882},
    "Royapuram": {"elevation": 4.0, "drainage": 0.40, "river_dist": 0.2, "lat": 13.1118, "lon": 80.2925},
    "Washermanpet": {"elevation": 5.0, "drainage": 0.40, "river_dist": 1.0, "lat": 13.1025, "lon": 80.2811},
    "Vyasarpadi": {"elevation": 3.0, "drainage": 0.28, "river_dist": 0.3, "lat": 13.1095, "lon": 80.2544},

    # Central Chennai New Areas
    "Kilpauk": {"elevation": 11.0, "drainage": 0.55, "river_dist": 1.2, "lat": 13.0788, "lon": 80.2385},
    "Ayanavaram": {"elevation": 9.0, "drainage": 0.45, "river_dist": 1.5, "lat": 13.0970, "lon": 80.2312},
    "Chetpet": {"elevation": 8.0, "drainage": 0.50, "river_dist": 0.3, "lat": 13.0689, "lon": 80.2418},
    "Egmore": {"elevation": 7.0, "drainage": 0.48, "river_dist": 0.2, "lat": 13.0783, "lon": 80.2605},
    "Purasawalkam": {"elevation": 8.0, "drainage": 0.45, "river_dist": 1.0, "lat": 13.0901, "lon": 80.2520},
    "Choolai": {"elevation": 6.0, "drainage": 0.40, "river_dist": 0.8, "lat": 13.0872, "lon": 80.2625},
    "Vadapalani": {"elevation": 10.0, "drainage": 0.52, "river_dist": 1.4, "lat": 13.0494, "lon": 80.2084},
    "Ashok Nagar": {"elevation": 11.0, "drainage": 0.55, "river_dist": 1.1, "lat": 13.0360, "lon": 80.2110},
    "KK Nagar": {"elevation": 10.0, "drainage": 0.52, "river_dist": 0.9, "lat": 13.0285, "lon": 80.2030},

    # South Chennai New Areas
    "Saidapet": {"elevation": 6.0, "drainage": 0.40, "river_dist": 0.1, "lat": 13.0205, "lon": 80.2225},
    "Alandur": {"elevation": 12.0, "drainage": 0.50, "river_dist": 1.8, "lat": 12.9975, "lon": 80.2006},
    "Nanganallur": {"elevation": 14.0, "drainage": 0.55, "river_dist": 2.5, "lat": 12.9804, "lon": 80.1965},
    "Perungudi": {"elevation": 3.0, "drainage": 0.22, "river_dist": 0.5, "lat": 12.9654, "lon": 80.2461},
    "Kottivakkam": {"elevation": 4.0, "drainage": 0.28, "river_dist": 0.5, "lat": 12.9682, "lon": 80.2601},
    "Palavakkam": {"elevation": 4.0, "drainage": 0.26, "river_dist": 0.4, "lat": 12.9554, "lon": 80.2625},
    "Neelankarai": {"elevation": 4.0, "drainage": 0.28, "river_dist": 0.3, "lat": 12.9492, "lon": 80.2647},
    "Karapakkam": {"elevation": 3.0, "drainage": 0.22, "river_dist": 0.4, "lat": 12.9220, "lon": 80.2292},
    "Thoraipakkam": {"elevation": 3.0, "drainage": 0.24, "river_dist": 0.6, "lat": 12.9430, "lon": 80.2345},
    "Semmencheri": {"elevation": 4.0, "drainage": 0.25, "river_dist": 0.8, "lat": 12.8718, "lon": 80.2215},
    "Uthandi": {"elevation": 3.0, "drainage": 0.30, "river_dist": 0.2, "lat": 12.8605, "lon": 80.2458},

    # West Chennai New Areas
    "Mogappair": {"elevation": 11.0, "drainage": 0.48, "river_dist": 1.6, "lat": 13.0854, "lon": 80.1762},
    "Nolambur": {"elevation": 13.0, "drainage": 0.50, "river_dist": 1.2, "lat": 13.0745, "lon": 80.1650},
    "Maduravoyal": {"elevation": 11.0, "drainage": 0.48, "river_dist": 0.5, "lat": 13.0664, "lon": 80.1685},
    "Valasaravakkam": {"elevation": 9.0, "drainage": 0.45, "river_dist": 0.9, "lat": 13.0402, "lon": 80.1784},
    "Ramapuram": {"elevation": 8.0, "drainage": 0.42, "river_dist": 0.8, "lat": 13.0232, "lon": 80.1802},
    "Virugambakkam": {"elevation": 9.0, "drainage": 0.45, "river_dist": 0.6, "lat": 13.0485, "lon": 80.1895},
    "Saligramam": {"elevation": 9.0, "drainage": 0.48, "river_dist": 1.0, "lat": 13.0538, "lon": 80.1982},
    "Koyambedu": {"elevation": 10.0, "drainage": 0.50, "river_dist": 0.3, "lat": 13.0732, "lon": 80.1912},
    "Nerkundram": {"elevation": 10.0, "drainage": 0.48, "river_dist": 0.7, "lat": 13.0694, "lon": 80.1785}
}

# Request schema for /predict
class PredictRequest(BaseModel):
    area_name: str = None
    latitude: float = None
    longitude: float = None
    current_rainfall: float = None
    cumulative_rainfall_72h: float = None
    soil_moisture: float = None
    tide_level: float = None
    is_monsoon: int = None


def get_closest_area(lat, lon):
    """
    Finds the closest hardcoded Chennai area to the given coordinates
    using the Euclidean distance formula.
    """
    closest_name = "Velachery"
    min_dist = float('inf')
    
    for area, geo in AREAS_DB.items():
        dist = np.sqrt((geo['lat'] - lat)**2 + (geo['lon'] - lon)**2)
        if dist < min_dist:
            min_dist = dist
            closest_name = area
            
    return closest_name

@app.get("/health")
def health_check():
    xgb, lstm = load_models()
    models_ok = xgb is not None and lstm is not None
    return {
        "status": "ok",
        "models_loaded": models_ok
    }

@app.get("/geocode")
def geocode_area(area_name: str):
    """
    Translate an area name into coordinate details.
    Checks the local hardcoded database first for instant loading, falling back to OSM Nominatim API.
    """
    cleaned_name = area_name.strip()
    
    # 1. Check local DB first for exact match (case-insensitive)
    for area, geo in AREAS_DB.items():
        if cleaned_name.lower() == area.lower():
            return {
                "lat": geo["lat"],
                "lon": geo["lon"],
                "display_name": f"{area}, Chennai, Tamil Nadu, India"
            }
            
    # 2. Check local DB for substring match (case-insensitive)
    for area, geo in AREAS_DB.items():
        if cleaned_name.lower() in area.lower():
            return {
                "lat": geo["lat"],
                "lon": geo["lon"],
                "display_name": f"{area}, Chennai, Tamil Nadu, India"
            }
            
    # 3. Fallback to OSM Nominatim API
    try:
        query = f"{cleaned_name} Chennai"
        encoded_query = urllib.parse.quote(query)
        url = f"https://nominatim.openstreetmap.org/search?q={encoded_query}&format=json"
        headers = {"User-Agent": "ChennaiFloodPredictorApp/1.0 (contact: support@predictor.net)"}
        res = requests.get(url, headers=headers, timeout=5)
        
        if res.status_code == 200 and len(res.json()) > 0:
            first_match = res.json()[0]
            return {
                "lat": float(first_match["lat"]),
                "lon": float(first_match["lon"]),
                "display_name": first_match["display_name"]
            }
        else:
            raise HTTPException(status_code=404, detail="Area coordinates not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/geocode/ip")
def geocode_ip(request: Request):
    """
    Geolocate the client's coordinate context using their public IP.
    """
    client_ip = request.client.host if request.client else None
    
    # If client_ip is local/private, get the public IP of the host
    # (since the user runs the server locally, the host's public IP represents the user's location)
    is_local = not client_ip or client_ip in ("127.0.0.1", "localhost", "::1") or client_ip.startswith("192.168.") or client_ip.startswith("10.") or client_ip.startswith("172.")
    
    try:
        if is_local:
            # Query external service to find our own public IP and location details
            res = requests.get("https://ipapi.co/json/", timeout=3)
        else:
            # Query external service for the client's public IP
            res = requests.get(f"https://ipapi.co/{client_ip}/json/", timeout=3)
            
        if res.status_code == 200:
            data = res.json()
            lat = data.get("latitude")
            lon = data.get("longitude")
            city = data.get("city", "Chennai")
            region = data.get("region", "Tamil Nadu")
            
            if lat is not None and lon is not None:
                return {
                    "lat": float(lat),
                    "lon": float(lon),
                    "city": city,
                    "region": region,
                    "ip": data.get("ip")
                }
        raise HTTPException(status_code=404, detail="Could not geolocate IP address.")
    except Exception as e:
        # Final fallback to Chennai center if anything fails
        return {
            "lat": 12.9815,
            "lon": 80.2180,
            "city": "Chennai (Simulated)",
            "region": "Tamil Nadu"
        }

@app.get("/weather/live")
def get_live_weather(lat: float, lon: float):
    """
    Fetch live monsoonal weather indices from OpenWeatherMap API using user key.
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        raise HTTPException(status_code=400, detail="OpenWeatherMap API Key is not configured in .env file.")
        
    try:
        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        res = requests.get(url, timeout=5)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail="OpenWeatherMap API query failed.")
            
        w_data = res.json()
        
        # Parse current rainfall rate (last 1h or 3h divided)
        rain_rate = 0.0
        if "rain" in w_data:
            rain_rate = w_data["rain"].get("1h", w_data["rain"].get("3h", 0.0) / 3.0)
            
        wind_mps = w_data.get("wind", {}).get("speed", 0.0)
        
        return {
            "rainfall_mmhr": float(round(rain_rate, 2)),
            "humidity": int(w_data.get("main", {}).get("humidity", 0)),
            "wind_speed_kmh": float(round(wind_mps * 3.6, 2)), # conversion from m/s to km/h
            "temperature_c": float(round(w_data.get("main", {}).get("temp", 0.0), 1)),
            "pressure_hpa": int(w_data.get("main", {}).get("pressure", 1013)),
            "description": w_data.get("weather", [{}])[0].get("description", "no clouds")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Live weather API error: {str(e)}")

@app.post("/predict")
def predict_flood(req: PredictRequest):
    lat = req.latitude
    lon = req.longitude
    area = req.area_name
    
    # Normalize area name to closest known area key
    if lat is not None and lon is not None:
        # Chennai bounding box checking
        if not ((12.75 <= lat <= 13.35) and (79.95 <= lon <= 80.40)):
            raise HTTPException(
                status_code=400,
                detail="The specified coordinates are outside the Chennai Metropolitan hydrological zone. This model only supports predictions within Chennai."
            )
        matched_area = get_closest_area(lat, lon)
    else:
        if area is None:
            raise HTTPException(status_code=400, detail="Area name or coordinates must be provided.")
        matched_area = None
        for name in AREAS_DB.keys():
            if name.lower() in area.lower() or area.lower() in name.lower():
                matched_area = name
                break
        if matched_area is None:
            raise HTTPException(
                status_code=400,
                detail=f"The area '{area}' is not recognized or is outside the Chennai Metropolitan hydrological zone."
            )
            
    geo = AREAS_DB[matched_area]
    lat = geo["lat"]
    lon = geo["lon"]
    
    # 2. Call OWM or get live rainfall rate
    current_rainfall = req.current_rainfall
    cumulative_72h = req.cumulative_rainfall_72h
    soil_moisture = req.soil_moisture
    tide_level = req.tide_level
    is_monsoon = req.is_monsoon

    # If any is None, fall back to OWM or dynamic simulation
    if current_rainfall is None or cumulative_72h is None or soil_moisture is None or tide_level is None or is_monsoon is None:
        live_weather_success = False
        temp_rainfall = 0.0
        humidity = 85.0
        api_key = os.getenv("OPENWEATHER_API_KEY")
        if api_key and api_key != "your_api_key_here":
            try:
                w_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
                w_res = requests.get(w_url, timeout=4)
                if w_res.status_code == 200:
                    w_json = w_res.json()
                    if "rain" in w_json:
                        temp_rainfall = w_json["rain"].get("1h", w_json["rain"].get("3h", 0.0) / 3.0)
                    humidity = w_json.get("main", {}).get("humidity", 85.0)
                    live_weather_success = True
            except Exception:
                pass

        temp_is_monsoon = 1 if time.localtime().tm_mon in [10, 11, 12] else 0
        if is_monsoon is None:
            is_monsoon = temp_is_monsoon
            
        if current_rainfall is None:
            if live_weather_success:
                current_rainfall = temp_rainfall
            else:
                current_rainfall = 18.0 if is_monsoon == 1 else 0.0
                
        if cumulative_72h is None:
            cumulative_72h = current_rainfall * 4.2 + (80.0 if is_monsoon == 1 else 0.0)
            
        if soil_moisture is None:
            soil_moisture = min(1.0, 0.2 + (cumulative_72h / 240.0) + (humidity / 500.0))
            
        if tide_level is None:
            tide_level = 0.8 + 0.4 * np.sin(time.time() / 3600.0)

    
    # Execute predict.py wrapper logic
    try:
        pred_res = run_prediction(
            cumulative_rainfall_72h=cumulative_72h,
            current_rainfall_rate=current_rainfall,
            elevation=geo["elevation"],
            drainage_capacity=geo["drainage"],
            soil_moisture=soil_moisture,
            tide_level=tide_level,
            monsoon_season=is_monsoon,
            distance_to_river=geo["river_dist"]
        )
        
        # Append spatial identifiers
        pred_res["area"] = matched_area
        pred_res["coordinates"] = {"lat": lat, "lon": lon}
        pred_res["model_used"] = "XGBoost + LSTM ensemble"
        pred_res["prediction_timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Override values for consistency in reporting
        pred_res["rain_duration_hours"] = max(12, pred_res["rain_duration_hours"])
        
        return pred_res
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flood predictive calculation error: {str(e)}")

# Mount frontend files at root (placed after API routes to avoid shading)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

import uvicorn
if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
