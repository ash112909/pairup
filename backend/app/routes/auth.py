from fastapi import APIRouter, HTTPException
from app.models.user import User, UserCreate
from app.core.security import create_access_token

router = APIRouter()

@router.post("/register")
def register(user: UserCreate):
    if User.objects(email=user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    new_user = User(
        name=user.name,
        email=user.email,
        userType=user.userType
    )
    new_user.set_password(user.password)
    new_user.save()
    return {"message": "User registered successfully"}

@router.post("/login")
def login(email: str, password: str):
    user = User.objects(email=email).first()
    if not user or not user.verify_password(password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"id": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
