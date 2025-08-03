import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { USER_BASE_URL, ORGANIZATION_BASE_URL } from "../config/api";
import {
  Settings,
  Users,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle,
  X,
  Edit3,
  Save,
  UserCheck,
  Building2,
  Shield,
  Mail,
  Phone,
  Filter,
  DollarSign,
  Clock,
  Calculator,
  TrendingUp,
} from "lucide-react";

const AdminUserManagement = () => {
  const { user, getAuthHeaders, authenticatedFetch } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Search and filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [businessUnitFilter, setBusinessUnitFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editForm, setEditForm] = useState({
    role: "",
    businessUnitId: "",
    businessUnitName: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    contractHours: "",
    hourlyRate: "",
  });

  // Available roles
  const ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"];
  const STATUSES = ["ACTIVE", "INACTIVE", "PENDING"];

  // Validation helper
  const isFieldEmpty = (value) => !value || !value.toString().trim();
  const hasValidationErrors = () => {
    return (
      isFieldEmpty(editForm.role) ||
      isFieldEmpty(editForm.firstName) ||
      isFieldEmpty(editForm.lastName) ||
      isFieldEmpty(editForm.email)
    );
  };

  const getFieldError = (fieldName) => {
    if (!editForm[fieldName] || !editForm[fieldName].toString().trim()) {
      return "This field is required";
    }
    return null;
  };

  const fetchAllUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(`${USER_BASE_URL}/users`);

      if (response.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Admin - Raw user data:", data);

      // Handle the response based on the actual API structure
      let userList = [];
      if (Array.isArray(data)) {
        userList = data;
      } else if (data.users && Array.isArray(data.users)) {
        userList = data.users;
      } else if (data.content && Array.isArray(data.content)) {
        userList = data.content;
      }

      // Format users for display
      const formattedUsers = userList.map((userData) => ({
        id: userData.id || userData.userId || `user-${Math.random()}`,
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        fullName:
          `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
          userData.username ||
          "Unknown User",
        username: userData.username || "",
        email: userData.email || "",
        phoneNumber: userData.phoneNumber || "",
        role: userData.role != null ? userData.role : "EMPLOYEE",
        userStatus: userData.userStatus || "ACTIVE",
        businessUnitId: userData.businessUnitId || null,
        businessUnitName: userData.businessUnitName || "Unassigned",
        isCurrentUser: user && userData.id === user.id,
        contractHours: userData.contractHours,
        hourlyRate: userData.hourlyRate || userData.hourlyPayment,
      }));

      // Sort users: current user first, then alphabetically
      const sortedUsers = formattedUsers.sort((a, b) => {
        if (a.isCurrentUser && !b.isCurrentUser) return -1;
        if (!a.isCurrentUser && b.isCurrentUser) return 1;
        return a.fullName.localeCompare(b.fullName);
      });

      setAllUsers(sortedUsers);
      setFilteredUsers(sortedUsers);
    } catch (error) {
      console.error("Error fetching all users:", error);
      setError(`Failed to load users: ${error.message}`);
      setAllUsers([]);
      setFilteredUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBusinessUnits = async () => {
    try {
      console.log(
        "Fetching business units with auth headers:",
        getAuthHeaders()
      );

      const response = await authenticatedFetch(
        `${ORGANIZATION_BASE_URL}/business-units`
      );

      if (response.status === 401) {
        console.error(
          "Authentication failed when fetching business units. Token may be expired."
        );
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch business units: ${response.status}`);
      }

      const businessUnitsData = await response.json();
      console.log("Successfully fetched business units:", businessUnitsData);
      setBusinessUnits(businessUnitsData);
    } catch (error) {
      console.error("Error fetching business units:", error);
      setBusinessUnits([]);
      setError(`Failed to load business units: ${error.message}`);
    }
  };

  const applyFilters = () => {
    let filtered = allUsers;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter) {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    // Business unit filter
    if (businessUnitFilter) {
      filtered = filtered.filter(
        (user) => user.businessUnitName === businessUnitFilter
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((user) => user.userStatus === statusFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleEditUser = (userData) => {
    console.log("Editing user:", userData);
    console.log("Original user role:", userData.role);

    setEditingUser(userData);

    // Ensure role is properly formatted for the dropdown
    const normalizedRole = userData.role
      ? userData.role.toUpperCase()
      : "EMPLOYEE";

    console.log("Normalized role for dropdown:", normalizedRole);

    setEditForm({
      role: normalizedRole,
      businessUnitId: userData.businessUnitId || "",
      businessUnitName:
        userData.businessUnitName === "Unassigned" || !userData.businessUnitName
          ? ""
          : userData.businessUnitName,
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      email: userData.email || "",
      phoneNumber: userData.phoneNumber || "",
      contractHours: userData.contractHours || "",
      hourlyRate: userData.hourlyRate || "",
    });

    console.log("Edit form initialized with:", {
      role: normalizedRole,
      businessUnitId: userData.businessUnitId,
      businessUnitName: userData.businessUnitName,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phoneNumber: userData.phoneNumber,
    });

    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setEditForm({
      role: "",
      businessUnitId: "",
      businessUnitName: "",
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      contractHours: "",
      hourlyRate: "",
    });
  };

  const handleSaveUser = async () => {
    if (!editForm.role) {
      setError("Role is required");
      return;
    }

    // Validate role is one of the accepted values
    const validRoles = ["ADMIN", "MANAGER", "EMPLOYEE"];
    if (!validRoles.includes(editForm.role.toUpperCase())) {
      setError("Invalid role selected");
      return;
    }

    // Validate required fields
    if (!editForm.firstName || !editForm.lastName || !editForm.email) {
      setError("First name, last name, and email are required");
      return;
    }

    setIsSubmitting(true);
    setError(null); // Clear any previous errors

    try {
      // Prepare update data - ensure all fields are properly formatted
      const updateData = {
        role: editForm.role.toUpperCase(), // Ensure role is uppercase for backend
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phoneNumber: editForm.phoneNumber ? editForm.phoneNumber.trim() : null,
      };

      // Prepare compensation data separately for the payment-and-hours endpoint
      const hasCompensationChanges = editForm.contractHours !== "" || editForm.hourlyRate !== "";
      const compensationData = hasCompensationChanges ? {
        contractHours:
          editForm.contractHours === ""
            ? null
            : parseInt(editForm.contractHours, 10),
        hourlyPayment:
          editForm.hourlyRate === ""
            ? null
            : parseFloat(editForm.hourlyRate),
      } : null;

      // Handle business unit assignment/unassignment
      if (editForm.businessUnitId && editForm.businessUnitId !== "") {
        // Assigning to a business unit
        console.log("Assigning user to business unit:", {
          businessUnitId: editForm.businessUnitId,
          businessUnitName: editForm.businessUnitName,
        });
        updateData.businessUnitId = editForm.businessUnitId;
        updateData.businessUnitName = editForm.businessUnitName;
      } else {
        // Unassigning from business unit (set to null)
        console.log("Unassigning user from business unit");
        updateData.businessUnitId = null;
        updateData.businessUnitName = null;
      }

      console.log("Updating user with data:", updateData);

      // First, update the main user data
      const response = await authenticatedFetch(
        `${USER_BASE_URL}/users/${editingUser.id}`,
        {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.text();
          if (errorData) {
            errorMessage = errorData;
          }
        } catch (e) {
          console.warn("Could not parse error response:", e);
        }
        throw new Error(errorMessage);
      }

      let updatedUser = await response.json();
      console.log("User update successful:", updatedUser);

      // If there are compensation changes, update those separately
      if (compensationData) {
        console.log("Updating compensation with data:", compensationData);
        
        const compensationResponse = await authenticatedFetch(
          `${USER_BASE_URL}/users/${editingUser.id}/payment-and-hours`,
          {
            method: "PUT",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify(compensationData),
          }
        );

        if (!compensationResponse.ok) {
          let errorMessage = `Failed to update compensation! status: ${compensationResponse.status}`;
          try {
            const errorData = await compensationResponse.text();
            if (errorData) {
              errorMessage = errorData;
            }
          } catch (e) {
            console.warn("Could not parse compensation error response:", e);
          }
          throw new Error(errorMessage);
        }

        updatedUser = await compensationResponse.json();
        console.log("Compensation update successful:", updatedUser);
      }

      setSuccessMessage("User updated successfully!");
      handleCloseModal();

      // Refresh users to show updated information
      fetchAllUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      setError(`Failed to update user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBusinessUnitChange = (unitId) => {
    console.log("Business unit change requested:", unitId);

    if (unitId === "" || unitId === null || unitId === undefined) {
      // Unassigning from business unit
      console.log("Unassigning user from business unit");
      setEditForm({
        ...editForm,
        businessUnitId: "",
        businessUnitName: "",
      });
    } else {
      // Assigning to a business unit - use the exact ID from the organization service
      const selectedUnit = businessUnits.find((unit) => unit.id === unitId);
      console.log(
        "Looking for business unit with ID:",
        unitId,
        "in available units:",
        businessUnits
      );
      console.log("Selected business unit:", selectedUnit);

      if (selectedUnit) {
        console.log("Assigning user to business unit:", {
          id: selectedUnit.id,
          name: selectedUnit.name,
          location: selectedUnit.location,
        });
        setEditForm({
          ...editForm,
          businessUnitId: unitId,
          businessUnitName: selectedUnit.name,
        });
      } else {
        console.error("Selected business unit not found:", unitId);
        setError(`Business unit with ID ${unitId} not found`);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };

  useEffect(() => {
    fetchAllUsers();
    fetchBusinessUnits();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, roleFilter, businessUnitFilter, statusFilter, allUsers]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const getRoleColor = (role) => {
    switch (role?.toUpperCase()) {
      case "ADMIN":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "MANAGER":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "EMPLOYEE":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "bg-green-100 text-green-800 border-green-200";
      case "INACTIVE":
        return "bg-red-100 text-red-800 border-red-200";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getInitials = (name) => {
    return (
      name
        ?.split(" ")
        .map((part) => part[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "??"
    );
  };

  // Check if current user is admin
  if (user?.role !== "ADMIN") {
    return (
      <div className="p-6 sm:p-8 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle size={48} className="text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-500">
            This page is only accessible to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-purple-100 rounded-full p-3 mr-4">
              <Settings size={28} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                User Management
              </h1>
              <p className="text-gray-500">
                Admin Panel • {filteredUsers.length} users
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search
              size={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search users by name, username, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Filter
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Roles</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Unit Filter
              </label>
              <select
                value={businessUnitFilter}
                onChange={(e) => setBusinessUnitFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Business Units</option>
                <option value="Unassigned">Unassigned</option>
                {businessUnits.map((unit) => (
                  <option key={unit.id} value={unit.name}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-2 text-sm text-green-700">
                {successMessage}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2
            size={48}
            className="text-purple-300 mx-auto mb-4 animate-spin"
          />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Loading Users
          </h3>
          <p className="text-gray-500">
            Fetching user information from the server...
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <Users size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || roleFilter || businessUnitFilter || statusFilter
              ? "No matching users found"
              : "No users found"}
          </h3>
          <p className="text-gray-500">
            {searchTerm || roleFilter || businessUnitFilter || statusFilter
              ? "Try adjusting your search criteria or filters."
              : "No users are available in the system."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredUsers.map((userData) => (
            <div
              key={userData.id}
              className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
                userData.isCurrentUser
                  ? "ring-2 ring-purple-500 border-purple-300"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* User Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`rounded-full h-12 w-12 flex items-center justify-center flex-shrink-0 text-sm font-medium ${
                        userData.isCurrentUser
                          ? "bg-purple-200 text-purple-800"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {getInitials(userData.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-lg font-semibold truncate ${
                          userData.isCurrentUser
                            ? "text-purple-900"
                            : "text-gray-900"
                        }`}
                      >
                        {userData.fullName}
                        {userData.isCurrentUser && (
                          <span className="ml-2 text-sm text-purple-600 font-medium">
                            (You)
                          </span>
                        )}
                      </h3>
                    </div>
                  </div>
                  
                  {!userData.isCurrentUser && (
                    <button
                      onClick={() => handleEditUser(userData)}
                      className="p-2 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                      title="Edit user"
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                </div>
                
                {/* Role and Status Badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getRoleColor(
                      userData.role
                    )}`}
                  >
                    <Shield size={10} className="mr-1" />
                    {userData.role}
                  </span>
                  
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      userData.userStatus
                    )}`}
                  >
                    <UserCheck size={10} className="mr-1" />
                    {userData.userStatus}
                  </span>
                </div>
                
                {/* Business Unit */}
                <div className="flex items-center space-x-2 mb-3">
                  <Building2 size={14} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600 truncate">
                    {userData.businessUnitName}
                  </span>
                </div>
              </div>

              {/* Compensation Section - Prominent Display */}
              {(userData.contractHours != null && userData.contractHours !== "") ||
              (userData.hourlyRate != null && userData.hourlyRate !== "") ? (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-5 py-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                      <Calculator size={14} className="mr-2 text-purple-600" />
                      Compensation
                    </h4>
                    {userData.contractHours &&
                      userData.hourlyRate &&
                      userData.contractHours !== "" &&
                      userData.hourlyRate !== "" && (
                        <div className="flex items-center space-x-1 bg-purple-100 px-2 py-1 rounded-full">
                          <TrendingUp size={12} className="text-purple-600" />
                          <span className="text-sm font-bold text-purple-800">
                            ${(
                              parseFloat(userData.contractHours) *
                              parseFloat(userData.hourlyRate)
                            ).toFixed(2)}/wk
                          </span>
                        </div>
                      )}
                  </div>
                  
                  <div className="space-y-2">
                    {userData.contractHours != null &&
                      userData.contractHours !== "" && (
                        <div className="flex items-center space-x-2">
                          <Clock size={14} className="text-blue-500 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-gray-500">Weekly Hours</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {userData.contractHours}h
                            </p>
                          </div>
                        </div>
                      )}

                    {userData.hourlyRate != null && userData.hourlyRate !== "" && (
                      <div className="flex items-center space-x-2">
                        <DollarSign size={14} className="text-green-500 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-gray-500">Hourly Rate</p>
                          <p className="text-sm font-semibold text-gray-900">
                            ${Number(userData.hourlyRate).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 px-5 py-4 border-t border-gray-100">
                  <div className="flex items-center justify-center text-gray-500">
                    <Calculator size={14} className="mr-2" />
                    <span className="text-sm">No compensation data</span>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="px-5 py-4 space-y-2 border-t border-gray-100">
                {userData.email && (
                  <div className="flex items-center space-x-2">
                    <Mail size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 truncate">
                      {userData.email}
                    </span>
                  </div>
                )}

                {userData.phoneNumber && (
                  <div className="flex items-center space-x-2">
                    <Phone size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600">
                      {userData.phoneNumber}
                    </span>
                  </div>
                )}
                
                {!userData.email && !userData.phoneNumber && (
                  <div className="text-center py-1">
                    <span className="text-xs text-gray-400">No contact info</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md bg-white rounded-md shadow-lg">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit User</h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="space-y-6">
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Personal Information
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="firstName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        First Name *
                      </label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={editForm.firstName || ""}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 ${
                          getFieldError("firstName")
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {getFieldError("firstName") && (
                        <p className="text-red-500 text-xs mt-1">
                          {getFieldError("firstName")}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="lastName"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Last Name *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={editForm.lastName || ""}
                        onChange={handleInputChange}
                        required
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 ${
                          getFieldError("lastName")
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                      />
                      {getFieldError("lastName") && (
                        <p className="text-red-500 text-xs mt-1">
                          {getFieldError("lastName")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={editForm.email || ""}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 ${
                        getFieldError("email")
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                    />
                    {getFieldError("email") && (
                      <p className="text-red-500 text-xs mt-1">
                        {getFieldError("email")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="phoneNumber"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Phone Number (optional)
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={editForm.phoneNumber || ""}
                      onChange={handleInputChange}
                      placeholder="Enter phone number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Work Details Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Work Details
                  </h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm({ ...editForm, role: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Role</option>
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Unit
                    </label>
                    <select
                      value={editForm.businessUnitId}
                      onChange={(e) => handleBusinessUnitChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {businessUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} - {unit.location}
                        </option>
                      ))}
                    </select>
                    {businessUnits.length === 0 && (
                      <p className="text-sm text-gray-500 mt-1">
                        Loading business units...
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Compensation Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
                    Compensation Details
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="contractHours"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Weekly Hours
                      </label>
                      <input
                        type="number"
                        id="contractHours"
                        name="contractHours"
                        min="0"
                        max="168"
                        step="0.5"
                        placeholder="e.g., 40"
                        value={editForm.contractHours || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Expected hours per week</p>
                    </div>
                    
                    <div>
                      <label
                        htmlFor="hourlyRate"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Hourly Pay Rate
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          $
                        </span>
                        <input
                          type="number"
                          id="hourlyRate"
                          name="hourlyRate"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={editForm.hourlyRate || ""}
                          onChange={handleInputChange}
                          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Pay rate per hour worked</p>
                    </div>
                  </div>
                  
                  {editForm.contractHours && editForm.hourlyRate && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-md">
                      <span className="text-sm text-purple-800">
                        Estimated weekly earnings: ${(parseFloat(editForm.contractHours) * parseFloat(editForm.hourlyRate)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={isSubmitting || hasValidationErrors()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  title={
                    hasValidationErrors()
                      ? "Please fill in all required fields"
                      : "Save changes to user"
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
