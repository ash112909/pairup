from fastapi import APIRouter, Depends
from app.middleware.auth import get_current_user
from app.models.match import Match
from app.models.user import User

router = APIRouter()

@router.post("/")
def create_match(user2_id: str, current_user: User = Depends(get_current_user)):
    user2 = User.objects(id=user2_id).first()
    if not user2:
        return {"error": "User not found"}
    match = Match(user1=current_user, user2=user2)
    match.save()
    return {"message": "Match created successfully"}

@router.get("/")
def list_matches(current_user: User = Depends(get_current_user)):
    matches = Match.objects(user1=current_user) or Match.objects(user2=current_user)
    return [{"id": str(m.id), "user1": str(m.user1.id), "user2": str(m.user2.id)} for m in matches]
