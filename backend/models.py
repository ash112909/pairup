import bcrypt
from datetime import datetime, timedelta, timezone # Import timezone
from mongoengine import (
    Document, StringField, IntField, FloatField, BooleanField, DateTimeField,
    ListField, ReferenceField, EmbeddedDocument, EmbeddedDocumentField, MapField
)

# ----------------- Sub-documents -----------------

# --- TZ helper ---
def _aware(dt):
    """Return a timezone-aware (UTC) datetime. If dt is None, return None."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)

class RequiredSkill(EmbeddedDocument):
    skill = StringField()
    level = StringField(choices=('beginner', 'intermediate', 'advanced', 'expert'), default='intermediate')
    required = BooleanField(default=True)

class ProjectTimeline(EmbeddedDocument):
    start_date = DateTimeField(tz_aware=True) # tz_aware=True
    end_date = DateTimeField(tz_aware=True) # tz_aware=True
    estimated_duration = EmbeddedDocumentField('EstimatedDuration')

class EstimatedDuration(EmbeddedDocument):
    value = IntField()
    unit = StringField(choices=('days', 'weeks', 'months'), default='weeks')

class ProjectBudget(EmbeddedDocument):
    min = FloatField()
    max = FloatField()
    currency = StringField(default='USD')
    type = StringField(choices=('fixed', 'hourly', 'equity', 'volunteer'), default='fixed')

class Attachment(EmbeddedDocument):
    name = StringField()
    url = StringField()
    type = StringField()

class Collaborator(EmbeddedDocument):
    user = ReferenceField('User')
    role = StringField()
    joined_at = DateTimeField(default=lambda: datetime.now(timezone.utc), tz_aware=True) # tz_aware=True
    status = StringField(choices=('pending', 'accepted', 'active', 'left'), default='pending')

class Application(EmbeddedDocument):
    user = ReferenceField('User')
    message = StringField(max_length=500)
    applied_at = DateTimeField(default=lambda: datetime.now(timezone.utc), tz_aware=True) # tz_aware=True
    status = StringField(choices=('pending', 'accepted', 'rejected'), default='pending')

class Milestone(EmbeddedDocument):
    title = StringField()
    description = StringField()
    due_date = DateTimeField(tz_aware=True) # tz_aware=True
    completed = BooleanField(default=False)
    completed_at = DateTimeField(tz_aware=True) # tz_aware=True

class Rating(EmbeddedDocument):
    average = FloatField(default=0.0, min_value=0.0, max_value=5.0)
    count = IntField(default=0)

class Skill(EmbeddedDocument):
    name = StringField()
    level = StringField(choices=('beginner', 'intermediate', 'advanced', 'expert'), default='intermediate')

class PortfolioItem(EmbeddedDocument):
    title = StringField()
    description = StringField()
    url = StringField()
    image = StringField()

class UserPreferences(EmbeddedDocument):
    max_distance = IntField(default=50)
    preferred_project_types = ListField(StringField())
    work_style = StringField(choices=('remote', 'in-person', 'hybrid'), default='hybrid')

class VerificationStatus(EmbeddedDocument):
    email = BooleanField(default=False)
    phone = BooleanField(default=False)
    identity = BooleanField(default=False)

class MatchAction(EmbeddedDocument):
    action = StringField(choices=('like', 'pass', 'super-like', 'pending'), default='pending')
    timestamp = DateTimeField(tz_aware=True) # tz_aware=True

class MatchDetails(EmbeddedDocument):
    common_categories = ListField(StringField())
    common_skills = ListField(StringField())
    reason_for_match = StringField()
    confidence_level = StringField(choices=('low', 'medium', 'high'), default='medium')

class Conversation(EmbeddedDocument):
    started = BooleanField(default=False)
    started_at = DateTimeField(tz_aware=True) # tz_aware=True
    last_message_at = DateTimeField(tz_aware=True) # tz_aware=True
    message_count = IntField(default=0)

class Feedback(EmbeddedDocument):
    from_user = ReferenceField('User')
    rating = IntField(min_value=1, max_value=5)
    comment = StringField()
    created_at = DateTimeField(default=lambda: datetime.now(timezone.utc), tz_aware=True) # tz_aware=True

class Metadata(EmbeddedDocument):
    algorithm = StringField(default='v1.0')
    factors = ListField(EmbeddedDocumentField('Factor'))

class Factor(EmbeddedDocument):
    name = StringField()
    weight = FloatField()
    score = FloatField()

class TeamSize(EmbeddedDocument):
    current = IntField(default=1)
    target = IntField(required=True, min_value=1)

# ----------------- Main Documents -----------------

class User(Document):
    name = StringField(required=True, max_length=100)
    email = StringField(required=True, unique=True, lowercase=True)
    password = StringField(required=True, min_length=6, select=False)
    user_type = StringField(required=True, choices=('creator', 'contributor', 'both'))
    categories = ListField(StringField(choices=['Technology', 'Design', 'Content', 'Business', 'Events', 'Creative']))
    subcategories = MapField(ListField(StringField()), default={})
    bio = StringField(max_length=500)
    experience = StringField(max_length=200)
    availability = StringField(choices=('full-time', 'part-time', 'freelance', 'weekends'))
    location = StringField(max_length=100)
    avatar = StringField(default='👤')
    skills = ListField(EmbeddedDocumentField(Skill))
    portfolio = ListField(EmbeddedDocumentField(PortfolioItem))
    rating = EmbeddedDocumentField(Rating)
    completed_projects = IntField(default=0)
    preferences = EmbeddedDocumentField(UserPreferences)
    is_active = BooleanField(default=True)
    last_active = DateTimeField(default=lambda: datetime.now(timezone.utc), tz_aware=True) # tz_aware=True
    verification_status = EmbeddedDocumentField(VerificationStatus)
    created_at = DateTimeField(auto_now_add=True, tz_aware=True)  # tz_aware=True
    updated_at = DateTimeField(auto_now=True, tz_aware=True)    # tz_aware=True
    likes_given = ListField(ReferenceField('User'), default=[])
    likes_received = ListField(ReferenceField('User'), default=[])
    
    meta = {
        'indexes': [
            'email',
            'location',
            'categories',
            'user_type',
            'rating.average',
            'last_active',
            'created_at',
            'updated_at'
        ]
    }
    
    # Pre-save hook to hash password
    def save(self, *args, **kwargs):
        # Only hash password if it's new or has been modified and is not already hashed
        if self.password and (self.pk is None or self.is_changed('password')) and \
           not (self.password.startswith('$2a$') and len(self.password) > 20 and bcrypt.checkpw(b'test_password_for_check', self.password.encode('utf-8'))): # Basic check to avoid re-hashing already hashed passwords
            self.password = bcrypt.hashpw(self.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        super(User, self).save(*args, **kwargs)

    def to_public_dict(self):
        return {
            'name': self.name,
            'avatar': self.avatar,
            'user_type': self.user_type,
            'categories': self.categories,
            'bio': self.bio,
            'experience': self.experience,
            'location': self.location,
            'rating': self.rating.to_mongo().to_dict() if self.rating else None,
            'completed_projects': self.completed_projects,
            'last_active': self.last_active,
            'portfolio': [item.to_mongo().to_dict() for item in self.portfolio],
            'skills': [skill.to_mongo().to_dict() for skill in self.skills]
        }

    # Instance methods
    @property
    def profile_completion(self):
        score = 0
        fields = ['name', 'user_type', 'bio', 'experience', 'location', 'availability']
        
        for field in fields:
            if getattr(self, field):
                score += 1
        
        if self.categories and len(self.categories) > 0:
            score += 1
        if self.skills and len(self.skills) > 0:
            score += 1
        if self.portfolio and len(self.portfolio) > 0:
            score += 1
            
        return round((score / 9) * 100)

    def compare_password(self, candidate_password):
        # Ensure password is not None before attempting to decode/check
        if self.password is None:
            return False
        try:
            return bcrypt.checkpw(candidate_password.encode('utf-8'), self.password.encode('utf-8'))
        except ValueError: # Handle cases where stored password might not be a valid bcrypt hash
            return False

    def update_last_active(self):
        self.last_active = datetime.now(timezone.utc) # Ensure this is also timezone aware
        self.save()

    def calculate_compatibility(self, other_user):
        score = 0
        
        # Category overlap (30% weight)
        category_overlap = len(set(self.categories).intersection(other_user.categories))
        category_score = (category_overlap / max(len(self.categories), len(other_user.categories), 1)) * 30
        score += category_score
        
        # User type compatibility (25% weight)
        type_score = 0
        if self.user_type == 'both' or other_user.user_type == 'both':
            type_score = 25
        elif (self.user_type == 'creator' and other_user.user_type == 'contributor') or \
             (self.user_type == 'contributor' and other_user.user_type == 'creator'):
            type_score = 25
        score += type_score
        
        # Experience compatibility (20% weight)
        experience_score = 0
        if self.experience and other_user.experience and self.experience == other_user.experience:
             experience_score = 20
        score += experience_score
        
        # Rating factor (15% weight)
        rating_score = (other_user.rating.average / 5) * 15 if other_user.rating else 0
        score += rating_score
        
        # Activity factor (10% weight)
        # Ensure consistent timezone for comparison
        now_utc = datetime.now(timezone.utc)
        last_active_aware = _aware(getattr(other_user, "last_active", None)) or now_utc
        days_since_active = (now_utc - last_active_aware).days
        activity_score = max(0, 10 - days_since_active) * 1
        score += activity_score
        
        return min(100, max(0, score))


class Project(Document):
    title = StringField(required=True, max_length=200)
    description = StringField(required=True, max_length=2000)
    creator = ReferenceField(User, required=True)
    category = StringField(required=True, choices=['Technology', 'Design', 'Content', 'Business', 'Events', 'Creative'])
    subcategory = StringField(required=True)
    status = StringField(choices=['draft', 'open', 'in-progress', 'completed', 'cancelled'], default='open')
    timeline = EmbeddedDocumentField(ProjectTimeline)
    budget = EmbeddedDocumentField(ProjectBudget)
    required_skills = ListField(EmbeddedDocumentField(RequiredSkill))
    team_size = EmbeddedDocumentField(TeamSize)
    location = StringField(max_length=100)
    work_style = StringField(choices=['remote', 'in-person', 'hybrid'], default='remote')
    tags = ListField(StringField())
    attachments = ListField(EmbeddedDocumentField(Attachment))
    collaborators = ListField(EmbeddedDocumentField(Collaborator))
    applications = ListField(EmbeddedDocumentField(Application))
    milestones = ListField(EmbeddedDocumentField(Milestone))
    rating = EmbeddedDocumentField(Rating)
    views = IntField(default=0)
    featured = BooleanField(default=False)
    is_public = BooleanField(default=True)
    created_at = DateTimeField(auto_now_add=True, tz_aware=True) # tz_aware=True
    updated_at = DateTimeField(auto_now=True, tz_aware=True)   # tz_aware=True
    
    meta = {
        'indexes': [
            ('category', 'subcategory'),
            'status',
            'creator',
            'created_at',
            'rating.average',
            ('featured', 'created_at'),
            'tags',
            {
                'fields': ['$title', '$description', '$tags'],
                'default_language': 'english',
                'weights': {'title': 10, 'description': 5, 'tags': 3}
            }
        ]
    }
    
    # Pre-save hook to update team size
    def save(self, *args, **kwargs):
        if self.collaborators:
            self.team_size.current = 1 + len([c for c in self.collaborators if c.status in ['active', 'accepted']])
        super(Project, self).save(*args, **kwargs)

    # Virtual properties
    @property
    def completion_percentage(self):
        if not self.milestones:
            return 0
        completed_milestones = len([m for m in self.milestones if m.completed])
        return round((completed_milestones / len(self.milestones)) * 100)

    @property
    def days_since_creation(self):
        # Ensure consistent timezone for comparison
        return (datetime.now(timezone.utc) - self.created_at).days

    @property
    def available_spots(self):
        return self.team_size.target - self.team_size.current

    # Instance methods
    def can_user_apply(self, user_id):
        user_id_str = str(user_id)
        if str(self.creator.id) == user_id_str:
            return False
        
        has_applied = any(str(app.user.id) == user_id_str for app in self.applications)
        if has_applied:
            return False
        
        is_collaborator = any(str(collab.user.id) == user_id_str for collab in self.collaborators)
        if is_collaborator:
            return False
        
        return self.status == 'open' and self.available_spots > 0

    def calculate_match_score(self, user):
        score = 0
        
        # Category match (40% weight)
        if self.category in user.categories:
            score += 40
            
        # Skills match (30% weight)
        user_skills = {s.name.lower() for s in user.skills}
        required_skills = {s.skill.lower() for s in self.required_skills}
        
        skill_matches = len(user_skills.intersection(required_skills))
        
        if required_skills:
            score += (skill_matches / len(required_skills)) * 30
            
        # User type compatibility (20% weight)
        if user.user_type in ['contributor', 'both']:
            score += 20
            
        # Rating factor (10% weight)
        if user.rating:
            score += (user.rating.average / 5) * 10
            
        return min(100, max(0, score))


class Match(Document):
    user1 = ReferenceField(User, required=True)
    user2 = ReferenceField(User, required=True)
    project = ReferenceField(Project)
    match_type = StringField(choices=('user-to-user', 'user-to-project', 'project-to-user'), required=True)
    status = StringField(choices=('pending', 'mutual', 'expired', 'blocked'), default='pending')
    initiated_by = ReferenceField(User, required=True)
    user1_action = EmbeddedDocumentField(MatchAction)
    user2_action = EmbeddedDocumentField(MatchAction)
    compatibility_score = FloatField(required=True, min_value=0, max_value=100)
    match_details = EmbeddedDocumentField(MatchDetails)
    conversation = EmbeddedDocumentField(Conversation)
    outcome = StringField(choices=('no-contact', 'chatted', 'collaborated', 'project-created'), default='no-contact')
    feedback = ListField(EmbeddedDocumentField(Feedback))
    metadata = EmbeddedDocumentField(Metadata)
    expires_at = DateTimeField(default=lambda: datetime.now(timezone.utc) + timedelta(days=7), tz_aware=True) # tz_aware=True
    created_at = DateTimeField(auto_now_add=True, tz_aware=True) # tz_aware=True
    updated_at = DateTimeField(auto_now=True, tz_aware=True)   # tz_aware=True
    
    meta = {
        'indexes': [
            {'fields': ('user1', 'user2'), 'unique': True},
            {'fields': ('user1', 'status')},
            {'fields': ('user2', 'status')},
            'project',
            'status',
            'created_at',
            'expires_at',
            'compatibility_score'
        ]
    }
    
    # Pre-save hook to update status
    def save(self, *args, **kwargs):
        # Normalize timestamps to UTC-aware to avoid naive/aware comparisons
        now_utc = datetime.now(timezone.utc)

        # Normalize action timestamps if present
        if self.user1_action:
            self.user1_action.timestamp = _aware(self.user1_action.timestamp) or now_utc
        if self.user2_action:
            self.user2_action.timestamp = _aware(self.user2_action.timestamp) or now_utc

        # Normalize core datetimes
        self.created_at = _aware(getattr(self, "created_at", None)) or now_utc
        self.updated_at = _aware(getattr(self, "updated_at", None)) or now_utc
        self.expires_at = _aware(getattr(self, "expires_at", None)) or (now_utc + timedelta(days=7))

        # Auto-set status based on actions / expiry
        if self.user1_action and self.user2_action and \
        self.user1_action.action == 'like' and self.user2_action.action == 'like':
            self.status = 'mutual'
        elif self.status == 'pending' and self.expires_at <= now_utc:
            self.status = 'expired'

        super(Match, self).save(*args, **kwargs)

    # Virtual properties
    @property
    def age_in_hours(self):
        # Ensure consistent timezone for comparison
        return (datetime.now(timezone.utc) - self.created_at).total_seconds() / 3600

    @property
    def hours_until_expiry(self):
        # Ensure consistent timezone for comparison
        return max(0, (self.expires_at - datetime.now(timezone.utc)).total_seconds() / 3600)
    
    @property
    def is_active(self):
        # Ensure consistent timezone for comparison
        return self.status not in ['expired', 'blocked'] and self.expires_at > datetime.now(timezone.utc)

    # Static methods (class methods in Python)
    @classmethod
    def find_user_matches(cls, user_id, status=None):
        query = {'$or': [{'user1': user_id}, {'user2': user_id}]}
        if status:
            query['status'] = status
        
        return cls.objects(__raw__=query).order_by('-created_at').select_related(1)

    @classmethod
    def create_match(cls, user1_id, user2_id, project_id, initiated_by_id, compatibility_score, match_details):
        existing_match = cls.objects(__raw__={
            '$or': [{'user1': user1_id, 'user2': user2_id}, {'user1': user2_id, 'user2': user1_id}]
        }).first()
        
        if existing_match:
            raise ValueError('Match already exists between these users')
            
        match_data = {
            'user1': user1_id,
            'user2': user2_id,
            'project': project_id,
            'match_type': 'user-to-project' if project_id else 'user-to-user',
            'initiated_by': initiated_by_id,
            'compatibility_score': compatibility_score,
            'match_details': match_details
        }
        
        initial_action = MatchAction(action='like', timestamp=datetime.now(timezone.utc))
        if str(initiated_by_id) == str(user1_id):
            match_data['user1_action'] = initial_action
        else:
            match_data['user2_action'] = initial_action
            
        return cls.objects.create(**match_data)

    # Instance methods
    def update_user_action(self, user_id, action):
        timestamp = datetime.now(timezone.utc)
        if str(self.user1.id) == str(user_id):
            self.user1_action.action = action
            self.user1_action.timestamp = timestamp
        elif str(self.user2.id) == str(user_id):
            self.user2_action.action = action
            self.user2_action.timestamp = timestamp
        else:
            raise ValueError('User is not part of this match')
        self.save()

    def start_conversation(self):
        if self.status != 'mutual':
            raise ValueError('Can only start conversation on mutual matches')
        self.conversation.started = True
        self.conversation.started_at = datetime.now(timezone.utc)
        self.save()

    def add_feedback(self, from_user_id, rating, comment):
        self.feedback.append(Feedback(from_user=from_user_id, rating=rating, comment=comment))
        self.save()
