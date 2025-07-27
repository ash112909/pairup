const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const { authenticateUser, requireUserType, requireCompleteProfile } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser);

// @route   POST /api/projects
// @desc    Create a new project
// @access  Private (Creators and Both)
router.post('/', [
  requireUserType(['creator', 'both']),
  requireCompleteProfile,
  body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be between 5-200 characters'),
  body('description').trim().isLength({ min: 20, max: 2000 }).withMessage('Description must be between 20-2000 characters'),
  body('category').isIn(['Technology', 'Design', 'Content', 'Business', 'Events', 'Creative']).withMessage('Invalid category'),
  body('subcategory').trim().notEmpty().withMessage('Subcategory is required'),
  body('teamSize.target').isInt({ min: 1, max: 50 }).withMessage('Target team size must be between 1-50')
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

    const projectData = {
      ...req.body,
      creator: req.user._id
    };

    const project = new Project(projectData);
    await project.save();

    await project.populate('creator', 'name avatar userType rating');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });

  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while creating project' 
    });
  }
});

// @route   GET /api/projects
// @desc    Get projects with filtering and pagination
// @access  Private
router.get('/', requireCompleteProfile, async (req, res) => {
  try {
    const { 
      category, 
      subcategory, 
      status = 'open',
      location,
      workStyle,
      featured,
      search,
      page = 1, 
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = { isPublic: true };

    // Apply filters
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (status) query.status = status;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (workStyle) query.workStyle = workStyle;
    if (featured === 'true') query.featured = true;

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Exclude user's own projects from general listing
    if (req.query.excludeOwn !== 'false') {
      query.creator = { $ne: req.user._id };
    }

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const projects = await Project.find(query)
      .populate('creator', 'name avatar userType rating location')
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Project.countDocuments(query);

    // Calculate match scores for each project
    const projectsWithScores = projects.map(project => {
      const matchScore = project.calculateMatchScore(req.user);
      return {
        ...project.toObject(),
        matchScore
      };
    });

    // Sort by match score if no specific sort is requested
    if (sortBy === 'relevance') {
      projectsWithScores.sort((a, b) => b.matchScore - a.matchScore);
    }

    res.json({
      success: true,
      projects: projectsWithScores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching projects' 
    });
  }
});

// @route   GET /api/projects/my-projects
// @desc    Get current user's projects
// @access  Private
router.get('/my-projects', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = { creator: req.user._id };
    if (status) query.status = status;

    const projects = await Project.find(query)
      .populate('collaborators.user', 'name avatar userType rating')
      .populate('applications.user', 'name avatar userType rating')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Project.countDocuments(query);

    res.json({
      success: true,
      projects,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get my projects error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching your projects' 
    });
  }
});

// @route   GET /api/projects/:projectId
// @desc    Get project by ID
// @access  Private
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('creator', 'name avatar userType rating location completedProjects')
      .populate('collaborators.user', 'name avatar userType rating')
      .populate('applications.user', 'name avatar userType rating');

    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

    // Increment view count if not the creator
    if (project.creator._id.toString() !== req.user._id.toString()) {
      project.views += 1;
      await project.save();
    }

    // Calculate match score
    const matchScore = project.calculateMatchScore(req.user);
    const canApply = project.canUserApply(req.user._id);

    res.json({
      success: true,
      project: {
        ...project.toObject(),
        matchScore,
        canApply
      }
    });

  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching project' 
    });
  }
});

// @route   PUT /api/projects/:projectId
// @desc    Update project
// @access  Private (Project Creator)
router.put('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

    // Check if user is the creator
    if (project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only project creator can update this project' 
      });
    }

    const allowedUpdates = [
      'title', 'description', 'status', 'timeline', 'budget', 
      'requiredSkills', 'teamSize', 'location', 'workStyle', 
      'tags', 'attachments', 'milestones', 'isPublic'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('creator', 'name avatar userType rating');

    res.json({
      success: true,
      message: 'Project updated successfully',
      project: updatedProject
    });

  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating project' 
    });
  }
});

// @route   DELETE /api/projects/:projectId
// @desc    Delete project
// @access  Private (Project Creator)
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

    // Check if user is the creator
    if (project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only project creator can delete this project' 
      });
    }

    await Project.findByIdAndDelete(projectId);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting project' 
    });
  }
});

// @route   POST /api/projects/:projectId/apply
// @desc    Apply to join a project
// @access  Private
router.post('/:projectId/apply', [
  requireUserType(['contributor', 'both']),
  requireCompleteProfile,
  body('message').trim().isLength({ min: 10, max: 500 }).withMessage('Application message must be between 10-500 characters')
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

    const { projectId } = req.params;
    const { message } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

    // Check if user can apply
    if (!project.canUserApply(req.user._id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot apply to this project' 
      });
    }

    // Add application
    project.applications.push({
      user: req.user._id,
      message
    });

    await project.save();
    await project.populate('applications.user', 'name avatar userType rating');

    res.json({
      success: true,
      message: 'Application submitted successfully',
      application: project.applications[project.applications.length - 1]
    });

  } catch (error) {
    console.error('Apply to project error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while applying to project' 
    });
  }
});

// @route   PUT /api/projects/:projectId/applications/:applicationId
// @desc    Update application status (accept/reject)
// @access  Private (Project Creator)
router.put('/:projectId/applications/:applicationId', [
  body('status').isIn(['accepted', 'rejected']).withMessage('Status must be accepted or rejected'),
  body('role').optional().trim().notEmpty().withMessage('Role cannot be empty if provided')
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

    const { projectId, applicationId } = req.params;
    const { status, role } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ 
        success: false, 
        message: 'Project not found' 
      });
    }

    // Check if user is the creator
    if (project.creator.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only project creator can update applications' 
      });
    }

    const application = project.applications.id(applicationId);
    if (!application) {
      return res.status(404).json({ 
        success: false, 
        message: 'Application not found' 
      });
    }

    application.status = status;

    // If accepted, add to collaborators
    if (status === 'accepted') {
      project.collaborators.push({
        user: application.user,
        role: role || 'Collaborator',
        status: 'accepted'
      });
    }

    await project.save();

    res.json({
      success: true,
      message: `Application ${status} successfully`,
      application
    });

  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating application' 
    });
  }
});

// @route   GET /api/projects/categories/stats
// @desc    Get project statistics by category
// @access  Private
router.get('/categories/stats', async (req, res) => {
  try {
    const stats = await Project.aggregate([
      { $match: { isPublic: true, status: 'open' } },
      { 
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgTeamSize: { $avg: '$teamSize.target' },
          avgRating: { $avg: '$rating.average' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching category statistics' 
    });
  }
});

// @route   GET /api/projects/featured
// @desc    Get featured projects
// @access  Private
router.get('/featured', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const projects = await Project.find({
      featured: true,
      status: 'open',
      isPublic: true
    })
    .populate('creator', 'name avatar userType rating')
    .sort({ 'rating.average': -1, createdAt: -1 })
    .limit(parseInt(limit));

    res.json({
      success: true,
      projects
    });

  } catch (error) {
    console.error('Get featured projects error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching featured projects' 
    });
  }
});

module.exports = router;