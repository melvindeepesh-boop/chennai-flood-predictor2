import os
import pandas as pd
import numpy as np

# Hardcoded elevation and drainage table for Chennai areas
AREAS_DB = {
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
    "Manali": {"elevation": 3.0, "drainage": 0.22, "river_dist": 0.3, "lat": 13.1672, "lon": 80.2592}
}

def generate_data():
    print("Generating Chennai synthetic rainfall & geological time-series...")
    np.random.seed(42)
    
    # 2010 to 2023 (14 years) hourly timeline
    start_date = '2010-01-01 00:00:00'
    end_date = '2023-12-31 23:00:00'
    time_index = pd.date_range(start=start_date, end=end_date, freq='h')
    n_hours = len(time_index)
    print(f"Total timeframe: {n_hours} hours (~14 years).")
    
    # Generate base hourly rainfall time series
    # 1. Seasonality: NE monsoon is typically mid-October to December (months 10, 11, 12)
    monsoon_season = np.array([1 if m in [10, 11, 12] else 0 for m in time_index.month])
    
    # Base rain probability: 30% during monsoon, 2% otherwise
    rain_prob = np.where(monsoon_season == 1, 0.25, 0.015)
    is_raining = np.random.binomial(1, rain_prob)
    
    # Rainfall amount (mm/hr): log-normal distribution to simulate mostly light rain with occasional heavy downpours
    rain_amount = np.where(is_raining == 1, np.random.lognormal(mean=1.2, sigma=0.9, size=n_hours), 0.0)
    # Clip extreme outlier values to 100mm/hr max
    rain_amount = np.clip(rain_amount, 0.0, 100.0)
    
    # Inject specific historical flood events:
    # 1. Nov 2015 event: Nov 10 to Nov 15 (5 days) -> 250mm per day (~10.4 mm/hr)
    nov_2015_mask = (time_index.year == 2015) & (time_index.month == 11) & (time_index.day >= 10) & (time_index.day <= 15)
    rain_amount[nov_2015_mask] = np.random.uniform(8.0, 15.0, size=nov_2015_mask.sum())
    
    # 2. Dec 2021 event: Dec 1 to Dec 3 (3 days) -> 180mm per day (~7.5 mm/hr)
    dec_2021_mask = (time_index.year == 2021) & (time_index.month == 12) & (time_index.day >= 1) & (time_index.day <= 3)
    rain_amount[dec_2021_mask] = np.random.uniform(6.0, 12.0, size=dec_2021_mask.sum())
    
    # 3. Oct 2023 event: Oct 15 to Oct 17 (3 days) -> 120mm per day (~5.0 mm/hr)
    oct_2023_mask = (time_index.year == 2023) & (time_index.month == 10) & (time_index.day >= 15) & (time_index.day <= 17)
    rain_amount[oct_2023_mask] = np.random.uniform(4.0, 8.0, size=oct_2023_mask.sum())
    
    df_series = pd.DataFrame({
        'timestamp': time_index,
        'rainfall': rain_amount,
        'monsoon_season': monsoon_season
    })
    
    # Pre-calculate rolling 72-hour cumulative rainfall
    df_series['cumulative_rainfall_72h'] = df_series['rainfall'].rolling(window=72, min_periods=1).sum()
    
    # Create final zone-wise dataset
    records = []
    # To limit memory usage while training, we sample a subset of hours (e.g., all monsoonal hours, plus all hours where it rains, plus 5% of dry hours)
    keep_mask = (df_series['rainfall'] > 0) | (df_series['monsoon_season'] == 1) | (np.random.rand(n_hours) < 0.05)
    df_sampled = df_series[keep_mask].copy()
    print(f"Sampled hours for dataset: {len(df_sampled)} hours.")
    
    # Generate spatial records
    for area, geo in AREAS_DB.items():
        print(f"Adding spatial logs for: {area}")
        area_df = df_sampled.copy()
        area_df['area_name'] = area
        area_df['elevation'] = geo['elevation']
        area_df['drainage_capacity'] = geo['drainage']
        area_df['distance_to_river'] = geo['river_dist']
        
        # Soil moisture is highly correlated with rolling 72h rainfall
        # Max out moisture at 1.0, base moisture is 0.15 during monsoon and 0.05 in dry
        base_moisture = np.where(area_df['monsoon_season'] == 1, 0.2, 0.06)
        moisture = base_moisture + (area_df['cumulative_rainfall_72h'] / 180.0)
        area_df['soil_moisture'] = np.clip(moisture + np.random.normal(0, 0.05, len(area_df)), 0.0, 1.0)
        
        # Tide level: periodic fluctuation between 0.1m and 1.5m, slightly random
        # Convert hours to radial angles
        angles = (area_df['timestamp'].dt.hour + area_df['timestamp'].dt.minute/60.0) * (2 * np.pi / 12.0)
        tides = 0.8 + 0.5 * np.sin(angles) + np.random.normal(0, 0.1, len(area_df))
        area_df['tide_level'] = np.clip(tides, 0.0, 2.0)
        
        # Define logic for flood risk labeling (target)
        # Factors: high 72h cumulative rainfall, high current rain rate, low elevation, low drainage capacity, high tide, high soil moisture, proximity to river
        score = (
            (area_df['cumulative_rainfall_72h'] / 110.0) * 1.8 +
            (area_df['rainfall'] / 20.0) * 1.2 +
            (1.0 - (area_df['elevation'] / 22.0)) * 1.4 +
            (1.0 - area_df['drainage_capacity']) * 1.0 +
            (area_df['tide_level'] / 2.0) * 0.5 +
            area_df['soil_moisture'] * 0.6 +
            (1.0 / (area_df['distance_to_river'] + 0.2)) * 0.5
        )
        
        # Risk class mapping
        # Score thresholds:
        # Safe (< 2.8)
        # Low Risk (2.8 to 4.5)
        # High Risk (>= 4.5)
        risk_class = np.where(score >= 4.5, 2, np.where(score >= 2.8, 1, 0))
        
        # Specific historical logic override for Nov 2015:
        # Nov 2015 event: low elevation areas (< 6m) must be marked as High Risk (2)
        nov_2015_mask_area = (area_df['timestamp'].dt.year == 2015) & (area_df['timestamp'].dt.month == 11) & (area_df['timestamp'].dt.day >= 12) & (area_df['timestamp'].dt.day <= 15) & (geo['elevation'] <= 6.0)
        risk_class[nov_2015_mask_area] = 2
        
        area_df['risk_class'] = risk_class
        
        # Flood probability calculated as a soft sigmoid of the score
        # Shift and scale score to map between 0% and 100%
        prob = 100 / (1 + np.exp(-(score - 3.2) * 1.7))
        area_df['flood_probability'] = np.clip(prob + np.random.normal(0, 2, len(area_df)), 0.0, 100.0).round().astype(int)
        
        records.append(area_df)
        
    df_final = pd.concat(records, ignore_index=True)
    
    # Save files
    os.makedirs('backend/data', exist_ok=True)
    df_final.to_csv('backend/data/chennai_synthetic_data.csv', index=False)
    print("XGBoost training data successfully written to backend/data/chennai_synthetic_data.csv")
    
    # Save the continuous raw time series for LSTM training (contains only timestamp and rainfall rate)
    df_series.to_csv('backend/data/chennai_rainfall_time_series.csv', index=False)
    print("LSTM training time-series successfully written to backend/data/chennai_rainfall_time_series.csv")

if __name__ == "__main__":
    generate_data()
