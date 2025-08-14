import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

class Settings:
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017/pairup")
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "pairup")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "secret")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    CLIENT_URL: str = os.getenv("CLIENT_URL", "*")

    def current_time(self):
        return datetime.utcnow().isoformat()

    def uptime(self):
        return "N/A"  # placeholder, could integrate psutil for actual uptime

settings = Settings()
