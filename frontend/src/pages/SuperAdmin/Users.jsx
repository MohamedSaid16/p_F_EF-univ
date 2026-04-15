import React, { useState } from 'react';
import UserRegistrationForm from '../../components/admin/UserRegistrationForm';
import StaffManagementTable from '../../components/admin/StaffManagementTable';
import { Users, Plus, Settings } from 'lucide-react';

const Users = () => {
  const [activeTab, setActiveTab] = useState('register');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUserCreated = () => {
    // Trigger refresh of user list
    setRefreshKey(prev => prev + 1);
    setActiveTab('manage');
  };

  return (
    <div className="min-h-screen bg-canvas p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink flex items-center gap-3 mb-2">
            <Users className="w-10 h-10 text-brand" />
            User Management
          </h1>
          <p className="text-ink-secondary">
            Register new users, manage roles, and maintain strict role separation between teachers and students.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-edge">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-6 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'register'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Plus className="w-5 h-5" />
            Register User
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'manage'
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            <Settings className="w-5 h-5" />
            Manage Users
          </button>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {activeTab === 'register' && (
            <UserRegistrationForm onSuccess={handleUserCreated} />
          )}

          {activeTab === 'manage' && (
            <StaffManagementTable refreshKey={refreshKey} />
          )}
        </div>

        {/* Info Box */}
        <div className="bg-brand-light border border-edge-strong rounded-lg p-6 max-w-7xl mx-auto">
          <h3 className="font-bold text-brand mb-3">Role Management Best Practices</h3>
          <ul className="space-y-2 text-brand text-sm">
            <li>Teacher roles (Enseignant, Admin, Vice Doyen) cannot be mixed with student roles.</li>
            <li>Each user is either a teacher or a student, maintaining clear institutional hierarchy.</li>
            <li>Role assignment is strictly validated during user creation and updates.</li>
            <li>New users are assigned a temporary password and must change it on first login.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Users;

