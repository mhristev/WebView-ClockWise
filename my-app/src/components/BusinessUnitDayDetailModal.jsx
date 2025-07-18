import React, { useState, useEffect } from "react";
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
  CheckCircle,
  Users,
  Building,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";

const BusinessUnitDayDetailModal = ({
  isOpen,
  onClose,
  selectedDate,
  shifts,
  businessUnitId, // Keep businessUnitId as it's a prop
  onWorkSessionUpdate,
}) => {
  const { user, authenticatedFetch } = useAuth(); // Removed getAuthHeaders
  const [editingWorkSession, setEditingWorkSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [localShifts, setLocalShifts] = useState(shifts);
  const [employees, setEmployees] = useState(new Map()); // Cache employee data

  // Form states for editing
  const [editForm, setEditForm] = useState({
    clockInTime: "",
    clockOutTime: "",
  });

  // Update local shifts when props change
  useEffect(() => {
    console.log(
      "[BusinessUnitDayDetailModal] Updating local shifts with fresh data:",
      shifts
    );
    setLocalShifts(
      shifts.map((shift) => ({
        ...shift,
        workSession: shift.workSession
          ? {
              ...shift.workSession,
              // Don't force confirmed to false - let the helper function handle the logic
            }
          : null,
      }))
    );

    // Fetch employee names for all shifts from the shift object itself
    const newEmployeesMap = new Map();
    shifts.forEach((shift) => {
      if (shift.employeeId) {
        newEmployeesMap.set(shift.employeeId, {
          firstName: shift.employeeFirstName || "",
          lastName: shift.employeeLastName || "",
          fullName:
            `${shift.employeeFirstName || ""} ${
              shift.employeeLastName || ""
            }`.trim() || `Employee ${shift.employeeId.slice(-4)}`,
        });
      }
    });
    setEmployees(newEmployeesMap);
  }, [shifts]);

  // Removed the old fetchEmployeeNames as it's now handled directly in the useEffect
  // const fetchEmployeeNames = async (shiftsData) => {
  //   try {
  //     const employeeIds = [
  //       ...new Set(shiftsData.map((shift) => shift.employeeId)),
  //     ];
  //     const newEmployees = new Map(employees);

  //     // Only fetch employees we don't already have
  //     const missingEmployeeIds = employeeIds.filter((id) => !employees.has(id));

  //     if (missingEmployeeIds.length > 0) {
  //       // For now, we'll use placeholder names - in a real app you'd fetch from employee service
  //       missingEmployeeIds.forEach((id) => {
  //         newEmployees.set(id, {
  //           name: `Employee ${id.slice(-4)}`,
  //           role: "Staff",
  //         });
  //       });
  //       setEmployees(newEmployees);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching employee names:", error);
  //   }
  // };

  if (!isOpen) return null;

  const isManagerOrAdmin =
    user && (user.role === "MANAGER" || user.role === "ADMIN");

  // Helper function to determine if a work session should be treated as confirmed
  const isWorkSessionConfirmed = (workSession) => {
    // If confirmation field is explicitly present and true, use it
    if (typeof workSession.confirmed === "boolean") {
      return workSession.confirmed;
    }

    // Since the backend doesn't return confirmation fields in the API response,
    // and we need manager approval for work sessions, treat all as unconfirmed
    // unless explicitly marked as confirmed (e.g., after a confirmation action)
    return false;
  };

  // Parse timestamp helper function
  const parseTimestamp = (timestamp) => {
    if (typeof timestamp === "number") {
      return timestamp > 1000000000000
        ? new Date(timestamp)
        : new Date(timestamp * 1000);
    } else if (typeof timestamp === "string") {
      return new Date(timestamp);
    } else if (Array.isArray(timestamp)) {
      const [year, month, day, hour = 0, minute = 0, second = 0] = timestamp;
      return new Date(year, month - 1, day, hour, minute, second);
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

  // Format duration as hours and minutes
  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return "N/A";
    try {
      const start = parseTimestamp(startTime);
      const end = parseTimestamp(endTime);
      const totalMinutes = Math.floor((end - start) / (1000 * 60));

      if (totalMinutes < 0) return "Invalid duration";

      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      if (hours === 0) {
        return `${minutes}m`;
      } else if (minutes === 0) {
        return `${hours}h`;
      } else {
        return `${hours}h ${minutes}m`;
      }
    } catch (error) {
      console.error("Error calculating duration:", error);
      return "Invalid duration";
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

    // Format total duration nicely
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);

    if (totalHours === 0) {
      return `${remainingMinutes}m`;
    } else if (remainingMinutes === 0) {
      return `${totalHours}h`;
    } else {
      return `${totalHours}h ${remainingMinutes}m`;
    }
  };

  // Calculate day statistics
  const calculateDayStats = () => {
    const totalShifts = localShifts.length;
    const activeEmployees = new Set(
      localShifts.map((shift) => shift.employeeId)
    ).size;
    const confirmedSessions = localShifts.filter(
      (shift) => shift.workSession && isWorkSessionConfirmed(shift.workSession)
    ).length;
    const pendingSessions = localShifts.filter(
      (shift) => shift.workSession && !isWorkSessionConfirmed(shift.workSession)
    ).length;

    return { totalShifts, activeEmployees, confirmedSessions, pendingSessions };
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
  const updateLocalShift = (updatedWorkSession, shouldConfirm = false) => {
    console.log(
      "[BusinessUnitDayDetailModal] Updating local shift with work session:",
      updatedWorkSession,
      "shouldConfirm:",
      shouldConfirm
    );

    setLocalShifts((prevShifts) =>
      prevShifts.map((shift) => {
        if (
          shift.workSession &&
          shift.workSession.id === updatedWorkSession.id
        ) {
          console.log(
            "[BusinessUnitDayDetailModal] Updating shift by work session ID:",
            {
              shiftId: shift.id,
              workSessionId: updatedWorkSession.id,
            }
          );

          const updatedWorkSessionData = {
            ...shift.workSession,
            ...updatedWorkSession,
            sessionNote:
              updatedWorkSession.sessionNote || shift.workSession.sessionNote,
          };

          // Only set confirmation fields if this is a confirmation operation
          if (shouldConfirm) {
            updatedWorkSessionData.confirmed = true;
            updatedWorkSessionData.confirmedBy =
              updatedWorkSession.confirmedBy || user.id;
            updatedWorkSessionData.confirmedAt =
              updatedWorkSession.confirmedAt || new Date().toISOString();
          }

          return {
            ...shift,
            workSession: updatedWorkSessionData,
          };
        } else if (shift.id === updatedWorkSession.shiftId) {
          console.log(
            "[BusinessUnitDayDetailModal] Updating shift by shift ID:",
            {
              shiftId: shift.id,
              workSessionShiftId: updatedWorkSession.shiftId,
            }
          );

          const updatedWorkSessionData = {
            ...shift.workSession,
            ...updatedWorkSession,
          };

          // Only set confirmation fields if this is a confirmation operation
          if (shouldConfirm) {
            updatedWorkSessionData.confirmed = true;
            updatedWorkSessionData.confirmedBy =
              updatedWorkSession.confirmedBy || user.id;
            updatedWorkSessionData.confirmedAt =
              updatedWorkSession.confirmedAt || new Date().toISOString();
          }

          return {
            ...shift,
            workSession: updatedWorkSessionData,
          };
        }
        return shift;
      })
    );

    // Note: onWorkSessionUpdate is now called explicitly in the individual operation functions
    // to pass the correct shouldConfirm parameter
  };

  // Confirm work session
  const confirmWorkSession = async (workSessionId) => {
    setLoading(true);
    setError(null);

    try {
      // Find the shift associated with the workSessionId
      const shiftToConfirm = localShifts.find(
        (shift) => shift.workSession?.id === workSessionId
      );

      if (!shiftToConfirm) {
        throw new Error("Shift not found for the given work session ID.");
      }

      let newClockInTime = shiftToConfirm.workSession?.clockInTime;
      let newClockOutTime = shiftToConfirm.workSession?.clockOutTime;

      // If clockInTime or clockOutTime are missing, use shift's start/end times
      if (!newClockInTime) {
        newClockInTime = shiftToConfirm.startTime;
      }
      if (!newClockOutTime) {
        newClockOutTime = shiftToConfirm.endTime;
      }

      // Check if a modification is needed before confirmation
      const needsModification =
        (!shiftToConfirm.workSession?.clockInTime && newClockInTime) ||
        (!shiftToConfirm.workSession?.clockOutTime && newClockOutTime);

      let updatedWorkSessionData = null;

      if (needsModification) {
        console.log(
          "[BusinessUnitDayDetailModal] Populating missing clock times before confirmation."
        );
        const modifyResponse = await authenticatedFetch(
          API_ENDPOINTS_CONFIG.modifyWorkSession(),
          {
            method: "PUT",
            body: JSON.stringify({
              workSessionId: workSessionId,
              newClockInTime: parseTimestamp(newClockInTime).toISOString(),
              newClockOutTime: newClockOutTime
                ? parseTimestamp(newClockOutTime).toISOString()
                : null, // Handle potentially null clockOutTime
              modifiedBy: user.id,
            }),
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!modifyResponse.ok) {
          const errorText = await modifyResponse.text();
          throw new Error(`Failed to update work session times: ${errorText}`);
        }
        updatedWorkSessionData = await modifyResponse.json();
      }

      // Proceed with confirmation
      console.log(
        "[BusinessUnitDayDetailModal] Confirming work session:",
        workSessionId
      );
      const confirmResponse = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.confirmWorkSession(),
        {
          method: "POST",
          body: JSON.stringify({
            workSessionId: workSessionId,
            confirmedBy: user.id,
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!confirmResponse.ok) {
        const errorText = await confirmResponse.text();
        throw new Error(`Failed to confirm work session: ${errorText}`);
      }

      const confirmedWorkSessionData = await confirmResponse.json();

      // Merge the results if a modification was made previously
      const finalWorkSession = updatedWorkSessionData
        ? { ...updatedWorkSessionData, ...confirmedWorkSessionData }
        : confirmedWorkSessionData;

      console.log(
        "[BusinessUnitDayDetailModal] Work session confirmed successfully:",
        finalWorkSession
      );

      updateLocalShift(finalWorkSession, true); // Pass true for confirmation

      // Notify parent component
      if (onWorkSessionUpdate) {
        onWorkSessionUpdate(finalWorkSession, true); // Pass true to indicate this is a confirmation
      }
    } catch (error) {
      console.error(
        "[BusinessUnitDayDetailModal] Error confirming work session:",
        error
      );
      setError(`Failed to confirm work session: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Save work session changes
  const saveWorkSessionChanges = async (shift) => {
    setLoading(true);
    setError(null);

    try {
      const selectedDateObj = selectedDate;
      const clockInDatetime = new Date(
        selectedDateObj.getFullYear(),
        selectedDateObj.getMonth(),
        selectedDateObj.getDate(),
        parseInt(editForm.clockInTime.split(":")[0]),
        parseInt(editForm.clockInTime.split(":")[1])
      );

      let clockOutDatetime = null;
      if (editForm.clockOutTime) {
        clockOutDatetime = new Date(
          selectedDateObj.getFullYear(),
          selectedDateObj.getMonth(),
          selectedDateObj.getDate(),
          parseInt(editForm.clockOutTime.split(":")[0]),
          parseInt(editForm.clockOutTime.split(":")[1])
        );
      }

      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.modifyWorkSession(),
        {
          method: "PUT",
          body: JSON.stringify({
            workSessionId: shift.workSession.id,
            newClockInTime: clockInDatetime.toISOString(),
            newClockOutTime: clockOutDatetime
              ? clockOutDatetime.toISOString()
              : null,
            modifiedBy: user.id,
          }),
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save changes: ${errorText}`);
      }

      const updatedWorkSession = await response.json();
      console.log(
        "[BusinessUnitDayDetailModal] Work session updated successfully:",
        updatedWorkSession
      );

      updateLocalShift(updatedWorkSession, false); // Pass false for edit (no auto-confirmation)
      cancelEditing();

      // Notify parent component
      if (onWorkSessionUpdate) {
        onWorkSessionUpdate(updatedWorkSession, false); // Pass false to indicate this is an edit
      }
    } catch (error) {
      console.error(
        "[BusinessUnitDayDetailModal] Error saving work session changes:",
        error
      );
      setError(`Failed to save changes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Group shifts by employee for better organization
  const groupShiftsByEmployee = () => {
    const grouped = new Map();
    localShifts.forEach((shift) => {
      const employeeId = shift.employeeId;
      if (!grouped.has(employeeId)) {
        // Use the full name from the employees map
        const employeeInfo = employees.get(employeeId);
        grouped.set(employeeId, {
          employeeId: employeeId,
          employeeName:
            employeeInfo?.fullName || `Employee ${employeeId.slice(-4)}`,
          shifts: [],
        });
      }
      grouped.get(employeeId).shifts.push(shift);
    });
    // Sort employees by name for consistent display
    return Array.from(grouped.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName)
    );
  };

  const stats = calculateDayStats();
  const groupedShifts = groupShiftsByEmployee();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Building className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedDate ? formatDate(selectedDate) : "Day Details"}
              </h2>
              <p className="text-sm text-gray-600">
                Manage shifts and work sessions for all employees
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Statistics Bar */}
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center">
              <Users className="w-4 h-4 text-blue-600 mr-2" />
              <span className="text-gray-600">Employees:</span>
              <span className="font-semibold ml-1">
                {stats.activeEmployees}
              </span>
            </div>
            <div className="flex items-center">
              <Calendar className="w-4 h-4 text-purple-600 mr-2" />
              <span className="text-gray-600">Shifts:</span>
              <span className="font-semibold ml-1">{stats.totalShifts}</span>
            </div>
            <div className="flex items-center">
              <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
              <span className="text-gray-600">Confirmed:</span>
              <span className="font-semibold ml-1">
                {stats.confirmedSessions}
              </span>
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 text-orange-600 mr-2" />
              <span className="text-gray-600">Pending:</span>
              <span className="font-semibold ml-1">
                {stats.pendingSessions}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {localShifts.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No shifts scheduled for this day.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedShifts.map((groupedEmployee) => (
                <div
                  key={groupedEmployee.employeeId}
                  className="border border-gray-200 rounded-lg"
                >
                  {/* Employee Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center">
                      <User className="w-5 h-5 text-gray-600 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">
                        {groupedEmployee.employeeName}
                      </h3>
                      <span className="ml-2 text-sm text-gray-500">
                        {groupedEmployee.shifts.length} shift
                        {groupedEmployee.shifts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* Shifts for this employee */}
                  <div className="p-4 space-y-4">
                    {groupedEmployee.shifts.map((shift) => (
                      <div
                        key={shift.id}
                        className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      >
                        {/* Shift Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 text-blue-600 mr-2" />
                            <span className="font-medium text-gray-900">
                              {formatTime(shift.startTime)} -{" "}
                              {formatTime(shift.endTime)}
                            </span>
                            {shift.position && (
                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {shift.position}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Work Session Details */}
                        {shift.workSession ? (
                          <div className="space-y-3">
                            {editingWorkSession === shift.id ? (
                              // Edit Mode
                              <div className="bg-blue-50 p-3 rounded-md">
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() =>
                                      saveWorkSessionChanges(shift)
                                    }
                                    disabled={loading || !editForm.clockInTime}
                                    className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    disabled={loading}
                                    className="flex items-center px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <div className="bg-gray-50 p-3 rounded-md">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-4 text-sm">
                                    <span>
                                      <strong>Clock In:</strong>{" "}
                                      {formatTime(
                                        shift.workSession.clockInTime
                                      )}
                                    </span>
                                    <span>
                                      <strong>Clock Out:</strong>{" "}
                                      {formatTime(
                                        shift.workSession.clockOutTime
                                      )}
                                    </span>
                                    {shift.workSession.clockInTime &&
                                      shift.workSession.clockOutTime && (
                                        <span>
                                          <strong>Duration:</strong>{" "}
                                          {formatDuration(
                                            shift.workSession.clockInTime,
                                            shift.workSession.clockOutTime
                                          )}
                                        </span>
                                      )}
                                  </div>
                                  {isManagerOrAdmin && (
                                    <div className="flex space-x-2">
                                      {!isWorkSessionConfirmed(
                                        shift.workSession
                                      ) && (
                                        <button
                                          onClick={() =>
                                            confirmWorkSession(
                                              shift.workSession.id
                                            )
                                          }
                                          disabled={loading}
                                          className="flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md hover:bg-green-200"
                                        >
                                          <Check className="w-3 h-3 mr-1" />
                                          Approve
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          startEditingWorkSession(shift)
                                        }
                                        disabled={loading}
                                        className="flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-md hover:bg-blue-200"
                                      >
                                        <Edit3 className="w-3 h-3 mr-1" />
                                        Edit
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Session Note */}
                                {shift.workSession.sessionNote && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex items-start">
                                      <FileText className="w-4 h-4 text-gray-500 mr-2 mt-0.5" />
                                      <div>
                                        <span className="text-sm font-medium text-gray-700">
                                          Note:
                                        </span>
                                        <p className="text-sm text-gray-600 mt-1">
                                          {
                                            shift.workSession.sessionNote
                                              .content
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-yellow-50 p-3 rounded-md">
                            <div className="flex items-center">
                              <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                              <span className="text-sm text-yellow-800">
                                No work session recorded for this shift
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Total Hours Worked: <strong>{calculateTotalHours()}</strong>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessUnitDayDetailModal;
