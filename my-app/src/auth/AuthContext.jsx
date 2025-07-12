import React, { createContext, useState, useContext, useEffect } from "react";
import { API_ENDPOINTS_CONFIG } from "../config/api";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Define authorized roles - only ADMIN and MANAGER
const AUTHORIZED_ROLES = ["ADMIN", "MANAGER"];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Check if user role is authorized
  const checkAuthorization = (role) => {
    if (!role) {
      setIsAuthorized(false);
      setAuthError("User has no assigned role");
      return false;
    }

    const hasAuthorizedRole = AUTHORIZED_ROLES.includes(role);
    setIsAuthorized(hasAuthorizedRole);

    if (!hasAuthorizedRole) {
      setAuthError(
        `Access denied. Your role (${role}) does not have permission to access this application. Only Managers and Admins are allowed.`
      );
    } else {
      setAuthError(null);
    }

    return hasAuthorizedRole;
  };

  // On mount, check if we have auth data in localStorage
  useEffect(() => {
    const loadAuthData = async () => {
      // Change to async
      const authData = localStorage.getItem("authData");

      if (authData) {
        try {
          const parsedData = JSON.parse(authData);
          const { user, token, refreshToken, expiresAt } = parsedData;

          setUser(user);
          setToken(token);
          setRefreshToken(refreshToken);
          setTokenExpiresAt(expiresAt);
          setIsAuthenticated(true);

          // Check if token is expired
          if (expiresAt && new Date(expiresAt) < new Date()) {
            try {
              await refresh(refreshToken); // Pass refreshToken as parameter
            } catch (error) {
              console.error("Failed to refresh token on load:", error);
              localStorage.removeItem("authData");
              setIsAuthenticated(false);
              setIsAuthorized(false);
            }
          } else {
            // Check if user has authorized role
            checkAuthorization(user?.role);
          }
        } catch (error) {
          console.error("Error parsing auth data:", error);
          // Clear invalid auth data
          localStorage.removeItem("authData");
          setIsAuthenticated(false);
          setIsAuthorized(false);
        }
      } else {
        // No auth data found, user needs to log in
        setIsAuthenticated(false);
        setIsAuthorized(false);
      }

      setIsLoading(false);
    };

    loadAuthData();
  }, []);

  const refresh = async (refreshTokenToUse = null) => {
    const tokenToUse = refreshTokenToUse || refreshToken;
    if (!tokenToUse) {
      throw new Error("No refresh token available");
    }

    const response = await fetch(API_ENDPOINTS_CONFIG.refresh(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken: tokenToUse }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();

    const newAccessToken = data.accessToken;
    const newRefreshToken = data.refreshToken || tokenToUse; // Use new if provided
    const expiresIn = data.expiresIn || 3600; // Default to 1 hour if not provided
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    setToken(newAccessToken);
    setRefreshToken(newRefreshToken);
    setTokenExpiresAt(newExpiresAt);
    setIsAuthenticated(true);
    checkAuthorization(data.role || user?.role); // Update role if provided

    // Update local storage
    const authDataToStore = {
      user: { ...user, role: data.role || user?.role },
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt.toISOString(),
    };
    localStorage.setItem("authData", JSON.stringify(authDataToStore));
  };

  const authenticatedFetch = async (url, options = {}) => {
    // Check if token is expired or close to expiring
    if (
      tokenExpiresAt &&
      new Date(tokenExpiresAt) < new Date(Date.now() + 5 * 60 * 1000)
    ) {
      await refresh();
    }

    const authHeaders = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(url, { ...options, headers: authHeaders });

    if (response.status === 401) {
      await refresh();
      authHeaders.Authorization = `Bearer ${token}`;
      response = await fetch(url, { ...options, headers: authHeaders });
    }

    return response;
  };

  const login = async (email, password) => {
    try {
      setAuthError(null);

      // Call the actual login API
      const response = await fetch(API_ENDPOINTS_CONFIG.login(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Login failed");
      }

      const authData = await response.json();

      // Validate response structure - now expecting role directly in response
      if (!authData.accessToken || !authData.role) {
        throw new Error("Invalid response from server");
      }

      // Check if user has authorized role
      if (!checkAuthorization(authData.role)) {
        throw new Error(
          `Access denied. Your role (${authData.role}) does not have permission to access this application. Only Managers and Admins are allowed.`
        );
      }

      // Fetch full user information from User Service
      const userResponse = await fetch(API_ENDPOINTS_CONFIG.me(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authData.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      let userObj;
      if (!userResponse.ok) {
        console.warn(
          "Failed to fetch user details from User Service, using basic info"
        );
        // Fall back to basic user object if User Service is unavailable
        userObj = {
          email: email,
          role: authData.role,
        };
      } else {
        const userData = await userResponse.json();
        // Use full user data from User Service but ensure role comes from auth response
        userObj = {
          ...userData,
          role: authData.role, // Always use role from auth service
        };
      }

      // Calculate token expiration time (default to 1 hour if not provided)
      const expiresIn = authData.expiresIn || 3600; // 1 hour default
      const expiresAt = new Date(new Date().getTime() + expiresIn * 1000);

      // Store auth data
      const authDataToStore = {
        user: userObj,
        token: authData.accessToken,
        refreshToken: authData.refreshToken,
        expiresAt: expiresAt.toISOString(),
      };

      localStorage.setItem("authData", JSON.stringify(authDataToStore));

      setUser(userObj);
      setToken(authData.accessToken);
      setRefreshToken(authData.refreshToken);
      setTokenExpiresAt(expiresAt);
      setIsAuthenticated(true);

      return authData;
    } catch (error) {
      console.error("Login error:", error);
      setAuthError(error.message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("authData");
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    setTokenExpiresAt(null);
    setIsAuthenticated(false);
    setIsAuthorized(false);
    setAuthError(null);
  };

  const getAuthHeaders = () => {
    if (!token) return {};

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // Function to get restaurant ID from user's business unit
  const getRestaurantId = () => {
    if (!user || !user.businessUnitId) {
      console.warn("No business unit ID found for user, using default");
      return "1"; // Fallback to '1' if not available
    }
    console.log(
      `Using restaurant ID ${user.businessUnitId} from user's business unit`
    );
    return user.businessUnitId;
  };

  // Get business unit details
  const getBusinessUnitDetails = async () => {
    if (!token || !user || !user.businessUnitId) return null;

    try {
      const response = await fetch(
        API_ENDPOINTS_CONFIG.businessUnit(user.businessUnitId),
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch business unit details");
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching business unit details:", error);
      return null;
    }
  };

  const value = {
    user,
    token,
    refreshToken,
    tokenExpiresAt,
    isAuthenticated,
    isAuthorized,
    isLoading,
    authError,
    login,
    logout,
    getAuthHeaders,
    getRestaurantId,
    getBusinessUnitDetails,
    authenticatedFetch, // Add this
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
