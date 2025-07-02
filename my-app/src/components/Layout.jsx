import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  Calendar,
  UserCircle,
  Building2,
  Menu,
  LogOut,
  X,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

// This component serves as the main layout with persistent sidebar
const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Add debugging on initial render and route changes
  useEffect(() => {
    console.log("Layout component rendered");
    console.log("Current path:", location.pathname);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavLinkClick = (path) => {
    console.log(`NavLink clicked: ${path}`);
    // Force navigation to ensure the path is activated
    navigate(path);
  };

  // Common NavLink style function
  const getLinkStyles = ({ isActive }) => {
    console.log("NavLink active state:", isActive);
    return `${
      isActive
        ? "bg-gray-100 text-gray-900"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    } 
    group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200`;
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-20 p-4">
        <button
          onClick={toggleMobileMenu}
          className="p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Fixed Sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white shadow-lg">
          <div className="flex flex-col flex-grow h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <h1 className="text-xl font-semibold text-gray-800">ClockWise</h1>
            </div>
            <div className="mt-8 flex-grow flex flex-col">
              <nav className="flex-1 px-4 space-y-2">
                <NavLink
                  to="/schedule"
                  className={getLinkStyles}
                  onClick={() => handleNavLinkClick("/schedule")}
                >
                  <Calendar className="mr-3 h-5 w-5 text-gray-400" />
                  Weekly Schedule
                </NavLink>
                <NavLink
                  to="/profile"
                  className={getLinkStyles}
                  onClick={() => handleNavLinkClick("/profile")}
                >
                  <UserCircle className="mr-3 h-5 w-5 text-gray-400" />
                  User Profile
                </NavLink>
                <NavLink
                  to="/business-unit"
                  className={getLinkStyles}
                  onClick={() => handleNavLinkClick("/business-unit")}
                >
                  <Building2 className="mr-3 h-5 w-5 text-gray-400" />
                  Business Unit
                </NavLink>
                <NavLink
                  to="/team-management"
                  className={getLinkStyles}
                  onClick={() => handleNavLinkClick("/team-management")}
                >
                  <Users className="mr-3 h-5 w-5 text-gray-400" />
                  Team Management
                </NavLink>
              </nav>
            </div>

            {/* User info and logout */}
            {user && (
              <div className="flex-shrink-0 flex border-t border-gray-200 p-4 mt-auto">
                <div className="flex-shrink-0 w-full group block">
                  <div className="flex items-center">
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-700">
                        {user.username}
                      </p>
                      <p className="text-xs font-medium text-gray-500">
                        {user.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-600"
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-10 flex">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={toggleMobileMenu}
          ></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-4/5 bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={toggleMobileMenu}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center px-4">
                <h1 className="text-xl font-semibold text-gray-800">
                  ClockWise
                </h1>
              </div>
              <nav className="mt-5 px-2 space-y-1">
                <NavLink
                  to="/schedule"
                  className={({ isActive }) =>
                    `${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`
                  }
                  onClick={() => {
                    console.log("Mobile Weekly Schedule clicked");
                    handleNavLinkClick("/schedule");
                    toggleMobileMenu();
                  }}
                >
                  <Calendar className="mr-4 h-5 w-5 text-gray-400" />
                  Weekly Schedule
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`
                  }
                  onClick={() => {
                    console.log("Mobile User Profile clicked");
                    handleNavLinkClick("/profile");
                    toggleMobileMenu();
                  }}
                >
                  <UserCircle className="mr-4 h-5 w-5 text-gray-400" />
                  User Profile
                </NavLink>
                <NavLink
                  to="/business-unit"
                  className={({ isActive }) =>
                    `${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`
                  }
                  onClick={() => {
                    console.log("Mobile Business Unit clicked");
                    handleNavLinkClick("/business-unit");
                    toggleMobileMenu();
                  }}
                >
                  <Building2 className="mr-4 h-5 w-5 text-gray-400" />
                  Business Unit
                </NavLink>
                <NavLink
                  to="/team-management"
                  className={({ isActive }) =>
                    `${
                      isActive
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    } group flex items-center px-2 py-2 text-base font-medium rounded-md`
                  }
                  onClick={() => {
                    console.log("Mobile Team Management clicked");
                    handleNavLinkClick("/team-management");
                    toggleMobileMenu();
                  }}
                >
                  <Users className="mr-4 h-5 w-5 text-gray-400" />
                  Team Management
                </NavLink>
              </nav>
            </div>

            {/* User info and logout (mobile) */}
            {user && (
              <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                <div className="flex-shrink-0 w-full group block">
                  <div className="flex items-center">
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-700">
                        {user.username}
                      </p>
                      <p className="text-xs font-medium text-gray-500">
                        {user.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-3 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-500 hover:bg-red-600"
                  >
                    <LogOut size={16} className="mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 w-14"></div>
        </div>
      )}

      {/* Main content area - where the pages render */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-2 lg:p-6">
          {/* Add top padding for mobile to account for the hamburger menu */}
          <div className="pt-12 lg:pt-0">
            {/* Use Outlet to render child routes */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
