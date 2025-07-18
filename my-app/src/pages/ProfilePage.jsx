import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { USER_BASE_URL } from "../config/api";
import {
  UserCircle,
  Mail,
  Shield,
  Building,
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Hash,
} from "lucide-react";

const ProfilePage = () => {
  const { authenticatedFetch, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await authenticatedFetch(`${USER_BASE_URL}/users/me`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setCurrentUser(data);
      } catch (err) {
        setError(err);
        console.error("Error fetching user profile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [authenticatedFetch]);

  // Helper function to format dates
  const formatDate = (timestamp) => {
    if (!timestamp) return "Not available";
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString() + " at " + date.toLocaleTimeString();
    } catch {
      return "Invalid date";
    }
  };

  // Helper function to get status badge color
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "INACTIVE":
        return "bg-red-100 text-red-800";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p>Loading user information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Error: {error.message}</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-8 text-center">
        <p>User profile not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">User Profile</h1>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex items-center">
            <div className="bg-blue-100 rounded-full p-2 mr-3">
              <UserCircle size={28} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Personal Information
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Your complete user profile details
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Hash size={16} className="mr-2" /> User ID
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">
                  {currentUser.id || "Not available"}
                </dd>
              </div>

              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <UserCircle size={16} className="mr-2" /> First Name
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {currentUser.firstName || "Not provided"}
                </dd>
              </div>

              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <UserCircle size={16} className="mr-2" /> Last Name
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {currentUser.lastName || "Not provided"}
                </dd>
              </div>

              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Mail size={16} className="mr-2" /> Email address
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {currentUser.email}
                </dd>
              </div>

              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Phone size={16} className="mr-2" /> Phone Number
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {currentUser.phoneNumber || "Not provided"}
                </dd>
              </div>

              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Shield size={16} className="mr-2" /> Role
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 flex items-center">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      currentUser.role === "ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : currentUser.role === "MANAGER"
                        ? "bg-blue-100 text-blue-800"
                        : currentUser.role === "EMPLOYEE"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </dd>
              </div>

              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Building size={16} className="mr-2" /> Business Unit
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div>
                    <div className="font-medium">
                      {currentUser.businessUnitName || "Not assigned"}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {currentUser.businessUnitId || "N/A"}
                    </div>
                  </div>
                </dd>
              </div>

              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <AlertCircle size={16} className="mr-2" /> Account Status
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      currentUser.userStatus
                    )}`}
                  >
                    {currentUser.userStatus || "Unknown"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Account Information Section */}
        <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Account Information
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Account creation and activity details
            </p>
          </div>

          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Calendar size={16} className="mr-2" /> Account Created
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(currentUser.createdAt)}
                </dd>
              </div>

              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <Clock size={16} className="mr-2" /> Last Seen
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(currentUser.lastSeenAt)}
                </dd>
              </div>

              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 flex items-center">
                  <CheckCircle size={16} className="mr-2" /> Privacy Consent
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        currentUser.hasProvidedConsent
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {currentUser.hasProvidedConsent
                        ? "Provided"
                        : "Not Provided"}
                    </span>
                    {currentUser.consentVersion && (
                      <span className="text-xs text-gray-500">
                        Version: {currentUser.consentVersion}
                      </span>
                    )}
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Account Security
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Account security settings and preferences
            </p>
          </div>

          <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
            <p className="text-sm text-gray-500 mb-4">
              For security reasons, password changes must be requested through
              the administrator.
            </p>
            <button
              type="button"
              disabled
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-50 cursor-not-allowed opacity-50"
            >
              Request Password Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
