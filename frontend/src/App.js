import React, { useState } from 'react';
import { Heart, X, ArrowLeft, ArrowRight, User, Briefcase, Calendar, Lightbulb, Code, Palette, Camera, Music, BookOpen, TrendingUp, Users, MessageCircle, Star } from 'lucide-react';

const PairUpApp = () => {
  const [currentStep, setCurrentStep] = useState('welcome');
  const [userProfile, setUserProfile] = useState({
    name: '',
    userType: '', // 'creator', 'contributor', 'both'
    categories: [],
    subcategories: {},
    bio: '',
    experience: '',
    availability: '',
    location: ''
  });
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Sample data for categories and subcategories
  const categories = {
    'Technology': {
      icon: Code,
      subcategories: ['Web Development', 'Mobile Apps', 'AI/ML', 'Blockchain', 'DevOps', 'Cybersecurity']
    },
    'Design': {
      icon: Palette,
      subcategories: ['UI/UX Design', 'Graphic Design', 'Brand Identity', 'Product Design', 'Animation', 'Photography']
    },
    'Content': {
      icon: BookOpen,
      subcategories: ['Writing', 'Video Production', 'Podcasting', 'Social Media', 'Copywriting', 'Blogging']
    },
    'Business': {
      icon: TrendingUp,
      subcategories: ['Marketing', 'Sales', 'Operations', 'Finance', 'Strategy', 'Legal']
    },
    'Events': {
      icon: Calendar,
      subcategories: ['Conferences', 'Workshops', 'Networking', 'Fundraising', 'Community Events', 'Trade Shows']
    },
    'Creative': {
      icon: Music,
      subcategories: ['Music Production', 'Film Making', 'Art Projects', 'Creative Writing', 'Performance', 'Crafts']
    }
  };

  // Sample potential matches
  const sampleMatches = [
    {
      id: 1,
      name: 'Sarah Chen',
      type: 'creator',
      project: 'AI-Powered Health App',
      category: 'Technology',
      subcategory: 'Mobile Apps',
      bio: 'Building the next generation of healthcare technology. Looking for experienced developers and UI/UX designers.',
      experience: '5+ years in health tech',
      location: 'San Francisco, CA',
      avatar: '👩‍💻'
    },
    {
      id: 2,
      name: 'Marcus Rodriguez',
      type: 'contributor',
      expertise: 'Full-Stack Development',
      category: 'Technology',
      subcategory: 'Web Development',
      bio: 'Passionate full-stack developer with expertise in React, Node.js, and cloud infrastructure. Love working on meaningful projects.',
      experience: '7+ years in web development',
      location: 'Austin, TX',
      avatar: '👨‍💼'
    },
    {
      id: 3,
      name: 'Elena Vasquez',
      type: 'creator',
      project: 'Sustainable Fashion Brand',
      category: 'Business',
      subcategory: 'Marketing',
      bio: 'Launching an eco-friendly fashion startup. Need marketing experts and brand strategists to join the mission.',
      experience: '3+ years in fashion industry',
      location: 'Los Angeles, CA',
      avatar: '🌱'
    }
  ];

  const handleStepNavigation = (step) => {
    setCurrentStep(step);
  };

  const handleProfileUpdate = (field, value) => {
    setUserProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryToggle = (category) => {
    setUserProfile(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const handleSubcategoryToggle = (category, subcategory) => {
    setUserProfile(prev => ({
      ...prev,
      subcategories: {
        ...prev.subcategories,
        [category]: prev.subcategories[category]?.includes(subcategory)
          ? prev.subcategories[category].filter(s => s !== subcategory)
          : [...(prev.subcategories[category] || []), subcategory]
      }
    }));
  };

  const handleSwipe = (direction) => {
    if (direction === 'right') {
      // Handle match logic here
      console.log('Liked:', sampleMatches[currentCardIndex]);
    }
    
    if (currentCardIndex < sampleMatches.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setCurrentCardIndex(0); // Loop back to start
    }
  };

  const WelcomeScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center transform hover:scale-105 transition-all duration-300">
        <div className="mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mx-auto flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            PairUp
          </h1>
          <p className="text-gray-600 mt-2">Connect. Create. Collaborate.</p>
        </div>
        
        <p className="text-gray-700 mb-8 leading-relaxed">
          Match with creators and contributors for outcome-based initiatives, projects, startups, and events.
        </p>
        
        <button
          onClick={() => handleStepNavigation('signup')}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
        >
          Get Started
        </button>
      </div>
    </div>
  );

  const SignupScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="flex items-center mb-6">
            <button onClick={() => handleStepNavigation('welcome')} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">Create Profile</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={userProfile.name}
                onChange={(e) => handleProfileUpdate('name', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">I want to be a...</label>
              <div className="space-y-3">
                {[
                  { value: 'creator', label: 'Creator', desc: 'I have projects and need contributors', icon: Lightbulb },
                  { value: 'contributor', label: 'Contributor', desc: 'I want to join and contribute to projects', icon: User },
                  { value: 'both', label: 'Both', desc: 'I create projects and contribute to others', icon: Users }
                ].map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleProfileUpdate('userType', value)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      userProfile.userType === value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className={`w-6 h-6 mr-3 ${userProfile.userType === value ? 'text-purple-600' : 'text-gray-500'}`} />
                      <div>
                        <div className={`font-semibold ${userProfile.userType === value ? 'text-purple-600' : 'text-gray-800'}`}>
                          {label}
                        </div>
                        <div className="text-sm text-gray-600">{desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {userProfile.userType && (
              <button
                onClick={() => handleStepNavigation('categories')}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold mt-6"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const CategoriesScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <button onClick={() => handleStepNavigation('signup')} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">Choose Categories</h2>
          </div>
          
          <p className="text-gray-600 mb-6">Select the categories you're interested in working on:</p>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Object.entries(categories).map(([category, { icon: Icon }]) => (
              <button
                key={category}
                onClick={() => handleCategoryToggle(category)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  userProfile.categories.includes(category)
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <Icon className={`w-8 h-8 mx-auto mb-2 ${
                  userProfile.categories.includes(category) ? 'text-purple-600' : 'text-gray-500'
                }`} />
                <div className={`text-sm font-medium ${
                  userProfile.categories.includes(category) ? 'text-purple-600' : 'text-gray-700'
                }`}>
                  {category}
                </div>
              </button>
            ))}
          </div>
          
          {userProfile.categories.length > 0 && (
            <button
              onClick={() => handleStepNavigation('subcategories')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const SubcategoriesScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <button onClick={() => handleStepNavigation('categories')} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">Specify Interests</h2>
          </div>
          
          <div className="space-y-6">
            {userProfile.categories.map(category => (
              <div key={category}>
                <h3 className="font-semibold text-gray-800 mb-3">{category}</h3>
                <div className="flex flex-wrap gap-2">
                  {categories[category].subcategories.map(subcategory => (
                    <button
                      key={subcategory}
                      onClick={() => handleSubcategoryToggle(category, subcategory)}
                      className={`px-3 py-2 rounded-full text-sm transition-all ${
                        userProfile.subcategories[category]?.includes(subcategory)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-purple-100'
                      }`}
                    >
                      {subcategory}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => handleStepNavigation('profile')}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold mt-6"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const ProfileScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <button onClick={() => handleStepNavigation('subcategories')} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">Complete Profile</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
              <textarea
                value={userProfile.bio}
                onChange={(e) => handleProfileUpdate('bio', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24"
                placeholder="Tell others about yourself and what you're passionate about..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
              <input
                type="text"
                value={userProfile.experience}
                onChange={(e) => handleProfileUpdate('experience', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., 5+ years in web development"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
              <input
                type="text"
                value={userProfile.location}
                onChange={(e) => handleProfileUpdate('location', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., San Francisco, CA"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <select
                value={userProfile.availability}
                onChange={(e) => handleProfileUpdate('availability', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select availability</option>
                <option value="full-time">Full-time (40+ hours/week)</option>
                <option value="part-time">Part-time (10-20 hours/week)</option>
                <option value="freelance">Freelance/Project basis</option>
                <option value="weekends">Weekends only</option>
              </select>
            </div>
            
            <button
              onClick={() => handleStepNavigation('matching')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold mt-6"
            >
              Start Matching
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const MatchingScreen = () => {
    const currentMatch = sampleMatches[currentCardIndex];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center">
              <Users className="w-8 h-8 mr-2" />
              <h1 className="text-2xl font-bold">PairUp</h1>
            </div>
            <MessageCircle className="w-6 h-6" />
          </div>
          
          {/* Match Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 transform hover:scale-105 transition-all duration-300">
            <div className="relative h-64 bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center">
              <div className="text-6xl">{currentMatch.avatar}</div>
              <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentMatch.type === 'creator' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentMatch.type === 'creator' ? 'Creator' : 'Contributor'}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{currentMatch.name}</h2>
                <div className="flex items-center text-yellow-500">
                  <Star className="w-5 h-5 fill-current" />
                  <span className="text-sm text-gray-600 ml-1">4.9</span>
                </div>
              </div>
              
              {currentMatch.project && (
                <div className="mb-4">
                  <h3 className="font-semibold text-purple-600 mb-1">Project:</h3>
                  <p className="text-gray-700">{currentMatch.project}</p>
                </div>
              )}
              
              {currentMatch.expertise && (
                <div className="mb-4">
                  <h3 className="font-semibold text-blue-600 mb-1">Expertise:</h3>
                  <p className="text-gray-700">{currentMatch.expertise}</p>
                </div>
              )}
              
              <div className="flex items-center mb-4">
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700 mr-2">
                  {currentMatch.category}
                </span>
                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                  {currentMatch.subcategory}
                </span>
              </div>
              
              <p className="text-gray-600 mb-4 leading-relaxed">{currentMatch.bio}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {currentMatch.experience}
                </div>
                <div>{currentMatch.location}</div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-center space-x-6">
            <button
              onClick={() => handleSwipe('left')}
              className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all duration-200"
            >
              <X className="w-8 h-8 text-red-500" />
            </button>
            
            <button
              onClick={() => handleSwipe('right')}
              className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all duration-200"
            >
              <Heart className="w-8 h-8 text-green-500" />
            </button>
          </div>
          
          {/* Match Counter */}
          <div className="text-center mt-6 text-white">
            <p className="text-sm opacity-75">
              {currentCardIndex + 1} of {sampleMatches.length}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeScreen />;
      case 'signup':
        return <SignupScreen />;
      case 'categories':
        return <CategoriesScreen />;
      case 'subcategories':
        return <SubcategoriesScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'matching':
        return <MatchingScreen />;
      default:
        return <WelcomeScreen />;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white">
      {renderCurrentStep()}
    </div>
  );
};

export default PairUpApp;