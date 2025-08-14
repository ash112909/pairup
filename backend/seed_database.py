import os
from datetime import datetime, timedelta, timezone # Import timezone
import bcrypt
from mongoengine import connect, disconnect
from models import User, Project, Match, RequiredSkill, ProjectTimeline, EstimatedDuration, ProjectBudget, Attachment, Collaborator, Application, Milestone, Rating, Skill, PortfolioItem, UserPreferences, VerificationStatus, MatchAction, MatchDetails, Conversation, Feedback, Metadata, Factor, TeamSize # Import all models

# Load environment variables (ensure .env is in backend_py directory)
from dotenv import load_dotenv
load_dotenv()

# MongoDB Connection URI from .env
MONGODB_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost/pairup')

# Sample users data (Directly translated from your Node.js seed script)
sample_users_data = [
    {
        'name': 'Sarah Chen',
        'email': 'sarah.chen@email.com',
        'password': 'password123',
        'user_type': 'creator',
        'categories': ['Technology', 'Design'],
        'subcategories': {
            'Technology': ['Mobile Apps', 'AI/ML'],
            'Design': ['UI/UX Design', 'Product Design']
        },
        'bio': 'Passionate tech entrepreneur building the next generation of healthcare applications. Love combining design thinking with cutting-edge technology.',
        'experience': '5+ years in health tech',
        'availability': 'full-time',
        'location': 'San Francisco, CA',
        'avatar': '👩‍💻',
        'skills': [
            {'name': 'React Native', 'level': 'advanced'},
            {'name': 'Product Management', 'level': 'expert'},
            {'name': 'UI/UX Design', 'level': 'intermediate'}
        ],
        'rating': {'average': 4.8, 'count': 15},
        'completed_projects': 8,
        'verification_status': {'email': True, 'phone': True, 'identity': False}
    },
    {
        'name': 'Marcus Rodriguez',
        'email': 'marcus.rodriguez@email.com',
        'password': 'password123',
        'user_type': 'contributor',
        'categories': ['Technology', 'Business'],
        'subcategories': {
            'Technology': ['Web Development', 'DevOps', 'Cybersecurity'],
            'Business': ['Strategy', 'Operations']
        },
        'bio': 'Full-stack developer with a passion for scalable architecture and clean code. Love working on meaningful projects that make a difference.',
        'experience': '7+ years in web development',
        'availability': 'part-time',
        'location': 'Austin, TX',
        'avatar': '👨‍💼',
        'skills': [
            {'name': 'React', 'level': 'expert'},
            {'name': 'Node.js', 'level': 'expert'},
            {'name': 'AWS', 'level': 'advanced'},
            {'name': 'Docker', 'level': 'intermediate'}
        ],
        'rating': {'average': 4.9, 'count': 23},
        'completed_projects': 12,
        'verification_status': {'email': True, 'phone': False, 'identity': True}
    },
    {
        'name': 'Elena Vasquez',
        'email': 'elena.vasquez@email.com',
        'password': 'password123',
        'user_type': 'both',
        'categories': ['Business', 'Creative', 'Content'],
        'subcategories': {
            'Business': ['Marketing', 'Sales', 'Strategy'],
            'Creative': ['Art Projects', 'Creative Writing'],
            'Content': ['Social Media', 'Copywriting', 'Blogging']
        },
        'bio': 'Creative strategist and entrepreneur launching sustainable fashion initiatives. Looking for like-minded collaborators to change the industry.',
        'experience': '4+ years in fashion and marketing',
        'availability': 'freelance',
        'location': 'Los Angeles, CA',
        'avatar': '🌱',
        'skills': [
            {'name': 'Brand Strategy', 'level': 'expert'},
            {'name': 'Social Media Marketing', 'level': 'advanced'},
            {'name': 'Creative Writing', 'level': 'advanced'},
            {'name': 'Sustainability Consulting', 'level': 'intermediate'}
        ],
        'rating': {'average': 4.6, 'count': 8},
        'completed_projects': 5,
        'verification_status': {'email': True, 'phone': True, 'identity': False}
    },
    {
        'name': 'David Kim',
        'email': 'david.kim@email.com',
        'password': 'password123',
        'user_type': 'contributor',
        'categories': ['Design', 'Technology'],
        'subcategories': {
            'Design': ['Graphic Design', 'Brand Identity', 'Animation'],
            'Technology': ['Web Development', 'Mobile Apps']
        },
        'bio': 'UI/UX designer and front-end developer who believes in the power of good design to solve complex problems.',
        'experience': '6+ years in design and development',
        'availability': 'part-time',
        'location': 'Seattle, WA',
        'avatar': '�',
        'skills': [
            {'name': 'Figma', 'level': 'expert'},
            {'name': 'React', 'level': 'advanced'},
            {'name': 'Animation', 'level': 'intermediate'},
            {'name': 'Brand Design', 'level': 'advanced'}
        ],
        'rating': {'average': 4.7, 'count': 11},
        'completed_projects': 9,
        'verification_status': {'email': True, 'phone': False, 'identity': False}
    },
    {
        'name': 'Priya Patel',
        'email': 'priya.patel@email.com',
        'password': 'password123',
        'user_type': 'creator',
        'categories': ['Business', 'Events', 'Technology'],
        'subcategories': {
            'Business': ['Finance', 'Operations', 'Legal'],
            'Events': ['Conferences', 'Networking', 'Fundraising'],
            'Technology': ['Blockchain', 'AI/ML']
        },
        'bio': 'Fintech entrepreneur passionate about financial inclusion and blockchain innovation. Building the future of decentralized finance.',
        'experience': '8+ years in fintech',
        'availability': 'full-time',
        'location': 'New York, NY',
        'avatar': '💼',
        'skills': [
            {'name': 'Blockchain', 'level': 'expert'},
            {'name': 'Financial Modeling', 'level': 'expert'},
            {'name': 'Regulatory Compliance', 'level': 'advanced'},
            {'name': 'Event Planning', 'level': 'intermediate'}
        ],
        'rating': {'average': 4.9, 'count': 19},
        'completed_projects': 6,
        'verification_status': {'email': True, 'phone': True, 'identity': True}
    }
]

