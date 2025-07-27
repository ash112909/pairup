const express = require('express');
const Match = require('../models/Match');
const User = require('../models/User');
const Project = require('../models/Project');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// @route   GET /api/matches/discover
// @desc    Get potential matches for user
// @access  Private
router.get('/discover', async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, type = 'all' } = req.query;
    
    // Get users that current user has already interacted with
    const existingMatches = await Match.find({
      $or: [{ user1: userId }, { user2: userId }]
    }).select('user1 user2');
    
    const excludeUserIds = [userId];
    existingMatches.forEach(match => {
      if (match.user1.toString() !== userId.toString()) {
        excludeUserIds.push(match.user1);
      }
      if (match.user2.toString() !== userId.toString()) {
        excludeUserIds.push(match.user2);
      }
    });

    // Build query based on user type and preferences
    let matchQuery = {
      _id: { $nin: excludeUserIds },
      isActive: true,
      lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Active in last 30 days
    };

    // Filter by complementary user types
    if (req.user.userType === 'creator') {
      matchQuery.userType = { $in: ['contributor', 'both'] };
    } else if (req.user.userType === 'contributor') {
      matchQuery.userType = { $in: ['creator', 'both'] };
    }

    // Find potential matches
    let potentialMatches = await User.find(matchQuery)
      .select('name avatar userType categories subcategories bio experience location rating completedProjects lastActive')
      .limit(parseInt(limit) * parseInt(page))
      .sort({ 'rating.average': -1, lastActive: -1 });

    // Calculate compatibility scores and rank matches
    const rankedMatches = potentialMatches
      .map(match => {
        const compatibilityScore = req.user.calculateCompatibility(match);
        return {
          user: match,
          compatibilityScore,
          matchDetails: {
            commonCategories: req.user.categories.filter(cat => match.categories.includes(cat)),
            reasonForMatch: generateMatchReason(req.user, match, compatibilityScore),
            confidenceLevel: compatibilityScore >= 70 ? 'high' : compatibilityScore >= 40 ? 'medium' : 'low'
          }
        };
      })
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      matches: rankedMatches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: rankedMatches.length
      }
    });

  } catch (error) {
    console.error('Discover matches error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while discovering matches' 
    });
  }
});

// @route   POST /api/matches/like
// @desc    Like a user or project
// @access  Private
router.post('/like', async (req, res) => {
  try {
    const { targetUserId, projectId, type = 'like' } = req.body;
    const userId = req.user._id;

    if (!targetUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Target user ID is required' 
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'Target user not found' 
      });
    }

    // Check if match already exists
    const existingMatch = await Match.findOne({
      $or: [
        { user1: userId, user2: targetUserId },
        { user1: targetUserId, user2: userId }
      ]
    });

    let match;
    if (existingMatch) {
      // Update existing match
      await existingMatch.updateUserAction(userId, type);
      match = existingMatch;
    } else {
      // Create new match
      const compatibilityScore = req.user.calculateCompatibility(targetUser);
      const matchDetails = {
        commonCategories: req.user.categories.filter(cat => targetUser.categories.includes(cat)),
        reasonForMatch: generateMatchReason(req.user, targetUser, compatibilityScore),
        confidenceLevel: compatibilityScore >= 70 ? 'high' : compatibilityScore >= 40 ? 'medium' : 'low'
      };

      match = await Match.createMatch(
        userId,
        targetUserId,
        projectId,
        userId,
        compatibilityScore,
        matchDetails
      );
    }

    // Populate the match for response
    await match.populate([
      { path: 'user1', select: 'name avatar userType categories rating' },
      { path: 'user2', select: 'name avatar userType categories rating' },
      { path: 'project', select: 'title category status' }
    ]);

    res.json({
      success: true,
      message: match.status === 'mutual' ? 'It\'s a match!' : 'Like sent successfully',
      match,
      isMutual: match.status === 'mutual'
    });

  } catch (error) {
    console.error('Like user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while processing like' 
    });
  }
});

// @route   POST /api/matches/pass
// @desc    Pass on a user
// @access  Private
router.post('/pass', async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const userId = req.user._id;

    // Check if match already exists
    const existingMatch = await Match.findOne({
      $or: [
        { user1: userId, user2: targetUserId },
        { user1: targetUserId, user2: userId }
      ]
    });

    if (existingMatch) {
      await existingMatch.updateUserAction(userId, 'pass');
    } else {
      // Create a pass record for future reference
      const targetUser = await User.findById(targetUserId);
      if (targetUser) {
        const compatibilityScore = req.user.calculateCompatibility(targetUser);
        await Match.createMatch(
          userId,
          targetUserId,
          null,
          userId,
          compatibilityScore,
          { reasonForMatch: 'User passed' }
        );
        await existingMatch.updateUserAction(userId, 'pass');
      }
    }

    res.json({
      success: true,
      message: 'Pass recorded successfully'
    });

  } catch (error) {
    console.error('Pass user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while processing pass' 
    });
  }
});

