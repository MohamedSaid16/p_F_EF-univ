import request from './api';

function buildQuery(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (!entries.length) {
    return '';
  }

  const query = new URLSearchParams();
  entries.forEach(([key, value]) => {
    query.set(key, String(value));
  });

  return `?${query.toString()}`;
}

export const pfeAPI = {
  getSummary: () => request('/api/v1/pfe/summary'),
  listSubjects: (params = {}) => request(`/api/v1/pfe/subjects${buildQuery(params)}`),
  getSubject: (subjectId) => request(`/api/v1/pfe/subjects/${subjectId}`),
  getTeacherCourses: (teacherId) => request(`/api/v1/pfe/teacher/${teacherId}/courses`),
  getCourseGroups: (courseId) => request(`/api/v1/pfe/course/${courseId}/groups`),
  getGroupStudents: (groupId) => request(`/api/v1/pfe/groups/${groupId}/students`),
};

export default pfeAPI;