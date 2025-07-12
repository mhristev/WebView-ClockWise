import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTestCredentials, setShowTestCredentials] = useState(false);

  const { login, isAuthenticated, isAuthorized, authError } = useAuth();
  const navigate = useNavigate();

  // Test credentials for development - only Manager and Admin
  const testCredentials = [
    {
      role: "Manager",
      email: "manager@clockwise.com",
      password: "manager123",
      description: "Manager with elevated permissions",
    },
    {
      role: "Admin",
      email: "admin@clockwise.com",
      password: "admin123",
      description: "Administrator with full permissions",
    },
  ];

  // If already authenticated AND authorized, redirect to schedule
  if (isAuthenticated && isAuthorized) {
    return <Navigate to="/schedule" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      // No need to use authenticatedFetch here, as login handles its own fetch and token storage
      await login(email, password);

      // Login was successful, navigate to schedule
      navigate("/schedule");
    } catch (error) {
      setError(error.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLogin = (credentials) => {
    setEmail(credentials.email);
    setPassword(credentials.password);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            ClockWise
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to your account
          </p>
          <p className="mt-1 text-center text-xs text-gray-500">
            Access restricted to Managers and Admins only
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          {(error || authError) && (
            <div className="text-red-500 text-sm text-center bg-red-50 border border-red-200 rounded p-3">
              {error || authError}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing in...
                </div>
              ) : (
                "Sign in"
              )}
            </button>
          </div>

          {/* Password Reset Link */}
          <div className="text-center">
            <a
              href="http://localhost:8080/realms/clockwise/login-actions/reset-credentials?client_id=auth-service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-500 underline"
            >
              Forgot your password?
            </a>
          </div>
        </form>

        {/* Development Test Credentials */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">
                Development Mode
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowTestCredentials(!showTestCredentials)}
              className="w-full text-sm text-blue-600 hover:text-blue-500 underline"
            >
              {showTestCredentials ? "Hide" : "Show"} Test Credentials
            </button>

            {showTestCredentials && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-gray-500 text-center">
                  Click on any credential below to auto-fill the form
                </p>
                {testCredentials.map((cred, index) => (
                  <div
                    key={index}
                    onClick={() => handleTestLogin(cred)}
                    className="cursor-pointer p-3 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors border"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {cred.role}
                        </p>
                        <p className="text-xs text-gray-600">{cred.email}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {cred.description}
                        </p>
                      </div>
                      <div className="text-xs text-gray-400">Click to use</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Make sure your microservices are running
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Auth Service: localhost:8081 | User Service: localhost:8082
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
