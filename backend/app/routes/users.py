from fastapi import APIRouter, Depends
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "userType": current_user.userType,
        "categories": current_user.categories
    }

@router.get("/")
def list_users():
    users = User.objects()
    return [{"id": str(u.id), "name": u.name, "email": u.email} for u in users]
