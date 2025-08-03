import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { USER_BASE_URL } from "../config/api";
import {
  Users,
  UserPlus,
  UserMinus,
  Shield,
  Mail,
  Phone,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle,
  X,
  Edit3,
  Trash2,
  Plus,
  DollarSign,
  Clock,
  Calculator,
  TrendingUp,
} from "lucide-react";

const TeamManagementPage = () => {
  const { user, authenticatedFetch, getRestaurantId } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editedContractHours, setEditedContractHours] = useState("");
  const [editedHourlyRate, setEditedHourlyRate] = useState("");

  // Search states for adding members
  const [searchFirstName, setSearchFirstName] = useState("");
  const [searchLastName, setSearchLastName] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState(null);

  const fetchTeamMembers = async () => {
    const businessUnitId = getRestaurantId();
    console.log("Fetching team members for business unit:", businessUnitId);

    setIsLoading(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${USER_BASE_URL}/users/business-unit/${businessUnitId}`,
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
      console.log("Raw team member data:", data);

      // Handle the response based on the actual API structure
      let memberList = [];
      if (Array.isArray(data)) {
        memberList = data;
      } else if (data.users && Array.isArray(data.users)) {
        memberList = data.users;
      } else if (data.content && Array.isArray(data.content)) {
        memberList = data.content;
      }

      // Format team members for display
      const formattedMembers = memberList.map((member) => {
        const isCurrentUser = user && member.id === user.id;

        return {
          id: member.id || member.userId || `member-${Math.random()}`,
          firstName: member.firstName || "",
          lastName: member.lastName || "",
          fullName:
            `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
            member.username ||
            "Unknown Employee",
          username: member.username || "",
          email: member.email || "",
          phoneNumber: member.phoneNumber || "",
          role: member.role || "EMPLOYEE",
          userStatus: member.userStatus || "ACTIVE",
          businessUnitName: member.businessUnitName || "Unknown",
          isCurrentUser: isCurrentUser,
          contractHours: member.contractHours,
          hourlyRate: member.hourlyRate || member.hourlyPayment,
        };
      });

      // Sort team members: current user first, then alphabetically
      const sortedMembers = formattedMembers.sort((a, b) => {
        if (a.isCurrentUser && !b.isCurrentUser) return -1;
        if (!a.isCurrentUser && b.isCurrentUser) return 1;
        return a.fullName.localeCompare(b.fullName);
      });

      setTeamMembers(sortedMembers);
    } catch (error) {
      console.error("Error fetching team members:", error);
      setError(`Failed to load team members: ${error.message}`);
      setTeamMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchUsersWithoutBusinessUnit = async () => {
    if (!searchFirstName.trim() && !searchLastName.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams();

      if (searchFirstName.trim()) {
        params.append("firstName", searchFirstName.trim());
      }
      if (searchLastName.trim()) {
        params.append("lastName", searchLastName.trim());
      }

      const url = `${USER_BASE_URL}/users/search-without-business-unit?${params.toString()}`;
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      };

      const response = await authenticatedFetch(url, { headers: headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const users = await response.json();
      setSearchResults(users);
    } catch (error) {
      console.error("Error searching users:", error);
      setError(`Failed to search users: ${error.message}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddExistingUser = async (e) => {
    e.preventDefault();

    if (!selectedUserToAdd) {
      setError("Please select a user to add");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authenticatedFetch(
        `${USER_BASE_URL}/users/${selectedUserToAdd.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            businessUnitId: user.businessUnitId,
            businessUnitName: user.businessUnitName,
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      setSuccessMessage(
        `Successfully added ${selectedUserToAdd.firstName} ${selectedUserToAdd.lastName} to the team!`
      );
      setShowAddModal(false);
      setSelectedUserToAdd(null);
      setSearchFirstName("");
      setSearchLastName("");
      setSearchResults([]);

      // Refresh team members
      fetchTeamMembers();
    } catch (error) {
      console.error("Error adding user:", error);
      setError(`Failed to add user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedMember) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${USER_BASE_URL}/users/${selectedMember.id}/business-unit`,
        { method: "DELETE" }
      );

      if (response.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      setSuccessMessage(
        `Successfully removed ${selectedMember.fullName} from the team!`
      );
      setShowRemoveModal(false);
      setSelectedMember(null);

      // Refresh team members
      fetchTeamMembers();
    } catch (error) {
      console.error("Error removing user:", error);
      setError(`Failed to remove user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch team members on component mount or user/auth state change
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchTeamMembers();
    }
  }, [user, authenticatedFetch]); // Add authenticatedFetch

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

  const handleUpdateCompensation = async (e) => {
    e.preventDefault();

    if (!editingMember) return;

    // Validation
    const weeklyHours = editedContractHours === "" ? null : parseFloat(editedContractHours);
    const hourlyRate = editedHourlyRate === "" ? null : parseFloat(editedHourlyRate);
    
    if (weeklyHours !== null && (weeklyHours < 0 || weeklyHours > 168)) {
      setError("Weekly hours must be between 0 and 168");
      return;
    }
    
    if (hourlyRate !== null && hourlyRate < 0) {
      setError("Hourly rate cannot be negative");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Update compensation via specialized payment-and-hours endpoint
      const response = await authenticatedFetch(
        `${USER_BASE_URL}/users/${editingMember.id}/payment-and-hours`,
        {
          method: "PUT",
          body: JSON.stringify({
            contractHours: weeklyHours,
            hourlyPayment: hourlyRate,
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `HTTP error! status: ${response.status}`);
      }

      setSuccessMessage(
        `Successfully updated compensation for ${editingMember.fullName}!`
      );
      setShowEditModal(false);
      setEditingMember(null);
      setEditedContractHours("");
      setEditedHourlyRate("");

      // Refresh team members
      fetchTeamMembers();
    } catch (error) {
      console.error("Error updating compensation:", error);
      setError(`Failed to update compensation: ${error.message}`);
    } finally {
      setIsSubmitting(false);
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

  const filteredMembers = teamMembers.filter(
    (member) =>
      member.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-green-100 rounded-full p-3 mr-4">
              <Users size={28} className="text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Team Management
              </h1>
              <p className="text-gray-500">
                {user?.businessUnitName || "Business Unit"} •{" "}
                {teamMembers.length} members
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <Plus size={16} className="mr-2" />
            Add Member
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search team members by name, username, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle size={20} className="text-green-500 mr-2" />
            <p className="text-green-800">{successMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle size={20} className="text-red-500 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Team Members Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Loader2 size={32} className="text-green-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading team members...</p>
          </div>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12">
          <Users size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm
              ? "No matching team members found"
              : "No team members found"}
          </h3>
          <p className="text-gray-500">
            {searchTerm
              ? "Try adjusting your search criteria."
              : "Add your first team member to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
                member.isCurrentUser
                  ? "ring-2 ring-green-500 border-green-300"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {/* Member Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <div
                      className={`rounded-full h-12 w-12 flex items-center justify-center flex-shrink-0 ${
                        member.isCurrentUser ? "bg-green-200" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`text-sm font-medium ${
                          member.isCurrentUser
                            ? "text-green-800"
                            : "text-gray-700"
                        }`}
                      >
                        {getInitials(member.fullName)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-lg font-semibold truncate ${
                          member.isCurrentUser
                            ? "text-green-900"
                            : "text-gray-900"
                        }`}
                      >
                        {member.isCurrentUser ? (
                          <span>
                            {member.fullName}
                            <span className="ml-2 text-sm text-green-600 font-medium">
                              (You)
                            </span>
                          </span>
                        ) : (
                          member.fullName
                        )}
                      </h3>
                      <p
                        className={`text-sm flex items-center space-x-2 ${
                          member.isCurrentUser
                            ? "text-green-600"
                            : "text-gray-500"
                        }`}
                      >
                        <Shield size={12} />
                        <span>{member.role}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {!member.isCurrentUser && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setEditingMember(member);
                          setEditedContractHours(member.contractHours || "");
                          setEditedHourlyRate(member.hourlyRate || "");
                          setShowEditModal(true);
                        }}
                        className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit compensation"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowRemoveModal(true);
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Compensation Section - Prominent Display */}
              {(member.contractHours != null && member.contractHours !== "") ||
              (member.hourlyRate != null && member.hourlyRate !== "") ? (
                <div className="bg-gradient-to-r from-blue-50 to-green-50 px-6 py-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 flex items-center">
                      <Calculator size={14} className="mr-2 text-blue-600" />
                      Compensation
                    </h4>
                    {member.contractHours &&
                      member.hourlyRate &&
                      member.contractHours !== "" &&
                      member.hourlyRate !== "" && (
                        <div className="flex items-center space-x-1 bg-green-100 px-2 py-1 rounded-full">
                          <TrendingUp size={12} className="text-green-600" />
                          <span className="text-sm font-bold text-green-800">
                            ${(
                              parseFloat(member.contractHours) *
                              parseFloat(member.hourlyRate)
                            ).toFixed(2)}/wk
                          </span>
                        </div>
                      )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {member.contractHours != null &&
                      member.contractHours !== "" && (
                        <div className="flex items-center space-x-2">
                          <Clock size={14} className="text-blue-500 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">Weekly Hours</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {member.contractHours}h
                            </p>
                          </div>
                        </div>
                      )}

                    {member.hourlyRate != null && member.hourlyRate !== "" && (
                      <div className="flex items-center space-x-2">
                        <DollarSign size={14} className="text-green-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Hourly Rate</p>
                          <p className="text-sm font-semibold text-gray-900">
                            ${Number(member.hourlyRate).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
                  <div className="flex items-center justify-center text-gray-500">
                    <Calculator size={14} className="mr-2" />
                    <span className="text-sm">No compensation data</span>
                  </div>
                </div>
              )}

              {/* Contact Information */}
              <div className="px-6 py-4 space-y-2 border-t border-gray-100">
                {member.email && (
                  <div className="flex items-center space-x-2">
                    <Mail size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 truncate">
                      {member.email}
                    </span>
                  </div>
                )}

                {member.phoneNumber && (
                  <div className="flex items-center space-x-2">
                    <Phone size={12} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600">
                      {member.phoneNumber}
                    </span>
                  </div>
                )}
                
                {!member.email && !member.phoneNumber && (
                  <div className="text-center py-2">
                    <span className="text-xs text-gray-400">No contact info</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-full p-2 mr-3">
                  <UserPlus size={20} className="text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Team Member
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleAddExistingUser} className="p-6">
              <div className="mb-3">
                <p className="text-sm text-gray-600">
                  Enter at least one name to search for existing users.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={searchFirstName}
                    onChange={(e) => setSearchFirstName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={searchLastName}
                    onChange={(e) => setSearchLastName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mb-4">
                <button
                  type="button"
                  onClick={searchUsersWithoutBusinessUnit}
                  disabled={
                    isSearching ||
                    (!searchFirstName.trim() && !searchLastName.trim())
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                >
                  {isSearching ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search size={16} className="mr-2" />
                      Search Users
                    </>
                  )}
                </button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select User to Add:
                  </label>
                  <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUserToAdd(user)}
                        className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                          selectedUserToAdd?.id === user.id
                            ? "bg-blue-50 border-blue-200"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-gray-600">
                              {user.email}
                            </p>
                          </div>
                          {selectedUserToAdd?.id === user.id && (
                            <CheckCircle size={20} className="text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.length === 0 &&
                (searchFirstName.trim() || searchLastName.trim()) &&
                !isSearching && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-yellow-800 text-sm">
                      No users found matching your search criteria. Try
                      different names.
                    </p>
                  </div>
                )}

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedUserToAdd(null);
                    setSearchFirstName("");
                    setSearchLastName("");
                    setSearchResults([]);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedUserToAdd}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} className="mr-2" />
                      Add Member
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <Edit3 size={20} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Compensation
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleUpdateCompensation} className="p-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-900 border-b border-gray-200 pb-2">
                  Compensation Details
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weekly Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="168"
                      step="0.5"
                      placeholder="e.g., 40"
                      value={editedContractHours}
                      onChange={(e) => setEditedContractHours(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Expected hours per week</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hourly Pay Rate
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={editedHourlyRate}
                        onChange={(e) => setEditedHourlyRate(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Pay rate per hour worked</p>
                  </div>
                </div>
                
                {editedContractHours && editedHourlyRate && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md">
                    <span className="text-sm text-blue-800">
                      Estimated weekly earnings: ${(parseFloat(editedContractHours) * parseFloat(editedHourlyRate)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="mr-2" />
                      Save Compensation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove User Modal */}
      {showRemoveModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div className="bg-red-100 rounded-full p-2 mr-3">
                  <UserMinus size={20} className="text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Remove Team Member
                </h2>
              </div>
              <button
                onClick={() => setShowRemoveModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 mb-6">
                Are you sure you want to remove{" "}
                <strong>{selectedMember.fullName}</strong> from the team? This
                action cannot be undone.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowRemoveModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveUser}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <UserMinus size={16} className="mr-2" />
                      Remove Member
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

export default TeamManagementPage;