// @route   GET /api/matches/my-matches
// @desc    Get user's matches
// @access  Private
router.get('/my-matches', async (req, res) => {
  try {
    const userId = req.user._id;
    const { status = 'mutual', page = 1, limit = 20 } = req.query;

    const matches = await Match.findUserMatches(userId, status)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Process matches to show the other user's info
    const processedMatches = matches.map(match => {
      const isUser1 = match.user1._id.toString() === userId.toString();
      const otherUser = isUser1 ? match.user2 : match.user1;
      const userAction = isUser1 ? match.user1Action : match.user2Action;
      const otherUserAction = isUser1 ? match.user2Action : match.user1Action;

      return {
        _id: match._id,
        otherUser,
        project: match.project,
        status: match.status,
        userAction,
        otherUserAction,
        compatibilityScore: match.compatibilityScore,
        matchDetails: match.matchDetails,
        conversation: match.conversation,
        createdAt: match.createdAt,
        ageInHours: match.ageInHours,
        hoursUntilExpiry: match.hoursUntilExpiry,
        isActive: match.isActive
      };
    });

    res.json({
      success: true,
      matches: processedMatches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: processedMatches.length
      }
    });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching matches' 
    });
  }
});

// @route   POST /api/matches/:matchId/start-conversation
// @desc    Start conversation with a match
// @access  Private
router.post('/:matchId/start-conversation', async (req, res) => {
  try {
    const { matchId } = req.params;
    const userId = req.user._id;

    const match = await Match.findById(matchId).populate([
      { path: 'user1', select: 'name avatar' },
      { path: 'user2', select: 'name avatar' }
    ]);

    if (!match) {
      return res.status(404).json({ 
        success: false, 
        message: 'Match not found' 
      });
    }

    // Verify user is part of this match
    if (match.user1._id.toString() !== userId.toString() && 
        match.user2._id.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access to match' 
      });
    }

    await match.startConversation();

    res.json({
      success: true,
      message: 'Conversation started successfully',
      match
    });

  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error while starting conversation' 
    });
  }
});

// @route   POST /api/matches/:matchId/feedback
// @desc    Add feedback for a match
// @access  Private
router.post('/:matchId/feedback', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Rating must be between 1 and 5' 
      });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ 
        success: false, 
        message: 'Match not found' 
      });
    }

    // Verify user is part of this match
    if (match.user1.toString() !== userId.toString() && 
        match.user2.toString() !== userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized access to match' 
      });
    }

    await match.addFeedback(userId, rating, comment);

    res.json({
      success: true,
      message: 'Feedback added successfully'
    });

  } catch (error) {
    console.error('Add feedback error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while adding feedback' 
    });
  }
});

// @route   GET /api/matches/stats
// @desc    Get user's matching statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Match.aggregate([
      {
        $match: {
          $or: [{ user1: userId }, { user2: userId }]
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgCompatibility: { $avg: '$compatibilityScore' }
        }
      }
    ]);

    const formattedStats = {
      totalMatches: 0,
      mutualMatches: 0,
      pendingMatches: 0,
      passedMatches: 0,
      averageCompatibility: 0,
      conversationsStarted: 0
    };

    stats.forEach(stat => {
      formattedStats.totalMatches += stat.count;
      if (stat._id === 'mutual') {
        formattedStats.mutualMatches = stat.count;
      } else if (stat._id === 'pending') {
        formattedStats.pendingMatches = stat.count;
      }
      formattedStats.averageCompatibility += stat.avgCompatibility || 0;
    });

    formattedStats.averageCompatibility = formattedStats.averageCompatibility / stats.length || 0;

    // Count conversations started
    const conversationsCount = await Match.countDocuments({
      $or: [{ user1: userId }, { user2: userId }],
      'conversation.started': true
    });
    formattedStats.conversationsStarted = conversationsCount;

    res.json({
      success: true,
      stats: formattedStats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching stats' 
    });
  }
});

// Helper function to generate match reason
function generateMatchReason(user1, user2, score) {
  const commonCategories = user1.categories.filter(cat => user2.categories.includes(cat));
  
  if (score >= 80) {
    return `Excellent match! You both work in ${commonCategories.join(', ')} and have complementary skills.`;
  } else if (score >= 60) {
    return `Great potential! You share interests in ${commonCategories.join(', ')}.`;
  } else if (score >= 40) {
    return `Interesting match with some overlapping areas.`;
  } else {
    return `Different backgrounds might bring fresh perspectives.`;
  }
}

module.exports = router;