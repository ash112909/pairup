import os
import sys

# Get the directory of the current script (which is in 'app/scripts')
current_dir = os.path.dirname(os.path.abspath(__file__))

# Navigate up two levels to reach the project root ('app')
project_root = os.path.join(current_dir, "..", "..") #  Adjust according to project structure

# Add the project root to sys.path so Python can find modules within 'app'
sys.path.insert(0, project_root)

# Now, you can use absolute imports from the 'app' directory
from app.database import connect_db
from app.models.user import User

def seed():
    connect_db()
    if not User.objects(email="test@example.com").first():
        u = User(name="Test User", email="test@example.com", userType="creator")
        u.set_password("password123")
        u.save()
        print("Seeded user: test@example.com / password123")

if __name__ == "__main__":
    seed()
