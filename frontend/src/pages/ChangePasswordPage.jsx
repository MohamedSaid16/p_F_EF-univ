import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const { logout, setRequiresPasswordChange } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully. Please login again.');
      setRequiresPasswordChange(false);

      // Backend clears cookies on successful password change, this keeps frontend state aligned.
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-8">
      <div className="bg-surface border border-edge rounded-lg shadow-card p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-ink tracking-tight mb-2">Change Password</h1>
        <p className="text-sm text-ink-secondary mb-6">
          First login detected. You must set a new password before continuing.
        </p>

        {error ? (
          <div className="mb-4 px-3 py-2 rounded-md border border-edge-strong bg-danger/10 text-danger text-sm">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 px-3 py-2 rounded-md border border-success/30 bg-success/10 text-success text-sm">
            {success}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-ink-secondary mb-1.5">
              Temporary Password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-ink bg-control-bg border border-control-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              required
            />
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-ink-secondary mb-1.5">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-ink bg-control-bg border border-control-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-ink-secondary mb-1.5">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-ink bg-control-bg border border-control-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-md text-sm font-medium text-white bg-brand hover:bg-brand-hover disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;

