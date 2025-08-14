from typing import List, Dict
from fastapi import APIRouter, Depends
from app.middleware.auth import get_current_user
from app.models.project import Project
from app.models.user import User

router = APIRouter()

@router.post("/")
def create_project(title: str, description: str, categories: List[str], current_user: User = Depends(get_current_user)):
    project = Project(
        title=title,
        description=description,
        categories=categories,
        createdBy=current_user
    )
    project.save()
    return {"message": "Project created successfully", "id": str(project.id)}

@router.get("/")
def list_projects():
    projects = Project.objects()
    return [{"id": str(p.id), "title": p.title, "categories": p.categories} for p in projects]
