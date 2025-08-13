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
  Edit3,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { API_ENDPOINTS_CONFIG, ORGANIZATION_BASE_URL } from "../config/api";

const BusinessUnitPage = () => {
  const { user, authenticatedFetch } = useAuth();
  const navigate = useNavigate();
  const [businessUnit, setBusinessUnit] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode states
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    description: "",
    phoneNumber: "",
    email: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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
          // Initialize edit data when business unit is loaded
          setEditData({
            description: data.description || "",
            phoneNumber: data.phoneNumber || "",
            email: data.email || "",
          });
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

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (showSuccessToast || showErrorToast) {
      const timer = setTimeout(() => {
        setShowSuccessToast(false);
        setShowErrorToast(false);
        setToastMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast, showErrorToast]);

  // Validation functions
  const validateField = (name, value) => {
    const errors = {};

    if (name === "email" && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.email = "Please enter a valid email address";
      } else if (value.length > 100) {
        errors.email = "Email must be less than 100 characters";
      }
    }

    if (name === "phoneNumber" && value) {
      const phoneRegex =
        /^[+]?[1-9][\d]{0,14}$|^\([\d]{3}\)[\s-]?[\d]{3}[\s-]?[\d]{4}$|^[\d]{3}[\s-]?[\d]{3}[\s-]?[\d]{4}$/;
      if (!phoneRegex.test(value.replace(/[\s\-()]/g, ""))) {
        errors.phoneNumber = "Please enter a valid phone number";
      }
    }

    if (name === "description" && value && value.length > 5000) {
      errors.description = "Description must be less than 5000 characters";
    }

    return errors;
  };

  const validateAllFields = () => {
    let allErrors = {};
    Object.keys(editData).forEach((field) => {
      const fieldErrors = validateField(field, editData[field]);
      allErrors = { ...allErrors, ...fieldErrors };
    });
    return allErrors;
  };

  // Edit mode handlers
  const handleEditToggle = () => {
    setIsEditing(true);
    setEditData({
      description: businessUnit.description || "",
      phoneNumber: businessUnit.phoneNumber || "",
      email: businessUnit.email || "",
    });
    setValidationErrors({});

    // Focus first field after state update
    setTimeout(() => {
      document.getElementById("edit-description")?.focus();
    }, 0);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({
      description: businessUnit.description || "",
      phoneNumber: businessUnit.phoneNumber || "",
      email: businessUnit.email || "",
    });
    setValidationErrors({});
  };

  const handleInputChange = (field, value) => {
    setEditData({ ...editData, [field]: value });

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: undefined });
    }
  };

  const handleInputBlur = (field, value) => {
    const errors = validateField(field, value);
    setValidationErrors({ ...validationErrors, ...errors });
  };

  const hasChanges = () => {
    return (
      editData.description !== (businessUnit.description || "") ||
      editData.phoneNumber !== (businessUnit.phoneNumber || "") ||
      editData.email !== (businessUnit.email || "")
    );
  };

  const handleSave = async () => {
    // Validate all fields
    const errors = validateAllFields();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSaving(true);

    try {
      const updateData = {
        description: editData.description || null,
        phoneNumber: editData.phoneNumber || null,
        email: editData.email || null,
      };

      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.updateBusinessUnitDetails(businessUnit.id),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (response.ok) {
        const updatedBusinessUnit = await response.json();
        setBusinessUnit(updatedBusinessUnit);
        setIsEditing(false);
        setToastMessage("Business unit updated successfully");
        setShowSuccessToast(true);
      } else {
        throw new Error("Failed to update business unit");
      }
    } catch (error) {
      console.error("Error updating business unit:", error);
      setToastMessage("Failed to update business unit. Please try again.");
      setShowErrorToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  const getInputClassName = (fieldName) => {
    const hasError = validationErrors[fieldName];
    return `block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:border-transparent sm:text-sm ${
      hasError
        ? "border-red-300 focus:ring-red-500"
        : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
    }`;
  };

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
              <div className="px-4 py-5 sm:px-6 flex items-center justify-between">
                <div className="flex items-center">
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
                {user?.role === "MANAGER" && !isEditing && (
                  <button
                    onClick={handleEditToggle}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    title="Edit business unit information"
                  >
                    <Edit3 size={16} className="mr-2" />
                    Edit
                  </button>
                )}
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
                      {isEditing ? (
                        <div className="space-y-1">
                          <textarea
                            id="edit-description"
                            value={editData.description}
                            onChange={(e) =>
                              handleInputChange("description", e.target.value)
                            }
                            onBlur={(e) =>
                              handleInputBlur("description", e.target.value)
                            }
                            className={`${getInputClassName(
                              "description"
                            )} resize-vertical min-h-20 whitespace-pre-wrap`}
                            placeholder="Enter business unit description...&#10;&#10;You can use line breaks and formatting here."
                            rows={5}
                            disabled={isSaving}
                            style={{ whiteSpace: 'pre-wrap' }}
                          />
                          {validationErrors.description && (
                            <p className="text-sm text-red-600 flex items-center">
                              <AlertCircle size={16} className="mr-1" />
                              {validationErrors.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {editData.description.length}/5000 characters
                          </p>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {businessUnit.description ||
                            "No description provided"}
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-lg relative">
              <div className="px-4 py-5 sm:px-6">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                    <Briefcase size={20} className="mr-2" /> Business Contact
                    Information
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">
                    Contact details for this business unit
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Phone size={16} className="mr-2" /> Phone
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="tel"
                            value={editData.phoneNumber}
                            onChange={(e) =>
                              handleInputChange("phoneNumber", e.target.value)
                            }
                            onBlur={(e) =>
                              handleInputBlur("phoneNumber", e.target.value)
                            }
                            className={getInputClassName("phoneNumber")}
                            placeholder="(555) 123-4567"
                            disabled={isSaving}
                          />
                          {validationErrors.phoneNumber && (
                            <p className="text-sm text-red-600 flex items-center">
                              <AlertCircle size={16} className="mr-1" />
                              {validationErrors.phoneNumber}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span>
                          {businessUnit.phoneNumber ||
                            "No phone number provided"}
                        </span>
                      )}
                    </dd>
                  </div>

                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500 flex items-center">
                      <Mail size={16} className="mr-2" /> Email
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="email"
                            value={editData.email}
                            onChange={(e) =>
                              handleInputChange("email", e.target.value)
                            }
                            onBlur={(e) =>
                              handleInputBlur("email", e.target.value)
                            }
                            className={getInputClassName("email")}
                            placeholder="business@example.com"
                            disabled={isSaving}
                          />
                          {validationErrors.email && (
                            <p className="text-sm text-red-600 flex items-center">
                              <AlertCircle size={16} className="mr-1" />
                              {validationErrors.email}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span>{businessUnit.email || "No email provided"}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Save/Cancel Actions */}
              {isEditing && (
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges()}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center order-1 sm:order-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              )}

              {/* Loading overlay during save */}
              {isSaving && (
                <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded-md">
                  <div className="flex items-center text-sm text-gray-600">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Updating...
                  </div>
                </div>
              )}
            </div>

            {/* Management Cards moved to bottom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
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
          </>
        )}

        {/* Success Toast */}
        {showSuccessToast && (
          <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-md p-4 shadow-lg max-w-sm">
            <div className="flex items-start">
              <CheckCircle
                size={20}
                className="text-green-600 mr-3 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  {toastMessage}
                </p>
              </div>
              <button
                onClick={() => setShowSuccessToast(false)}
                className="ml-2 text-green-400 hover:text-green-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Error Toast */}
        {showErrorToast && (
          <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 rounded-md p-4 shadow-lg max-w-sm">
            <div className="flex items-start">
              <AlertCircle
                size={20}
                className="text-red-600 mr-3 flex-shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">
                  {toastMessage}
                </p>
              </div>
              <button
                onClick={() => setShowErrorToast(false)}
                className="ml-2 text-red-400 hover:text-red-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Screen reader announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {isSaving && "Saving changes..."}
          {showSuccessToast && "Changes saved successfully"}
          {showErrorToast && "Error saving changes"}
        </div>
      </div>
    </div>
  );
};

export default BusinessUnitPage;
