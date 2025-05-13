from flask import Blueprint, request, jsonify
from app.models import SpamDetector
import os

# Create blueprint
api = Blueprint('api', __name__)

# Initialize and load model
detector = SpamDetector()
model_dir = "./app/models/saved"

# Check if model exists, if not train and save it
if not os.path.exists(os.path.join(model_dir, "spam_model.pkl")):
    print("Training model...")
    detector.train()
    detector.save_model()
    print(f"Model trained with accuracy: {detector.accuracy}")
else:
    print("Loading pre-trained model...")
    detector.load_model()

@api.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "message": "Spam detection service is running"
    })

@api.route('/predict', methods=['POST'])
def predict_spam():
    """Predict if a message is spam or not"""
    if not request.json or 'message' not in request.json:
        return jsonify({
            "error": "Invalid request, 'message' field is required"
        }), 400
    
    message = request.json['message']
    
    try:
        result = detector.predict(message)
        return jsonify({
            "message": message,
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "is_spam": result["prediction"] == "Spam"
        })
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

@api.route('/train', methods=['POST'])
def train_model():
    """Endpoint to retrain the model"""
    try:
        accuracy = detector.train()
        detector.save_model()
        return jsonify({
            "success": True,
            "message": "Model trained successfully",
            "accuracy": accuracy
        })
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500 