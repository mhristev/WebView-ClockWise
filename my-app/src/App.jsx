import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ScheduleApp from "./schedule-ui-component";
import ProfilePage from "./pages/ProfilePage";
import BusinessUnitPage from "./pages/BusinessUnitPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import Layout from "./components/Layout";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Layout wrapper with persistent sidebar and outlet for child routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Child routes will render in the Layout's outlet */}
            <Route path="schedule" element={<ScheduleApp />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="business-unit" element={<BusinessUnitPage />} />
            <Route path="team-management" element={<TeamManagementPage />} />
            <Route path="" element={<Navigate to="/schedule" replace />} />
          </Route>

          {/* Redirect any unknown routes to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
