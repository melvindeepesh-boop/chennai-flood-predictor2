import os
import joblib
import pandas as pd
import numpy as np
from backend.model.shap_explain import get_shap_explanations

# 1. Load XGBoost model FIRST (to initialize OpenMP thread settings safely before PyTorch imports)
_xgb_model = None
xgb_path = 'backend/saved_models/xgboost_flood_model.pkl'
if os.path.exists(xgb_path):
    _xgb_model = joblib.load(xgb_path)
    print("XGBoost model loaded into memory.")

# 2. Import PyTorch libraries safely now
import torch
torch.set_num_threads(1)
import torch.nn as nn


# PyTorch LSTM Model Class Definition matching train_lstm.py
class RainfallLSTM(nn.Module):
    def __init__(self):
        super(RainfallLSTM, self).__init__()
        self.lstm1 = nn.LSTM(input_size=1, hidden_size=128, batch_first=True)
        self.lstm2 = nn.LSTM(input_size=128, hidden_size=64, batch_first=True)
        self.fc1 = nn.Linear(64, 32)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(32, 7)

    def forward(self, x):
        out1, _ = self.lstm1(x)
        out2, (hn, _) = self.lstm2(out1)
        last_step = out2[:, -1, :]
        out = self.fc1(last_step)
        out = self.relu(out)
        out = self.fc2(out)
        return out

# Cache loaded models in memory
_lstm_model = None


def load_models():
    global _xgb_model, _lstm_model
    
    xgb_path = 'backend/saved_models/xgboost_flood_model.pkl'
    lstm_path = 'backend/saved_models/lstm_rainfall_model.h5'
    
    if _xgb_model is None and os.path.exists(xgb_path):
        _xgb_model = joblib.load(xgb_path)
        print("XGBoost model loaded into memory.")
        
    if _lstm_model is None and os.path.exists(lstm_path):
        # Instantiate model architecture and load PyTorch weights state dict
        model = RainfallLSTM()
        # map_location='cpu' is critical for compatibility across different servers/CPU arches
        state_dict = torch.load(lstm_path, map_location=torch.device('cpu'))
        model.load_state_dict(state_dict)
        model.eval() # Set model to evaluation mode
        _lstm_model = model
        print("LSTM PyTorch model weights loaded into memory.")
        
    return _xgb_model, _lstm_model

def simulate_past_72h_rainfall(cumulative_72h, current_rate):
    """
    Synthesize a realistic 72-hour hourly rainfall vector that:
    - Sums to cumulative_72h
    - Ends at current_rate (last element)
    """
    history = np.zeros(72)
    history[-1] = current_rate
    
    remaining = cumulative_72h - current_rate
    if remaining <= 0:
        return history
        
    # Generate random monsoonal peaks over the last 72 hours
    weights = np.random.uniform(0.1, 1.0, 71)
    weights = weights * np.linspace(0.2, 1.0, 71)
    weights = weights / np.sum(weights)
    
    history[:-1] = weights * remaining
    return history

