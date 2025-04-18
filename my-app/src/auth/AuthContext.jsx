import React, { createContext, useState, useContext, useEffect } from "react";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Define authorized roles
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
  const checkAuthorization = (userObj) => {
    if (!userObj || !userObj.role) {
      setIsAuthorized(false);
      setAuthError("User has no assigned role");
      return false;
    }

    const hasAuthorizedRole = AUTHORIZED_ROLES.includes(userObj.role);
    setIsAuthorized(hasAuthorizedRole);

    if (!hasAuthorizedRole) {
      setAuthError(
        `Access denied. Your role (${userObj.role}) does not have permission to access this application.`
      );
    } else {
      setAuthError(null);
    }

    return hasAuthorizedRole;
  };

  // On mount, check if we have auth data in localStorage
  useEffect(() => {
    const loadAuthData = () => {
      const authData = localStorage.getItem("authData");

      if (authData) {
        try {
          const parsedData = JSON.parse(authData);
          const { user, token, refreshToken, expiresAt } = parsedData;

          // Check if token is expired
          if (expiresAt && new Date(expiresAt) > new Date()) {
            setUser(user);
            setToken(token);
            setRefreshToken(refreshToken);
            setTokenExpiresAt(expiresAt);
            setIsAuthenticated(true);

            // Check if user has authorized role
            checkAuthorization(user);
          } else {
            // Token expired, clear data
            logout();
          }
        } catch (error) {
          console.error("Error parsing auth data:", error);
          logout();
        }
      }

      setIsLoading(false);
    };

    loadAuthData();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await fetch("http://localhost:8081/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();

      // Check if user has authorized role
      if (!checkAuthorization(data.user)) {
        throw new Error(
          `Access denied. Your role (${data.user.role}) does not have permission to access this application.`
        );
      }

      // Calculate token expiration time
      const expiresAt = new Date(new Date().getTime() + data.expiresIn * 1000);

      // Store auth data
      const authData = {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        expiresAt: expiresAt.toISOString(),
      };

      localStorage.setItem("authData", JSON.stringify(authData));

      setUser(data.user);
      setToken(data.token);
      setRefreshToken(data.refreshToken);
      setTokenExpiresAt(expiresAt);
      setIsAuthenticated(true);

      return data;
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

  // Get business unit details (placeholder - will be replaced with API call)
  const getBusinessUnitDetails = async () => {
    if (!token || !user || !user.businessUnitId) return null;

    try {
      const response = await fetch(
        `http://localhost:8081/v1/business-units/${user.businessUnitId}`,
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
