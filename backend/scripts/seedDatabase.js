const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Project = require('../models/Project');
const Match = require('../models/Match');
require('dotenv').config();

// Sample users data
const sampleUsers = [
  {
    name: 'Sarah Chen',
    email: 'sarah.chen@email.com',
    password: 'password123',
    userType: 'creator',
    categories: ['Technology', 'Design'],
    subcategories: {
      'Technology': ['Mobile Apps', 'AI/ML'],
      'Design': ['UI/UX Design', 'Product Design']
    },
    bio: 'Passionate tech entrepreneur building the next generation of healthcare applications. Love combining design thinking with cutting-edge technology.',
    experience: '5+ years in health tech',
    availability: 'full-time',
    location: 'San Francisco, CA',
    avatar: '👩‍💻',
    skills: [
      { name: 'React Native', level: 'advanced' },
      { name: 'Product Management', level: 'expert' },
      { name: 'UI/UX Design', level: 'intermediate' }
    ],
    rating: { average: 4.8, count: 15 },
    completedProjects: 8,
    verificationStatus: { email: true, phone: true, identity: false }
  },
  {
    name: 'Marcus Rodriguez',
    email: 'marcus.rodriguez@email.com',
    password: 'password123',
    userType: 'contributor',
    categories: ['Technology', 'Business'],
    subcategories: {
      'Technology': ['Web Development', 'DevOps', 'Cybersecurity'],
      'Business': ['Strategy', 'Operations']
    },
    bio: 'Full-stack developer with a passion for scalable architecture and clean code. Love working on meaningful projects that make a difference.',
    experience: '7+ years in web development',
    availability: 'part-time',
    location: 'Austin, TX',
    avatar: '👨‍💼',
    skills: [
      { name: 'React', level: 'expert' },
      { name: 'Node.js', level: 'expert' },
      { name: 'AWS', level: 'advanced' },
      { name: 'Docker', level: 'intermediate' }
    ],
    rating: { average: 4.9, count: 23 },
    completedProjects: 12,
    verificationStatus: { email: true, phone: false, identity: true }
  },
  {
    name: 'Elena Vasquez',
    email: 'elena.vasquez@email.com',
    password: 'password123',
    userType: 'both',
    categories: ['Business', 'Creative', 'Content'],
    subcategories: {
      'Business': ['Marketing', 'Sales', 'Strategy'],
      'Creative': ['Art Projects', 'Creative Writing'],
      'Content': ['Social Media', 'Copywriting', 'Blogging']
    },
    bio: 'Creative strategist and entrepreneur launching sustainable fashion initiatives. Looking for like-minded collaborators to change the industry.',
    experience: '4+ years in fashion and marketing',
    availability: 'freelance',
    location: 'Los Angeles, CA',
    avatar: '🌱',
    skills: [
      { name: 'Brand Strategy', level: 'expert' },
      { name: 'Social Media Marketing', level: 'advanced' },
      { name: 'Creative Writing', level: 'advanced' },
      { name: 'Sustainability Consulting', level: 'intermediate' }
    ],
    rating: { average: 4.6, count: 8 },
    completedProjects: 5,
    verificationStatus: { email: true, phone: true, identity: false }
  },
  {
    name: 'David Kim',
    email: 'david.kim@email.com',
    password: 'password123',
    userType: 'contributor',
    categories: ['Design', 'Technology'],
    subcategories: {
      'Design': ['Graphic Design', 'Brand Identity', 'Animation'],
      'Technology': ['Web Development', 'Mobile Apps']
    },
    bio: 'UI/UX designer and front-end developer who believes in the power of good design to solve complex problems.',
    experience: '6+ years in design and development',
    availability: 'part-time',
    location: 'Seattle, WA',
    avatar: '🎨',
    skills: [
      { name: 'Figma', level: 'expert' },
      { name: 'React', level: 'advanced' },
      { name: 'Animation', level: 'intermediate' },
      { name: 'Brand Design', level: 'advanced' }
    ],
    rating: { average: 4.7, count: 11 },
    completedProjects: 9,
    verificationStatus: { email: true, phone: false, identity: false }
  },
  {
    name: 'Priya Patel',
    email: 'priya.patel@email.com',
    password: 'password123',
    userType: 'creator',
    categories: ['Business', 'Events', 'Technology'],
    subcategories: {
      'Business': ['Finance', 'Operations', 'Legal'],
      'Events': ['Conferences', 'Networking', 'Fundraising'],
      'Technology': ['Blockchain', 'AI/ML']
    },
    bio: 'Fintech entrepreneur passionate about financial inclusion and blockchain innovation. Building the future of decentralized finance.',
    experience: '8+ years in fintech',
    availability: 'full-time',
    location: 'New York, NY',
    avatar: '💼',
    skills: [
      { name: 'Blockchain', level: 'expert' },
      { name: 'Financial Modeling', level: 'expert' },
      { name: 'Regulatory Compliance', level: 'advanced' },
      { name: 'Event Planning', level: 'intermediate' }
    ],
    rating: { average: 4.9, count: 19 },
    completedProjects: 6,
    verificationStatus: { email: true, phone: true, identity: true }
  }
];

