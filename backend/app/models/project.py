from mongoengine import Document, StringField, ReferenceField, ListField
from app.models.user import User

class Project(Document):
    title = StringField(required=True)
    description = StringField()
    categories = ListField(StringField())
    createdBy = ReferenceField(User, required=True)
