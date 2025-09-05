import React, { useState, useEffect } from 'react';
import {
  Heart, X, ArrowLeft, Users, MessageCircle, Star, Eye, EyeOff,
  Briefcase, Calendar, Code, Palette, Music, BookOpen, TrendingUp
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL;

// API helper functions
async function request(endpoint, options = {}) {
  // Don’t send auth for auth endpoints
  const isAuthEndpoint =
    endpoint === '/auth/login' || endpoint === '/auth/register';
  const stored = localStorage.getItem('token') || '';
  const hasJWT = stored && stored.split('.').length === 3;
  const authToken = !isAuthEndpoint && hasJWT ? stored : null;

  const url = `${process.env.REACT_APP_API_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  // Detect Capacitor native
  const isNative =
    typeof window !== 'undefined' &&
    window.Capacitor &&
    window.Capacitor.isNativePlatform
      ? window.Capacitor.isNativePlatform()
      : false;

  const handleError = (status, data) => {
    if (status === 401 || status === 403) {
      try { localStorage.removeItem('token'); } catch {}
    }
    throw new Error(data?.message || data?.msg || 'Something went wrong');
  };

  if (!isNative) {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) handleError(res.status, data);
    return data;
  }

  // Native (Capacitor) – avoids CORS
  const { Http } = await import('@capacitor-community/http');
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : undefined;

  const resp = await Http.request({ url, method, headers, data: body });
  const status = resp.status || 0;
  const data = resp.data || {};
  if (status < 200 || status >= 300) handleError(status, data);
  return data;
}

// ---- Unified API helper that uses the request() above ----
const api = {
  request,

  auth: {
    register: (userData) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),

    login: (credentials) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),

    getProfile: () => request('/auth/me'),
  },

  users: {
    updateProfile: (profileData) =>
      request('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      }),
    getPublic: (userId) => request(`/users/${userId}`),
  },

  matches: {
    discover: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/matches/discover${query ? `?${query}` : ''}`);
    },
    like: (targetUserId, projectId = null) =>
      request('/matches/like', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, projectId }),
      }),
    pass: (targetUserId) =>
      request('/matches/pass', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    getMyMatches: (status = 'mutual') =>
      request(`/matches/my-matches?status=${status}`),
    getLikedMe: () => request('/matches/liked-me'),
  },
};

