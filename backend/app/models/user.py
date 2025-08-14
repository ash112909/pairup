from mongoengine import Document, StringField, EmailField, BooleanField, ListField, EmbeddedDocument, EmbeddedDocumentField
from pydantic import BaseModel, EmailStr
from app.core.security import hash_password, verify_password

class Skill(EmbeddedDocument):
    name = StringField(required=True)
    level = StringField(choices=['beginner','intermediate','advanced','expert'], default='intermediate')

class User(Document):
    name = StringField(required=True, max_length=100)
    email = EmailField(required=True, unique=True)
    password = StringField(required=True)
    userType = StringField(required=True, choices=['creator', 'contributor', 'both'])
    categories = ListField(StringField())
    skills = ListField(EmbeddedDocumentField(Skill))
    isActive = BooleanField(default=True)

    def set_password(self, password: str):
        self.password = hash_password(password)

    def verify_password(self, password: str):
        return verify_password(password, self.password)

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    userType: str
