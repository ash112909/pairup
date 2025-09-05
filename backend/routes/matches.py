# backend/routes/matches.py
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required
from mongoengine import Q
from mongoengine.errors import NotUniqueError

from models import User, Match, MatchAction

matches_bp = Blueprint('matches', __name__)

# -----------------------------
# Helpers
# -----------------------------

def _serialize_user(u: User):
    """Map a User document to the shape expected by the React UI."""
    rating_avg = 0.0
    if getattr(u, "rating", None) and getattr(u.rating, "average", None) is not None:
        rating_avg = float(u.rating.average)

    return {
        "_id": str(u.id),
        "name": getattr(u, "name", "Unknown"),
        "avatar": getattr(u, "avatar", "👤"),
        "userType": getattr(u, "user_type", "contributor"),
        "categories": list(getattr(u, "categories", [])),
        "bio": getattr(u, "bio", ""),
        "experience": getattr(u, "experience", ""),
        "location": getattr(u, "location", ""),
        "completedProjects": getattr(u, "completed_projects", 0),
        "rating": {"average": rating_avg},
    }

def _pair_key(a: User, b: User):
    """Return a deterministic (user_low, user_high) tuple for the pair."""
    return (a, b) if str(a.id) < str(b.id) else (b, a)

def _get_or_create_match(me: User, other: User, project=None) -> Match:
    """Atomically fetch or create the Match for (me, other)."""
    u1, u2 = _pair_key(me, other)
    try:
        comp = me.calculate_compatibility(other)
    except Exception:
        comp = 87.0

    # 1) fast path: already exists
    m = Match.objects(Q(user1=u1) & Q(user2=u2)).first()
    if m:
        return m

    # 2) atomic upsert; if a unique race happens, refetch
    try:
        m = Match.objects(user1=u1, user2=u2).modify(
            upsert=True,
            new=True,
            set_on_insert__project=project,
            set_on_insert__match_type=('user-to-user' if project is None else 'user-to-project'),
            set_on_insert__initiated_by=me,
            set_on_insert__compatibility_score=comp,
            set_on_insert__match_details=None,
            set_on_insert__user1_action=MatchAction(action='pending', timestamp=datetime.now(timezone.utc)),
            set_on_insert__user2_action=MatchAction(action='pending', timestamp=datetime.now(timezone.utc)),
        )
    except NotUniqueError:
        m = Match.objects(Q(user1=u1) & Q(user2=u2)).first()

    # 3) final guard
    return m


def _set_action_for_user(m: Match, user: User, action: str):
    """Set 'like' or 'pass' for a specific user on a Match (idempotent)."""
    now = datetime.now(timezone.utc)
    if str(m.user1.id) == str(user.id):
        if m.user1_action is None:
            m.user1_action = MatchAction()
        m.user1_action.action = action
        m.user1_action.timestamp = now
    elif str(m.user2.id) == str(user.id):
        if m.user2_action is None:
            m.user2_action = MatchAction()
        m.user2_action.action = action
        m.user2_action.timestamp = now
    else:
        raise ValueError("User is not part of this match")
    m.save()  # Match.save() sets status to 'mutual' when both actions == 'like'

def _other_side(m: Match, me: User) -> User:
    return m.user2 if str(m.user1.id) == str(me.id) else m.user1

def _my_action(m: Match, me: User) -> str:
    if str(m.user1.id) == str(me.id):
        return m.user1_action.action if m.user1_action else 'pending'
    return m.user2_action.action if m.user2_action else 'pending'

def _their_action(m: Match, me: User) -> str:
    if str(m.user1.id) == str(me.id):
        return m.user2_action.action if m.user2_action else 'pending'
    return m.user1_action.action if m.user1_action else 'pending'


# -----------------------------
# Discovery
# -----------------------------

@matches_bp.route("/discover", methods=["GET", "OPTIONS"])
def discover():
    if request.method == "OPTIONS":
        return ("", 204)

    try:
        limit = int(request.args.get("limit", 10))
    except ValueError:
        limit = 10

    try:
        q = User.objects
        if getattr(g, "user", None):
            q = q.filter(id__ne=g.user.id)
        users = q.limit(limit)
    except Exception:
        users = []

    matches = []
    for u in users:
        try:
            score = g.user.calculate_compatibility(u) if getattr(g, "user", None) else 87
        except Exception:
            score = 87
        matches.append({
            "user": _serialize_user(u),
            "compatibilityScore": score,
            "matchDetails": {"reasonForMatch": "Shared categories & interests"}
        })

    return jsonify({"success": True, "matches": matches}), 200


# -----------------------------
# Actions: like / pass
# -----------------------------

@matches_bp.route("/like", methods=["POST", "OPTIONS"])
@jwt_required()
def like():
    if request.method == "OPTIONS":
        return ("", 204)

    if not getattr(g, "user", None):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("targetUserId")
    project_id = data.get("projectId")

    if not target_user_id:
        return jsonify({"success": False, "message": "targetUserId is required"}), 400
    if str(g.user.id) == str(target_user_id):
        return jsonify({"success": False, "message": "You cannot like yourself"}), 400

    other = User.objects(id=target_user_id).first()
    if not other:
        return jsonify({"success": False, "message": "Target user not found"}), 404

    # Get/create the match and set my action
    m = _get_or_create_match(g.user, other, project=None)
    if not m:
        return jsonify({"success": False, "message": "Could not create or fetch match"}), 500
    _set_action_for_user(m, g.user, "like")

    # reflect like at User level (idempotent mirror)
    try:
        if g.user.likes_given is None: g.user.likes_given = []
        if other.likes_received is None: other.likes_received = []

        if other.id not in [u.id for u in g.user.likes_given]:
            g.user.likes_given.append(other)
            g.user.save()

        if g.user.id not in [u.id for u in other.likes_received]:
            other.likes_received.append(g.user)
            other.save()
    except Exception as e:
        print(f"[matches.like] user like bookkeeping error: {e}")


    # Is it mutual now?
    my_act = _my_action(m, g.user)
    their_act = _their_action(m, g.user)
    is_mutual = (my_act == "like" and their_act == "like" and m.status == "mutual")

    return jsonify({
        "success": True,
        "liked": str(other.id),
        "projectId": project_id,
        "isMutual": is_mutual
    }), 200


