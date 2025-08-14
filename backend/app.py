import os
from flask import Flask, jsonify, g, request
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, exceptions, verify_jwt_in_request # Import verify_jwt_in_request
from mongoengine import connect
from flask_cors import CORS
from dotenv import load_dotenv

from config import Config
from models import User
from routes import auth, projects, users

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# Configure CORS to allow requests from the CLIENT_URL
# This ensures that your frontend's origin is explicitly allowed.
CORS(app, resources={r"/api/*": {"origins": app.config['CLIENT_URL']}})

# Initialize extensions
jwt = JWTManager(app)

# User lookup loader for Flask-JWT-Extended - REGISTERED GLOBALLY
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return User.objects(id=identity).first()

# Global before_request to load user into Flask's `g` object for all authenticated requests
@app.before_request
def before_request_auth():
    g.user = None # Initialize g.user to None
    try:
        # Verify JWT in the request. If optional=True, it won't raise an error if no token is present.
        # It returns True if a token was present and valid, False otherwise.
        # It also populates the JWT context for get_jwt_identity().
        is_jwt_present = verify_jwt_in_request(optional=True)
        
        if is_jwt_present:
            current_user_id = get_jwt_identity()
            if current_user_id:
                g.user = User.objects(id=current_user_id).first()
    except exceptions.NoAuthorizationError:
        # This exception should ideally not be hit with optional=True, but as a fallback.
        pass
    except Exception as e:
        # Catch any other unexpected errors during JWT processing or user lookup
        print(f"Error during JWT processing or user lookup: {e}")
        pass

# Connect to MongoDB
connect(**app.config['MONGODB_SETTINGS'])

# Register blueprints
app.register_blueprint(auth.auth_bp, url_prefix='/api/auth')
app.register_blueprint(projects.projects_bp, url_prefix='/api/projects')
app.register_blueprint(users.users_bp, url_prefix='/api/users')

@app.route('/')
def home():
    return "Pairup Backend API is running!"

# Custom error handler for JWT errors
@app.errorhandler(401)
def handle_auth_error(e):
    return jsonify({
        "success": False,
        "message": "Authentication failed",
        "error": str(e)
    }), 401

if __name__ == '__main__':
    app.run(debug=True, port=5001)

