const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Project description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Technology', 'Design', 'Content', 'Business', 'Events', 'Creative']
  },
  subcategory: {
    type: String,
    required: [true, 'Subcategory is required']
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'in-progress', 'completed', 'cancelled'],
    default: 'open'
  },
  timeline: {
    startDate: Date,
    endDate: Date,
    estimatedDuration: {
      value: Number,
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months'],
        default: 'weeks'
      }
    }
  },
  budget: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    type: {
      type: String,
      enum: ['fixed', 'hourly', 'equity', 'volunteer'],
      default: 'fixed'
    }
  },
  requiredSkills: [{
    skill: String,
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced', 'expert'],
      default: 'intermediate'
    },
    required: {
      type: Boolean,
      default: true
    }
  }],
  teamSize: {
    current: {
      type: Number,
      default: 1
    },
    target: {
      type: Number,
      required: true,
      min: 1
    }
  },
  location: {
    type: String,
    trim: true
  },
  workStyle: {
    type: String,
    enum: ['remote', 'in-person', 'hybrid'],
    default: 'remote'
  },
  tags: [String],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  collaborators: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: String,
    joinedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'active', 'left'],
      default: 'pending'
    }
  }],
  applications: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    appliedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    }
  }],
  milestones: [{
    title: String,
    description: String,
    dueDate: Date,
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date
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
  views: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for project completion percentage
ProjectSchema.virtual('completionPercentage').get(function() {
  if (!this.milestones || this.milestones.length === 0) return 0;
  
  const completedMilestones = this.milestones.filter(m => m.completed).length;
  return Math.round((completedMilestones / this.milestones.length) * 100);
});

// Virtual for days since creation
ProjectSchema.virtual('daysSinceCreation').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual for available spots
ProjectSchema.virtual('availableSpots').get(function() {
  return this.teamSize.target - this.teamSize.current;
});

// Indexes for efficient queries
ProjectSchema.index({ category: 1, subcategory: 1 });
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ creator: 1 });
ProjectSchema.index({ createdAt: -1 });
ProjectSchema.index({ 'rating.average': -1 });
ProjectSchema.index({ featured: -1, createdAt: -1 });
ProjectSchema.index({ tags: 1 });

// Text search index
ProjectSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Pre-save middleware to update team size
ProjectSchema.pre('save', function(next) {
  if (this.collaborators) {
    this.teamSize.current = 1 + this.collaborators.filter(c => 
      c.status === 'active' || c.status === 'accepted'
    ).length;
  }
  next();
});

// Method to check if user can apply
ProjectSchema.methods.canUserApply = function(userId) {
  // Check if user is the creator
  if (this.creator.toString() === userId.toString()) return false;
  
  // Check if already applied
  const hasApplied = this.applications.some(app => 
    app.user.toString() === userId.toString()
  );
  if (hasApplied) return false;
  
  // Check if already a collaborator
  const isCollaborator = this.collaborators.some(collab => 
    collab.user.toString() === userId.toString()
  );
  if (isCollaborator) return false;
  
  // Check if project is open and has available spots
  return this.status === 'open' && this.availableSpots > 0;
};

// Method to calculate match score with a user
ProjectSchema.methods.calculateMatchScore = function(user) {
  let score = 0;
  
  // Category match (40% weight)
  if (user.categories.includes(this.category)) {
    score += 40;
  }
  
  // Skills match (30% weight)
  const userSkills = user.skills.map(s => s.name.toLowerCase());
  const requiredSkills = this.requiredSkills.map(s => s.skill.toLowerCase());
  const skillMatches = requiredSkills.filter(skill => 
    userSkills.some(userSkill => userSkill.includes(skill) || skill.includes(userSkill))
  ).length;
  
  if (requiredSkills.length > 0) {
    score += (skillMatches / requiredSkills.length) * 30;
  }
  
  // User type compatibility (20% weight)
  if (user.userType === 'contributor' || user.userType === 'both') {
    score += 20;
  }
  
  // Rating factor (10% weight)
  score += (user.rating.average / 5) * 10;
  
  return Math.min(100, Math.max(0, score));
};

module.exports = mongoose.model('Project', ProjectSchema);