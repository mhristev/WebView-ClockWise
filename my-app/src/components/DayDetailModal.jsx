import React, { useState } from "react";
import {
  X,
  Clock,
  FileText,
  User,
  Calendar,
  Check,
  Edit3,
  AlertCircle,
  Save,
  XCircle,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";

const DayDetailModal = ({
  isOpen,
  onClose,
  selectedDate,
  shifts,
  employeeName,
  onWorkSessionUpdate,
}) => {
  const { user, authenticatedFetch } = useAuth(); // Removed getAuthHeaders
  const [editingWorkSession, setEditingWorkSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Add local state to track work session updates
  const [localShifts, setLocalShifts] = useState(shifts);

  // Form states for editing
  const [editForm, setEditForm] = useState({
    clockInTime: "",
    clockOutTime: "",
  });

  // Update local shifts when props change
  React.useEffect(() => {
    console.log(
      "[DayDetailModal] Updating local shifts with fresh data:",
      shifts
    );
    // Ensure we preserve any confirmation status that might have been updated
    setLocalShifts(
      shifts.map((shift) => ({
        ...shift,
        workSession: shift.workSession
          ? {
              ...shift.workSession,
              // Log the confirmation status for debugging
              confirmed: shift.workSession.confirmed || false,
            }
          : null,
      }))
    );
  }, [shifts]);

  if (!isOpen) return null;

  const isManagerOrAdmin =
    user && (user.role === "MANAGER" || user.role === "ADMIN");

  const parseTimestamp = (timestamp) => {
    if (typeof timestamp === "number") {
      return timestamp > 1000000000000
        ? new Date(timestamp)
        : new Date(timestamp * 1000);
    } else if (typeof timestamp === "string") {
      return new Date(timestamp);
    }
    return new Date();
  };

  // Format time for display
  const formatTime = (timeValue) => {
    if (!timeValue) return "N/A";
    try {
      const date = parseTimestamp(timeValue);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch (error) {
      console.error("Error formatting time:", timeValue, error);
      return "Invalid time";
    }
  };

  // Format time for input (HH:MM)
  const formatTimeForInput = (timeValue) => {
    if (!timeValue) return "";
    try {
      const date = parseTimestamp(timeValue);
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error("Error formatting time for input:", timeValue, error);
      return "";
    }
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Calculate total hours for the day
  const calculateTotalHours = () => {
    let totalMinutes = 0;
    localShifts.forEach((shift) => {
      if (shift.workSession && shift.workSession.clockOutTime) {
        try {
          const start = parseTimestamp(shift.workSession.clockInTime);
          const end = parseTimestamp(shift.workSession.clockOutTime);
          totalMinutes += (end - start) / (1000 * 60);
        } catch (error) {
          console.error("Error calculating hours:", error);
        }
      }
    });
    return (totalMinutes / 60).toFixed(1);
  };

  // Start editing a work session
  const startEditingWorkSession = (shift) => {
    const workSession = shift.workSession;
    setEditingWorkSession(shift.id);
    setEditForm({
      clockInTime: formatTimeForInput(workSession.clockInTime),
      clockOutTime: workSession.clockOutTime
        ? formatTimeForInput(workSession.clockOutTime)
        : "",
    });
    setError(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingWorkSession(null);
    setEditForm({
      clockInTime: "",
      clockOutTime: "",
    });
    setError(null);
  };

  // Update local shift state when work session is updated
  const updateLocalShift = (updatedWorkSession) => {
    console.log(
      "[DayDetailModal] Updating local shift with work session:",
      updatedWorkSession
    );

    setLocalShifts((prevShifts) =>
      prevShifts.map((shift) => {
        // Check if this shift has the work session we're updating
        if (
          shift.workSession &&
          shift.workSession.id === updatedWorkSession.id
        ) {
          console.log("[DayDetailModal] Updating shift by work session ID:", {
            shiftId: shift.id,
            workSessionId: updatedWorkSession.id,
          });
          return {
            ...shift,
            workSession: {
              ...shift.workSession, // Preserve existing work session data
              ...updatedWorkSession, // Override with updated data
              confirmed: true, // Ensure confirmed status is set
              confirmedBy: updatedWorkSession.confirmedBy || user.id,
              confirmedAt:
                updatedWorkSession.confirmedAt || new Date().toISOString(),
              // Preserve the session note if it exists and wasn't included in the update
              note: updatedWorkSession.note || shift.workSession.note,
            },
          };
        }
        // Also check if this shift's ID matches the updated work session's shift ID
        else if (shift.id === updatedWorkSession.shiftId) {
          console.log("[DayDetailModal] Updating shift by shift ID:", {
            shiftId: shift.id,
            workSessionShiftId: updatedWorkSession.shiftId,
          });
          return {
            ...shift,
            workSession: {
              ...shift.workSession, // Preserve existing work session data
              ...updatedWorkSession, // Override with updated data
              confirmed: true,
              confirmedBy: updatedWorkSession.confirmedBy || user.id,
              confirmedAt:
                updatedWorkSession.confirmedAt || new Date().toISOString(),
              // Preserve the session note if it exists and wasn't included in the update
              note: updatedWorkSession.note || shift.workSession.note,
            },
          };
        }
        return shift;
      })
    );
  };

  // Confirm work session
  const confirmWorkSession = async (workSessionId) => {
    setLoading(true);
    setError(null);

    try {
      console.log("[DayDetailModal] Confirming work session:", workSessionId);

      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.confirmWorkSession(),
        {
          method: "POST",
          body: JSON.stringify({
            workSessionId,
            confirmedBy: user.id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to confirm work session: ${response.status}`);
      }

      const updatedWorkSession = await response.json();
      console.log(
        "[DayDetailModal] Work session confirmed successfully:",
        updatedWorkSession
      );

      // Update local state immediately
      updateLocalShift(updatedWorkSession);

      // Notify parent component about the update
      if (onWorkSessionUpdate) {
        console.log(
          "[DayDetailModal] Notifying parent component of work session update"
        );
        // Include shift ID in the notification to help parent component identify the shift
        const workSessionWithShiftInfo = {
          ...updatedWorkSession,
          shiftId:
            updatedWorkSession.shiftId ||
            localShifts.find((s) => s.workSession?.id === updatedWorkSession.id)
              ?.id,
        };
        console.log(
          "[DayDetailModal] Sending work session with shift info:",
          workSessionWithShiftInfo
        );
        onWorkSessionUpdate(workSessionWithShiftInfo);
      }

      setError(null);
    } catch (error) {
      console.error("Error confirming work session:", error);
      setError("Failed to confirm work session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Save work session changes
  const saveWorkSessionChanges = async (shift) => {
    setLoading(true);
    setError(null);

    try {
      const workSession = shift.workSession;
      const selectedDateObj = new Date(selectedDate);

      // Create datetime objects for the selected date
      const [clockInHours, clockInMinutes] = editForm.clockInTime
        .split(":")
        .map(Number);
      const [clockOutHours, clockOutMinutes] = editForm.clockOutTime
        .split(":")
        .map(Number);

      const clockInDateTime = new Date(selectedDateObj);
      clockInDateTime.setHours(clockInHours, clockInMinutes, 0, 0);

      const clockOutDateTime = new Date(selectedDateObj);
      clockOutDateTime.setHours(clockOutHours, clockOutMinutes, 0, 0);

      // If clock out is before clock in, assume it's the next day
      if (clockOutDateTime < clockInDateTime) {
        clockOutDateTime.setDate(clockOutDateTime.getDate() + 1);
      }

      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.modifyAndConfirmWorkSession(),
        {
          method: "PUT",
          body: JSON.stringify({
            workSessionId: workSession.id,
            newClockInTime: clockInDateTime.toISOString(),
            newClockOutTime: clockOutDateTime.toISOString(),
            modifiedBy: user.id,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to modify work session: ${response.status}`);
      }

      const updatedWorkSession = await response.json();

      // Update local state immediately
      updateLocalShift(updatedWorkSession);

      // Notify parent component about the update
      if (onWorkSessionUpdate) {
        // Include shift ID in the notification to help parent component identify the shift
        const workSessionWithShiftInfo = {
          ...updatedWorkSession,
          shiftId:
            updatedWorkSession.shiftId ||
            localShifts.find((s) => s.workSession?.id === updatedWorkSession.id)
              ?.id,
        };
        console.log(
          "[DayDetailModal] Sending modified work session with shift info:",
          workSessionWithShiftInfo
        );
        onWorkSessionUpdate(workSessionWithShiftInfo);
      }

      cancelEditing();
    } catch (error) {
      console.error("Error saving work session changes:", error);
      setError("Failed to save changes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Remove the updateSessionNote function as it's no longer needed for managers

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {formatDate(selectedDate)}
              </h2>
              <p className="text-sm text-gray-600">{employeeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {localShifts.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Shifts Scheduled
              </h3>
              <p className="text-gray-500">
                No shifts are scheduled for this day.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Total Hours
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {calculateTotalHours()}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Shifts</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {localShifts.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Shifts */}
              <div className="space-y-4">
                {localShifts.map((shift, index) => (
                  <div key={shift.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Shift {index + 1}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatTime(shift.startTime)} -{" "}
                            {formatTime(shift.endTime)}
                          </p>
                        </div>
                      </div>
                      {shift.role && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {shift.role}
                        </span>
                      )}
                    </div>

                    {/* Work Session */}
                    {shift.workSession ? (
                      <div
                        className={`border rounded-md p-4 ${
                          shift.workSession.confirmed
                            ? "bg-green-50 border-green-200"
                            : "bg-amber-50 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <User
                              className={`h-4 w-4 ${
                                shift.workSession.confirmed
                                  ? "text-green-600"
                                  : "text-amber-600"
                              }`}
                            />
                            <h4
                              className={`font-medium ${
                                shift.workSession.confirmed
                                  ? "text-green-800"
                                  : "text-amber-800"
                              }`}
                            >
                              Work Session
                              {shift.workSession.confirmed && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <Check className="h-3 w-3 mr-1" />
                                  Confirmed
                                </span>
                              )}
                              {!shift.workSession.confirmed && (
                                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Needs Approval
                                </span>
                              )}
                            </h4>
                          </div>

                          {/* Management Actions - Updated logic */}
                          {isManagerOrAdmin && (
                            <div className="flex gap-2">
                              {/* Confirm button - only show if not confirmed */}
                              {!shift.workSession.confirmed && (
                                <button
                                  onClick={() =>
                                    confirmWorkSession(shift.workSession.id)
                                  }
                                  disabled={loading}
                                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm transition-colors"
                                >
                                  <Check className="h-3 w-3" />
                                  {loading ? "Confirming..." : "Confirm"}
                                </button>
                              )}
                              {/* Show confirmed status when confirmed */}
                              {shift.workSession.confirmed && (
                                <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-md text-sm">
                                  <Check className="h-3 w-3" />
                                  Confirmed
                                </div>
                              )}
                              {/* Edit button - always available for managers */}
                              <button
                                onClick={() => startEditingWorkSession(shift)}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
                              >
                                <Edit3 className="h-3 w-3" />
                                Edit
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Work Session Details */}
                        {editingWorkSession === shift.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Clock In Time
                                </label>
                                <input
                                  type="time"
                                  value={editForm.clockInTime}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      clockInTime: e.target.value,
                                    })
                                  }
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Clock Out Time
                                </label>
                                <input
                                  type="time"
                                  value={editForm.clockOutTime}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      clockOutTime: e.target.value,
                                    })
                                  }
                                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                                />
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => saveWorkSessionChanges(shift)}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                              >
                                <Save className="h-3 w-3" />
                                Save & Confirm
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm"
                              >
                                <XCircle className="h-3 w-3" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <p
                                className={`text-xs font-medium mb-1 ${
                                  shift.workSession.confirmed
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }`}
                              >
                                Clock In
                              </p>
                              <p
                                className={`text-sm ${
                                  shift.workSession.confirmed
                                    ? "text-green-800"
                                    : "text-amber-800"
                                }`}
                              >
                                {formatTime(shift.workSession.clockInTime)}
                              </p>
                            </div>
                            {shift.workSession.clockOutTime && (
                              <div>
                                <p
                                  className={`text-xs font-medium mb-1 ${
                                    shift.workSession.confirmed
                                      ? "text-green-600"
                                      : "text-amber-600"
                                  }`}
                                >
                                  Clock Out
                                </p>
                                <p
                                  className={`text-sm ${
                                    shift.workSession.confirmed
                                      ? "text-green-800"
                                      : "text-amber-800"
                                  }`}
                                >
                                  {formatTime(shift.workSession.clockOutTime)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Session Note - Always Read-only for managers */}
                        {shift.workSession.note && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mt-3">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-2">
                                <FileText className="h-4 w-4 text-gray-600 mt-0.5" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-medium text-gray-800">
                                      Session Note
                                    </p>
                                    {isManagerOrAdmin && (
                                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                        Employee Note - Read Only
                                      </span>
                                    )}
                                  </div>
                                  <div className="bg-white border border-gray-200 rounded-md p-2">
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                      {shift.workSession.note.noteContent}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Show message if no session note exists */}
                        {!shift.workSession.note && isManagerOrAdmin && (
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mt-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-400" />
                              <p className="text-sm text-gray-500 italic">
                                No session note provided by employee
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <p className="text-sm text-yellow-800">
                            No work session recorded for this shift
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayDetailModal;
