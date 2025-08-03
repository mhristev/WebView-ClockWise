# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a React-based web application for the ClockWise employee scheduling system. The main application is located in `WebView-ClockWise/my-app/`.

### Core Directory Layout
- `src/` - Main application source code
- `src/auth/` - Authentication context and protected routes
- `src/components/` - Reusable UI components (Layout, modals, calendars)
- `src/pages/` - Page components for different routes
- `src/config/` - API configuration with microservices endpoints

## Development Commands

All commands should be run from the `WebView-ClockWise/my-app/` directory:

```bash
# Development server
npm run dev

# Production build
npm run build

# Linting
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Microservices Architecture
The application communicates with multiple backend services via a centralized API configuration (`src/config/api.js`):

- **Auth Service** (port 8081): Authentication and authorization
- **User Service** (port 8082): User management and profiles
- **Planning Service** (port 8083): Schedules, shifts, and availability
- **Organization Service** (port 8084): Business units and companies

### Authentication System
- JWT-based authentication with automatic token refresh
- Role-based access control (ADMIN, MANAGER roles only)
- Centralized auth context (`src/auth/AuthContext.jsx`) provides:
  - `authenticatedFetch()` - Auto-handles token refresh on 401s
  - `getAuthHeaders()` - Standard headers for API calls
  - `getRestaurantId()` - User's business unit ID

### Key Components
- `Layout.jsx` - Main app layout with collapsible sidebar navigation
- `ProtectedRoute.jsx` - Route guards with role requirements
- Calendar components for monthly/weekly schedule views
- Modal components for day detail editing

### Routing Structure
- `/schedule` - Weekly schedule management
- `/schedule-view` - Monthly schedule view
- `/team-management` - Team member management
- `/business-unit-calendar` - Manager/Admin calendar view
- `/admin/*` - Admin-only pages (users, organizations, schedules, paychecks)

## API Integration Notes

When making API calls:
1. Always use `authenticatedFetch()` from auth context for automatic token handling
2. Use endpoint builders from `API_ENDPOINTS_CONFIG` rather than hardcoding URLs
3. API switches between dev/prod environments automatically based on Vite's `import.meta.env.DEV`

## Role-Based Features

- **ADMIN**: Full access to all pages including user management, organization management
- **MANAGER**: Access to team management and business unit calendar
- Both roles can access basic scheduling and profile features