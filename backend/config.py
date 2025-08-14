import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-that-should-be-random')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-jwt-secret-key-that-should-be-random')
    MONGODB_SETTINGS = {
        'host': os.environ.get('MONGODB_URI', 'mongodb://localhost/pairup')
    }
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    CLIENT_URL = os.environ.get('CLIENT_URL', 'http://localhost:3000') # <--- Add this line
