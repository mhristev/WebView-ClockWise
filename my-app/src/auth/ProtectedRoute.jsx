import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isAuthorized, isLoading, authError } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    // Show loading spinner or placeholder while checking auth status
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated but not authorized (wrong role)
  if (!isAuthorized) {
    return (
      <div className="flex flex-col justify-center items-center h-screen p-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16 mx-auto"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 0 1 12 21a9 9 0 0 1-6.364-2.636m12.728 0A9 9 0 0 0 15 12a9 9 0 0 0-3-6.364m-1.414 1.414A9 9 0 0 1 12 3a9 9 0 0 1 6.364 2.636M18.364 5.636A9 9 0 0 1 21 12a9 9 0 0 1-2.636 6.364"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            {authError ||
              "You don't have permission to access this application."}
          </p>
          <div className="space-y-4">
            <button
              onClick={() => navigate("/login")}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Back to Login
            </button>
            <p className="text-sm text-gray-500">
              Or visit directly:{" "}
              <a
                href="http://localhost:5173/login"
                className="text-blue-500 underline"
              >
                http://localhost:5173/login
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If authenticated and authorized, render children
  return children;
};

export default ProtectedRoute;
