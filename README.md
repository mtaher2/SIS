# Spam Detection API

A Flask-based REST API service for spam detection, designed to be integrated with Flutter applications.

## How It Works

The spam detection system uses a Naive Bayes machine learning model to classify text messages as spam or legitimate. When a client sends a message to the API endpoint, the system:

1. Preprocesses the text (normalizes, removes stop words)
2. Extracts features from the text
3. Passes these features to the trained model
4. Returns the classification result (spam/not spam) with a confidence score

The API can be accessed via HTTP requests, making it easy to integrate with Flutter applications.

## API Endpoints

- `GET /api/health` - Check if service is running
- `POST /api/predict` - Submit a message for spam classification
- `POST /api/train` - Retrain the ML model with new data
