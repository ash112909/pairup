from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required # Keep jwt_required for route decorators
from models import User
from middleware import require_complete_profile
from mongoengine.queryset.visitor import Q
from bson import ObjectId # Import ObjectId for serialization

users_bp = Blueprint('users', __name__)

def convert_objectids_to_strings(obj):
    """Recursively converts ObjectId instances in a dictionary or list to strings."""
    if isinstance(obj, dict):
        return {k: convert_objectids_to_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectids_to_strings(elem) for elem in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    return obj

@users_bp.route('/profile', methods=['GET'])
@jwt_required() # This decorator enforces authentication for this route
def get_profile():
    try:
        # g.user is now populated by the global app.before_request in app.py
        user = g.user
        if not user: # Safety check
            return jsonify({"success": False, "message": "User not found."}), 404

        user_dict = user.to_mongo().to_dict()
        user_dict.pop('password', None)
        user_dict = convert_objectids_to_strings(user_dict) # Apply conversion
        
        return jsonify({
            "success": True,
            "user": user_dict,
            "profileCompletion": user.profile_completion
        })
    except Exception as e:
        print(f"Server error in get_profile: {e}") # Added error logging
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@users_bp.route('/profile', methods=['PUT'])
@jwt_required() # This decorator enforces authentication for this route
def update_profile():
    data = request.get_json()
    user = g.user # g.user is populated by the global app.before_request in app.py
    
    if not user: # Safety check
        return jsonify({"success": False, "message": "User not found or not authenticated."}), 404

    allowed_updates = [
        'name', 'user_type', 'categories', 'subcategories', 'bio', 'experience',
        'availability', 'location', 'avatar', 'skills', 'portfolio', 'preferences'
    ]
    
    update_data = {key: data[key] for key in data if key in allowed_updates}
    
    try:
        user.update(**update_data)
        user.reload()
        
        user_dict = user.to_mongo().to_dict()
        user_dict.pop('password', None)
        user_dict = convert_objectids_to_strings(user_dict) # Apply conversion here
        
        return jsonify({
            "success": True,
            "message": "Profile updated successfully",
            "user": user_dict,
            "profileCompletion": user.profile_completion
        })
    except Exception as e:
        print(f"Server error in update_profile: {e}") # Added error logging
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@users_bp.route('/<user_id>', methods=['GET'])
@jwt_required(optional=True) # User ID route might be publicly viewable, but shows more if authenticated
def get_user_profile(user_id):
    try:
        user = User.objects.get(id=user_id)
        
        user_data = user.to_public_dict()
        # Ensure ObjectIds are converted to strings in the public dict
        user_data = convert_objectids_to_strings(user_data) 

        return jsonify({
            "success": True,
            "user": user_data
        })
    except User.DoesNotExist:
        return jsonify({"success": False, "message": "User not found"}), 404
    except Exception as e:
        print(f"Server error in get_user_profile: {e}") # Added error logging
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@users_bp.route('/search', methods=['GET'])
@jwt_required() # This route requires authentication
@require_complete_profile
def search_users():
    try:
        query_params = request.args
        query = query_params.get('query')
        page = int(query_params.get('page', 1))
        limit = int(query_params.get('limit', 20))
        
        q_object = Q(is_active=True, id__ne=g.user.id)
        
        if query:
            q_object &= Q(name__icontains=query) | Q(bio__icontains=query) | Q(skills__name__icontains=query)
            
        if query_params.get('category'):
            q_object &= Q(categories=query_params['category'])
        if query_params.get('userType'):
            q_object &= Q(user_type=query_params['userType'])
        if query_params.get('location'):
            q_object &= Q(location__icontains=query_params['location'])
        if query_params.get('minRating'):
            q_object &= Q(rating__average__gte=float(query_params['minRating']))
            
        users = User.objects(q_object).order_by('-rating.average', '-last_active').skip((page - 1) * limit).limit(limit)
        total = User.objects(q_object).count()

        users_list = [convert_objectids_to_strings(u.to_public_dict()) for u in users] # Apply conversion

        return jsonify({
            "success": True,
            "users": users_list,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        })
    except Exception as e:
        print(f"Server error in search_users: {e}") # Added error logging
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

# Additional routes for skills, portfolio, deactivate, etc.