def run_prediction(
    cumulative_rainfall_72h: float,
    current_rainfall_rate: float,
    elevation: float,
    drainage_capacity: float,
    soil_moisture: float,
    tide_level: float,
    monsoon_season: int,
    distance_to_river: float
) -> dict:
    """
    Executes ensemble inference (XGBoost + LSTM) for a given location snapshot.
    """
    xgb_model, lstm_model = load_models()
    
    if xgb_model is None or lstm_model is None:
        raise RuntimeError("Ensemble models are not trained or missing in saved_models/")
        
    # 1. XGBoost Classifier Prediction
    input_dict = {
        'cumulative_rainfall_72h': cumulative_rainfall_72h,
        'rainfall': current_rainfall_rate,
        'elevation': elevation,
        'drainage_capacity': drainage_capacity,
        'soil_moisture': soil_moisture,
        'tide_level': tide_level,
        'monsoon_season': monsoon_season,
        'distance_to_river': distance_to_river
    }
    input_df = pd.DataFrame([input_dict])
    
    probabilities = xgb_model.predict_proba(input_df)[0]
    flood_prob = int(round(probabilities[2] * 100))  # Class 2: High Risk probability
    
    if flood_prob >= 75:
        risk_class = 3
        risk_level = "Severe Risk"
    elif flood_prob >= 50:
        risk_class = 2
        risk_level = "High Risk"
    elif flood_prob >= 25:
        risk_class = 1
        risk_level = "Moderate Risk"
    else:
        risk_class = 0
        risk_level = "Low Risk"
    
    # 2. PyTorch LSTM Forecast
    history_72h = simulate_past_72h_rainfall(cumulative_rainfall_72h, current_rainfall_rate)
    
    # Prepare PyTorch input tensor with shape (batch_size=1, seq_len=72, input_size=1)
    lstm_input_np = np.expand_dims(history_72h, axis=(0, -1)).astype(np.float32)
    lstm_input_t = torch.tensor(lstm_input_np)
    
    with torch.no_grad():
        lstm_pred_t = lstm_model(lstm_input_t)
        lstm_pred = lstm_pred_t.numpy()[0]
        
    # Keep predictions non-negative
    lstm_pred = np.clip(lstm_pred, 0.0, None)
    
    forecast_6h = float(lstm_pred[0])
    forecast_12h = float(lstm_pred[1])
    forecast_18h = float(lstm_pred[2])
    forecast_24h = float(lstm_pred[3])
    forecast_36h = float(lstm_pred[4])
    forecast_48h = float(lstm_pred[5])
    predicted_duration = float(lstm_pred[6])
    
    # Compile 48h forecast intervals
    forecast_times = ["6h", "12h", "18h", "24h", "36h", "48h"]
    forecast_rates = [forecast_6h, forecast_12h, forecast_18h, forecast_24h, forecast_36h, forecast_48h]
    
    forecast_list = [{"time": "Now", "rainfall_mm": round(current_rainfall_rate, 1), "risk_pct": flood_prob}]
    
    # Estimate forecast risk percentages
    for t_lbl, rate in zip(forecast_times, forecast_rates):
        future_cum = cumulative_rainfall_72h + rate
        future_input = pd.DataFrame([{
            'cumulative_rainfall_72h': future_cum,
            'rainfall': rate,
            'elevation': elevation,
            'drainage_capacity': drainage_capacity,
            'soil_moisture': min(1.0, soil_moisture + (rate / 150.0)),
            'tide_level': tide_level,
            'monsoon_season': monsoon_season,
            'distance_to_river': distance_to_river
        }])
        f_prob = int(round(xgb_model.predict_proba(future_input)[0][2] * 100))
        forecast_list.append({
            "time": t_lbl,
            "rainfall_mm": round(rate, 1),
            "risk_pct": f_prob
        })
        
    # 3. SHAP Explanations
    shap_reasons = get_shap_explanations(input_df)
    
    # 4. Warnings and Consequences
    consequences = []
    if risk_class == 3:
        consequences = [
            "Severe waterlogging on roads — avoid all travel",
            "Ground floor flooding likely — move valuables above 3ft immediately",
            "Do not start vehicles in flooded zones",
            "Switch off mains power if water enters home",
            "Follow NDRF and local corporation evacuation alerts"
        ]
    elif risk_class == 2:
        consequences = [
            "High risk of waterlogging on secondary road networks",
            "Drainage systems operating at critical capacity",
            "Drive with caution; watch for open stormwater drains",
            "Check basements for seepage and run pumps if needed"
        ]
    elif risk_class == 1:
        consequences = [
            "Moderate risk of localized waterlogging in low-lying areas",
            "Drains filling; check local culverts for blockages",
            "Exercise caution during peak travel hours"
        ]
    else:
        consequences = [
            "Low risk of flood conditions; area operating normally",
            "Stay alert for general monsoon updates",
            "Ensure roof drain pipes are clear of debris"
        ]
        
    total_rainfall_expected = float(current_rainfall_rate + sum(forecast_rates))
    peak_intensity = float(max([current_rainfall_rate] + forecast_rates))
    
    return {
        "elevation_m": int(round(elevation)),
        "drainage_capacity": float(round(drainage_capacity, 2)),
        "risk_level": risk_level,
        "risk_class": risk_class,
        "flood_probability": flood_prob,
        "rain_duration_hours": int(round(predicted_duration)),
        "total_rainfall_expected": int(round(total_rainfall_expected)),
        "peak_intensity_mmhr": int(round(peak_intensity)),
        "current_rainfall_mmhr": int(round(current_rainfall_rate)),
        "forecast": forecast_list,
        "shap_reasons": shap_reasons,
        "consequences": consequences
    }
