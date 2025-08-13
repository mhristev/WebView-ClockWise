import React, { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Calendar,
  User,
  Building2,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  CalendarDays,
  Building,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Coffee,
  ArrowRightLeft,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

// This component serves as the main layout with persistent sidebar
const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState(
    new Set(["scheduling"])
  ); // Default expanded

  // Define navigation sections
  const navigationSections = [
    {
      id: "scheduling",
      title: "Scheduling",
      icon: Calendar,
      items: [
        {
          name: "Weekly Schedule",
          path: "/schedule",
          icon: Calendar,
        },
        {
          name: "Monthly Schedule",
          path: "/schedule-view",
          icon: CalendarDays,
        },
      ],
    },
    {
      id: "management",
      title: "Management",
      icon: Users,
      items: [
        {
          name: "Team Management",
          path: "/team-management",
          icon: Users,
        },
        ...(user?.role === "MANAGER" || user?.role === "ADMIN"
          ? [
              {
                name: "Business Unit Calendar",
                path: "/business-unit-calendar",
                icon: Building,
              },
              {
                name: "Consumption Items",
                path: "/consumption-items",
                icon: Coffee,
              },
              {
                name: "Consumption Records",
                path: "/consumption-records",
                icon: ClipboardList,
              },
              {
                name: "Pending Shift Exchanges",
                path: "/pending-shift-exchanges",
                icon: ArrowRightLeft,
              },
              {
                name: "Posts",
                path: "/posts",
                icon: MessageSquare,
              },
            ]
          : []),
        {
          name: "Business Unit",
          path: "/business-unit",
          icon: Building2,
        },
      ],
    },
    // Admin-only sections
    ...(user?.role === "ADMIN"
      ? [
          {
            id: "administration",
            title: "Administration",
            icon: Settings,
            items: [
              {
                name: "User Management",
                path: "/admin/users",
                icon: Settings,
              },
              {
                name: "Organization Management",
                path: "/admin/organizations",
                icon: Building,
              },
              {
                name: "Business Unit Schedules",
                path: "/admin/business-unit-schedules",
                icon: ClipboardList,
              },
              {
                name: "Paycheck Generator",
                path: "/admin/paychecks",
                icon: DollarSign,
              },
            ],
          },
        ]
      : []),
    {
      id: "profile",
      title: "Profile",
      icon: User,
      items: [
        {
          name: "User Profile",
          path: "/profile",
          icon: User,
        },
      ],
    },
  ];

  // Add debugging on initial render and route changes
  useEffect(() => {
    console.log("Layout component rendered");
    console.log("Current path:", location.pathname);

    // Auto-expand the section containing the current route
    const currentPath = location.pathname;
    const sectionToExpand = navigationSections.find((section) =>
      section.items.some((item) => item.path === currentPath)
    );

    if (sectionToExpand && !expandedSections.has(sectionToExpand.id)) {
      setExpandedSections((prev) => new Set([...prev, sectionToExpand.id]));
    }
  }, [location, navigationSections, expandedSections]);

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

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
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

  // Render navigation section
  const renderNavigationSection = (section) => {
    const isExpanded = expandedSections.has(section.id);

    return (
      <div key={section.id} className="space-y-1">
        {/* Section Header */}
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
        >
          <div className="flex items-center">
            <section.icon className="mr-3 h-5 w-5 text-gray-500" />
            {section.title}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Section Items */}
        {isExpanded && (
          <div className="ml-6 space-y-1 border-l-2 border-gray-200 pl-2">
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={getLinkStyles}
                onClick={() => handleNavLinkClick(item.path)}
              >
                <item.icon className="mr-3 h-4 w-4 text-gray-400" />
                {item.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render mobile navigation section
  const renderMobileNavigationSection = (section) => {
    const isExpanded = expandedSections.has(section.id);

    return (
      <div key={section.id} className="space-y-1">
        {/* Section Header */}
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center justify-between px-3 py-2 text-base font-semibold text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
        >
          <div className="flex items-center">
            <section.icon className="mr-4 h-5 w-5 text-gray-500" />
            {section.title}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>

        {/* Section Items */}
        {isExpanded && (
          <div className="ml-6 space-y-1 border-l-2 border-gray-200 pl-2">
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `${
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  } group flex items-center px-2 py-2 text-base font-medium rounded-md`
                }
                onClick={() => {
                  console.log(`Mobile ${item.name} clicked`);
                  handleNavLinkClick(item.path);
                  toggleMobileMenu();
                }}
              >
                <item.icon className="mr-4 h-4 w-4 text-gray-400" />
                {item.name}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
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
              <nav className="flex-1 px-4 space-y-4">
                {navigationSections.map((section, index) => (
                  <div key={section.id}>
                    {renderNavigationSection(section)}
                    {index < navigationSections.length - 1 && (
                      <div className="mt-4 border-t border-gray-100"></div>
                    )}
                  </div>
                ))}
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
              <nav className="mt-5 px-2 space-y-4">
                {navigationSections.map((section, index) => (
                  <div key={section.id}>
                    {renderMobileNavigationSection(section)}
                    {index < navigationSections.length - 1 && (
                      <div className="mt-4 border-t border-gray-100"></div>
                    )}
                  </div>
                ))}
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
            {/* Render children instead of Outlet */}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
