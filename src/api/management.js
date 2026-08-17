import { apiRequest } from './client'

export async function getManagementData() {
  return apiRequest('/admin/management')
}

export async function createGuardianCredential(payload) {
  return apiRequest('/admin/guardians', {
    method: 'POST',
    body: payload,
  })
}

export async function updateGuardian(id, payload) {
  return apiRequest(`/admin/guardians/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteGuardian(id, { mode = 'deactivate' } = {}) {
  return apiRequest(`/admin/guardians/${id}`, {
    method: 'DELETE',
    body: { mode },
  })
}

export async function createTeacher(payload) {
  return apiRequest('/admin/teachers', {
    method: 'POST',
    body: payload,
  })
}

export async function updateTeacher(id, payload) {
  return apiRequest(`/admin/teachers/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteTeacher(id, { mode = 'deactivate' } = {}) {
  return apiRequest(`/admin/teachers/${id}`, {
    method: 'DELETE',
    body: { mode },
  })
}

export async function assignTeacherCourses(payload) {
  return apiRequest('/admin/course-assignments', {
    method: 'POST',
    body: payload,
  })
}

export async function createCourse(payload) {
  return apiRequest('/admin/courses', {
    method: 'POST',
    body: payload,
  })
}

export async function getTeacherCourses() {
  return apiRequest('/teacher/courses')
}

export async function getTeacherStudents() {
  return apiRequest('/teacher/students')
}

export async function createStudent(payload) {
  return apiRequest('/teacher/students', {
    method: 'POST',
    body: payload,
  })
}