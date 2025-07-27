const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token. User not found.' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated.' 
      });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during authentication.' 
    });
  }
};

// Middleware to check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user.verificationStatus.email) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required to access this resource.'
    });
  }
  next();
};

// Middleware to check user type
const requireUserType = (allowedTypes) => {
  return (req, res, next) => {
    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required user type: ${allowedTypes.join(' or ')}`
      });
    }
    next();
  };
};

// Middleware to check if profile is complete
const requireCompleteProfile = (req, res, next) => {
  const requiredFields = ['name', 'userType', 'bio', 'experience', 'location'];
  const missingFields = requiredFields.filter(field => !req.user[field]);
  
  if (missingFields.length > 0 || req.user.categories.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please complete your profile before accessing this feature.',
      missingFields: missingFields.concat(req.user.categories.length === 0 ? ['categories'] : [])
    });
  }
  next();
};

module.exports = {
  authenticateUser,
  requireVerification,
  requireUserType,
  requireCompleteProfile
};