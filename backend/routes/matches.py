# backend/routes/matches.py
from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required  # use if you want to require auth
from models import User  # assumes you already have this model

matches_bp = Blueprint('matches', __name__)

def _serialize_user(u):
    # Map to the shape your frontend expects
    return {
        "_id": str(u.id),
        "name": getattr(u, "name", "Unknown"),
        "avatar": getattr(u, "avatar", "👤"),
        "userType": getattr(u, "user_type", getattr(u, "userType", "contributor")),
        "categories": list(getattr(u, "categories", [])),
        "bio": getattr(u, "bio", ""),
        "experience": getattr(u, "experience", ""),
        "location": getattr(u, "location", ""),
        "completedProjects": getattr(u, "completed_projects", 0),
        "rating": {
            "average": float(getattr(u, "rating_average", 0.0))
        }
    }

@matches_bp.route("/discover", methods=["GET", "OPTIONS"])
def discover():
    """Return a list of candidate matches. Public for now; lock down with @jwt_required() if needed."""
    try:
        limit = int(request.args.get("limit", 10))
    except ValueError:
        limit = 10

    users = []
    try:
        # Exclude current user if available (g.user is set by your before_request)
        q = User.objects
        if getattr(g, "user", None):
            q = q.filter(id__ne=g.user.id)
        users = q.limit(limit)
    except Exception:
        # If DB not ready, fall back to an empty list (or mock)
        users = []

    matches = []
    for u in users:
        matches.append({
            "user": _serialize_user(u),
            "compatibilityScore": 87,  # placeholder; replace with your logic
            "matchDetails": {"reasonForMatch": "Shared categories & interests"}
        })

    return jsonify({"success": True, "matches": matches})

@matches_bp.route("/like", methods=["POST", "OPTIONS"])
# @jwt_required()   # enable if you want to force auth
def like():
    data = request.get_json(silent=True) or {}
    target_user_id = data.get("targetUserId")
    project_id = data.get("projectId")
    # TODO: persist the like; for now just ack
    return jsonify({"success": True, "liked": target_user_id, "projectId": project_id})

@matches_bp.route("/pass", methods=["POST", "OPTIONS"])
# @jwt_required()
def pass_user():
    data = request.get_json(silent=True) or {}
    target_user_id = data.get("targetUserId")
    # TODO: persist the pass; for now just ack
    return jsonify({"success": True, "passed": target_user_id})

@matches_bp.route("/my-matches", methods=["GET", "OPTIONS"])
# @jwt_required()
def my_matches():
    status = request.args.get("status", "mutual")
    # TODO: return real mutual matches; placeholder shape matches your frontend
    return jsonify({
        "success": True,
        "matches": [
            # Example skeleton — keep empty list if you prefer
            # {
            #   "_id": "match-id-1",
            #   "otherUser": _serialize_user(some_user),
            #   "compatibilityScore": 92,
            #   "conversation": {"started": False}
            # }
        ]
    })
