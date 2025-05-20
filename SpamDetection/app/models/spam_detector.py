import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
import joblib
import os

class SpamDetector:
    def __init__(self):
        self.model = None
        self.vectorizer = None
        self.accuracy = None
    
    def train(self, data_path="./data/spam.csv"):
        """Train the spam detection model"""
        # Load and preprocess data
        data = pd.read_csv(data_path)
        data.drop_duplicates(inplace=True)
        data.dropna(inplace=True)
        data['Category'] = data['Category'].replace(['ham', 'spam'], ['Not Spam', 'Spam'])
        
        # Split data
        message = data['Message']
        cat = data['Category']
        message_train, message_test, cat_train, cat_test = train_test_split(message, cat, test_size=0.2, random_state=42)
        
        # Vectorize text
        self.vectorizer = CountVectorizer(stop_words='english')
        message_train_cv = self.vectorizer.fit_transform(message_train)
        message_test_cv = self.vectorizer.transform(message_test)
        
        # Train model
        self.model = MultinomialNB()
        self.model.fit(message_train_cv, cat_train)
        
        # Calculate accuracy
        self.accuracy = self.model.score(message_test_cv, cat_test)
        return self.accuracy
    
    def predict(self, message):
        """Predict if a message is spam or not"""
        if not self.model or not self.vectorizer:
            raise ValueError("Model not trained. Call train() first.")
        
        vectorized_message = self.vectorizer.transform([message])
        prediction = self.model.predict(vectorized_message)[0]
        confidence = max(self.model.predict_proba(vectorized_message)[0])
        
        return {
            "prediction": prediction,
            "confidence": float(confidence)
        }
    
    def save_model(self, model_dir="./app/models/saved"):
        """Save the trained model and vectorizer"""
        if not self.model or not self.vectorizer:
            raise ValueError("Model not trained. Call train() first.")
            
        os.makedirs(model_dir, exist_ok=True)
        joblib.dump(self.model, os.path.join(model_dir, "spam_model.pkl"))
        joblib.dump(self.vectorizer, os.path.join(model_dir, "vectorizer.pkl"))
    
    def load_model(self, model_dir="./app/models/saved"):
        """Load a trained model and vectorizer"""
        model_path = os.path.join(model_dir, "spam_model.pkl")
        vectorizer_path = os.path.join(model_dir, "vectorizer.pkl")
        
        if not os.path.exists(model_path) or not os.path.exists(vectorizer_path):
            raise FileNotFoundError("Model files not found. Train and save the model first.")
            
        self.model = joblib.load(model_path)
        self.vectorizer = joblib.load(vectorizer_path) 