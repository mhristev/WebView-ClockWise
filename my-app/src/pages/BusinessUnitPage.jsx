import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  MapPin,
  FileText,
  Calendar,
  Users,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react";
import { API_ENDPOINTS_CONFIG, ORGANIZATION_BASE_URL } from "../config/api";

const BusinessUnitPage = () => {
  const { user, authenticatedFetch } = useAuth();
  const navigate = useNavigate();
  const [businessUnit, setBusinessUnit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBusinessUnit = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Try to get business unit details from API
        const businessUnitId = user?.businessUnitId || "1"; // Fallback to "1" if user data is not available
        const response = await authenticatedFetch(
          API_ENDPOINTS_CONFIG.businessUnit(businessUnitId),
          {
            method: "GET",
          }
        );

        if (response.ok) {
          const data = await response.json();
          setBusinessUnit(data);
        } else {
          // If API fails or returns null, use fallback data
          console.warn("Failed to fetch business unit details from API.");
          setBusinessUnit(null); // Or set a default/error state
        }
      } catch (error) {
        console.error("Error fetching business unit details:", error);
        setError(`Failed to load business unit details: ${error.message}`);
        setBusinessUnit(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessUnit();
  }, [user, authenticatedFetch]); // Add authenticatedFetch

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto bg-red-50 p-4 rounded-md border border-red-200">
          <h2 className="text-red-800 font-medium">Error</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Business Unit</h1>

        {businessUnit && (
          <>
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
              <div className="px-4 py-5 sm:px-6 flex items-center">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <Building2 size={28} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {businessUnit.name}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    ID: {businessUnit.id}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <MapPin size={16} className="mr-2" /> Location
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {businessUnit.location}
                    </dd>
                  </div>

                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <FileText size={16} className="mr-2" /> Description
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {businessUnit.description}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-5 bg-blue-50 border-b border-blue-100">
                  <h3 className="text-lg font-medium text-blue-800 flex items-center">
                    <Calendar size={20} className="mr-2" /> Schedule Management
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-gray-700 mb-4">
                    Create and manage weekly schedules for your team. Assign
                    shifts and view employee availability.
                  </p>
                  <a
                    href="/schedule"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800"
                  >
                    Go to Schedule{" "}
                    <span aria-hidden="true" className="ml-1">
                      →
                    </span>
                  </a>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-5 bg-green-50 border-b border-green-100">
                  <h3 className="text-lg font-medium text-green-800 flex items-center">
                    <Users size={20} className="mr-2" /> Team Overview
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-gray-700 mb-4">
                    View all team members associated with this business unit.
                    See roles and contact information.
                  </p>
                  <button
                    onClick={() => navigate("/team-management")}
                    className="inline-flex items-center text-green-600 hover:text-green-800 transition-colors"
                  >
                    Manage Team{" "}
                    <span aria-hidden="true" className="ml-1">
                      →
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                  <Briefcase size={20} className="mr-2" /> Business Contact
                  Information
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Contact details for this business unit
                </p>
              </div>

              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Phone size={16} className="mr-2" /> Phone
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      (555) 123-4567
                    </dd>
                  </div>

                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Mail size={16} className="mr-2" /> Email
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {businessUnit.name?.toLowerCase().replace(/\s+/g, ".")}
                      @clockwise.example.com
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BusinessUnitPage;
