// API Configuration
// This file centralizes all API endpoints and handles environment-based URL switching

const isDevelopment = import.meta.env.DEV;

// Base URLs for different environments
const API_URLS = {
  // Auth service (port 8081)
  AUTH_API: {
    DEV: "http://localhost:8081/v1",
    PROD: "http://localhost:8081/v1"
  },
  // User service (port 8082)
  USER_API: {
    DEV: "http://localhost:8082/v1", 
    PROD: "http://localhost:8082/v1"
  },
  // Planning service (port 8083)
  PLANNING_API: {
    DEV: "http://localhost:8083/v1",
    PROD: "http://localhost:8083/v1"
  },
  // Organization service (port 8084)
  ORGANIZATION_API: {
    DEV: "http://localhost:8084/v1",
    PROD: "http://localhost:8084/v1"
  }
};

// Get the appropriate URL based on environment
const getApiUrl = (service) => {
  return isDevelopment ? API_URLS[service].DEV : API_URLS[service].PROD;
};

// Service base URLs
export const AUTH_BASE_URL = getApiUrl('AUTH_API');
export const USER_BASE_URL = getApiUrl('USER_API');
export const PLANNING_BASE_URL = getApiUrl('PLANNING_API');
export const ORGANIZATION_BASE_URL = getApiUrl('ORGANIZATION_API');

// Specific endpoint builders
export const API_ENDPOINTS_CONFIG = {
  // Auth endpoints
  login: () => `${AUTH_BASE_URL}/auth/login`,
  
  // User endpoints
  me: () => `${USER_BASE_URL}/users/me`,
  restaurantUsers: (restaurantId) => `${USER_BASE_URL}/users/business-unit/${restaurantId}`,
  
  // Organization endpoints
  businessUnit: (businessUnitId) => `${ORGANIZATION_BASE_URL}/business-units/${businessUnitId}`,
  companiesWithBusinessUnits: () => `${ORGANIZATION_BASE_URL}/companies/with-business-units`,
  
  // Schedule endpoints (using planning service)
  schedules: () => `${PLANNING_BASE_URL}/schedules`,
  scheduleById: (scheduleId) => `${PLANNING_BASE_URL}/schedules/${scheduleId}`,
  scheduleShifts: (scheduleId) => `${PLANNING_BASE_URL}/schedules/${scheduleId}/shifts`,
  scheduleDraft: (scheduleId) => `${PLANNING_BASE_URL}/schedules/${scheduleId}/draft`,
  schedulePublish: (scheduleId) => `${PLANNING_BASE_URL}/schedules/${scheduleId}/publish`,
  
  // Main endpoint for getting schedule with shifts (no more metadata endpoint)
  restaurantSchedulesWeekWithShifts: (businessUnitId, weekStart) => `${PLANNING_BASE_URL}/business-units/${businessUnitId}/schedules/week?weekStart=${weekStart}`,
  
  // Shift endpoints
  shifts: () => `${PLANNING_BASE_URL}/shifts`,
  shiftById: (shiftId) => `${PLANNING_BASE_URL}/shifts/${shiftId}`,
  
  // Availability endpoints
  availabilities: (businessUnitId, startDate, endDate) => 
    `${PLANNING_BASE_URL}/business-units/${businessUnitId}/availabilities?startDate=${startDate}&endDate=${endDate}`,
  
  // Monthly schedule endpoint for managers
  monthlySchedule: (businessUnitId, userId, month, year) =>
    `${PLANNING_BASE_URL}/business-units/${businessUnitId}/users/${userId}/monthly-schedule?month=${month}&year=${year}`,
};

// Environment info for debugging
export const ENV_INFO = {
  isDevelopment,
  authApiUrl: AUTH_BASE_URL,
  userApiUrl: USER_BASE_URL,
  planningApiUrl: PLANNING_BASE_URL,
  organizationApiUrl: ORGANIZATION_BASE_URL,
  viteEnv: import.meta.env.MODE
};

console.log('API Configuration loaded:', ENV_INFO);