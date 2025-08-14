from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import create_access_token, jwt_required
from models import User
from bson import ObjectId # Import ObjectId

auth_bp = Blueprint('auth', __name__)

def convert_objectids_to_strings(obj):
    """Recursively converts ObjectId instances in a dictionary or list to strings."""
    if isinstance(obj, dict):
        return {k: convert_objectids_to_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectids_to_strings(elem) for elem in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    return obj

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    user_type = data.get('userType') # <--- Changed from 'user_type' to 'userType'
    
    if not email or not password or not user_type:
        return jsonify({"success": False, "message": "Email, password, and user type are required"}), 400
    
    if User.objects(email=email).first():
        return jsonify({"success": False, "message": "Email already registered"}), 400
        
    try:
        # Note: User model still expects 'user_type' (snake_case) due to MongoEngine field definition.
        # So we pass 'user_type=user_type' which uses the 'user_type' variable from data.get('userType').
        user = User(email=email, password=password, user_type=user_type, name=data.get('name')) # Pass name too
        user.save()
        
        # Omit password from the response and convert ObjectIds
        user_data = user.to_mongo().to_dict()
        user_data.pop('password', None)
        user_data = convert_objectids_to_strings(user_data) # Apply conversion
        
        return jsonify({
            "success": True,
            "message": "User registered successfully",
            "user": user_data,
            "profileCompletion": user.profile_completion # Include profileCompletion
        }), 201
    except Exception as e:
        # Log the full error for debugging
        print(f"Registration error: {e}")
        return jsonify({"success": False, "message": f"Registration failed: {str(e)}"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400
        
    user = User.objects(email=email).first()
    
    if user and user.compare_password(password):
        access_token = create_access_token(identity=str(user.id))
        
        # Prepare user data for response, removing sensitive info like password and converting ObjectIds
        user_data = user.to_mongo().to_dict()
        user_data.pop('password', None)
        user_data = convert_objectids_to_strings(user_data) # Apply conversion
        
        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": access_token,
            "user": user_data, # Include the user object
            "profileCompletion": user.profile_completion # Include profile completion
        }), 200
    else:
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

@auth_bp.route('/me', methods=['GET'])
@jwt_required() # This route still requires a valid JWT
def get_current_user_profile():
    try:
        # g.user is populated by the global @app.before_request decorator in app.py
        user = g.user
        
        if not user:
            return jsonify({"success": False, "message": "User not found"}), 404
        
        # Prepare user data for response, removing sensitive info like password and converting ObjectIds
        user_data = user.to_mongo().to_dict()
        user_data.pop('password', None)
        user_data = convert_objectids_to_strings(user_data) # Apply conversion
        
        return jsonify({
            "success": True,
            "user": user_data,
            "profileCompletion": user.profile_completion
        }), 200
    except Exception as e:
        print(f"Get current user profile error: {e}")
        return jsonify({"success": False, "message": "Server error while fetching profile"}), 500

