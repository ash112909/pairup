from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity

def require_user_type(allowed_types):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            from models import User
            current_user_id = get_jwt_identity()
            user = User.objects.get(id=current_user_id)
            if user.user_type not in allowed_types:
                return jsonify({
                    "success": False,
                    "message": f"Access denied. Required user type: {', '.join(allowed_types)}"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def require_complete_profile(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        from models import User
        current_user_id = get_jwt_identity()
        user = User.objects.get(id=current_user_id)
        
        required_fields = ['name', 'user_type', 'bio', 'experience', 'location']
        missing_fields = [field for field in required_fields if not getattr(user, field)]
        
        if not user.categories:
            missing_fields.append('categories')
            
        if missing_fields:
            return jsonify({
                "success": False,
                "message": "Please complete your profile before accessing this feature.",
                "missingFields": missing_fields
            }), 400
        return fn(*args, **kwargs)
    return wrapper