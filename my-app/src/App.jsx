import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import ScheduleApp from "./schedule-ui-component";
import ProfilePage from "./pages/ProfilePage";
import BusinessUnitPage from "./pages/BusinessUnitPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminBusinessUnitSchedulePage from "./pages/AdminBusinessUnitSchedulePage";
import AdminOrganizationManagement from "./pages/AdminOrganizationManagement";
import ManagerEmployeeScheduleView from "./pages/ManagerEmployeeScheduleView";
import BusinessUnitCalendarView from "./pages/BusinessUnitCalendarView";
import AdminPaycheckGenerator from "./pages/AdminPaycheckGenerator";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/schedule" element={<ScheduleApp />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route
                      path="/business-unit"
                      element={<BusinessUnitPage />}
                    />
                    <Route
                      path="/team-management"
                      element={<TeamManagementPage />}
                    />
                    <Route
                      path="/schedule-view"
                      element={<ManagerEmployeeScheduleView />}
                    />
                    <Route
                      path="/business-unit-calendar"
                      element={
                        <ProtectedRoute requiredRole={["MANAGER", "ADMIN"]}>
                          <BusinessUnitCalendarView />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <ProtectedRoute requiredRole="ADMIN">
                          <AdminUserManagement />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/organizations"
                      element={
                        <ProtectedRoute requiredRole="ADMIN">
                          <AdminOrganizationManagement />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/business-unit-schedules"
                      element={
                        <ProtectedRoute requiredRole="ADMIN">
                          <AdminBusinessUnitSchedulePage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/admin/paychecks"
                      element={
                        <ProtectedRoute requiredRole="ADMIN">
                          <AdminPaycheckGenerator />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/"
                      element={<Navigate to="/schedule" replace />}
                    />
                    <Route
                      path="*"
                      element={<Navigate to="/login" replace />}
                    />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
