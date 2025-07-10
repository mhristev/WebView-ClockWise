import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import {
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  AlertCircle,
  Download,
} from "lucide-react";
import MonthlyCalendar from "../components/MonthlyCalendar";
import DayDetailModal from "../components/DayDetailModal";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Helper function to format minutes into a more readable "Xh Ym" format
const formatMinutesToHoursAndMinutes = (minutes) => {
  if (isNaN(minutes) || minutes <= 0) {
    return "0h 0m";
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
};

const ManagerEmployeeScheduleView = () => {
  const { user, getAuthHeaders, getRestaurantId } = useAuth();

  // State management
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to current month
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
  });
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState(null);
  const [selectedDayShifts, setSelectedDayShifts] = useState([]);

  // Check manager access
  useEffect(() => {
    if (user && user.role !== "MANAGER" && user.role !== "ADMIN") {
      setError(
        "Access denied. This page is only accessible to managers and administrators."
      );
    }
  }, [user]);

  // Fetch employees when component mounts
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchEmployees();
    }
  }, [user]);

  // Fetch schedule data when employee or date changes
  useEffect(() => {
    if (selectedEmployee && selectedDate.month && selectedDate.year) {
      fetchMonthlySchedule();
    }
  }, [selectedEmployee, selectedDate]);

  const fetchEmployees = async () => {
    try {
      const businessUnitId = getRestaurantId();
      const response = await fetch(
        `${API_ENDPOINTS_CONFIG.restaurantUsers(businessUnitId)}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch employees: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched employees:", data);

      // Handle different response formats
      let employeeList = [];
      if (Array.isArray(data)) {
        employeeList = data;
      } else if (data.users && Array.isArray(data.users)) {
        employeeList = data.users;
      } else if (data.content && Array.isArray(data.content)) {
        employeeList = data.content;
      }

      // Include all employees including the current user
      // Put the current user at the top
      let sortedEmployees = [...employeeList];
      if (user) {
        sortedEmployees = [
          ...employeeList.filter((emp) => emp.id === user.id),
          ...employeeList.filter((emp) => emp.id !== user.id),
        ];
      }
      setEmployees(sortedEmployees);

      // Auto-select first employee if available
      if (sortedEmployees.length > 0) {
        setSelectedEmployee(sortedEmployees[0].id);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError(`Failed to load employees: ${error.message}`);
    }
  };

  const fetchMonthlySchedule = async () => {
    if (!selectedEmployee || !selectedDate.month || !selectedDate.year) return;

    setLoading(true);
    setError(null);

    try {
      const businessUnitId = getRestaurantId();
      const response = await fetch(
        API_ENDPOINTS_CONFIG.monthlySchedule(
          businessUnitId,
          selectedEmployee,
          selectedDate.month,
          selectedDate.year
        ),
        {
          headers: {
            ...getAuthHeaders(),
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setScheduleData([]);
          return;
        }
        throw new Error(`Failed to fetch schedule: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched monthly schedule:", data);

      // Log details of each shift and its work session
      data.forEach((week, weekIndex) => {
        if (week.shifts && week.shifts.length > 0) {
          console.log(
            `--- Week ${weekIndex + 1} starting: ${week.weekStartDate} ---`
          );
          week.shifts.forEach((shift, shiftIndex) => {
            console.log(`Shift ${shiftIndex + 1} Details:`, {
              shiftId: shift.id,
              scheduledTime: `${shift.startTime} - ${shift.endTime}`,
              role: shift.role,
              hasWorkSession: !!shift.workSession,
              workSession: shift.workSession
                ? {
                    id: shift.workSession.id,
                    clockInTime: shift.workSession.clockInTime,
                    clockOutTime: shift.workSession.clockOutTime,
                    confirmed: isWorkSessionConfirmed(shift.workSession),
                    sessionNote: shift.workSession.sessionNote
                      ? "Present"
                      : "None",
                  }
                : "No work session",
            });
          });
        } else {
          console.log(
            `--- Week ${weekIndex + 1} starting: ${
              week.weekStartDate
            } --- NO SHIFTS`
          );
        }
      });

      console.log("Schedule data structure:", {
        totalWeeks: data.length,
        weeks: data.map((week, index) => ({
          weekIndex: index,
          scheduleId: week.scheduleId,
          weekStartDate: week.weekStartDate,
          shiftsCount: week.shifts?.length || 0,
          shifts:
            week.shifts?.map((shift) => ({
              id: shift.id,
              startTime: shift.startTime,
              endTime: shift.endTime,
              role: shift.role,
              hasWorkSession: !!shift.workSession,
              workSession: shift.workSession,
            })) || [],
        })),
      });
      setScheduleData(data);
    } catch (error) {
      console.error("Error fetching monthly schedule:", error);
      setError(`Failed to load schedule: ${error.message}`);
      setScheduleData([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction) => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev.year, prev.month - 1 + direction, 1);
      return {
        month: newDate.getMonth() + 1,
        year: newDate.getFullYear(),
      };
    });
  };

  const getMonthName = () => {
    const date = new Date(selectedDate.year, selectedDate.month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const getSelectedEmployeeName = () => {
    const employee = employees.find((emp) => emp.id === selectedEmployee);
    return employee
      ? `${employee.firstName} ${employee.lastName}`
      : "Unknown Employee";
  };

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

  // Helper function to parse timestamps (same as in MonthlyCalendar)
  const parseTimestamp = (timestamp) => {
    if (typeof timestamp === "number") {
      if (timestamp > 1000000000000) {
        const timestampStr = timestamp.toString();
        if (timestampStr.length > 13) {
          const milliseconds = Math.floor(timestamp / 1000000);
          return new Date(milliseconds);
        } else {
          return new Date(timestamp);
        }
      } else {
        return new Date(timestamp * 1000);
      }
    } else if (typeof timestamp === "string") {
      if (/^\d+(\.\d+)?$/.test(timestamp)) {
        const numericTimestamp = parseFloat(timestamp);
        if (timestamp.length > 13 || timestamp.includes(".")) {
          const milliseconds = Math.floor(numericTimestamp * 1000);
          return new Date(milliseconds);
        } else if (numericTimestamp > 1000000000000) {
          return new Date(numericTimestamp);
        } else {
          return new Date(numericTimestamp * 1000);
        }
      }
      return new Date(timestamp);
    } else if (Array.isArray(timestamp)) {
      const [year, month, day, hour = 0, minute = 0, second = 0] = timestamp;
      return new Date(year, month - 1, day, hour, minute, second);
    }
    return null; // Return null for invalid or null timestamps
  };

  const calculateTotalHours = () => {
    let actualWorkedMinutes = 0;
    let scheduledMinutes = 0;

    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        // Calculate scheduled hours
        try {
          const startTime = parseTimestamp(shift.startTime);
          const endTime = parseTimestamp(shift.endTime);
          const shiftMinutes = (endTime - startTime) / (1000 * 60);
          scheduledMinutes += shiftMinutes > 0 ? shiftMinutes : 0;
        } catch (error) {
          console.error("Error calculating scheduled hours:", error);
        }

        // Calculate actual worked hours if available
        if (
          shift.workSession &&
          shift.workSession.clockInTime &&
          shift.workSession.clockOutTime
        ) {
          try {
            const start = parseTimestamp(shift.workSession.clockInTime);
            const end = parseTimestamp(shift.workSession.clockOutTime);
            const workedMinutes = (end - start) / (1000 * 60);
            actualWorkedMinutes += workedMinutes > 0 ? workedMinutes : 0;
          } catch (error) {
            console.error("Error calculating worked hours:", error);
          }
        }
      });
    });

    // Use actual worked hours if available, otherwise use scheduled hours
    const totalMinutes =
      actualWorkedMinutes > 0 ? actualWorkedMinutes : scheduledMinutes;
    return {
      total: totalMinutes,
      scheduled: scheduledMinutes,
      actual: actualWorkedMinutes,
    };
  };

  const calculateShiftStatistics = () => {
    const stats = {
      totalShifts: 0,
      completedShifts: 0,
      weekCount: scheduleData.length,
    };

    scheduleData.forEach((week) => {
      stats.totalShifts += week.shifts.length;
      week.shifts.forEach((shift) => {
        if (shift.workSession && shift.workSession.clockOutTime) {
          stats.completedShifts++;
        }
      });
    });

    return stats;
  };

  // Modal handlers
  const handleDayClick = (date, shifts) => {
    setSelectedDayDate(date);
    setSelectedDayShifts(shifts);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDayDate(null);
    setSelectedDayShifts([]);
  };

  // Handle work session updates to refresh the schedule data
  const handleWorkSessionUpdate = async (
    updatedWorkSession,
    isConfirmation = false
  ) => {
    console.log(
      "[ManagerEmployeeScheduleView] Work session updated:",
      updatedWorkSession,
      "isConfirmation:",
      isConfirmation
    );

    // Update the local schedule data immediately
    setScheduleData((prevData) =>
      prevData.map((week) => ({
        ...week,
        shifts: week.shifts.map((shift) => {
          // Check if this shift has the work session we're updating
          if (
            shift.workSession &&
            shift.workSession.id === updatedWorkSession.id
          ) {
            console.log(
              "[ManagerEmployeeScheduleView] Updating shift work session:",
              {
                shiftId: shift.id,
                oldWorkSession: shift.workSession,
                newWorkSession: updatedWorkSession,
              }
            );

            const workSessionUpdate = {
              ...shift.workSession, // Preserve existing work session data
              ...updatedWorkSession, // Override with updated data
              // Preserve the session note if it exists and wasn't included in the update
              note: updatedWorkSession.note || shift.workSession.note,
            };

            // Only set confirmation fields if this is a confirmation operation
            if (isConfirmation) {
              workSessionUpdate.confirmed = true;
              workSessionUpdate.confirmedBy =
                updatedWorkSession.confirmedBy || user?.id;
              workSessionUpdate.confirmedAt =
                updatedWorkSession.confirmedAt || new Date().toISOString();
            }

            return {
              ...shift,
              workSession: workSessionUpdate,
            };
          }
          // Also check if this shift's ID matches the updated work session's shift ID
          else if (shift.id === updatedWorkSession.shiftId) {
            console.log(
              "[ManagerEmployeeScheduleView] Updating shift by shiftId:",
              {
                shiftId: shift.id,
                workSessionShiftId: updatedWorkSession.shiftId,
                newWorkSession: updatedWorkSession,
              }
            );

            const workSessionUpdate = {
              ...shift.workSession, // Preserve existing work session data
              ...updatedWorkSession, // Override with updated data
              // Preserve the session note if it exists and wasn't included in the update
              note: updatedWorkSession.note || shift.workSession.note,
            };

            // Only set confirmation fields if this is a confirmation operation
            if (isConfirmation) {
              workSessionUpdate.confirmed = true;
              workSessionUpdate.confirmedBy =
                updatedWorkSession.confirmedBy || user?.id;
              workSessionUpdate.confirmedAt =
                updatedWorkSession.confirmedAt || new Date().toISOString();
            }

            return {
              ...shift,
              workSession: workSessionUpdate,
            };
          }
          return shift;
        }),
      }))
    );

    // Also update the selected day shifts if modal is open
    if (selectedDayShifts.length > 0) {
      setSelectedDayShifts((prevShifts) =>
        prevShifts.map((shift) => {
          if (
            (shift.workSession &&
              shift.workSession.id === updatedWorkSession.id) ||
            shift.id === updatedWorkSession.shiftId
          ) {
            console.log(
              "[ManagerEmployeeScheduleView] Updating selected day shift:",
              {
                shiftId: shift.id,
                newWorkSession: updatedWorkSession,
              }
            );

            const workSessionUpdate = {
              ...shift.workSession, // Preserve existing work session data
              ...updatedWorkSession, // Override with updated data
              // Preserve the session note if it exists and wasn't included in the update
              note: updatedWorkSession.note || shift.workSession.note,
            };

            // Only set confirmation fields if this is a confirmation operation
            if (isConfirmation) {
              workSessionUpdate.confirmed = true;
              workSessionUpdate.confirmedBy =
                updatedWorkSession.confirmedBy || user?.id;
              workSessionUpdate.confirmedAt =
                updatedWorkSession.confirmedAt || new Date().toISOString();
            }

            return {
              ...shift,
              workSession: workSessionUpdate,
            };
          }
          return shift;
        })
      );
    }

    // For work session modifications (not confirmations), refetch data to ensure consistency
    // Skip refetch for confirmations to avoid overriding the local confirmation state
    if (!isConfirmation) {
      // Add a small delay then refetch to ensure backend consistency
      setTimeout(() => {
        console.log(
          "[ManagerEmployeeScheduleView] Refetching schedule for consistency"
        );
        fetchMonthlySchedule();
      }, 1000);
    }
  };

  // Create a data signature that changes when work session confirmations change
  const dataSignature = React.useMemo(() => {
    const workSessionIds = [];
    const confirmationStates = [];
    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        if (shift.workSession) {
          workSessionIds.push(shift.workSession.id);
          confirmationStates.push(shift.workSession.confirmed || false);
        }
      });
    });
    return `${workSessionIds.join(",")}-${confirmationStates.join(",")}`;
  }, [scheduleData]);

  const exportToPDF = () => {
    try {
      if (!selectedEmployee || scheduleData.length === 0) {
        setError("No schedule data to export");
        return;
      }

      console.log("Starting PDF export...");

      // Test if jsPDF is working
      const doc = new jsPDF();
      console.log("jsPDF instance created:", doc);

      const employeeName = getSelectedEmployeeName();
      const monthYear = getMonthName();
      const hours = calculateTotalHours();

      console.log("PDF data:", { employeeName, monthYear, hours });

      // Title
      doc.setFontSize(20);
      doc.text("Employee Schedule Report", 14, 20);

      // Employee and month info
      doc.setFontSize(12);
      doc.text(`Employee: ${employeeName}`, 14, 30);
      doc.text(`Period: ${monthYear}`, 14, 37);
      doc.text(
        `Total Hours: ${formatMinutesToHoursAndMinutes(hours.total)}`,
        14,
        44
      );

      // Prepare table data
      const tableData = [];
      scheduleData.forEach((week) => {
        week.shifts.forEach((shift) => {
          const shiftDate = parseTimestamp(shift.startTime);
          const dayName = shiftDate.toLocaleDateString("en-US", {
            weekday: "long",
          });
          const dateStr = shiftDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          const scheduledStart = parseTimestamp(
            shift.startTime
          ).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });

          const scheduledEnd = parseTimestamp(shift.endTime).toLocaleTimeString(
            "en-US",
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            }
          );

          let actualStart = "N/A";
          let actualEnd = "N/A";
          let actualHours = "N/A";

          if (shift.workSession && shift.workSession.clockInTime) {
            const clockIn = parseTimestamp(shift.workSession.clockInTime);
            actualStart = clockIn.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });

            if (shift.workSession.clockOutTime) {
              const clockOut = parseTimestamp(shift.workSession.clockOutTime);
              actualEnd = clockOut.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });

              const workedMinutes = (clockOut - clockIn) / (1000 * 60);
              actualHours = formatMinutesToHoursAndMinutes(workedMinutes);
            }
          }

          tableData.push([
            dayName,
            dateStr,
            scheduledStart,
            scheduledEnd,
            actualStart,
            actualEnd,
            actualHours,
          ]);
        });
      });

      console.log("Table data prepared:", tableData.length, "rows");

      // Create manual table
      const startY = 55;
      const columnWidths = [25, 25, 25, 25, 25, 25, 20];
      const headers = [
        "Day",
        "Date",
        "Scheduled Start",
        "Scheduled End",
        "Actual Start",
        "Actual End",
        "Hours Worked",
      ];
      let currentY = startY;

      // Draw header
      doc.setFillColor(59, 130, 246);
      doc.rect(14, currentY - 8, 170, 8, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(undefined, "bold");

      let xPos = 16;
      headers.forEach((header, index) => {
        doc.text(header, xPos, currentY - 2);
        xPos += columnWidths[index];
      });

      // Reset text color and font
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, "normal");

      // Draw table rows
      tableData.forEach((row, rowIndex) => {
        currentY += 8;

        // Draw row background (alternating colors)
        if (rowIndex % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, currentY - 8, 170, 8, "F");
        }

        // Draw cell borders
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);

        let xPos = 14;
        columnWidths.forEach((width) => {
          doc.line(xPos, currentY - 8, xPos, currentY);
          xPos += width;
        });
        doc.line(14, currentY - 8, 184, currentY - 8);
        doc.line(14, currentY, 184, currentY);

        // Add text
        doc.setFontSize(7);
        xPos = 16;
        row.forEach((cell, cellIndex) => {
          doc.text(cell, xPos, currentY - 2);
          xPos += columnWidths[cellIndex];
        });
      });

      // Draw final border
      doc.line(14, startY, 14, currentY);
      doc.line(184, startY, 184, currentY);

      // Footer
      doc.setFontSize(10);
      doc.text(
        `Generated on: ${new Date().toLocaleDateString()}`,
        14,
        currentY + 15
      );

      // Save PDF
      const fileName = `${employeeName.replace(
        /\s+/g,
        "_"
      )}_${monthYear.replace(/\s+/g, "_")}_Schedule.pdf`;

      console.log("Saving PDF as:", fileName);
      doc.save(fileName);
      console.log("PDF saved successfully");

      // Clear any previous errors
      setError(null);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError(`Failed to generate PDF: ${error.message}`);
    }
  };

  // Access control check
  if (user && user.role !== "MANAGER" && user.role !== "ADMIN") {
    return (
      <div className="p-6 sm:p-8 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle size={48} className="text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-500">
            This page is only accessible to managers and administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Monthly Employee Schedule
        </h1>
        <p className="text-gray-600">
          Review detailed schedule history including work sessions and notes
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Employee Selector */}
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Employee
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Choose an employee...</option>
              {employees.map((employee) => {
                const isCurrentUser = employee.id === user?.id;
                return (
                  <option
                    key={employee.id}
                    value={employee.id}
                    style={isCurrentUser ? { fontWeight: "bold" } : {}}
                  >
                    {employee.firstName} {employee.lastName}
                    {isCurrentUser ? " (me)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Month/Year Selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-md"
              title="Previous month"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 py-2 bg-gray-50 rounded-md min-w-[150px] text-center">
              <span className="font-medium">{getMonthName()}</span>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-md"
              title="Next month"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={exportToPDF}
            disabled={!selectedEmployee || scheduleData.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            title="Export to PDF"
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading schedule data...</p>
        </div>
      )}

      {/* Schedule Content */}
      {!loading && selectedEmployee && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {getSelectedEmployeeName()}
                </h2>
                <p className="text-gray-600">{getMonthName()}</p>
              </div>
              <div className="text-right">
                <div className="space-y-1">
                  {(() => {
                    const hours = calculateTotalHours();
                    return (
                      <>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatMinutesToHoursAndMinutes(hours.total)}
                        </p>
                        <p className="text-sm text-gray-500">Total Hours</p>
                        {hours.actual > 0 && (
                          <div className="text-xs text-gray-400">
                            <div>
                              Scheduled:{" "}
                              {formatMinutesToHoursAndMinutes(hours.scheduled)}
                            </div>
                            <div>
                              Actual:{" "}
                              {formatMinutesToHoursAndMinutes(hours.actual)}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {(() => {
              const hours = calculateTotalHours();
              const stats = calculateShiftStatistics();
              return (
                <>
                  <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatMinutesToHoursAndMinutes(hours.total)}
                    </div>
                    <div className="text-sm text-gray-500">Total Hours</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.totalShifts}
                    </div>
                    <div className="text-sm text-gray-500">Total Shifts</div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.completedShifts}
                    </div>
                    <div className="text-sm text-gray-500">
                      Completed Shifts
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.weekCount}
                    </div>
                    <div className="text-sm text-gray-500">Weeks Scheduled</div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Schedule Data */}
          {scheduleData.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Schedule Data
              </h3>
              <p className="text-gray-500">
                No shifts found for {getSelectedEmployeeName()} in{" "}
                {getMonthName()}.
              </p>
            </div>
          ) : (
            <MonthlyCalendar
              key={`${selectedEmployee}-${selectedDate.year}-${selectedDate.month}-${dataSignature}`}
              scheduleData={scheduleData}
              selectedDate={selectedDate}
              employeeName={getSelectedEmployeeName()}
              onDayClick={handleDayClick}
            />
          )}
        </>
      )}

      {/* Day Detail Modal */}
      {isModalOpen && selectedDayDate && (
        <DayDetailModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          selectedDate={selectedDayDate}
          shifts={selectedDayShifts}
          employeeName={getSelectedEmployeeName()}
          onWorkSessionUpdate={handleWorkSessionUpdate}
        />
      )}
    </div>
  );
};

export default ManagerEmployeeScheduleView;
