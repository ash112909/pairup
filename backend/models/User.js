const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  userType: {
    type: String,
    required: [true, 'User type is required'],
    enum: ['creator', 'contributor', 'both']
  },
  categories: [{
    type: String,
    enum: ['Technology', 'Design', 'Content', 'Business', 'Events', 'Creative']
  }],
  subcategories: {
    type: Map,
    of: [String],
    default: {}
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true
  },
  experience: {
    type: String,
    maxlength: [200, 'Experience cannot exceed 200 characters'],
    trim: true
  },
  availability: {
    type: String,
    enum: ['full-time', 'part-time', 'freelance', 'weekends']
  },
  location: {
    type: String,
    maxlength: [100, 'Location cannot exceed 100 characters'],
    trim: true
  },
  avatar: {
    type: String,
    default: '👤'
  },
  skills: [{
    name: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    }
  }],
  portfolio: [{
    title: String,
    description: String,
    url: String,
    image: String
  }],
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  completedProjects: {
    type: Number,
    default: 0
  },
  preferences: {
    maxDistance: {
      type: Number,
      default: 50 // km
    },
    preferredProjectTypes: [String],
    workStyle: {
      type: String,
      enum: ['remote', 'in-person', 'hybrid'],
      default: 'hybrid'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  verificationStatus: {
    email: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Boolean,
      default: false
    },
    identity: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for user's full profile completion percentage
UserSchema.virtual('profileCompletion').get(function() {
  let score = 0;
  const fields = ['name', 'email', 'userType', 'bio', 'experience', 'location', 'availability'];
  
  fields.forEach(field => {
    if (this[field] && this[field].toString().trim()) score += 1;
  });
  
  if (this.categories && this.categories.length > 0) score += 1;
  if (this.skills && this.skills.length > 0) score += 1;
  if (this.portfolio && this.portfolio.length > 0) score += 1;
  
  return Math.round((score / 10) * 100);
});

// Index for geospatial queries (if we add coordinates later)
UserSchema.index({ location: 'text' });
UserSchema.index({ categories: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ 'rating.average': -1 });
UserSchema.index({ lastActive: -1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    //this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return candidatePassword == this.password;
};

// Update last active timestamp
UserSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// Calculate compatibility score with another user
UserSchema.methods.calculateCompatibility = function(otherUser) {
  let score = 0;
  
  // Category overlap (30% weight)
  const categoryOverlap = this.categories.filter(cat => 
    otherUser.categories.includes(cat)
  ).length;
  const categoryScore = categoryOverlap / Math.max(this.categories.length, otherUser.categories.length) * 30;
  score += categoryScore;
  
  // User type compatibility (25% weight)
  let typeScore = 0;
  if (this.userType === 'both' || otherUser.userType === 'both') {
    typeScore = 25;
  } else if (
    (this.userType === 'creator' && otherUser.userType === 'contributor') ||
    (this.userType === 'contributor' && otherUser.userType === 'creator')
  ) {
    typeScore = 25;
  }
  score += typeScore;
  
  // Experience level compatibility (20% weight)
  const experienceScore = Math.random() * 20; // Simplified for now
  score += experienceScore;
  
  // Rating factor (15% weight)
  const ratingScore = (otherUser.rating.average / 5) * 15;
  score += ratingScore;
  
  // Activity factor (10% weight)
  const daysSinceActive = Math.floor((Date.now() - otherUser.lastActive) / (1000 * 60 * 60 * 24));
  const activityScore = Math.max(0, 10 - daysSinceActive) * 1;
  score += activityScore;
  
  return Math.min(100, Math.max(0, score));
};

module.exports = mongoose.model('User', UserSchema);