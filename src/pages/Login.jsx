import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../api/auth.js';
import { useAuth } from '../lib/AuthContext';
import { REPORT_ROLES, isValidReportRoleCode } from '../lib/reportRoles.js';
import { isHardcodedAdminCredentials } from '../lib/hardcodedAdmin.js';
import { HeartHandshake, PawPrint, Search } from 'lucide-react';

const roleIcons = {
  homeless: HeartHandshake,
  'missing-dogs': PawPrint,
  'missing-person': Search,
};

/**
 * Maps Firebase auth error codes to human-readable messages.
 * @param {unknown} error - The error thrown by signIn
 * @returns {string}
 */
function getErrorMessage(error) {
  const code = error?.code ?? '';
  const message = error?.message ?? '';

  if (message.includes('Access denied')) {
    return 'You do not have admin access.';
  }

  switch (code) {
    case 'auth/user-not-found':
      return 'No account found with that email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { currentUser, isAdmin, isLoadingAuth, loginWithHardcodedAdmin, selectedReportRole, setSelectedReportRole } = useAuth();

  // If already authenticated as admin, redirect to dashboard
  useEffect(() => {
    if (!isLoadingAuth && currentUser && isAdmin) {
      navigate('/reports', { replace: true });
    }
  }, [currentUser, isAdmin, isLoadingAuth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!isValidReportRoleCode(selectedReportRole, roleCode)) {
        setError('Invalid admin queue code for the selected role.');
        setLoading(false);
        return;
      }

      if (isHardcodedAdminCredentials(email, password)) {
        loginWithHardcodedAdmin();
        navigate('/reports', { replace: true });
        return;
      }

      await signIn(email, password);
      // signIn succeeded — onAuthStateChanged will fire in AuthContext,
      // which sets currentUser + isAdmin, and the useEffect above redirects.
      navigate('/reports', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, hsl(150 55% 8%) 0%, hsl(152 50% 14%) 50%, hsl(148 45% 18%) 100%)' }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-white/10 p-8">
        {/* App title */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-xl overflow-hidden">
            <img src="/streetassist.png" alt="StreetAssist" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Street Assist Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Camarines Norte · Municipal Office</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin queue
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {REPORT_ROLES.map((role) => {
                const Icon = roleIcons[role.value];
                const isSelected = selectedReportRole === role.value;

                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setSelectedReportRole(role.value)}
                    className={`min-h-[96px] rounded-lg border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                    <span className="block text-sm font-semibold leading-tight">{role.label}</span>
                    <span className="mt-1 block text-[11px] leading-snug text-gray-500">{role.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="role-code"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Admin queue code
            </label>
            <input
              id="role-code"
              type="text"
              autoComplete="off"
              required
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter role code"
            />
          </div>

          {/* Email field */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="admin@example.com"
            />
          </div>

          {/* Password field */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
          </div>

          {/* Error message */}
          {error !== null && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition"
            style={{ background: 'linear-gradient(135deg, hsl(145 65% 32%), hsl(152 70% 22%))' }}
          >
            {loading && (
              <svg
                className="h-4 w-4 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
