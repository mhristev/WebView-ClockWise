import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNotification } from "../components/NotificationContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import {
  Clock,
  User,
  AlertCircle,
  Loader2,
  CheckCircle,
  X,
  Calendar,
  ArrowRightLeft,
  RefreshCw,
  Search,
  Filter,
  Check,
  XCircle,
} from "lucide-react";

const PendingShiftExchanges = () => {
  const { user, authenticatedFetch, getRestaurantId } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [exchanges, setExchanges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [isProcessing, setIsProcessing] = useState(false);
  const [recheckingConflicts, setRecheckingConflicts] = useState(new Set());
  const [lastRefreshTime, setLastRefreshTime] = useState(null);

  const fetchPendingExchanges = async () => {
    const businessUnitId = getRestaurantId();
    console.log(
      "Fetching pending shift exchanges for business unit:",
      businessUnitId
    );

    setIsLoading(true);

    try {
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.awaitingApprovalExchanges(businessUnitId),
        { method: "GET" }
      );

      if (response.status === 401) {
        showError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Pending exchanges data:", data);
      setExchanges(data || []);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error("Error fetching pending exchanges:", error);
      showError(`Failed to load pending shift exchanges: ${error.message}`);
      setExchanges([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchPendingExchanges();
    }
  }, [user, authenticatedFetch]);

  // Auto-refresh every 30 seconds to pick up conflict status changes
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      const interval = setInterval(() => {
        fetchPendingExchanges();
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [user, authenticatedFetch]);

  const handleApproveClick = (exchange) => {
    setSelectedRequest(exchange);
    setActionType("approve");
    setShowConfirmModal(true);
  };

  const handleRejectClick = (exchange) => {
    setSelectedRequest(exchange);
    setActionType("reject");
    setShowConfirmModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    setIsProcessing(true);

    try {
      const endpoint =
        actionType === "approve"
          ? API_ENDPOINTS_CONFIG.approveRequest(
              selectedRequest.acceptedRequest.id
            )
          : API_ENDPOINTS_CONFIG.rejectRequest(
              selectedRequest.acceptedRequest.id
            );

      const response = await authenticatedFetch(endpoint, {
        method: "PUT",
      });

      if (response.status === 401) {
        showError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const actionText = actionType === "approve" ? "approved" : "rejected";
      showSuccess(
        `Successfully ${actionText} shift exchange request from ${selectedRequest.acceptedRequest.requesterUserFirstName} ${selectedRequest.acceptedRequest.requesterUserLastName}`
      );

      setShowConfirmModal(false);
      setSelectedRequest(null);
      setActionType(null);

      // Refresh the exchanges list
      fetchPendingExchanges();
    } catch (error) {
      console.error(`Error ${actionType}ing request:`, error);
      showError(`Failed to ${actionType} request: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelAction = () => {
    setShowConfirmModal(false);
    setSelectedRequest(null);
    setActionType(null);
  };

  const handleRecheckConflicts = async (requestId) => {
    setRecheckingConflicts((prev) => new Set(prev).add(requestId));

    try {
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.recheckConflicts(requestId),
        { method: "POST" }
      );

      if (response.status === 401) {
        showError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      showSuccess("Conflict check completed. Results updated.");

      // Refresh the exchanges list to get updated conflict status
      await fetchPendingExchanges();
    } catch (error) {
      console.error("Error rechecking conflicts:", error);
      showError(`Failed to recheck conflicts: ${error.message}`);
    } finally {
      setRecheckingConflicts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return "N/A";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const formatTimeOnly = (dateTimeString) => {
    if (!dateTimeString) return "N/A";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch (error) {
      return "Invalid Time";
    }
  };

  const formatDateOnly = (dateTimeString) => {
    if (!dateTimeString) return "N/A";
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      return "Invalid Date";
    }
  };

  const getRequestTypeDisplay = (requestType) => {
    switch (requestType) {
      case "SWAP":
        return "Swap";
      case "TAKE_OVER":
        return "Take Over";
      default:
        return requestType || "Unknown";
    }
  };

  const filteredExchanges = exchanges.filter(
    (exchange) =>
      exchange.exchangeShift.userFirstName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      exchange.exchangeShift.userLastName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      exchange.acceptedRequest.requesterUserFirstName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      exchange.acceptedRequest.requesterUserLastName
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      exchange.exchangeShift.shiftPosition
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-full p-3 mr-4">
              <ArrowRightLeft size={28} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Pending Shift Exchanges
              </h1>
              <p className="text-gray-500">
                {user?.businessUnitName || "Business Unit"} • {exchanges.length}{" "}
                pending approval{exchanges.length !== 1 ? "s" : ""}
                {lastRefreshTime && (
                  <span className="ml-2 text-xs text-gray-400">
                    • Last updated {lastRefreshTime.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={fetchPendingExchanges}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
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
            placeholder="Search by employee name or position..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Exchange Requests */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center">
            <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading pending exchanges...</p>
          </div>
        </div>
      ) : filteredExchanges.length === 0 ? (
        <div className="text-center py-12">
          <ArrowRightLeft size={48} className="text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm
              ? "No matching exchange requests found"
              : "No pending exchange requests"}
          </h3>
          <p className="text-gray-500">
            {searchTerm
              ? "Try adjusting your search criteria."
              : "All shift exchanges are approved or there are no pending requests."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredExchanges.map((exchange) => {
            const isSwapRequest =
              exchange.acceptedRequest.requestType === "SWAP_SHIFT";
            const requestTypeConfig = isSwapRequest
              ? {
                  bgColor: "bg-blue-50",
                  borderColor: "border-blue-200",
                  iconBg: "bg-blue-100",
                  iconColor: "text-blue-600",
                  badgeBg: "bg-blue-100",
                  badgeText: "text-blue-800",
                  icon: ArrowRightLeft,
                  title: "Shift Swap Request",
                  description: "Employee wants to exchange shifts",
                }
              : {
                  bgColor: "bg-orange-50",
                  borderColor: "border-orange-200",
                  iconBg: "bg-orange-100",
                  iconColor: "text-orange-600",
                  badgeBg: "bg-orange-100",
                  badgeText: "text-orange-800",
                  icon: User,
                  title: "Shift Coverage Request",
                  description: "Employee needs someone to cover their shift",
                };

            return (
              <div
                key={exchange.exchangeShift.id}
                className={`bg-white border ${requestTypeConfig.borderColor} rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden`}
                role="article"
                aria-label={`${requestTypeConfig.title} from ${exchange.acceptedRequest.requesterUserFirstName} ${exchange.acceptedRequest.requesterUserLastName}`}
              >
                {/* Header Section */}
                <div
                  className={`${requestTypeConfig.bgColor} px-6 py-4 border-b ${requestTypeConfig.borderColor}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`${requestTypeConfig.iconBg} rounded-xl p-3 flex items-center justify-center`}
                      >
                        <requestTypeConfig.icon
                          size={24}
                          className={requestTypeConfig.iconColor}
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {requestTypeConfig.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {requestTypeConfig.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${requestTypeConfig.badgeBg} ${requestTypeConfig.badgeText}`}
                      >
                        <Clock size={14} className="mr-1.5" />
                        Pending Approval
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Original Shift (Left Column) */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                          Shift to Cover
                        </h4>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Employee
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {exchange.exchangeShift.userFirstName}{" "}
                            {exchange.exchangeShift.userLastName}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Position
                          </span>
                          <span className="text-sm font-semibold text-gray-900 bg-white px-2 py-1 rounded-md">
                            {exchange.exchangeShift.shiftPosition || "N/A"}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              Date
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {formatDateOnly(
                                exchange.exchangeShift.shiftStartTime
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Time
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {formatTimeOnly(
                                exchange.exchangeShift.shiftStartTime
                              )}{" "}
                              -{" "}
                              {formatTimeOnly(
                                exchange.exchangeShift.shiftEndTime
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Requester Info (Right Column) */}
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2 mb-3">
                        <div
                          className={`w-2 h-2 ${
                            isSwapRequest ? "bg-blue-500" : "bg-orange-500"
                          } rounded-full`}
                        ></div>
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                          {isSwapRequest
                            ? "Swap Partner"
                            : "Coverage Volunteer"}
                        </h4>
                      </div>

                      <div
                        className={`${
                          isSwapRequest ? "bg-blue-50" : "bg-orange-50"
                        } rounded-xl p-4 space-y-3`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Employee
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {exchange.acceptedRequest.requesterUserFirstName}{" "}
                            {exchange.acceptedRequest.requesterUserLastName}
                          </span>
                        </div>

                        {/* Execution Possibility Indicator */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            Schedule Conflict
                          </span>
                          <div className="flex items-center space-x-2">
                            {recheckingConflicts.has(
                              exchange.acceptedRequest.id
                            ) ? (
                              <div className="flex items-center">
                                <Loader2
                                  size={14}
                                  className="animate-spin text-blue-500 mr-1"
                                />
                                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
                                  Rechecking...
                                </span>
                              </div>
                            ) : exchange.acceptedRequest.isExecutionPossible ===
                              null ? (
                              <div className="flex items-center space-x-1">
                                <Loader2
                                  size={14}
                                  className="animate-spin text-yellow-500 mr-1"
                                />
                                <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-md">
                                  Checking...
                                </span>
                                <button
                                  onClick={() =>
                                    handleRecheckConflicts(
                                      exchange.acceptedRequest.id
                                    )
                                  }
                                  disabled={recheckingConflicts.has(
                                    exchange.acceptedRequest.id
                                  )}
                                  className="text-xs text-blue-600 hover:text-blue-700 underline ml-1 disabled:opacity-50"
                                  title="Recheck for conflicts"
                                >
                                  Recheck
                                </button>
                              </div>
                            ) : exchange.acceptedRequest.isExecutionPossible ? (
                              <div className="flex items-center space-x-1">
                                <CheckCircle
                                  size={14}
                                  className="text-green-500 mr-1"
                                />
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-md">
                                  No Conflict
                                </span>
                                <button
                                  onClick={() =>
                                    handleRecheckConflicts(
                                      exchange.acceptedRequest.id
                                    )
                                  }
                                  disabled={recheckingConflicts.has(
                                    exchange.acceptedRequest.id
                                  )}
                                  className="text-xs text-blue-600 hover:text-blue-700 underline ml-1 disabled:opacity-50"
                                  title="Recheck for conflicts"
                                >
                                  Recheck
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                <AlertCircle
                                  size={14}
                                  className="text-red-500 mr-1"
                                />
                                <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-1 rounded-md">
                                  Has Conflict
                                </span>
                                <button
                                  onClick={() =>
                                    handleRecheckConflicts(
                                      exchange.acceptedRequest.id
                                    )
                                  }
                                  disabled={recheckingConflicts.has(
                                    exchange.acceptedRequest.id
                                  )}
                                  className="text-xs text-blue-600 hover:text-blue-700 underline ml-1 disabled:opacity-50"
                                  title="Recheck for conflicts"
                                >
                                  Recheck
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isSwapRequest && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-700">
                                Their Position
                              </span>
                              <span className="text-sm font-semibold text-gray-900 bg-white px-2 py-1 rounded-md">
                                {exchange.acceptedRequest.swapShiftPosition ||
                                  "N/A"}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-blue-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                  Their Date
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                  {formatDateOnly(
                                    exchange.acceptedRequest.swapShiftStartTime
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">
                                  Their Time
                                </span>
                                <span className="text-sm font-bold text-gray-900">
                                  {formatTimeOnly(
                                    exchange.acceptedRequest.swapShiftStartTime
                                  )}{" "}
                                  -{" "}
                                  {formatTimeOnly(
                                    exchange.acceptedRequest.swapShiftEndTime
                                  )}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        <div
                          className={`pt-2 border-t ${
                            isSwapRequest
                              ? "border-blue-200"
                              : "border-orange-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              Requested
                            </span>
                            <span className="text-xs text-gray-600">
                              {formatDateTime(
                                exchange.acceptedRequest.createdAt
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Banner */}
                  <div
                    className={`mt-6 ${
                      isSwapRequest
                        ? "bg-blue-50 border-blue-200"
                        : "bg-orange-50 border-orange-200"
                    } border rounded-xl p-4`}
                  >
                    <div className="flex items-start space-x-3">
                      <div
                        className={`${
                          isSwapRequest ? "bg-blue-100" : "bg-orange-100"
                        } rounded-lg p-2 mt-0.5`}
                      >
                        {isSwapRequest ? (
                          <ArrowRightLeft
                            size={16}
                            className={
                              isSwapRequest
                                ? "text-blue-600"
                                : "text-orange-600"
                            }
                          />
                        ) : (
                          <User size={16} className="text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {isSwapRequest
                            ? "Mutual Shift Exchange"
                            : "Shift Coverage Request"}
                        </p>
                        <p className="text-sm text-gray-700">
                          {isSwapRequest
                            ? `${
                                exchange.acceptedRequest.requesterUserFirstName
                              } wants to swap their ${formatDateOnly(
                                exchange.acceptedRequest.swapShiftStartTime
                              )} shift with ${
                                exchange.exchangeShift.userFirstName
                              }'s ${formatDateOnly(
                                exchange.exchangeShift.shiftStartTime
                              )} shift.`
                            : `${
                                exchange.acceptedRequest.requesterUserFirstName
                              } wants to cover ${
                                exchange.exchangeShift.userFirstName
                              }'s shift on ${formatDateOnly(
                                exchange.exchangeShift.shiftStartTime
                              )}.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-xs text-gray-500">
                        Posted{" "}
                        {formatDateTime(exchange.exchangeShift.createdAt)}
                      </div>
                      <button
                        onClick={() =>
                          handleRecheckConflicts(exchange.acceptedRequest.id)
                        }
                        disabled={recheckingConflicts.has(
                          exchange.acceptedRequest.id
                        )}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 flex items-center"
                        title="Recheck for schedule conflicts"
                      >
                        {recheckingConflicts.has(
                          exchange.acceptedRequest.id
                        ) ? (
                          <>
                            <Loader2 size={12} className="animate-spin mr-1" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={12} className="mr-1" />
                            Recheck Conflicts
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleRejectClick(exchange)}
                        className="px-5 py-2.5 border-2 border-red-200 text-red-700 bg-white hover:bg-red-50 hover:border-red-300 rounded-xl font-semibold flex items-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        aria-label={`Reject ${requestTypeConfig.title.toLowerCase()}`}
                      >
                        <XCircle size={16} className="mr-2" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveClick(exchange)}
                        disabled={
                          exchange.acceptedRequest.isExecutionPossible === false
                        }
                        className={`px-5 py-2.5 rounded-xl font-semibold flex items-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm hover:shadow-md ${
                          exchange.acceptedRequest.isExecutionPossible === false
                            ? "bg-gray-400 cursor-not-allowed text-white"
                            : "bg-green-600 hover:bg-green-700 text-white focus:ring-green-500"
                        }`}
                        aria-label={`${
                          exchange.acceptedRequest.isExecutionPossible === false
                            ? "Cannot approve - has conflicts"
                            : `Approve ${requestTypeConfig.title.toLowerCase()}`
                        }`}
                        title={
                          exchange.acceptedRequest.isExecutionPossible === false
                            ? "Cannot approve request due to schedule conflicts"
                            : ""
                        }
                      >
                        <Check size={16} className="mr-2" />
                        {exchange.acceptedRequest.isExecutionPossible === false
                          ? "Conflicts"
                          : "Approve"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center">
                <div
                  className={`rounded-full p-2 mr-3 ${
                    actionType === "approve" ? "bg-green-100" : "bg-red-100"
                  }`}
                >
                  {actionType === "approve" ? (
                    <Check size={20} className="text-green-600" />
                  ) : (
                    <XCircle size={20} className="text-red-600" />
                  )}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {actionType === "approve" ? "Approve" : "Reject"} Shift
                  Exchange
                </h2>
              </div>
              <button
                onClick={handleCancelAction}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to <strong>{actionType}</strong> this
                  shift exchange request?
                </p>

                {/* Request Summary */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      Original Shift:
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.exchangeShift.userFirstName}{" "}
                      {selectedRequest.exchangeShift.userLastName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Requested by:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {selectedRequest.acceptedRequest.requesterUserFirstName}{" "}
                      {selectedRequest.acceptedRequest.requesterUserLastName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Request Type:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {getRequestTypeDisplay(
                        selectedRequest.acceptedRequest.requestType
                      )}
                    </span>
                  </div>
                </div>

                {actionType === "reject" && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      <strong>Note:</strong> Rejecting this request will decline
                      the shift exchange and notify both employees.
                    </p>
                  </div>
                )}

                {actionType === "approve" && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 text-sm">
                      <strong>Note:</strong> Approving this request will
                      finalize the shift exchange and update both employees'
                      schedules.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCancelAction}
                  disabled={isProcessing}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  disabled={isProcessing}
                  className={`px-4 py-2 text-white rounded-md flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    actionType === "approve"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {actionType === "approve" ? (
                        <Check size={16} className="mr-2" />
                      ) : (
                        <XCircle size={16} className="mr-2" />
                      )}
                      {actionType === "approve" ? "Approve" : "Reject"}
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

export default PendingShiftExchanges;
