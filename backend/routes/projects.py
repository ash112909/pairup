from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, Project
from middleware import require_user_type, require_complete_profile
from mongoengine.queryset.visitor import Q
from bson import ObjectId # Import ObjectId for serialization

projects_bp = Blueprint('projects', __name__)

def convert_objectids_to_strings(obj):
    """Recursively converts ObjectId instances in a dictionary or list to strings."""
    if isinstance(obj, dict):
        return {k: convert_objectids_to_strings(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_objectids_to_strings(elem) for elem in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    return obj

@projects_bp.route('/', methods=['POST'])
@jwt_required() # Enforce authentication
@require_user_type(['creator', 'both'])
@require_complete_profile
def create_project():
    data = request.get_json()
    
    required_fields = ['title', 'description', 'category', 'subcategory', 'team_size'] # Note: teamSize vs team_size
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "message": f"{field} is required"}), 400
            
    try:
        # Ensure team_size is handled correctly, it's an embedded document
        team_size_data = data.get('team_size')
        if team_size_data and isinstance(team_size_data, dict):
            # Create an instance of the embedded document
            data['team_size'] = TeamSize(**team_size_data)
        else:
            return jsonify({"success": False, "message": "team_size is required and must be an object"}), 400

        project = Project(**data, creator=g.user.id) # g.user is populated by global app.before_request
        project.save()
        
        project_dict = project.to_mongo().to_dict()
        project_dict = convert_objectids_to_strings(project_dict) # Apply conversion
        
        return jsonify({
            "success": True,
            "message": "Project created successfully",
            "project": project_dict
        }), 201
    except Exception as e:
        print(f"Server error in create_project: {e}")
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@projects_bp.route('/', methods=['GET'])
@jwt_required() # Enforce authentication
@require_complete_profile
def get_projects():
    try:
        query_params = request.args
        page = int(query_params.get('page', 1))
        limit = int(query_params.get('limit', 20))
        sort_by = query_params.get('sortBy', 'created_at')
        sort_order = query_params.get('sortOrder', 'desc')
        
        q_object = Q(is_public=True)
        
        if query_params.get('category'):
            q_object &= Q(category=query_params['category'])
        if query_params.get('subcategory'):
            q_object &= Q(subcategory=query_params['subcategory'])
        if query_params.get('status'):
            q_object &= Q(status=query_params['status'])
        if query_params.get('location'):
            q_object &= Q(location__icontains=query_params['location'])
        if query_params.get('workStyle'):
            q_object &= Q(work_style=query_params['workStyle'])
        if query_params.get('featured') == 'true':
            q_object &= Q(featured=True)
            
        if query_params.get('search'):
            q_object &= Q(__raw__={
                '$text': {'$search': query_params['search']}
            })

        if query_params.get('excludeOwn') != 'false':
            q_object &= Q(creator__ne=g.user.id)
            
        sort_field = f'-{sort_by}' if sort_order == 'desc' else sort_by
        
        total = Project.objects(q_object).count()
        projects = Project.objects(q_object).order_by(sort_field).skip((page - 1) * limit).limit(limit)

        projects_with_scores = []
        for project in projects:
            score = project.calculate_match_score(g.user)
            project_dict = project.to_mongo().to_dict()
            project_dict['matchScore'] = score
            projects_with_scores.append(project_dict)
        
        projects_with_scores = convert_objectids_to_strings(projects_with_scores) # Apply conversion
            
        if sort_by == 'relevance':
            projects_with_scores.sort(key=lambda p: p['matchScore'], reverse=True)
            
        return jsonify({
            "success": True,
            "projects": projects_with_scores,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        })

    except Exception as e:
        print(f"Server error in get_projects: {e}")
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@projects_bp.route('/my-projects', methods=['GET'])
@jwt_required() # Enforce authentication
def get_my_projects():
    try:
        query_params = request.args
        page = int(query_params.get('page', 1))
        limit = int(query_params.get('limit', 20))
        status = query_params.get('status')
        
        query = {'creator': g.user.id}
        if status:
            query['status'] = status
            
        projects = Project.objects(__raw__=query).order_by('-created_at').skip((page - 1) * limit).limit(limit)
        total = Project.objects(__raw__=query).count()
        
        projects_list = [convert_objectids_to_strings(p.to_mongo().to_dict()) for p in projects] # Apply conversion

        return jsonify({
            "success": True,
            "projects": projects_list,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            }
        })
    except Exception as e:
        print(f"Server error in get_my_projects: {e}")
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

@projects_bp.route('/<project_id>', methods=['GET'])
@jwt_required(optional=True) # Public view, but more info if authenticated
def get_project(project_id):
    try:
        project = Project.objects.get(id=project_id)
        
        # Increment views only if accessed by a different user
        if g.user and str(project.creator.id) != str(g.user.id):
            project.views += 1
            project.save()
        
        match_score = None
        can_apply = False
        if g.user: # Calculate only if user is authenticated
            match_score = project.calculate_match_score(g.user)
            can_apply = project.can_user_apply(g.user.id)
        
        project_dict = project.to_mongo().to_dict()
        project_dict = convert_objectids_to_strings(project_dict) # Apply conversion
        
        project_dict['matchScore'] = match_score
        project_dict['canApply'] = can_apply
        
        return jsonify({
            "success": True,
            "project": project_dict
        })
    except Project.DoesNotExist:
        return jsonify({"success": False, "message": "Project not found"}), 404
    except Exception as e:
        print(f"Server error in get_project: {e}")
        return jsonify({"success": False, "message": f"Server error: {str(e)}"}), 500

# Additional routes for PUT, DELETE, apply, update application status, etc.
