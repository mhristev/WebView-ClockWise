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
                pending approvals
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
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredExchanges.map((exchange) => (
            <div
              key={exchange.exchangeShift.id}
              className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Exchange Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-orange-100 rounded-full p-2">
                      <ArrowRightLeft size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Shift Exchange Request
                      </h3>
                      <p className="text-sm text-gray-500">
                        {getRequestTypeDisplay(
                          exchange.acceptedRequest.requestType
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Awaiting Approval
                    </span>
                  </div>
                </div>
              </div>

              {/* Original Shift Details */}
              <div className="p-6 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <User size={14} className="mr-2 text-blue-600" />
                  Original Shift (Posted by)
                </h4>
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Employee:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {exchange.exchangeShift.userFirstName}{" "}
                      {exchange.exchangeShift.userLastName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Position:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {exchange.exchangeShift.shiftPosition || "N/A"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Date:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDateOnly(exchange.exchangeShift.shiftStartTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Start Time:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatTimeOnly(exchange.exchangeShift.shiftStartTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">End Time:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatTimeOnly(exchange.exchangeShift.shiftEndTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-blue-200">
                      <span className="text-sm text-gray-600">Posted:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatDateTime(exchange.exchangeShift.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requester Details */}
              <div className="p-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                  <User size={14} className="mr-2 text-green-600" />
                  Requested by
                </h4>
                <div className="bg-green-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Employee:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {exchange.acceptedRequest.requesterUserFirstName}{" "}
                      {exchange.acceptedRequest.requesterUserLastName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Request Type:</span>
                    <span
                      className={`text-sm font-medium px-2 py-1 rounded text-white ${
                        exchange.acceptedRequest.requestType === "SWAP_SHIFT"
                          ? "bg-blue-500"
                          : "bg-orange-500"
                      }`}
                    >
                      {getRequestTypeDisplay(
                        exchange.acceptedRequest.requestType
                      )}
                    </span>
                  </div>

                  {exchange.acceptedRequest.requestType === "SWAP_SHIFT" && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">
                        Swap Shift Details:
                      </h5>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            Position:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {exchange.acceptedRequest.swapShiftPosition ||
                              "N/A"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Date:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatDateOnly(
                              exchange.acceptedRequest.swapShiftStartTime
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            Start Time:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatTimeOnly(
                              exchange.acceptedRequest.swapShiftStartTime
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            End Time:
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatTimeOnly(
                              exchange.acceptedRequest.swapShiftEndTime
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-green-200">
                    <span className="text-sm text-gray-600">Requested:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatDateTime(exchange.acceptedRequest.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => handleRejectClick(exchange)}
                    className="px-4 py-2 border border-red-300 text-red-700 bg-white hover:bg-red-50 rounded-lg flex items-center transition-colors"
                  >
                    <XCircle size={16} className="mr-2" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveClick(exchange)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center transition-colors"
                  >
                    <Check size={16} className="mr-2" />
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))}
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
