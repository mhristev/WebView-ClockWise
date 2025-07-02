# Weekly Schedule Manager

A React application for managing weekly schedules and assigning users to specific time slots.

## Features

- Create and manage users
- Assign users to specific time slots in a weekly schedule
- View all scheduled assignments in a grid layout
- Edit and remove schedules as needed
- Centralized API configuration with environment-based URL switching

## Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```

## API Configuration

The application uses a centralized API configuration system located in `src/config/api.js` that automatically switches between development and production URLs:

### Development (localhost)
When running `npm run dev`, the app automatically uses localhost URLs:
- Main API: `http://localhost:8888/v1`
- Auth API: `http://localhost:8081/v1`

### Production
For production deployment, update the PROD URLs in `src/config/api.js`:

```javascript
const API_ENDPOINTS = {
  MAIN_API: {
    DEV: "http://localhost:8888/v1",
    PROD: "https://your-production-api-url.com/v1" // Replace with your actual production URL
  },
  AUTH_API: {
    DEV: "http://localhost:8081/v1",
    PROD: "https://your-production-auth-url.com/v1" // Replace with your actual production URL
  }
};
```

### Available Endpoints
All API endpoints are centralized in `API_ENDPOINTS_CONFIG`:
- Authentication endpoints
- User management endpoints
- Schedule management endpoints
- Shift management endpoints
- Availability endpoints

## Usage

1. First, manage your users in the "Manage Users" section
2. Add users to your schedule by selecting a user, day, start time, and end time
3. View the complete weekly schedule in the grid below
4. Remove assignments by clicking the "×" button on any schedule item

## Technologies Used

- React
- CSS
- Vite
- Centralized API configuration system

## License

This project is open source and available under the MIT License.
