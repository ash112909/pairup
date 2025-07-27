const express = require('express');
const User = require('../models/User');
const { authenticateUser, requireCompleteProfile } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// @route   GET /api/users/profile
// @desc    Get current user's full profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      user,
      profileCompletion: user.profileCompletion
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching profile' 
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('experience').optional().trim().isLength({ max: 200 }).withMessage('Experience cannot exceed 200 characters'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location cannot exceed 100 characters'),
  body('availability').optional().isIn(['full-time', 'part-time', 'freelance', 'weekends']).withMessage('Invalid availability option'),
  body('categories').optional().isArray().withMessage('Categories must be an array'),
  body('userType').optional().isIn(['creator', 'contributor', 'both']).withMessage('Invalid user type')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors',
        errors: errors.array() 
      });
    }

    const allowedUpdates = [
      'name', 'userType', 'categories', 'subcategories', 'bio', 'experience', 
      'availability', 'location', 'avatar', 'skills', 'portfolio', 'preferences'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
      profileCompletion: user.profileCompletion
    });

  } catch (error) {
    console.error('Update profile error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation error',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating profile' 
    });
  }
});

// @route   GET /api/users/:userId
// @desc    Get public user profile
// @access  Private
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select(
      'name avatar userType categories bio experience location rating completedProjects lastActive portfolio skills'
    );

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching user' 
    });
  }
});

// @route   POST /api/users/skills
// @desc    Add skill to user profile
// @access  Private
router.post('/skills', [
  body('name').trim().notEmpty().withMessage('Skill name is required'),
  body('level').isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid skill level')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors',
        errors: errors.array() 
      });
    }

    const { name, level } = req.body;
    const user = await User.findById(req.user._id);

    // Check if skill already exists
    const existingSkill = user.skills.find(skill => 
      skill.name.toLowerCase() === name.toLowerCase()
    );

    if (existingSkill) {
      existingSkill.level = level;
    } else {
      user.skills.push({ name, level });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Skill added successfully',
      skills: user.skills
    });

  } catch (error) {
    console.error('Add skill error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while adding skill' 
    });
  }
});

// @route   DELETE /api/users/skills/:skillId
// @desc    Remove skill from user profile
// @access  Private
router.delete('/skills/:skillId', async (req, res) => {
  try {
    const { skillId } = req.params;
    const user = await User.findById(req.user._id);

    user.skills = user.skills.filter(skill => skill._id.toString() !== skillId);
    await user.save();

    res.json({
      success: true,
      message: 'Skill removed successfully',
      skills: user.skills
    });

  } catch (error) {
    console.error('Remove skill error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while removing skill' 
    });
  }
});

// @route   POST /api/users/portfolio
// @desc    Add portfolio item
// @access  Private
router.post('/portfolio', [
  body('title').trim().notEmpty().withMessage('Portfolio title is required'),
  body('description').trim().notEmpty().withMessage('Portfolio description is required'),
  body('url').optional().isURL().withMessage('Invalid URL format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors',
        errors: errors.array() 
      });
    }

    const { title, description, url, image } = req.body;
    const user = await User.findById(req.user._id);

    user.portfolio.push({ title, description, url, image });
    await user.save();

    res.json({
      success: true,
      message: 'Portfolio item added successfully',
      portfolio: user.portfolio
    });

  } catch (error) {
    console.error('Add portfolio error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while adding portfolio item' 
    });
  }
});

// @route   DELETE /api/users/portfolio/:itemId
// @desc    Remove portfolio item
// @access  Private
router.delete('/portfolio/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = await User.findById(req.user._id);

    user.portfolio = user.portfolio.filter(item => item._id.toString() !== itemId);
    await user.save();

    res.json({
      success: true,
      message: 'Portfolio item removed successfully',
      portfolio: user.portfolio
    });

  } catch (error) {
    console.error('Remove portfolio error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while removing portfolio item' 
    });
  }
});

// @route   GET /api/users/search
// @desc    Search users by criteria
// @access  Private
router.get('/search', requireCompleteProfile, async (req, res) => {
  try {
    const { 
      query, 
      category, 
      userType, 
      location, 
      minRating = 0,
      page = 1, 
      limit = 20 
    } = req.query;

    let searchCriteria = {
      _id: { $ne: req.user._id }, // Exclude current user
      isActive: true
    };

    // Text search
    if (query) {
      searchCriteria.$or = [
        { name: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } },
        { 'skills.name': { $regex: query, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category) {
      searchCriteria.categories = category;
    }

    // Filter by user type
    if (userType) {
      searchCriteria.userType = userType;
    }

    // Filter by location
    if (location) {
      searchCriteria.location = { $regex: location, $options: 'i' };
    }

    // Filter by minimum rating
    if (minRating > 0) {
      searchCriteria['rating.average'] = { $gte: parseFloat(minRating) };
    }

    const users = await User.find(searchCriteria)
      .select('name avatar userType categories bio experience location rating completedProjects lastActive')
      .sort({ 'rating.average': -1, lastActive: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(searchCriteria);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while searching users' 
    });
  }
});

// @route   PUT /api/users/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', [
  body('maxDistance').optional().isNumeric().withMessage('Max distance must be a number'),
  body('workStyle').optional().isIn(['remote', 'in-person', 'hybrid']).withMessage('Invalid work style'),
  body('preferredProjectTypes').optional().isArray().withMessage('Preferred project types must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation errors',
        errors: errors.array() 
      });
    }

    const user = await User.findById(req.user._id);
    
    // Update preferences
    Object.keys(req.body).forEach(key => {
      if (user.preferences[key] !== undefined) {
        user.preferences[key] = req.body[key];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating preferences' 
    });
  }
});

// @route   POST /api/users/deactivate
// @desc    Deactivate user account
// @access  Private
router.post('/deactivate', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isActive = false;
    await user.save();

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deactivating account' 
    });
  }
});

// @route   POST /api/users/reactivate
// @desc    Reactivate user account
// @access  Private
router.post('/reactivate', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isActive = true;
    user.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Account reactivated successfully'
    });

  } catch (error) {
    console.error('Reactivate account error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while reactivating account' 
    });
  }
});

// @route   GET /api/users/analytics
// @desc    Get user analytics
// @access  Private
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user's profile views, matches, etc.
    const analytics = {
      profileCompletion: req.user.profileCompletion,
      accountAge: Math.floor((Date.now() - req.user.createdAt) / (1000 * 60 * 60 * 24)),
      lastActiveAgo: Math.floor((Date.now() - req.user.lastActive) / (1000 * 60 * 60)),
      totalSkills: req.user.skills.length,
      totalPortfolioItems: req.user.portfolio.length,
      currentRating: req.user.rating.average,
      totalRatings: req.user.rating.count,
      completedProjects: req.user.completedProjects
    };

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching analytics' 
    });
  }
});

module.exports = router;