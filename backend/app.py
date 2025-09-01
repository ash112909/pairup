import os
from flask import Flask, jsonify, g, request
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, exceptions, verify_jwt_in_request # Import verify_jwt_in_request
from mongoengine import connect
from flask_cors import CORS
from dotenv import load_dotenv

from config import Config
from models import User
from routes import auth, projects, users
from routes import matches  # <-- add

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)

# --- CORS (robust for local dev) ---
client_origins = {
    os.getenv("CLIENT_URL", "http://localhost:3000"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}

from flask_cors import CORS
CORS(
    app,
    resources={r"/api/*": {
        "origins": list(client_origins),
        "supports_credentials": False,  # keep False since you're using Authorization header, not cookies
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type"],
        "max_age": 600,  # cache preflight for 10 minutes
    }},
)

@app.route("/api/<path:subpath>", methods=["OPTIONS"])
def api_preflight(subpath):
    # Let Flask-CORS fill headers; explicit 204 helps some clients
    return ("", 204)

@app.after_request
def add_cors_headers(resp):
    # Always echo ACAO for API routes so even 4xx/5xx show real errors
    if request.path.startswith("/api/"):
        origin = request.headers.get("Origin")
        if origin in client_origins:
            resp.headers.setdefault("Access-Control-Allow-Origin", origin)
            resp.headers.setdefault("Vary", "Origin")
            resp.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
            resp.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            resp.headers.setdefault("Access-Control-Max-Age", "600")
    return resp


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
    g.user = None
    try:
        # This validates the token if present (and does nothing if missing),
        # but it does NOT return a boolean.
        verify_jwt_in_request(optional=True)

        # If a valid JWT was present, identity will be set; otherwise None.
        current_user_id = get_jwt_identity()
        if current_user_id:
            g.user = User.objects(id=current_user_id).first()
    except exceptions.NoAuthorizationError:
        # optional=True should prevent this, but keep as guard.
        pass
    except Exception as e:
        print(f"Error during JWT processing or user lookup: {e}")
        pass


# Connect to MongoDB
connect(**app.config['MONGODB_SETTINGS'])

# Register blueprints
app.register_blueprint(auth.auth_bp, url_prefix='/api/auth')
app.register_blueprint(projects.projects_bp, url_prefix='/api/projects')
app.register_blueprint(users.users_bp, url_prefix='/api/users')
app.register_blueprint(matches.matches_bp, url_prefix='/api/matches')  # <-- add

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