// Sample projects data
const sampleProjects = [
  {
    title: 'AI-Powered Health Monitoring App',
    description: 'Developing a revolutionary mobile application that uses machine learning to predict health issues before they become serious. The app will integrate with wearable devices and provide personalized health insights. We need experienced mobile developers, ML engineers, and UI/UX designers to join our mission of making healthcare more proactive and accessible.',
    category: 'Technology',
    subcategory: 'Mobile Apps',
    status: 'open',
    timeline: {
      estimatedDuration: { value: 6, unit: 'months' }
    },
    budget: {
      min: 50000,
      max: 100000,
      type: 'equity'
    },
    requiredSkills: [
      { skill: 'React Native', level: 'advanced', required: true },
      { skill: 'Machine Learning', level: 'intermediate', required: true },
      { skill: 'Healthcare Domain', level: 'beginner', required: false }
    ],
    teamSize: { current: 2, target: 6 },
    location: 'San Francisco, CA',
    workStyle: 'hybrid',
    tags: ['health', 'ai', 'mobile', 'startup'],
    featured: true
  },
  {
    title: 'Sustainable Fashion Marketplace',
    description: 'Creating an online marketplace that connects sustainable fashion brands with conscious consumers. The platform will feature carbon footprint tracking, ethical sourcing verification, and community-driven reviews. Looking for full-stack developers, marketing specialists, and sustainability experts to build something meaningful.',
    category: 'Business',
    subcategory: 'Marketing',
    status: 'open',
    timeline: {
      estimatedDuration: { value: 4, unit: 'months' }
    },
    budget: {
      min: 30000,
      max: 60000,
      type: 'fixed'
    },
    requiredSkills: [
      { skill: 'E-commerce', level: 'advanced', required: true },
      { skill: 'Digital Marketing', level: 'intermediate', required: true },
      { skill: 'Sustainability', level: 'beginner', required: false }
    ],
    teamSize: { current: 1, target: 4 },
    location: 'Los Angeles, CA',
    workStyle: 'remote',
    tags: ['sustainability', 'fashion', 'e-commerce', 'social-impact']
  },
  {
    title: 'Open Source Developer Tools',
    description: 'Building a suite of developer productivity tools focused on code quality and team collaboration. The project includes automated code review, performance monitoring, and integration with popular IDEs. This is an open-source initiative looking for passionate developers who want to give back to the community.',
    category: 'Technology',
    subcategory: 'Web Development',
    status: 'open',
    timeline: {
      estimatedDuration: { value: 8, unit: 'months' }
    },
    budget: {
      type: 'volunteer'
    },
    requiredSkills: [
      { skill: 'JavaScript', level: 'advanced', required: true },
      { skill: 'Node.js', level: 'advanced', required: true },
      { skill: 'Open Source', level: 'intermediate', required: false }
    ],
    teamSize: { current: 3, target: 8 },
    workStyle: 'remote',
    tags: ['open-source', 'developer-tools', 'productivity'],
    featured: true
  },
  {
    title: 'Interactive Learning Platform',
    description: 'Designing an immersive educational platform that gamifies learning for K-12 students. The platform will feature interactive lessons, progress tracking, and peer collaboration tools. We need educational technology experts, game designers, and front-end developers.',
    category: 'Design',
    subcategory: 'UI/UX Design',
    status: 'open',
    timeline: {
      estimatedDuration: { value: 5, unit: 'months' }
    },
    budget: {
      min: 40000,
      max: 80000,
      type: 'fixed'
    },
    requiredSkills: [
      { skill: 'Educational Technology', level: 'intermediate', required: true },
      { skill: 'Game Design', level: 'intermediate', required: true },
      { skill: 'React', level: 'advanced', required: true }
    ],
    teamSize: { current: 2, target: 5 },
    location: 'Remote',
    workStyle: 'remote',
    tags: ['education', 'gamification', 'children', 'learning']
  }
];

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pairup');
    console.log('📦 Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Project.deleteMany({});
    await Match.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = new User({
        ...userData,
        password: hashedPassword,
        lastActive: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random last active within 7 days
      });
      await user.save();
      createdUsers.push(user);
      console.log(`👤 Created user: ${user.name}`);
    }

    // Create projects
    const createdProjects = [];
    for (let i = 0; i < sampleProjects.length; i++) {
      const projectData = sampleProjects[i];
      const creator = createdUsers.find(user => user.userType === 'creator' || user.userType === 'both');
      
      const project = new Project({
        ...projectData,
        creator: creator._id,
        createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random creation within 30 days
        views: Math.floor(Math.random() * 100) + 10
      });
      
      await project.save();
      createdProjects.push(project);
      console.log(`📋 Created project: ${project.title}`);
    }

    // Create some sample matches
    const contributors = createdUsers.filter(user => user.userType === 'contributor' || user.userType === 'both');
    const creators = createdUsers.filter(user => user.userType === 'creator' || user.userType === 'both');

    for (let i = 0; i < Math.min(contributors.length, creators.length); i++) {
      const contributor = contributors[i];
      const creator = creators[i];
      
      if (contributor._id.toString() !== creator._id.toString()) {
        const compatibilityScore = contributor.calculateCompatibility(creator);
        
        const match = new Match({
          user1: contributor._id,
          user2: creator._id,
          matchType: 'user-to-user',
          initiatedBy: contributor._id,
          compatibilityScore,
          status: Math.random() > 0.5 ? 'mutual' : 'pending',
          user1Action: { action: 'like', timestamp: new Date() },
          user2Action: { 
            action: Math.random() > 0.5 ? 'like' : 'pending', 
            timestamp: Math.random() > 0.5 ? new Date() : undefined 
          },
          matchDetails: {
            commonCategories: contributor.categories.filter(cat => creator.categories.includes(cat)),
            reasonForMatch: 'Great potential collaboration based on shared interests',
            confidenceLevel: compatibilityScore >= 70 ? 'high' : compatibilityScore >= 40 ? 'medium' : 'low'
          }
        });
        
        await match.save();
        console.log(`🤝 Created match between ${contributor.name} and ${creator.name}`);
      }
    }

    // Add some applications to projects
    for (const project of createdProjects) {
      const applicableUsers = createdUsers.filter(user => 
        user._id.toString() !== project.creator.toString() &&
        (user.userType === 'contributor' || user.userType === 'both')
      );
      
      // Add 1-3 random applications per project
      const numApplications = Math.floor(Math.random() * 3) + 1;
      for (let i = 0; i < Math.min(numApplications, applicableUsers.length); i++) {
        const applicant = applicableUsers[i];
        project.applications.push({
          user: applicant._id,
          message: `I'm very interested in joining this project. My experience in ${applicant.categories.join(', ')} would be valuable.`,
          status: 'pending'
        });
      }
      
      await project.save();
    }

    console.log('✅ Database seeded successfully!');
    console.log(`👥 Created ${createdUsers.length} users`);
    console.log(`📋 Created ${createdProjects.length} projects`);
    console.log('🎯 Sample login credentials:');
    console.log('   Email: sarah.chen@email.com, Password: password123 (Creator)');
    console.log('   Email: marcus.rodriguez@email.com, Password: password123 (Contributor)');
    console.log('   Email: elena.vasquez@email.com, Password: password123 (Both)');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Run the seed function
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;