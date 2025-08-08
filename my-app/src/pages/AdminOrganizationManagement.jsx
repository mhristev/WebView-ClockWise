import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG, ORGANIZATION_BASE_URL } from "../config/api";
import {
  Building2,
  Plus,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle,
  X,
  Edit3,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Building,
  FileText,
  Phone,
  Mail,
  Navigation,
  Radius,
} from "lucide-react";

const AdminOrganizationManagement = () => {
  const { authenticatedFetch, user, getAuthHeaders } = useAuth();
  const [companiesWithBusinessUnits, setCompaniesWithBusinessUnits] = useState(
    []
  );
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [expandedCompanies, setExpandedCompanies] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [showBusinessUnitModal, setShowBusinessUnitModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingBusinessUnit, setEditingBusinessUnit] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");

  // Form states
  const [companyForm, setCompanyForm] = useState({
    name: "",
    description: "",
    phoneNumber: "",
    email: "",
  });

  const [businessUnitForm, setBusinessUnitForm] = useState({
    name: "",
    location: "",
    description: "",
    companyId: "",
    latitude: "",
    longitude: "",
    phoneNumber: "",
    email: "",
    allowedRadius: "200",
  });

  // Auto-dismiss messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, []);

  // Apply search filter
  useEffect(() => {
    if (!searchTerm) {
      setFilteredCompanies(companiesWithBusinessUnits);
      return;
    }

    const filtered = companiesWithBusinessUnits.filter((company) => {
      const companyMatch =
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.description.toLowerCase().includes(searchTerm.toLowerCase());

      const businessUnitMatch = company.businessUnits.some(
        (bu) =>
          bu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bu.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bu.description.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return companyMatch || businessUnitMatch;
    });

    setFilteredCompanies(filtered);
  }, [companiesWithBusinessUnits, searchTerm]);

  // Check admin access
  if (user?.role !== "ADMIN") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="text-gray-500">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Validation helpers
  const isFieldEmpty = (value) => !value || !value.toString().trim();

  const hasCompanyValidationErrors = () => {
    return (
      isFieldEmpty(companyForm.name) || isFieldEmpty(companyForm.description)
    );
  };

  const hasBusinessUnitValidationErrors = () => {
    return (
      isFieldEmpty(businessUnitForm.name) ||
      isFieldEmpty(businessUnitForm.location) ||
      isFieldEmpty(businessUnitForm.description) ||
      isFieldEmpty(businessUnitForm.companyId)
    );
  };

  const fetchCompaniesWithBusinessUnits = async () => {
    try {
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.companiesWithBusinessUnits(),
        { method: "GET" }
      );

      if (response.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Companies with business units data:", data);

      // Handle Flow response from backend
      const companiesArray = Array.isArray(data) ? data : [];
      setCompaniesWithBusinessUnits(companiesArray);
      setFilteredCompanies(companiesArray);
    } catch (error) {
      console.error("Error fetching companies with business units:", error);
      setError(`Failed to load organization data: ${error.message}`);
      setCompaniesWithBusinessUnits([]);
      setFilteredCompanies([]);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await fetchCompaniesWithBusinessUnits();
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load organization data");
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle company expansion
  const toggleCompanyExpansion = (companyId) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
    }
    setExpandedCompanies(newExpanded);
  };

  // Company CRUD operations
  const handleCreateCompany = () => {
    setEditingCompany(null);
    setCompanyForm({ name: "", description: "", phoneNumber: "", email: "" });
    setShowCompanyModal(true);
  };

  const handleEditCompany = (company) => {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name,
      description: company.description,
      phoneNumber: company.phoneNumber || "",
      email: company.email || "",
    });
    setShowCompanyModal(true);
  };

  const handleSaveCompany = async () => {
    if (hasCompanyValidationErrors()) {
      setError("Please fill in all required fields for the company.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingCompany
        ? `${ORGANIZATION_BASE_URL}/companies/${editingCompany.id}`
        : `${ORGANIZATION_BASE_URL}/companies`;

      const method = editingCompany ? "PUT" : "POST";

      const body = editingCompany
        ? { 
            ...companyForm, 
            id: editingCompany.id,
            phoneNumber: companyForm.phoneNumber || null,
            email: companyForm.email || null,
          }
        : {
            ...companyForm,
            phoneNumber: companyForm.phoneNumber || null,
            email: companyForm.email || null,
          };

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(body),
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSuccessMessage(
        editingCompany
          ? "Company updated successfully!"
          : "Company created successfully!"
      );
      setShowCompanyModal(false);
      await loadData();
    } catch (error) {
      console.error("Error saving company:", error);
      setError(
        `Failed to ${editingCompany ? "update" : "create"} company: ${
          error.message
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptDeleteItem = (item, type) => {
    setItemToDelete({ ...item, type });
    setShowDeleteModal(true);
    setDeleteConfirmationInput("");
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
    setDeleteConfirmationInput("");
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || deleteConfirmationInput !== itemToDelete.name) {
      setError("The typed name does not match.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const { type, id } = itemToDelete;
    const url =
      type === "company"
        ? `${ORGANIZATION_BASE_URL}/companies/${id}`
        : `${ORGANIZATION_BASE_URL}/business-units/${id}`;

    try {
      const response = await authenticatedFetch(url, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSuccessMessage(
        `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`
      );
      handleCloseDeleteModal();
      await loadData();
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      setError(`Failed to delete ${type}: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Business Unit CRUD operations
  const handleCreateBusinessUnit = (company) => {
    setEditingBusinessUnit(null);
    setBusinessUnitForm({
      name: "",
      location: "",
      description: "",
      companyId: company.id,
      latitude: "",
      longitude: "",
      phoneNumber: "",
      email: "",
      allowedRadius: "200",
    });
    setShowBusinessUnitModal(true);
  };

  const handleEditBusinessUnit = (businessUnit) => {
    setEditingBusinessUnit(businessUnit);
    setBusinessUnitForm({
      name: businessUnit.name,
      location: businessUnit.location,
      description: businessUnit.description,
      companyId: businessUnit.companyId,
      latitude: businessUnit.latitude || "",
      longitude: businessUnit.longitude || "",
      phoneNumber: businessUnit.phoneNumber || "",
      email: businessUnit.email || "",
      allowedRadius: businessUnit.allowedRadius || "200",
    });
    setShowBusinessUnitModal(true);
  };

  const handleSaveBusinessUnit = async () => {
    if (hasBusinessUnitValidationErrors()) {
      setError("Please fill in all required fields for the business unit.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = editingBusinessUnit
        ? `${ORGANIZATION_BASE_URL}/business-units/${editingBusinessUnit.id}/complete`
        : `${ORGANIZATION_BASE_URL}/business-units`;

      const method = editingBusinessUnit ? "PUT" : "POST";

      // Prepare body with proper field mapping for the new endpoint
      const body = editingBusinessUnit
        ? {
            name: businessUnitForm.name,
            location: businessUnitForm.location,
            description: businessUnitForm.description,
            latitude: businessUnitForm.latitude ? parseFloat(businessUnitForm.latitude) : null,
            longitude: businessUnitForm.longitude ? parseFloat(businessUnitForm.longitude) : null,
            phoneNumber: businessUnitForm.phoneNumber || null,
            email: businessUnitForm.email || null,
            allowedRadius: parseFloat(businessUnitForm.allowedRadius) || 200.0,
          }
        : businessUnitForm;

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(body),
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSuccessMessage(
        editingBusinessUnit
          ? "Business unit updated successfully!"
          : "Business unit created successfully!"
      );
      setShowBusinessUnitModal(false);
      await loadData();
    } catch (error) {
      console.error("Error saving business unit:", error);
      setError(
        `Failed to ${
          editingBusinessUnit ? "update" : "create"
        } business unit: ${error.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseCompanyModal = () => {
    setShowCompanyModal(false);
    setEditingCompany(null);
    setCompanyForm({ name: "", description: "", phoneNumber: "", email: "" });
  };

  const handleCloseBusinessUnitModal = () => {
    setShowBusinessUnitModal(false);
    setEditingBusinessUnit(null);
    setBusinessUnitForm({
      name: "",
      location: "",
      description: "",
      companyId: "",
      latitude: "",
      longitude: "",
      phoneNumber: "",
      email: "",
      allowedRadius: "200",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2 text-gray-600">Loading organization data...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Building2 className="mr-3" />
              Organization Management
            </h1>
            <p className="mt-2 text-gray-600">
              Manage companies and their business units
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm text-green-800">{successMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="mx-auto h-8 w-8 text-blue-600 animate-spin" />
              <p className="mt-2 text-gray-600">Loading organization data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Controls */}
              <div className="bg-white shadow rounded-lg">
                <div className="p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1 max-w-md">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Search companies and business units..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleCreateCompany}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Company
                    </button>
                  </div>
                </div>
              </div>

              {/* Organization List */}
              <div className="bg-white shadow rounded-lg">
                <div className="p-6">
                  {filteredCompanies.length === 0 ? (
                    <div className="text-center py-8">
                      <Building className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500">
                        {searchTerm
                          ? "No organizations match your search."
                          : "No companies found."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredCompanies.map((company) => (
                        <div
                          key={company.id}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          {/* Company Header */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center flex-1">
                              <button
                                onClick={() =>
                                  toggleCompanyExpansion(company.id)
                                }
                                className="mr-3 text-gray-600 hover:text-gray-800"
                              >
                                {expandedCompanies.has(company.id) ? (
                                  <ChevronDown className="h-5 w-5" />
                                ) : (
                                  <ChevronRight className="h-5 w-5" />
                                )}
                              </button>
                              <div>
                                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                                  <Building className="h-5 w-5 mr-2" />
                                  {company.name}
                                </h3>
                                <p className="text-sm text-gray-600 mb-2">
                                  {company.description}
                                </p>
                                
                                {/* Company Contact Information */}
                                {(company.phoneNumber || company.email) && (
                                  <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-2">
                                    {company.phoneNumber && (
                                      <div className="flex items-center">
                                        <Phone className="h-3 w-3 mr-1" />
                                        {company.phoneNumber}
                                      </div>
                                    )}
                                    {company.email && (
                                      <div className="flex items-center">
                                        <Mail className="h-3 w-3 mr-1" />
                                        {company.email}
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                <div className="text-xs text-gray-500">
                                  Business Units: {company.businessUnits.length}
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() =>
                                  handleCreateBusinessUnit(company)
                                }
                                className="text-green-600 hover:text-green-800"
                                title="Add Business Unit"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEditCompany(company)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit Company"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  promptDeleteItem(company, "company")
                                }
                                className="text-red-600 hover:text-red-800"
                                title="Delete Company"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Business Units */}
                          {expandedCompanies.has(company.id) && (
                            <div className="ml-8 mt-4 space-y-3">
                              {company.businessUnits.length === 0 ? (
                                <div className="text-center py-4 text-gray-500">
                                  <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                  <p className="text-sm">
                                    No business units in this company
                                  </p>
                                </div>
                              ) : (
                                company.businessUnits.map((businessUnit) => (
                                  <div
                                    key={businessUnit.id}
                                    className="bg-gray-50 border border-gray-200 rounded-md p-4"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex-1">
                                        <h4 className="font-medium text-gray-900 flex items-center mb-2">
                                          <Building2 className="h-4 w-4 mr-2" />
                                          {businessUnit.name}
                                        </h4>
                                        
                                        {/* Basic Info */}
                                        <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                                          <div className="flex items-center">
                                            <MapPin className="h-3 w-3 mr-2" />
                                            {businessUnit.location}
                                          </div>
                                          <div className="flex items-start">
                                            <FileText className="h-3 w-3 mr-2 mt-0.5" />
                                            <span className="flex-1">{businessUnit.description}</span>
                                          </div>
                                        </div>

                                        {/* Contact Information */}
                                        {(businessUnit.phoneNumber || businessUnit.email) && (
                                          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 mt-3 pt-2 border-t border-gray-200">
                                            {businessUnit.phoneNumber && (
                                              <div className="flex items-center">
                                                <Phone className="h-3 w-3 mr-2" />
                                                {businessUnit.phoneNumber}
                                              </div>
                                            )}
                                            {businessUnit.email && (
                                              <div className="flex items-center">
                                                <Mail className="h-3 w-3 mr-2" />
                                                {businessUnit.email}
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Coordinates & Radius */}
                                        {(businessUnit.latitude || businessUnit.longitude || businessUnit.allowedRadius) && (
                                          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 mt-3 pt-2 border-t border-gray-200">
                                            {(businessUnit.latitude && businessUnit.longitude) && (
                                              <div className="flex items-center">
                                                <Navigation className="h-3 w-3 mr-2" />
                                                {businessUnit.latitude}°, {businessUnit.longitude}°
                                              </div>
                                            )}
                                            {businessUnit.allowedRadius && (
                                              <div className="flex items-center">
                                                <Radius className="h-3 w-3 mr-2" />
                                                Radius: {businessUnit.allowedRadius}m
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex space-x-2 ml-4">
                                        <button
                                          onClick={() =>
                                            handleEditBusinessUnit(businessUnit)
                                          }
                                          className="text-blue-600 hover:text-blue-800"
                                          title="Edit Business Unit"
                                        >
                                          <Edit3 className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            promptDeleteItem(
                                              businessUnit,
                                              "businessUnit"
                                            )
                                          }
                                          className="text-red-600 hover:text-red-800"
                                          title="Delete Business Unit"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingCompany ? "Edit Company" : "Create Company"}
                </h3>
                <button
                  onClick={handleCloseCompanyModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="companyName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    value={companyForm.name}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, name: e.target.value })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter company name"
                  />
                  {isFieldEmpty(companyForm.name) && (
                    <p className="mt-1 text-sm text-red-600">
                      Company name is required
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="companyDescription"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="companyDescription"
                    value={companyForm.description}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter company description"
                  />
                  {isFieldEmpty(companyForm.description) && (
                    <p className="mt-1 text-sm text-red-600">
                      Description is required
                    </p>
                  )}
                </div>

                {/* Contact Information */}
                <div>
                  <label
                    htmlFor="companyPhoneNumber"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="companyPhoneNumber"
                    value={companyForm.phoneNumber}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        phoneNumber: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter company phone number"
                  />
                </div>

                <div>
                  <label
                    htmlFor="companyEmail"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="companyEmail"
                    value={companyForm.email}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        email: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter company email address"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseCompanyModal}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCompany}
                  disabled={isSubmitting || hasCompanyValidationErrors()}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingCompany ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Unit Modal */}
      {showBusinessUnitModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingBusinessUnit
                    ? "Edit Business Unit"
                    : "Create Business Unit"}
                </h3>
                <button
                  onClick={handleCloseBusinessUnitModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="businessUnitName"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Business Unit Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="businessUnitName"
                    value={businessUnitForm.name}
                    onChange={(e) =>
                      setBusinessUnitForm({
                        ...businessUnitForm,
                        name: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter business unit name"
                  />
                  {isFieldEmpty(businessUnitForm.name) && (
                    <p className="mt-1 text-sm text-red-600">
                      Business unit name is required
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="businessUnitLocation"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="businessUnitLocation"
                    value={businessUnitForm.location}
                    onChange={(e) =>
                      setBusinessUnitForm({
                        ...businessUnitForm,
                        location: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter location"
                  />
                  {isFieldEmpty(businessUnitForm.location) && (
                    <p className="mt-1 text-sm text-red-600">
                      Location is required
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="businessUnitDescription"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="businessUnitDescription"
                    value={businessUnitForm.description}
                    onChange={(e) =>
                      setBusinessUnitForm({
                        ...businessUnitForm,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter business unit description"
                  />
                  {isFieldEmpty(businessUnitForm.description) && (
                    <p className="mt-1 text-sm text-red-600">
                      Description is required
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="businessUnitCompany"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Company <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="businessUnitCompany"
                    value={businessUnitForm.companyId}
                    onChange={(e) =>
                      setBusinessUnitForm({
                        ...businessUnitForm,
                        companyId: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a company</option>
                    {companiesWithBusinessUnits.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {isFieldEmpty(businessUnitForm.companyId) && (
                    <p className="mt-1 text-sm text-red-600">
                      Company selection is required
                    </p>
                  )}
                </div>

                {/* Coordinates Section */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="businessUnitLatitude"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      id="businessUnitLatitude"
                      value={businessUnitForm.latitude}
                      onChange={(e) =>
                        setBusinessUnitForm({
                          ...businessUnitForm,
                          latitude: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 40.7128"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="businessUnitLongitude"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      id="businessUnitLongitude"
                      value={businessUnitForm.longitude}
                      onChange={(e) =>
                        setBusinessUnitForm({
                          ...businessUnitForm,
                          longitude: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., -74.0060"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="businessUnitAllowedRadius"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Radius (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      id="businessUnitAllowedRadius"
                      value={businessUnitForm.allowedRadius}
                      onChange={(e) =>
                        setBusinessUnitForm({
                          ...businessUnitForm,
                          allowedRadius: e.target.value,
                        })
                      }
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="200"
                    />
                  </div>
                </div>

                {/* Contact Information Section */}
                <div>
                  <label
                    htmlFor="businessUnitPhoneNumber"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="businessUnitPhoneNumber"
                    value={businessUnitForm.phoneNumber}
                    onChange={(e) =>
                      setBusinessUnitForm({
                        ...businessUnitForm,
                        phoneNumber: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label
                    htmlFor="businessUnitEmail"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    id="businessUnitEmail"
                    value={businessUnitForm.email}
                    onChange={(e) =>
                      setBusinessUnitForm({
                        ...businessUnitForm,
                        email: e.target.value,
                      })
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email address"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseBusinessUnitModal}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBusinessUnit}
                  disabled={isSubmitting || hasBusinessUnitValidationErrors()}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Save className="h-4 w-4 mr-2" />
                  {editingBusinessUnit ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-red-700 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Confirm Deletion
                </h3>
                <button
                  onClick={handleCloseDeleteModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-gray-700">
                <p>
                  You are about to delete the {itemToDelete.type}{" "}
                  <strong>{itemToDelete.name}</strong>. This action is
                  irreversible.
                </p>
                {itemToDelete.type === "company" && (
                  <p className="font-semibold text-red-600">
                    Warning: Deleting a company will also delete all of its
                    associated business units.
                  </p>
                )}
                <p>
                  To confirm, please type{" "}
                  <strong className="text-red-700">{itemToDelete.name}</strong>{" "}
                  in the box below.
                </p>
                <div>
                  <input
                    type="text"
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCloseDeleteModal}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={
                    isSubmitting ||
                    deleteConfirmationInput !== itemToDelete.name
                  }
                  className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrganizationManagement;
