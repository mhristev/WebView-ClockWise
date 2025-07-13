import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
} from "react";
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
  // Use a ref to store the refresh promise to prevent multiple simultaneous token refreshes
  const refreshPromiseRef = useRef(null);

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

    if (refreshPromiseRef.current) {
      console.log("Refresh already in progress, waiting...");
      return refreshPromiseRef.current;
    }

    refreshPromiseRef.current = (async () => {
      try {
        console.log("🔄 Starting token refresh...");
        console.log("📡 Making request to:", API_ENDPOINTS_CONFIG.refresh());

        const response = await fetch(API_ENDPOINTS_CONFIG.refresh(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refreshToken: tokenToUse }),
        });

        console.log("📊 Response status:", response.status);
        console.log("📊 Response ok:", response.ok);
        console.log(
          "📊 Response headers:",
          Object.fromEntries(response.headers.entries())
        );

        if (!response.ok) {
          let errorMessage = `Token refresh failed: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            console.log("❌ Error response data:", errorData);
            if (errorData.message) {
              errorMessage += ` - ${errorData.message}`;
            } else if (errorData.error) {
              errorMessage += ` - ${errorData.error}`;
            }
          } catch (e) {
            console.warn("Could not parse error response body:", e);
          }
          throw new Error(errorMessage);
        }

        console.log("✅ Response is ok, parsing JSON...");
        const data = await response.json();
        console.log("📦 Parsed response data:", data);

        const newAccessToken = data.accessToken;
        const newRefreshToken = data.refreshToken || tokenToUse; // Use new if provided
        const expiresIn = data.expiresIn || 3600; // Default to 1 hour if not provided
        const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

        console.log("🔑 New access token length:", newAccessToken?.length);
        console.log("🔄 New refresh token length:", newRefreshToken?.length);
        console.log("⏰ New expiration time:", newExpiresAt);

        setToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        setTokenExpiresAt(newExpiresAt);
        setIsAuthenticated(true);
        checkAuthorization(data.role || user?.role); // Update role if provided

        // Fetch full user information from User Service after token refresh
        let updatedUser = { ...user, role: data.role || user?.role }; // Start with existing user data and updated role
        try {
          const userResponse = await fetch(API_ENDPOINTS_CONFIG.me(), {
            method: "GET",
            headers: {
              Authorization: `Bearer ${newAccessToken}`,
              "Content-Type": "application/json",
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            updatedUser = {
              ...userData,
              role: data.role || user?.role, // Ensure role from auth service is used
            };
            console.log("👥 User data updated after refresh:", updatedUser);
          } else {
            console.warn("Failed to re-fetch user details after refresh.");
          }
        } catch (error) {
          console.error("Error re-fetching user details after refresh:", error);
        }

        setUser(updatedUser);

        console.log("✨ Auth state updated:");
        console.log(
          "  Token (first 10 chars):",
          newAccessToken?.substring(0, 10),
          "..."
        );
        console.log(
          "  Refresh Token (first 10 chars):",
          newRefreshToken?.substring(0, 10),
          "..."
        );
        console.log("  Expires At:", newExpiresAt);
        console.log("  Is Authenticated:", true);
        console.log(
          "  Is Authorized:",
          AUTHORIZED_ROLES.includes(updatedUser?.role)
        );
        console.log("  User Role:", updatedUser?.role);
        console.log("  User Business Unit ID:", updatedUser?.businessUnitId);

        // Update local storage
        const authDataToStore = {
          user: updatedUser,
          token: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt.toISOString(),
        };
        localStorage.setItem("authData", JSON.stringify(authDataToStore));
        console.log("💾 Updated localStorage with new tokens and user data");
        const storedAuthData = JSON.parse(localStorage.getItem("authData"));
        console.log(
          "🔎 Verified refreshToken in localStorage (immediate check):",
          storedAuthData.refreshToken?.length > 0 ? "Exists" : "Does not exist"
        );

        // Delayed check to ensure persistence
        setTimeout(() => {
          const delayedAuthData = localStorage.getItem("authData");
          if (delayedAuthData) {
            const parsedDelayedData = JSON.parse(delayedAuthData);
            console.log(
              "⏰ Verified refreshToken in localStorage (delayed check):",
              parsedDelayedData.refreshToken?.length > 0
                ? "Exists"
                : "Does not exist"
            );
          } else {
            console.log(
              "⏰ Verified refreshToken in localStorage (delayed check): No authData found"
            );
          }
        }, 500); // 500ms delay

        return data; // Return the new token data
      } catch (error) {
        console.error("❌ Error in refresh function:", error);
        throw error;
      } finally {
        refreshPromiseRef.current = null; // Clear the promise when done
        console.log("🧹 Cleared refresh promise");
      }
    })();
    return refreshPromiseRef.current;
  };

  const authenticatedFetch = async (url, options = {}) => {
    // Ensure there's no ongoing refresh operation before proceeding
    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
    }

    const currentAuthData = localStorage.getItem("authData");
    let currentToken = null;
    if (currentAuthData) {
      try {
        const parsedAuthData = JSON.parse(currentAuthData);
        currentToken = parsedAuthData.token;
      } catch (e) {
        console.error("Error parsing auth data from localStorage:", e);
      }
    }

    // Check if token is expired or close to expiring
    // Use currentToken for this check if it's available, otherwise fallback to state token
    if (tokenExpiresAt) {
      if (new Date(tokenExpiresAt) < new Date(Date.now() + 5 * 60 * 1000)) {
        console.log("Token nearing expiry, initiating proactive refresh.");
        await refresh();
        // After proactive refresh, re-read from localStorage for the freshest token
        const refreshedAuthData = localStorage.getItem("authData");
        if (refreshedAuthData) {
          try {
            const parsedRefreshedData = JSON.parse(refreshedAuthData);
            currentToken = parsedRefreshedData.token;
            console.log("🔑 Updated currentToken after proactive refresh.");
          } catch (e) {
            console.error(
              "Error parsing refreshed auth data from localStorage:",
              e
            );
          }
        }
      }
    }

    const authHeaders = {
      ...options.headers,
      Authorization: `Bearer ${currentToken}`,
    };

    let response = await fetch(url, { ...options, headers: authHeaders });

    if (response.status === 401) {
      // If 401, attempt to refresh and retry the original request
      try {
        console.log("🔄 Got 401, attempting token refresh...");
        await refresh();

        // Get the fresh token from localStorage after refresh
        const authData = localStorage.getItem("authData");
        if (authData) {
          const parsedData = JSON.parse(authData);
          const freshToken = parsedData.token;
          console.log("🔑 Using fresh token for retry");

          authHeaders.Authorization = `Bearer ${freshToken}`;
          response = await fetch(url, { ...options, headers: authHeaders });
        } else {
          throw new Error("No auth data found after refresh");
        }
      } catch (refreshError) {
        console.error("Failed to refresh token after 401:", refreshError);
        // If refresh fails, log out the user
        logout();
        throw refreshError; // Re-throw to propagate the error to the calling component
      }
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
