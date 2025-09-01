import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, ArrowLeft, ArrowRight, User, Briefcase, Calendar, Lightbulb, Code, Palette, Camera, Music, BookOpen, TrendingUp, Users, MessageCircle, Star, Eye, EyeOff } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// API helper functions
const api = {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  },

  auth: {
    register: (userData) => api.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
    login: (credentials) => api.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
    getProfile: () => api.request('/auth/me'),
  },

  users: {
    updateProfile: (profileData) => api.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),
  },

  matches: {
    discover: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return api.request(`/matches/discover${query ? `?${query}` : ''}`);
    },
    like: (targetUserId, projectId = null) => api.request('/matches/like', {
      method: 'POST',
      body: JSON.stringify({ targetUserId, projectId }),
    }),
    pass: (targetUserId) => api.request('/matches/pass', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),
    getMyMatches: (status = 'mutual') => api.request(`/matches/my-matches?status=${status}`),
    getLikedMe: () => api.request(`/matches/liked-me`),
  },
};

const PairUpApp = () => {
  const [currentStep, setCurrentStep] = useState('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Auth form states (we’ll only use userType here to avoid parent re-render on typing)
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({
    name: '',      // kept for initial defaultValue only
    email: '',     // kept for initial defaultValue only
    password: '',  // kept for initial defaultValue only
    userType: ''   // actively used for register choice
  });

  // Profile states
  const [userProfile, setUserProfile] = useState({
    name: '',
    userType: '',
    categories: [],
    subcategories: {},
    bio: '',
    experience: '',
    availability: '',
    location: '',
    skills: [],
    portfolio: []
  });

  // Matching states
  const [matches, setMatches] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Categories data (same as before)
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

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      checkAuthStatus();
    }
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.auth.getProfile();
      setUser(response.user);
      setIsAuthenticated(true);
      
      // If user profile is complete, go to matching, otherwise go to profile setup
      if (response.user.profileCompletion >= 80) {
        setCurrentStep('matching');
        loadMatches();
      } else {
        setCurrentStep('categories');
        setUserProfile(prev => ({
          ...prev,
          name: response.user.name,
          userType: response.user.userType,
          categories: response.user.categories || [],
          bio: response.user.bio || '',
          experience: response.user.experience || '',
          location: response.user.location || '',
          availability: response.user.availability || ''
        }));
      }
    } catch (error) {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    }
  };

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await api.matches.discover({ limit: 10 });
      setMatches(response.matches || []);
      setCurrentCardIndex(0);
    } catch (error) {
      setError('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e, refs) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      if (authMode === 'register') {
        const name = refs.nameRef.current?.value?.trim() || '';
        const email = refs.emailRef.current?.value?.trim() || '';
        const password = refs.passwordRef.current?.value || '';
        response = await api.auth.register({
          name,
          email,
          password,
          userType: authForm.userType
        });
      } else {
        const email = refs.emailRef.current?.value?.trim() || '';
        const password = refs.passwordRef.current?.value || '';
        response = await api.auth.login({
          email,
          password
        });
      }

      localStorage.setItem('token', response.token);
      setUser(response.user);
      setIsAuthenticated(true);

      if (authMode === 'register') {
        setUserProfile(prev => ({
          ...prev,
          name: response.user.name,
          userType: response.user.userType
        }));
        setCurrentStep('categories');
      } else {
        if (response.user.profileCompletion >= 80) {
          setCurrentStep('matching');
          loadMatches();
        } else {
          setCurrentStep('categories');
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = async (profileData) => {
    try {
      setLoading(true);
      const response = await api.users.updateProfile(profileData);
      setUser(response.user);
      return response;
    } catch (error) {
      setError(error.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction, match) => {
    try {
      if (direction === 'right') {
        await api.matches.like(match.user._id);
      } else {
        await api.matches.pass(match.user._id);
      }
      
      if (currentCardIndex < matches.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
      } else {
        // Load more matches or loop back
        loadMatches();
      }
    } catch (error) {
      setError('Failed to process swipe');
    }
  };

  // ---- Logout available to all inner screens ----
  function handleLogout() {
    try {
      localStorage.removeItem('token');
    } catch {}
    setIsAuthenticated(false);
    setUser(null);
    setMatches([]);
    setCurrentCardIndex(0);
    setCurrentStep('welcome');
  }

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
        
        <div className="space-y-3">
          <button
            onClick={() => setCurrentStep('auth')}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Get Started
          </button>
          
          {isAuthenticated && (
            <button
              onClick={() => {
                if (user?.profileCompletion >= 80) {
                  setCurrentStep('matching');
                  loadMatches();
                } else {
                  setCurrentStep('categories');
                }
              }}
              className="w-full bg-white border-2 border-purple-600 text-purple-600 py-4 rounded-xl font-semibold hover:bg-purple-50 transition-all duration-200"
            >
              Continue to App
            </button>
          )}

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-all duration-200"
            >
              Logout
            </button>
          )}

        </div>
      </div>
    </div>
  );

  const AuthScreen = () => {
    // Refs for uncontrolled inputs
    const nameRef = useRef(null);
    const emailRef = useRef(null);
    const passwordRef = useRef(null);

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
            <div className="flex items-center mb-6">
              <button onClick={() => setCurrentStep('welcome')} className="mr-4">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <h2 className="text-2xl font-bold text-gray-800">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
              </h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={(e) => handleAuth(e, { nameRef, emailRef, passwordRef })} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                    <input
                      type="text"
                      required
                      defaultValue={authForm.name}
                      ref={nameRef}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">I want to be a...</label>
                    <div className="space-y-2">
                      {[
                        { value: 'creator', label: 'Creator', desc: 'I have projects and need contributors' },
                        { value: 'contributor', label: 'Contributor', desc: 'I want to join and contribute to projects' },
                        { value: 'both', label: 'Both', desc: 'I create projects and contribute to others' }
                      ].map(({ value, label, desc }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setAuthForm(prev => ({ ...prev, userType: value }))}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                            authForm.userType === value
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className={`font-semibold ${authForm.userType === value ? 'text-purple-600' : 'text-gray-800'}`}>
                            {label}
                          </div>
                          <div className="text-sm text-gray-600">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  required
                  defaultValue={authForm.email}
                  ref={emailRef}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    defaultValue={authForm.password}
                    ref={passwordRef}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    placeholder="Enter your password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (authMode === 'register' && !authForm.userType)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const CategoriesScreen = () => (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <button onClick={() => setCurrentStep(isAuthenticated ? 'welcome' : 'auth')} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">Choose Categories</h2>
          </div>
          
          <p className="text-gray-600 mb-6">Select the categories you're interested in working on:</p>
          
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Object.entries(categories).map(([category, { icon: Icon }]) => (
              <button
                key={category}
                onClick={() => setUserProfile(prev => ({
                  ...prev,
                  categories: prev.categories.includes(category)
                    ? prev.categories.filter(c => c !== category)
                    : [...prev.categories, category]
                }))}
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
              onClick={() => setCurrentStep('subcategories')}
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
            <button onClick={() => setCurrentStep('categories')} className="mr-4">
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
                      onClick={() => setUserProfile(prev => ({
                        ...prev,
                        subcategories: {
                          ...prev.subcategories,
                          [category]: prev.subcategories[category]?.includes(subcategory)
                            ? prev.subcategories[category].filter(s => s !== subcategory)
                            : [...(prev.subcategories[category] || []), subcategory]
                        }
                      }))}
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
            onClick={() => setCurrentStep('profile')}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold mt-6"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const ProfileScreen = () => {
    // Uncontrolled refs
    const bioRef = useRef(null);
    const experienceRef = useRef(null);
    const locationRef = useRef(null);
    const availabilityRef = useRef(null);

    const handleProfileComplete = async () => {
      const result = await updateUserProfile({
        ...userProfile,
        bio: bioRef.current?.value || '',
        experience: experienceRef.current?.value || '',
        location: locationRef.current?.value || '',
        availability: availabilityRef.current?.value || ''
      });
      if (result) {
        setCurrentStep('matching');
        loadMatches();
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center mb-6">
              <button onClick={() => setCurrentStep('subcategories')} className="mr-4">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <h2 className="text-2xl font-bold text-gray-800">Complete Profile</h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  defaultValue={userProfile.bio}
                  ref={bioRef}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24"
                  placeholder="Tell others about yourself and what you're passionate about..."
                  maxLength={500}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                <input
                  type="text"
                  defaultValue={userProfile.experience}
                  ref={experienceRef}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 5+ years in web development"
                  maxLength={200}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  defaultValue={userProfile.location}
                  ref={locationRef}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., San Francisco, CA"
                  maxLength={100}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  defaultValue={userProfile.availability}
                  ref={availabilityRef}
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
                onClick={handleProfileComplete}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold mt-6 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Start Matching'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MatchingScreen = () => {
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Finding matches...</p>
          </div>
        </div>
      );
    }

    if (!matches || matches.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No matches found</h2>
            <p className="text-gray-600 mb-6">
              We're working on finding the perfect matches for you. Check back soon!
            </p>
            <button
              onClick={loadMatches}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    const currentMatch = matches[currentCardIndex];
    if (!currentMatch) return null;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 text-white">
            <div className="flex items-center">
              <Users className="w-8 h-8 mr-2" />
              <h1 className="text-2xl font-bold">PairUp</h1>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentStep('matches')} title="Connections">
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                onClick={handleLogout}
                title="Log out"
                className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-sm"
              >
                Logout
              </button>
            </div>
          </div>


          {error && (
            <div className="bg-red-500 text-white p-3 rounded-lg mb-4 text-center">
              {error}
            </div>
          )}
          
          {/* Match Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 transform hover:scale-105 transition-all duration-300">
            <div className="relative h-64 bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center">
              <div className="text-6xl">{currentMatch.user.avatar || '👤'}</div>
              <div className="absolute top-4 right-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentMatch.user.userType === 'creator' ? 'bg-green-100 text-green-800' : 
                  currentMatch.user.userType === 'contributor' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {currentMatch.user.userType === 'creator' ? 'Creator' : 
                   currentMatch.user.userType === 'contributor' ? 'Contributor' : 'Both'}
                </span>
              </div>
              <div className="absolute top-4 left-4">
                <span className="px-2 py-1 bg-white bg-opacity-90 rounded-full text-sm font-medium text-gray-800">
                  {Math.round(currentMatch.compatibilityScore)}% match
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{currentMatch.user.name}</h2>
                <div className="flex items-center text-yellow-500">
                  <Star className="w-5 h-5 fill-current" />
                  <span className="text-sm text-gray-600 ml-1">
                    {currentMatch.user.rating?.average?.toFixed(1) || '0.0'}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {currentMatch.user.categories.map(category => (
                  <span key={category} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                    {category}
                  </span>
                ))}
              </div>
              
              {currentMatch.matchDetails.reasonForMatch && (
                <div className="mb-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-purple-700 text-sm font-medium">
                    {currentMatch.matchDetails.reasonForMatch}
                  </p>
                </div>
              )}
              
              <p className="text-gray-600 mb-4 leading-relaxed">
                {currentMatch.user.bio || 'No bio available'}
              </p>
              
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-1" />
                  {currentMatch.user.experience || 'Experience not specified'}
                </div>
                <div>{currentMatch.user.location || 'Location not specified'}</div>
              </div>
              
              {currentMatch.user.completedProjects > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  <span className="font-medium">{currentMatch.user.completedProjects}</span> completed projects
                </div>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-center space-x-6">
            <button
              onClick={() => handleSwipe('left', currentMatch)}
              className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all duration-200"
            >
              <X className="w-8 h-8 text-red-500" />
            </button>
            
            <button
              onClick={() => handleSwipe('right', currentMatch)}
              className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all duration-200"
            >
              <Heart className="w-8 h-8 text-green-500" />
            </button>
          </div>
          
          {/* Match Counter */}
          <div className="text-center mt-6 text-white">
            <p className="text-sm opacity-75">
              {currentCardIndex + 1} of {matches.length}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const MatchesScreen = () => {
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'likedMe'

  // My Matches state
  const [myMatches, setMyMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState('');

  // Liked Me state
  const [likedMe, setLikedMe] = useState([]);
  const [likedMeLoading, setLikedMeLoading] = useState(true);
  const [likesError, setLikesError] = useState('');

  useEffect(() => {
    if (activeTab === 'matches') {
      loadMyMatches();
    } else {
      loadLikedMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadMyMatches = async () => {
    try {
      setMatchesLoading(true);
      setMatchesError('');
      const res = await api.matches.getMyMatches('mutual');
      setMyMatches(res.matches || []);
    } catch (err) {
      setMatchesError(err.message || 'Failed to load matches');
    } finally {
      setMatchesLoading(false);
    }
  };

  const loadLikedMe = async () => {
    try {
      setLikedMeLoading(true);
      setLikesError('');
      const res = await api.matches.getLikedMe();
    // support either {users: [...] } or fallbacks
      const list = res.users || res.likes || res.matches || [];
      setLikedMe(list);
    } catch (err) {
      setLikesError(err.message || 'Failed to load likes');
    } finally {
      setLikedMeLoading(false);
    }
  };

  const TabButton = ({ id, children }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-full text-sm font-medium ${
        activeTab === id
          ? 'bg-purple-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );

  const Card = ({ person, score, extra }) => (
    <div className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center space-x-4">
        <div className="text-3xl">{person.avatar || '👤'}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{person.name}</h3>
            {typeof score === 'number' && (
              <span className="text-sm text-purple-600 font-medium">
                {Math.round(score)}% match
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {(person.userType || person.user_type) ?? '—'} • {(person.categories || []).join(', ')}
          </p>
          {extra}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center mb-6">
            <div className="flex items-center gap-2 mr-4">
              <button onClick={() => setCurrentStep('matching')}>
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Log out
              </button>
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Connections</h2>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <TabButton id="matches">My Matches</TabButton>
            <TabButton id="likedMe">Liked Me</TabButton>
          </div>

          {/* Errors */}
          {activeTab === 'matches' && matchesError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {matchesError}
            </div>
          )}
          {activeTab === 'likedMe' && likesError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {likesError}
            </div>
          )}

          {/* Content */}
          {activeTab === 'matches' ? (
            matchesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading matches...</p>
              </div>
            ) : myMatches.length === 0 ? (
              <div className="text-center py-8">
                <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No matches yet</h3>
                <p className="text-gray-600">Keep swiping to find your perfect collaborators!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myMatches.map((m) => (
                  <Card
                    key={m._id}
                    person={m.otherUser}
                    score={m.compatibilityScore}
                    extra={
                      m.conversation?.started ? (
                        <span className="mt-2 inline-block text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          Conversation started
                        </span>
                      ) : (
                        <button className="mt-2 text-sm text-purple-600 hover:text-purple-700 font-medium">
                          Start conversation
                        </button>
                      )
                    }
                  />
                ))}
              </div>
            )
          ) : likedMeLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading likes...</p>
            </div>
          ) : likedMe.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No likes yet</h3>
              <p className="text-gray-600">When someone likes you, you’ll see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {likedMe.map((entry) => {
                // support { user: {...} } or plain user object
                const person = entry.user || entry.otherUser || entry;
                return (
                  <Card
                    key={person._id || person.id}
                    person={person}
                    score={entry.compatibilityScore}
                    extra={
                      <div className="mt-2 flex gap-2">
                        <button className="text-sm bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700">
                          Like back
                        </button>
                        <button className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200">
                          View profile
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeScreen />;
      case 'auth':
        return <AuthScreen />;
      case 'categories':
        return <CategoriesScreen />;
      case 'subcategories':
        return <SubcategoriesScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'matching':
        return <MatchingScreen />;
      case 'matches':
        return <MatchesScreen />;
      default:
        return <WelcomeScreen />;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white min-h-screen">
      {renderCurrentStep()}
    </div>
  );
};

export default PairUpApp;
