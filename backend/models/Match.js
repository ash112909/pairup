const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  matchType: {
    type: String,
    enum: ['user-to-user', 'user-to-project', 'project-to-user'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'mutual', 'expired', 'blocked'],
    default: 'pending'
  },
  initiatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user1Action: {
    action: {
      type: String,
      enum: ['like', 'pass', 'super-like', 'pending'],
      default: 'pending'
    },
    timestamp: Date
  },
  user2Action: {
    action: {
      type: String,
      enum: ['like', 'pass', 'super-like', 'pending'],
      default: 'pending'
    },
    timestamp: Date
  },
  compatibilityScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  matchDetails: {
    commonCategories: [String],
    commonSkills: [String],
    reasonForMatch: String,
    confidenceLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  conversation: {
    started: {
      type: Boolean,
      default: false
    },
    startedAt: Date,
    lastMessageAt: Date,
    messageCount: {
      type: Number,
      default: 0
    }
  },
  outcome: {
    type: String,
    enum: ['no-contact', 'chatted', 'collaborated', 'project-created'],
    default: 'no-contact'
  },
  feedback: [{
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    algorithm: {
      type: String,
      default: 'v1.0'
    },
    factors: [{
      name: String,
      weight: Number,
      score: Number
    }]
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for match age in hours
MatchSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

// Virtual for time until expiration
MatchSchema.virtual('hoursUntilExpiry').get(function() {
  return Math.max(0, Math.floor((this.expiresAt - Date.now()) / (1000 * 60 * 60)));
});

// Virtual to check if match is active
MatchSchema.virtual('isActive').get(function() {
  return this.status !== 'expired' && this.status !== 'blocked' && this.expiresAt > new Date();
});

// Indexes for efficient queries
MatchSchema.index({ user1: 1, user2: 1 }, { unique: true });
MatchSchema.index({ user1: 1, status: 1 });
MatchSchema.index({ user2: 1, status: 1 });
MatchSchema.index({ project: 1 });
MatchSchema.index({ status: 1 });
MatchSchema.index({ createdAt: -1 });
MatchSchema.index({ expiresAt: 1 });
MatchSchema.index({ compatibilityScore: -1 });

// Compound index for finding matches for a user
MatchSchema.index({ 
  $or: [{ user1: 1 }, { user2: 1 }], 
  status: 1, 
  createdAt: -1 
});

// TTL index for automatic cleanup of expired matches
MatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to update match status
MatchSchema.pre('save', function(next) {
  // Check if it's a mutual match
  if (this.user1Action.action === 'like' && this.user2Action.action === 'like') {
    this.status = 'mutual';
  }
  
  // Check if match should be expired
  if (this.expiresAt <= new Date() && this.status === 'pending') {
    this.status = 'expired';
  }
  
  next();
});

// Static method to find matches for a user
MatchSchema.statics.findUserMatches = function(userId, status = null) {
  const query = {
    $or: [
      { user1: userId },
      { user2: userId }
    ]
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query)
    .populate('user1', 'name avatar userType categories rating')
    .populate('user2', 'name avatar userType categories rating')
    .populate('project', 'title category status')
    .sort({ createdAt: -1 });
};

// Static method to create a new match
MatchSchema.statics.createMatch = async function(user1Id, user2Id, projectId, initiatedById, compatibilityScore, matchDetails) {
  // Check if match already exists
  const existingMatch = await this.findOne({
    $or: [
      { user1: user1Id, user2: user2Id },
      { user1: user2Id, user2: user1Id }
    ]
  });
  
  if (existingMatch) {
    throw new Error('Match already exists between these users');
  }
  
  const matchData = {
    user1: user1Id,
    user2: user2Id,
    matchType: projectId ? 'user-to-project' : 'user-to-user',
    initiatedBy: initiatedById,
    compatibilityScore,
    matchDetails
  };
  
  if (projectId) {
    matchData.project = projectId;
  }
  
  // Set initial action for the initiating user
  if (initiatedById.toString() === user1Id.toString()) {
    matchData.user1Action = {
      action: 'like',
      timestamp: new Date()
    };
  } else {
    matchData.user2Action = {
      action: 'like',
      timestamp: new Date()
    };
  }
  
  return this.create(matchData);
};

// Method to update user action
MatchSchema.methods.updateUserAction = function(userId, action) {
  const timestamp = new Date();
  
  if (this.user1.toString() === userId.toString()) {
    this.user1Action = { action, timestamp };
  } else if (this.user2.toString() === userId.toString()) {
    this.user2Action = { action, timestamp };
  } else {
    throw new Error('User is not part of this match');
  }
  
  return this.save();
};

// Method to start conversation
MatchSchema.methods.startConversation = function() {
  if (this.status !== 'mutual') {
    throw new Error('Can only start conversation on mutual matches');
  }
  
  this.conversation.started = true;
  this.conversation.startedAt = new Date();
  
  return this.save();
};

// Method to add feedback
MatchSchema.methods.addFeedback = function(fromUserId, rating, comment) {
  this.feedback.push({
    fromUser: fromUserId,
    rating,
    comment
  });
  
  return this.save();
};

module.exports = mongoose.model('Match', MatchSchema);