from mongoengine import connect
from app.core.config import settings

def connect_db():
    connect(
        db=settings.MONGO_DB_NAME,
        host=settings.MONGODB_URI
    )