@matches_bp.route("/pass", methods=["POST", "OPTIONS"])
@jwt_required()
def pass_user():
    if request.method == "OPTIONS":
        return ("", 204)

    if not getattr(g, "user", None):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("targetUserId")

    if not target_user_id:
        return jsonify({"success": False, "message": "targetUserId is required"}), 400
    if str(g.user.id) == str(target_user_id):
        return jsonify({"success": False, "message": "You cannot pass on yourself"}), 400

    other = User.objects(id=target_user_id).first()
    if not other:
        return jsonify({"success": False, "message": "Target user not found"}), 404

    # Get/create the match and set my action
    m = _get_or_create_match(g.user, other, project=None)
    if not m:
        return jsonify({"success": False, "message": "Could not create or fetch match"}), 500
    _set_action_for_user(m, g.user, "pass")

    # optional tidy-up: remove any prior like mirror
    try:
        if g.user.likes_given:
            g.user.likes_given = [u for u in g.user.likes_given if str(u.id) != str(other.id)]
            g.user.save()
        if other.likes_received:
            other.likes_received = [u for u in other.likes_received if str(u.id) != str(g.user.id)]
            other.save()
    except Exception as e:
        print(f"[matches.pass] user pass bookkeeping error: {e}")


    return jsonify({"success": True, "passed": str(other.id)}), 200


# -----------------------------
# Reads: liked-me / my-matches
# -----------------------------

@matches_bp.route("/liked-me", methods=["GET", "OPTIONS"])
@jwt_required()
def liked_me():
    if request.method == "OPTIONS":
        return ("", 204)

    if not getattr(g, "user", None):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    # pagination
    try:
        page = max(1, int(request.args.get("page", 1)))
    except ValueError:
        page = 1
    try:
        limit = min(50, max(1, int(request.args.get("limit", 20))))
    except ValueError:
        limit = 20

    # Non-mutual matches involving me
    candidate_matches = Match.objects(
        (Q(user1=g.user) | Q(user2=g.user)) & Q(status__ne='mutual')
    ).select_related(1)

    liked_me_rows = []
    for m in candidate_matches:
        # Which side is which?
        i_am_user1 = (str(m.user1.id) == str(g.user.id))
        their_action = m.user2_action if i_am_user1 else m.user1_action
        my_action    = m.user1_action if i_am_user1 else m.user2_action
        other        = m.user2 if i_am_user1 else m.user1

        # They liked me, and I haven't liked them back (yet)
        if their_action and their_action.action == 'like' and not (my_action and my_action.action == 'like'):
            liked_me_rows.append({
                "other": other,
                "match": m,
                "theirLikedAt": getattr(their_action, "timestamp", None)
            })

    # Newest first
    liked_me_rows.sort(key=lambda r: (r["theirLikedAt"] or datetime.min.replace(tzinfo=timezone.utc)), reverse=True)

    total = len(liked_me_rows)
    start = (page - 1) * limit
    end = start + limit
    page_rows = liked_me_rows[start:end]

    items = []
    for r in page_rows:
        other = r["other"]
        m = r["match"]
        items.append({
            "user": _serialize_user(other),
            "likedAt": r["theirLikedAt"].isoformat() if r["theirLikedAt"] else None,
            "isMutual": (m.status == "mutual"),
            "matchId": f"{str(m.user1.id)}_{str(m.user2.id)}"
        })

    return jsonify({
        "success": True,
        "users": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }), 200


@matches_bp.route("/my-matches", methods=["GET", "OPTIONS"])
def my_matches():
    if request.method == "OPTIONS":
        return ("", 204)

    if not getattr(g, "user", None):
        return jsonify({"success": False, "message": "Authentication required"}), 401

    status = request.args.get("status", "mutual")

    if status == "mutual":
        qs = Match.objects(
            (Q(user1=g.user) | Q(user2=g.user)) & Q(status='mutual')
        ).select_related(1)
    elif status == "pending":
        # I liked them; they haven’t liked back yet
        all_my = Match.objects(
            (Q(user1=g.user) | Q(user2=g.user)) & Q(status__ne='mutual')
        ).select_related(1)
        filtered = []
        for m in all_my:
            my_act = _my_action(m, g.user)
            their_act = _their_action(m, g.user)
            if my_act == 'like' and their_act != 'like':
                filtered.append(m)
        qs = filtered
    else:
        qs = Match.objects(Q(user1=g.user) | Q(user2=g.user)).select_related(1)

    results = []
    for m in qs:
        other = _other_side(m, g.user)
        comp = m.compatibility_score
        if comp is None:
            try:
                comp = g.user.calculate_compatibility(other)
            except Exception:
                comp = 90.0

        results.append({
            "_id": f"{str(m.user1.id)}_{str(m.user2.id)}",
            "otherUser": _serialize_user(other),
            "compatibilityScore": comp,
            "conversation": {
                "started": bool(getattr(m, "conversation", None) and m.conversation.started)
            }
        })

    return jsonify({"success": True, "matches": results}), 200