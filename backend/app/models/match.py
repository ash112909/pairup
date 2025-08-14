from mongoengine import Document, ReferenceField
from app.models.user import User

class Match(Document):
    user1 = ReferenceField(User, required=True)
    user2 = ReferenceField(User, required=True)