const PairUpApp = () => {
  const [currentStep, setCurrentStep] = useState('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [profileCompletion, setProfileCompletion] = useState(0);

  // Auth form states (we’ll only use userType here to avoid parent re-render on typing)
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

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

  // Categories data
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
      const response = await api.auth.getProfile(); // { user, profileCompletion }
      const completion = Number(response?.profileCompletion ?? 0);
      const u = response.user || {};
      setUser(u);
      setProfileCompletion(completion);
      setIsAuthenticated(true);

      if (completion >= 80) {
        setCurrentStep('matching');
        loadMatches();
      } else {
        setCurrentStep('categories');
        setUserProfile(prev => ({
          ...prev,
          name: u.name || '',
          userType: u.userType || u.user_type || '',
          categories: u.categories || [],
          bio: u.bio || '',
          experience: u.experience || '',
          location: u.location || '',
          availability: u.availability || ''
        }));
      }

    } catch (error) {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
      setCurrentStep('welcome');
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

  const updateUserProfile = async (profileData) => {
    try {
      setLoading(true);

      const payload = { ...profileData };
      const chosenType = userProfile.userType || user?.userType || user?.user_type;
      if (chosenType) payload.user_type = chosenType; // include only if we have a value

      const response = await api.users.updateProfile(payload);
      setUser(response.user);
      setProfileCompletion(Number(response?.profileCompletion ?? profileCompletion));
      return response;
    } catch (err) {
      setError(err.message);
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
    setProfileCompletion(0);
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
            type="button"
            onClick={() => setCurrentStep('auth')}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200"
          >
            Get Started
          </button>

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                if (profileCompletion >= 80) {
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
              type="button"
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
    const [form, setForm] = useState({
      name: '',
      email: '',
      password: '',
      userType: '', // creator | contributor | both
    });
    const [showPwd, setShowPwd] = useState(false);

    const onChange = (e) => {
      const { name, value } = e.target;
      setForm((f) => ({ ...f, [name]: value }));
    };

    const onSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError('');

      try {
        let resp;

        if (authMode === 'register') {
          // 1) Register
          resp = await api.auth.register({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            userType: form.userType,
          });

          // 2) If register didn't return a token, immediately login
          if (!resp?.token) {
            const loginRes = await api.auth.login({
              email: form.email.trim(),
              password: form.password,
            });
            resp = { ...resp, ...loginRes }; // merge useful fields
          }
        } else {
          // Login
          resp = await api.auth.login({
            email: form.email.trim(),
            password: form.password,
          });
        }

        if (!resp?.token) {
          throw new Error('Could not obtain auth token. Please try again.');
        }

        localStorage.setItem('token', resp.token);

        // Prefer user + profileCompletion from response; fallback to /auth/me for consistency
        let u = resp.user;
        let completion = Number(resp?.profileCompletion ?? 0);

        if (!u || Number.isNaN(completion)) {
          const me = await api.auth.getProfile(); // { user, profileCompletion }
          u = me.user;
          completion = Number(me?.profileCompletion ?? 0);
        }

        setUser(u);
        setProfileCompletion(completion);
        setIsAuthenticated(true);

        // Seed profile fields only for new registrations
        if (authMode === 'register') {
          setUserProfile((prev) => ({
            ...prev,
            name: u?.name || form.name.trim(),
            userType: u?.userType || u?.user_type || form.userType || '',
            categories: u?.categories || [],
            bio: u?.bio || '',
            experience: u?.experience || '',
            location: u?.location || '',
            availability: u?.availability || '',
          }));
        }

        if (completion >= 80) {
          setCurrentStep('matching');
          loadMatches();
        } else {
          setCurrentStep('categories');
        }
      } catch (err) {
        setError(err.message || 'Something went wrong');
        try { localStorage.removeItem('token'); } catch {}
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    const userTypeOptions = [
      { value: 'creator', label: 'Creator', desc: 'I have projects and need contributors' },
      { value: 'contributor', label: 'Contributor', desc: 'I want to join and contribute to projects' },
      { value: 'both', label: 'Both', desc: 'I create projects and contribute to others' },
    ];

    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
            <div className="flex items-center mb-6">
              <button type="button" onClick={() => setCurrentStep('welcome')} className="mr-4">
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

            <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                    <input
                      name="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={onChange}
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      I want to be a...
                    </label>

                    <div className="space-y-2" role="radiogroup" aria-label="User type">
                      {userTypeOptions.map(({ value, label, desc }) => (
                        <label
                          key={value}
                          className={`w-full p-3 rounded-xl border-2 cursor-pointer block ${
                            form.userType === value
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="userType"
                            value={value}
                            checked={form.userType === value}
                            onChange={onChange}
                            required
                            className="sr-only"
                          />
                          <div className={`font-semibold ${form.userType === value ? 'text-purple-600' : 'text-gray-800'}`}>
                            {label}
                          </div>
                          <div className="text-sm text-gray-600">{desc}</div>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={onChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={form.password}
                    onChange={onChange}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                    placeholder="Enter your password"
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (authMode === 'register' && !form.userType)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'register' : 'login');
                  setError('');
                  setForm({ name: '', email: '', password: '', userType: '' });
                }}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                {authMode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
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
            <button type="button" onClick={() => setCurrentStep(isAuthenticated ? 'welcome' : 'auth')} className="mr-4">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">Choose Categories</h2>
          </div>

          <p className="text-gray-600 mb-6">Select the categories you're interested in working on:</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {Object.entries(categories).map(([category, { icon: Icon }]) => (
              <button
                type="button"
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
              type="button"
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
            <button type="button" onClick={() => setCurrentStep('categories')} className="mr-4">
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
                      type="button"
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
            type="button"
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
    // Controlled form for stability
    const [form, setForm] = useState({
      name: userProfile.name || user?.name || '',
      bio: userProfile.bio || '',
      experience: userProfile.experience || '',
      location: userProfile.location || '',
      availability: userProfile.availability || '',
    });

    const onChange = (e) => {
      const { name, value } = e.target;
      setForm((f) => ({ ...f, [name]: value }));
    };

    const handleProfileComplete = async () => {
      if (!form.name.trim()) {
        setError('Name is required');
        return;
      }
      if (!userProfile.categories?.length) {
        setError('Pick at least one category');
        return;
      }

      setError('');
      const result = await updateUserProfile({
        ...userProfile,
        name: form.name.trim(),
        bio: form.bio,
        experience: form.experience,
        location: form.location,
        availability: form.availability,
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={onChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={onChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent h-24"
                  placeholder="Tell others about yourself and what you're passionate about..."
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience</label>
                <input
                  name="experience"
                  type="text"
                  value={form.experience}
                  onChange={onChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., 5+ years in web development"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  name="location"
                  type="text"
                  value={form.location}
                  onChange={onChange}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., San Francisco, CA"
                  maxLength={100}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  name="availability"
                  value={form.availability}
                  onChange={onChange}
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
              type="button"
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
              <button type="button" onClick={() => setCurrentStep('matches')} title="Connections">
                <MessageCircle className="w-6 h-6" />
              </button>
              <button
                type="button"
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
              type="button"
              onClick={() => handleSwipe('left', currentMatch)}
              className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all duration-200"
            >
              <X className="w-8 h-8 text-red-500" />
            </button>

            <button
              type="button"
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

    // Profile modal state
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileData, setProfileData] = useState(null);

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
        type="button"
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

    const handleLikeBack = async (person) => {
      try {
        const targetId = person._id || person.id;
        if (!targetId) return;

        await api.matches.like(targetId);
        await Promise.all([loadLikedMe(), loadMyMatches()]);
        setActiveTab('matches');
      } catch (err) {
        setLikesError(err.message || 'Failed to like back');
      }
    };

    const handleViewProfile = async (person) => {
      try {
        const targetId = person._id || person.id;
        if (!targetId) return;
        setProfileError('');
        setProfileLoading(true);
        setProfileOpen(true);

        const res = await api.users.getPublic(targetId);
        setProfileData(res.user || null);
      } catch (err) {
        setProfileError(err.message || 'Failed to load profile');
        setProfileData(null);
      } finally {
        setProfileLoading(false);
      }
    };

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
                <button type="button" onClick={() => setCurrentStep('matching')}>
                  <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <button
                  type="button"
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
                  const person = entry.user || entry.otherUser || entry;
                  return (
                    <Card
                      key={person._id || person.id}
                      person={person}
                      score={entry.compatibilityScore}
                      extra={
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleLikeBack(person)}
                            className="text-sm bg-green-600 text-white px-3 py-1 rounded-full hover:bg-green-700"
                          >
                            Like back
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewProfile(person)}
                            className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-200"
                          >
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

        {/* Profile Modal */}
        {profileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>

              <h3 className="text-xl font-bold text-gray-800 mb-4">Profile</h3>

              {profileLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading profile...</p>
                </div>
              ) : profileError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {profileError}
                </div>
              ) : profileData ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{profileData.avatar || '👤'}</div>
                    <div>
                      <div className="text-lg font-semibold">{profileData.name}</div>
                      <div className="text-sm text-gray-600">
                        {(profileData.userType || profileData.user_type) ?? '—'}
                      </div>
                    </div>
                  </div>

                  {profileData.categories?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {profileData.categories.map((c) => (
                        <span key={c} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {profileData.bio && (
                    <p className="text-gray-700 leading-relaxed">{profileData.bio}</p>
                  )}

                  <div className="text-sm text-gray-600">
                    <div><span className="font-medium">Experience:</span> {profileData.experience || '—'}</div>
                    <div><span className="font-medium">Location:</span> {profileData.location || '—'}</div>
                  </div>

                  {Array.isArray(profileData.skills) && profileData.skills.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-800 mb-1">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {profileData.skills.map((s, i) => (
                          <span key={`${s.name}-${i}`} className="px-2 py-1 bg-purple-50 text-purple-700 rounded-md text-xs">
                            {s.name}{s.level ? ` (${s.level})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(profileData.portfolio) && profileData.portfolio.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-gray-800 mb-1">Portfolio</div>
                      <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                        {profileData.portfolio.map((p, i) => (
                          <li key={`${p.title}-${i}`}>
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
                                {p.title || p.url}
                              </a>
                            ) : (
                              <span>{p.title || 'Item'}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-600">No profile data.</div>
              )}
            </div>
          </div>
        )}
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