# Sample projects data (Directly translated)
sample_projects_data = [
    {
        'title': 'AI-Powered Health Monitoring App',
        'description': 'Developing a revolutionary mobile application that uses machine learning to predict health issues before they become serious. The app will integrate with wearable devices and provide personalized health insights. We need experienced mobile developers, ML engineers, and UI/UX designers to join our mission of making healthcare more proactive and accessible.',
        'category': 'Technology',
        'subcategory': 'Mobile Apps',
        'status': 'open',
        'timeline': {
            'estimated_duration': {'value': 6, 'unit': 'months'}
        },
        'budget': {
            'min': 50000,
            'max': 100000,
            'type': 'equity'
        },
        'required_skills': [
            {'skill': 'React Native', 'level': 'advanced', 'required': True},
            {'skill': 'Machine Learning', 'level': 'intermediate', 'required': True},
            {'skill': 'Healthcare Domain', 'level': 'beginner', 'required': False}
        ],
        'team_size': {'current': 2, 'target': 6},
        'location': 'San Francisco, CA',
        'work_style': 'hybrid',
        'tags': ['health', 'ai', 'mobile', 'startup'],
        'featured': True
    },
    {
        'title': 'Sustainable Fashion Marketplace',
        'description': 'Creating an online marketplace that connects sustainable fashion brands with conscious consumers. The platform will feature carbon footprint tracking, ethical sourcing verification, and community-driven reviews. Looking for full-stack developers, marketing specialists, and sustainability experts to build something meaningful.',
        'category': 'Business',
        'subcategory': 'Marketing',
        'status': 'open',
        'timeline': {
            'estimated_duration': {'value': 4, 'unit': 'months'}
        },
        'budget': {
            'min': 30000,
            'max': 60000,
            'type': 'fixed'
        },
        'required_skills': [
            {'skill': 'E-commerce', 'level': 'advanced', 'required': True},
            {'skill': 'Digital Marketing', 'level': 'intermediate', 'required': True},
            {'skill': 'Sustainability', 'level': 'beginner', 'required': False}
        ],
        'team_size': {'current': 1, 'target': 4},
        'location': 'Los Angeles, CA',
        'work_style': 'remote',
        'tags': ['sustainability', 'fashion', 'e-commerce', 'social-impact']
    },
    {
        'title': 'Open Source Developer Tools',
        'description': 'Building a suite of developer productivity tools focused on code quality and team collaboration. The project includes automated code review, performance monitoring, and integration with popular IDEs. This is an open-source initiative looking for passionate developers who want to give back to the community.',
        'category': 'Technology',
        'subcategory': 'Web Development',
        'status': 'open',
        'timeline': {
            'estimated_duration': {'value': 8, 'unit': 'months'}
        },
        'budget': {
            'type': 'volunteer'
        },
        'required_skills': [
            {'skill': 'JavaScript', 'level': 'advanced', 'required': True},
            {'skill': 'Node.js', 'level': 'advanced', 'required': True},
            {'skill': 'Open Source', 'level': 'intermediate', 'required': False}
        ],
        'team_size': {'current': 3, 'target': 8},
        'work_style': 'remote',
        'tags': ['open-source', 'developer-tools', 'productivity'],
        'featured': True
    },
    {
        'title': 'Interactive Learning Platform',
        'description': 'Designing an immersive educational platform that gamifies learning for K-12 students. The platform will feature interactive lessons, progress tracking, and peer collaboration tools. We need educational technology experts, game designers, and front-end developers.',
        'category': 'Design',
        'subcategory': 'UI/UX Design',
        'status': 'open',
        'timeline': {
            'estimated_duration': {'value': 5, 'unit': 'months'}
        },
        'budget': {
            'min': 40000,
            'max': 80000,
            'type': 'fixed'
        },
        'required_skills': [
            {'skill': 'Educational Technology', 'level': 'intermediate', 'required': True},
            {'skill': 'Game Design', 'level': 'intermediate', 'required': True},
            {'skill': 'React', 'level': 'advanced', 'required': True}
        ],
        'team_size': {'current': 2, 'target': 5},
        'location': 'Remote',
        'work_style': 'remote',
        'tags': ['education', 'gamification', 'children', 'learning']
    }
]

