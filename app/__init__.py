from flask import Flask
from flask_cors import CORS

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app)  # Enable CORS for Flutter integration
    
    # Register blueprints
    from app.api.routes import api
    app.register_blueprint(api, url_prefix='/api')
    
    return app 