import os
import joblib
import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

def train_model():
    print("Training XGBoost flood risk classifier...")
    data_path = 'backend/data/chennai_synthetic_data.csv'
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Missing training data at: {data_path}. Generate data first.")
        
    df = pd.read_csv(data_path)
    
    # Input features (8 features as specified)
    feature_cols = [
        'cumulative_rainfall_72h',
        'rainfall',
        'elevation',
        'drainage_capacity',
        'soil_moisture',
        'tide_level',
        'monsoon_season',
        'distance_to_river'
    ]
    
    X = df[feature_cols]
    y = df['risk_class']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    # XGBClassifier with specifications
    clf = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='mlogloss'
    )
    
    clf.fit(X_train, y_train)
    
    # Metrics
    y_pred = clf.predict(X_test)
    
    print("\n=== CLASSIFICATION REPORT ===")
    print(classification_report(y_test, y_pred))
    
    print("=== CONFUSION MATRIX ===")
    conf_mat = confusion_matrix(y_test, y_pred)
    print(conf_mat)
    
    # Calculate Probability of Detection (POD) on High Risk events (class 2)
    # POD = TP / (TP + FN)
    tp = conf_mat[2, 2]
    fn = conf_mat[2, 0] + conf_mat[2, 1]
    pod = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    print(f"\nProbability of Detection (POD) for High Risk: {pod:.4f}")
    
    accuracy = (y_pred == y_test).mean()
    print(f"Overall Accuracy: {accuracy:.4f}")
    
    # Save the model
    os.makedirs('backend/saved_models', exist_ok=True)
    model_path = 'backend/saved_models/xgboost_flood_model.pkl'
    joblib.dump(clf, model_path)
    print(f"Saved trained XGBoost model to: {model_path}")
    
    # November 2015 Chennai Flood Validation:
    # 250mm/day for 3 days = 750mm cumulative, 10.4 mm/hr current, soil saturated (1.0), high tides (1.2m), monsoon (1)
    print("\n=== HISTORICAL FLOOD VALIDATION (NOV 2015 DELUGE) ===")
    
    test_areas = {
        "Velachery": {"elevation": 5.0, "drainage": 0.30, "river_dist": 1.5},
        "Adyar": {"elevation": 4.0, "drainage": 0.25, "river_dist": 0.2},
        "Sholinganallur": {"elevation": 3.0, "drainage": 0.20, "river_dist": 0.8},
        "Pallikaranai": {"elevation": 2.0, "drainage": 0.18, "river_dist": 0.4}
    }
    
    for area, geo in test_areas.items():
        sample_input = pd.DataFrame([{
            'cumulative_rainfall_72h': 750.0,
            'rainfall': 10.4,
            'elevation': geo['elevation'],
            'drainage_capacity': geo['drainage'],
            'soil_moisture': 1.0,
            'tide_level': 1.2,
            'monsoon_season': 1,
            'distance_to_river': geo['river_dist']
        }])
        
        pred_class = clf.predict(sample_input)[0]
        pred_prob = clf.predict_proba(sample_input)[0]
        
        risk_labels = {0: "Safe", 1: "Low Risk", 2: "High Risk"}
        print(f"Area: {area:<16} | Predicted: {risk_labels[pred_class]:<12} | Probability (High Risk): {pred_prob[2]*100:.1f}%")
        
        # Verify prediction meets "High Risk" constraint
        assert pred_class == 2, f"Validation Failed: {area} was not predicted as High Risk!"
        
    print("All 2015 deluge validations successfully resolved as High Risk.")

if __name__ == "__main__":
    train_model()