def generate_match_reason(user1, user2, score):
    common_categories = [cat for cat in user1.categories if cat in user2.categories]
    
    if score >= 80:
        return f"Excellent match! You both work in {', '.join(common_categories)} and have complementary skills."
    elif score >= 60:
        return f"Great potential! You share interests in {', '.join(common_categories)}."
    elif score >= 40:
        return "Interesting match with some overlapping areas."
    else:
        return "Different backgrounds might bring fresh perspectives."

def seed_database():
    try:
        # Connect to MongoDB
        connect(host=MONGODB_URI)
        print('📦 Connected to MongoDB')

        # Clear existing data
        User.drop_collection()
        Project.drop_collection()
        Match.drop_collection()
        print('🗑️ Cleared existing data')

        # Create users
        created_users = []
        for user_data in sample_users_data:
            user = User(**user_data)
            # Use int.from_bytes to get a numeric value from os.urandom
            # And datetime.now(timezone.utc) for timezone-aware datetime
            user.last_active = datetime.now(timezone.utc) - timedelta(days=int.from_bytes(os.urandom(1), 'big') / 256 * 7)
            user.save()
            created_users.append(user)
            print(f'👤 Created user: {user.name}')

        # Create projects
        created_projects = []
        for i, project_data in enumerate(sample_projects_data):
            # Find a creator user, or a 'both' user
            creator = next((u for u in created_users if u.user_type in ['creator', 'both']), None)
            if not creator:
                print("No creator found, skipping project creation.")
                continue
            
            project_instance = Project(**project_data, creator=creator.id)
            # created_at is handled by auto_now_add=True and tz_aware=True in models.py
            project_instance.views = int(int.from_bytes(os.urandom(1), 'big') / 256 * 90) + 10 # Random views between 10-100
            project_instance.save() # Save creates the created_at timestamp
            created_projects.append(project_instance)
            print(f'📋 Created project: {project_instance.title}')

        # Create some sample matches
        contributors = [u for u in created_users if u.user_type in ['contributor', 'both']]
        creators = [u for u in created_users if u.user_type in ['creator', 'both']]

        for i in range(min(len(contributors), len(creators))):
            contributor = contributors[i]
            creator = creators[i]
            
            if str(contributor.id) != str(creator.id):
                compatibility_score = contributor.calculate_compatibility(creator)
                
                # Create embedded documents before passing to Match
                user1_action = MatchAction(action='like', timestamp=datetime.now(timezone.utc))
                user2_action = MatchAction(action='pending', timestamp=None)
                if int.from_bytes(os.urandom(1), 'big') / 256 > 0.5: # 50% chance for mutual
                    user2_action.action = 'like'
                    user2_action.timestamp = datetime.now(timezone.utc)
                
                match_details = MatchDetails(
                    common_categories=[cat for cat in contributor.categories if cat in creator.categories],
                    reason_for_match=generate_match_reason(contributor, creator, compatibility_score),
                    confidence_level='high' if compatibility_score >= 70 else ('medium' if compatibility_score >= 40 else 'low')
                )

                match_instance = Match(
                    user1=contributor.id,
                    user2=creator.id,
                    match_type='user-to-user',
                    initiated_by=contributor.id,
                    compatibility_score=compatibility_score,
                    user1_action=user1_action,
                    user2_action=user2_action,
                    match_details=match_details
                )
                # created_at is handled by auto_now_add=True and tz_aware=True in models.py
                match_instance.save()
                print(f'🤝 Created match between {contributor.name} and {creator.name}')

        # Add some applications to projects
        for project in created_projects:
            applicable_users = [u for u in created_users if str(u.id) != str(project.creator.id) and u.user_type in ['contributor', 'both']]
            
            num_applications = int(int.from_bytes(os.urandom(1), 'big') / 256 * 3) + 1 # 1-3 random applications
            for i in range(min(num_applications, len(applicable_users))):
                applicant = applicable_users[i]
                project.applications.append(Application(
                    user=applicant.id,
                    message=f"I'm very interested in joining this project. My experience in {', '.join(applicant.categories)} would be valuable.",
                    status='pending'
                ))
            project.save()

        print('✅ Database seeded successfully!')
        print(f'👥 Created {len(created_users)} users')
        print(f'📋 Created {len(created_projects)} projects')
        print('🎯 Sample login credentials:')
        print('    Email: sarah.chen@email.com, Password: password123 (Creator)')
        print('    Email: marcus.rodriguez@email.com, Password: password123 (Contributor)')
        print('    Email: elena.vasquez@email.com, Password: password123 (Both)')

    except Exception as e:
        print(f'❌ Error seeding database: {e}')
    finally:
        disconnect()
        print('📦 Disconnected from MongoDB')

if __name__ == '__main__':
    seed_database()