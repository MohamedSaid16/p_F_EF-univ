import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  Plus,
  Trash2,
  Crown,
  AlertCircle,
  Loader,
  CheckCircle,
} from 'lucide-react';

const StudentAssignmentManager = ({ groupId, onSuccess }) => {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [groupLeader, setGroupLeader] = useState(null);

  // Fetch group students on mount
  useEffect(() => {
    if (groupId) {
      fetchGroupStudents();
    }
  }, [groupId]);

  // Fetch available students (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (groupId) {
        searchStudents();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, groupId]);

  const fetchGroupStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/pfe/groups/${groupId}/students`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch group students');

      const result = await response.json();
      setAssignedStudents(result.data);

      // Find group leader
      const leader = result.data.find((s) => s.role === 'chef_groupe');
      setGroupLeader(leader);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const searchStudents = async () => {
    if (!groupId) return;

    try {
      const query = new URLSearchParams({
        query: searchQuery,
        groupId: groupId,
        limit: '50',
      });

      const response = await fetch(
        `/api/v1/pfe/groups/students/search?${query}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Search failed');

      const result = await response.json();
      setStudents(result.data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleSelectStudent = (studentId) => {
    const newSelection = new Set(selectedStudents);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudents(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
    }
  };

  const handleAssignStudents = async () => {
    if (selectedStudents.size === 0) {
      setMessage({ type: 'error', text: 'Please select at least one student' });
      return;
    }

    setAssigning(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(
        `/api/v1/pfe/groups/${groupId}/assign-students`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            studentIds: Array.from(selectedStudents),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign students');
      }

      const result = await response.json();
      setMessage({
        type: 'success',
        text: `Success! Added: ${result.added}, Already assigned: ${result.updated}`,
      });

      setSelectedStudents(new Set());
      await fetchGroupStudents();

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setAssigning(false);
    }
  };

  const removeStudent = async (studentId) => {
    try {
      const response = await fetch(
        `/api/v1/pfe/groups/${groupId}/students/${studentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to remove student');

      setMessage({
        type: 'success',
        text: 'Student removed successfully',
      });
      await fetchGroupStudents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const setLeader = async (studentId) => {
    try {
      const response = await fetch(
        `/api/v1/pfe/groups/${groupId}/leader/${studentId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to set group leader');

      setMessage({
        type: 'success',
        text: 'Group leader updated',
      });
      await fetchGroupStudents();
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
        <Search className="w-8 h-8 text-blue-600" />
        Student Assignment Manager
      </h2>
      <p className="text-gray-600 mb-6">
        Find and assign students to this PFE group
      </p>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 border border-edge-strong'
              : 'bg-red-50 border border-edge-strong'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p
            className={
              message.type === 'success' ? 'text-green-800' : 'text-red-800'
            }
          >
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Available Students */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-600" />
            Available Students
          </h3>

          {/* Search Input */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or matricule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-control-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Select All Checkbox */}
          {students.length > 0 && (
            <label className="flex items-center p-2 mb-3 hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedStudents.size === students.length}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600"
              />
              <span className="ml-3 text-sm font-medium text-gray-700">
                Select All ({students.length})
              </span>
            </label>
          )}

          {/* Students List */}
          <div className="space-y-2 max-h-96 overflow-y-auto border border-edge rounded-lg p-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : students.length > 0 ? (
              students.map((student) => (
                <label
                  key={student.id}
                  className="flex items-center p-3 border border-edge rounded hover:bg-surface-200 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedStudents.has(student.id)}
                    onChange={() => handleSelectStudent(student.id)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="ml-3 flex-1">
                    <p className="font-medium text-gray-900">
                      {student.prenom} {student.nom}
                    </p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                    {student.matricule && (
                      <p className="text-xs text-gray-400">
                        {student.matricule}
                      </p>
                    )}
                  </div>
                  {student.moyenne && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {student.moyenne.toFixed(2)}
                    </span>
                  )}
                </label>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">
                {searchQuery ? 'No students found' : 'Search to find students'}
              </p>
            )}
          </div>

          {/* Assign Button */}
          <button
            onClick={handleAssignStudents}
            disabled={selectedStudents.size === 0 || assigning}
            className="w-full mt-4 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {assigning ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Assign {selectedStudents.size > 0 ? `(${selectedStudents.size})` : ''}
              </>
            )}
          </button>
        </div>

        {/* Assigned Students */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Assigned Students ({assignedStudents.length})
          </h3>

          {/* Assigned Students List */}
          <div className="space-y-2 max-h-96 overflow-y-auto border border-edge rounded-lg p-3">
            {assignedStudents.length > 0 ? (
              assignedStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border border-edge rounded-lg hover:bg-surface-200 transition"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {student.prenom} {student.nom}
                    </p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                    {student.role === 'chef_groupe' && (
                      <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Group Leader
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {student.role !== 'chef_groupe' && (
                      <button
                        onClick={() => setLeader(student.id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition"
                        title="Set as group leader"
                      >
                        <Crown className="w-5 h-5" />
                      </button>
                    )}

                    <button
                      onClick={() => removeStudent(student.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                      title="Remove student"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">
                No students assigned yet
              </p>
            )}
          </div>

          {/* Summary Card */}
          <div className="mt-4 p-4 bg-brand-light border border-edge-strong rounded-lg">
            <p className="text-sm text-brand">
              <strong>Stats:</strong> {assignedStudents.length} students assigned
              {groupLeader && (
                <span className="block mt-1">
                  Leader: {groupLeader.prenom} {groupLeader.nom}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentAssignmentManager;

