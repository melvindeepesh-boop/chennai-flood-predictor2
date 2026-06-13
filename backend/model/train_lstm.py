import os
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import numpy as np

# Set random seeds for reproducibility
torch.manual_seed(42)
np.random.seed(42)

class RainfallLSTM(nn.Module):
    def __init__(self):
        super(RainfallLSTM, self).__init__()
        # First LSTM: 128 hidden units, outputs sequences (return_sequences=True equivalent)
        self.lstm1 = nn.LSTM(input_size=1, hidden_size=128, batch_first=True)
        # Second LSTM: 64 hidden units, outputs last sequence step (return_sequences=False equivalent)
        self.lstm2 = nn.LSTM(input_size=128, hidden_size=64, batch_first=True)
        # Dense layers
        self.fc1 = nn.Linear(64, 32)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(32, 7) # Predicts 7 intervals/values

    def forward(self, x):
        # x shape: (batch_size, seq_len, 1)
        out1, _ = self.lstm1(x) # out1 shape: (batch_size, seq_len, 128)
        out2, (hn, _) = self.lstm2(out1) # hn shape: (1, batch_size, 64)
        # We take the final step's output of the second LSTM
        last_step = out2[:, -1, :] # shape: (batch_size, 64)
        out = self.fc1(last_step)
        out = self.relu(out)
        out = self.fc2(out)
        return out

def train_lstm():
    print("Training PyTorch LSTM rainfall forecaster...")
    data_path = 'backend/data/chennai_rainfall_time_series.csv'
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Missing time-series rainfall data at: {data_path}. Generate data first.")
        
    df = pd.read_csv(data_path)
    rainfall_series = df['rainfall'].values
    n_samples = len(rainfall_series)
    
    seq_len = 72
    forecast_steps = [6, 12, 18, 24, 36, 48]
    max_step = 48
    limit = n_samples - seq_len - max_step
    
    X_list = []
    y_list = []
    
    for i in range(0, limit, 4):
        seq_in = rainfall_series[i : i + seq_len]
        
        targets = []
        for step in forecast_steps:
            targets.append(rainfall_series[i + seq_len + step - 1])
            
        future_window = rainfall_series[i + seq_len : i + seq_len + 48]
        rain_duration = float(np.sum(future_window > 0.1))
        targets.append(rain_duration)
        
        X_list.append(seq_in)
        y_list.append(targets)
        
    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    
    X = np.expand_dims(X, axis=-1) # (samples, 72, 1)
    
    print(f"Generated {X.shape[0]} sequences for LSTM training. Shape: {X.shape}")
    
    split = int(len(X) * 0.8)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    
    # Converters to PyTorch Tensors
    X_train_t = torch.tensor(X_train)
    y_train_t = torch.tensor(y_train)
    X_val_t = torch.tensor(X_val)
    y_val_t = torch.tensor(y_val)
    
    # Model, Loss, Optimizer
    model = RainfallLSTM()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    # Training Loop
    epochs = 50
    batch_size = 32
    n_train = len(X_train)
    
    print("Starting training process (50 epochs)...")
    for epoch in range(epochs):
        model.train()
        # Shuffle indices
        permutation = torch.randperm(n_train)
        epoch_loss = 0.0
        
        for i in range(0, n_train, batch_size):
            indices = permutation[i:i+batch_size]
            batch_x, batch_y = X_train_t[indices], y_train_t[indices]
            
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item() * batch_x.size(0)
            
        epoch_loss /= n_train
        
        # Validation
        model.eval()
        with torch.no_grad():
            val_outputs = model(X_val_t)
            val_loss = criterion(val_outputs, y_val_t).item()
            
        if (epoch + 1) % 5 == 0 or epoch == 0 or epoch == epochs - 1:
            print(f"Epoch {epoch+1:02d}/50 | Train MSE: {epoch_loss:.4f} | Val MSE: {val_loss:.4f}")
            
    # Save the model weights
    os.makedirs('backend/saved_models', exist_ok=True)
    model_path = 'backend/saved_models/lstm_rainfall_model.h5'
    torch.save(model.state_dict(), model_path)
    print(f"Saved trained LSTM PyTorch model weights to: {model_path}")

if __name__ == "__main__":
    train_lstm()
