import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  Building,
  Download,
} from "lucide-react";
import BusinessUnitMonthlyCalendar from "../components/BusinessUnitMonthlyCalendar";
import BusinessUnitDayDetailModal from "../components/BusinessUnitDayDetailModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper function to format minutes into hours and minutes
const formatMinutesToHoursAndMinutes = (minutes) => {
  if (isNaN(minutes) || minutes <= 0) {
    return "0h 0m";
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}m`;
};

const BusinessUnitCalendarView = () => {
  const { user, getAuthHeaders, getRestaurantId } = useAuth();

  // State management
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
  });
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [businessUnitName, setBusinessUnitName] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState(null);
  const [selectedDayShifts, setSelectedDayShifts] = useState([]);

  // Check manager/admin access
  useEffect(() => {
    if (user && user.role !== "MANAGER" && user.role !== "ADMIN") {
      setError(
        "Access denied. This page is only accessible to managers and administrators."
      );
    }
  }, [user]);

  // Fetch business unit info and schedule data
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchBusinessUnitInfo();
      fetchComprehensiveSchedule();
    }
  }, [user, selectedDate]);

  const fetchBusinessUnitInfo = async () => {
    try {
      const businessUnitId = getRestaurantId();
      const response = await fetch(
        `${API_ENDPOINTS_CONFIG.businessUnit(businessUnitId)}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setBusinessUnitName(data.name || "Business Unit");
      }
    } catch (error) {
      console.error("Error fetching business unit info:", error);
    }
  };

  const fetchComprehensiveSchedule = async () => {
    if (!selectedDate.month || !selectedDate.year) return;

    setLoading(true);
    setError(null);

    try {
      const businessUnitId = getRestaurantId();

      // Calculate the full month date range
      const startDate = new Date(selectedDate.year, selectedDate.month - 1, 1);
      const endDate = new Date(
        selectedDate.year,
        selectedDate.month,
        0,
        23,
        59,
        59
      );

      // Format dates for the API (ISO strings)
      const startDateISO = startDate.toISOString();
      const endDateISO = endDate.toISOString();

      console.log(
        `Fetching comprehensive schedule for ${businessUnitId} from ${startDateISO} to ${endDateISO}`
      );

      const response = await fetch(
        API_ENDPOINTS_CONFIG.comprehensiveShifts(
          businessUnitId,
          startDateISO,
          endDateISO
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
        throw new Error(
          `Failed to fetch comprehensive schedule: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("Fetched comprehensive schedule data:", data);

      // Transform the flat shift list into a weekly structure for the calendar component
      const transformedData = transformShiftsToWeeklyStructure(data);
      setScheduleData(transformedData);
    } catch (error) {
      console.error("Error fetching comprehensive schedule:", error);
      setError(`Failed to load schedule: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const transformShiftsToWeeklyStructure = (shifts) => {
    // Group shifts by week
    const weekMap = new Map();

    shifts.forEach((shift) => {
      const shiftDate = parseTimestamp(shift.startTime);
      const weekStart = getWeekStart(shiftDate);
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, {
          weekStartDate: weekKey,
          shifts: [],
        });
      }

      weekMap.get(weekKey).shifts.push(shift);
    });

    // Convert to array and sort by week start date
    return Array.from(weekMap.values()).sort(
      (a, b) => new Date(a.weekStartDate) - new Date(b.weekStartDate)
    );
  };

  const getWeekStart = (date) => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

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

  const navigateMonth = (direction) => {
    setSelectedDate((prev) => {
      let newMonth = prev.month + direction;
      let newYear = prev.year;

      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      } else if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }

      return { month: newMonth, year: newYear };
    });
  };

  const getMonthName = () => {
    return new Date(
      selectedDate.year,
      selectedDate.month - 1
    ).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

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

  const handleWorkSessionUpdate = async (
    updatedWorkSession,
    isConfirmation = false
  ) => {
    console.log(
      "[BusinessUnitCalendarView] Work session updated:",
      updatedWorkSession,
      "isConfirmation:",
      isConfirmation
    );

    // Update the local schedule data to reflect the changes immediately
    setScheduleData((prevData) =>
      prevData.map((week) => ({
        ...week,
        shifts: week.shifts.map((shift) => {
          if (
            shift.workSession &&
            shift.workSession.id === updatedWorkSession.id
          ) {
            const workSessionUpdate = {
              ...shift.workSession,
              ...updatedWorkSession,
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
            const workSessionUpdate = {
              ...shift.workSession,
              ...updatedWorkSession,
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

    // Update modal data if currently showing
    if (selectedDayShifts.length > 0) {
      setSelectedDayShifts((prevShifts) =>
        prevShifts.map((shift) => {
          if (
            shift.workSession &&
            shift.workSession.id === updatedWorkSession.id
          ) {
            const workSessionUpdate = {
              ...shift.workSession,
              ...updatedWorkSession,
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
            const workSessionUpdate = {
              ...shift.workSession,
              ...updatedWorkSession,
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
      try {
        await fetchComprehensiveSchedule();
      } catch (error) {
        console.error(
          "[BusinessUnitCalendarView] Failed to refetch schedule after work session update:",
          error
        );
        // Don't throw the error - the local update has already been applied
      }
    }
  };

  // Calculate summary statistics for the current month
  const calculateMonthlyStats = () => {
    let totalShifts = 0;
    let confirmedSessions = 0;
    let unconfirmedSessions = 0;
    let totalEmployees = new Set();
    let scheduledMinutes = 0;
    let workedMinutes = 0;

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

    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        const shiftDate = parseTimestamp(shift.startTime);
        if (
          shiftDate.getFullYear() === selectedDate.year &&
          shiftDate.getMonth() === selectedDate.month - 1
        ) {
          totalShifts++;
          totalEmployees.add(shift.employeeId);

          // Calculate scheduled hours from shift start/end times
          try {
            const start = parseTimestamp(shift.startTime);
            const end = parseTimestamp(shift.endTime);
            const shiftMinutes = (end - start) / (1000 * 60);
            scheduledMinutes += shiftMinutes > 0 ? shiftMinutes : 0;
          } catch (error) {
            console.error("Error calculating scheduled hours:", error);
          }

          // Calculate worked hours only from completed work sessions
          if (
            shift.workSession &&
            shift.workSession.clockInTime &&
            shift.workSession.clockOutTime
          ) {
            try {
              const start = parseTimestamp(shift.workSession.clockInTime);
              const end = parseTimestamp(shift.workSession.clockOutTime);
              const sessionMinutes = (end - start) / (1000 * 60);
              workedMinutes += sessionMinutes > 0 ? sessionMinutes : 0;
            } catch (error) {
              console.error("Error calculating worked hours:", error);
            }
          }

          if (shift.workSession) {
            if (isWorkSessionConfirmed(shift.workSession)) {
              confirmedSessions++;
            } else {
              unconfirmedSessions++;
            }
          }
        }
      });
    });

    return {
      totalShifts,
      totalEmployees: totalEmployees.size,
      confirmedSessions,
      unconfirmedSessions,
      scheduledHours: formatMinutesToHoursAndMinutes(scheduledMinutes),
      workedHours: formatMinutesToHoursAndMinutes(workedMinutes),
      completionRate:
        totalShifts > 0
          ? Math.round((confirmedSessions / totalShifts) * 100)
          : 0,
    };
  };

  const monthlyStats = React.useMemo(() => {
    return calculateMonthlyStats();
  }, [scheduleData, selectedDate]);

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

  if (user && user.role !== "MANAGER" && user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          </div>
          <p className="text-gray-600">
            This page is only accessible to managers and administrators.
          </p>
        </div>
      </div>
    );
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = parseTimestamp(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric",
    });
  };

  const formatDuration = (startTimestamp, endTimestamp) => {
    if (!startTimestamp || !endTimestamp) return "N/A";
    const start = parseTimestamp(startTimestamp);
    const end = parseTimestamp(endTimestamp);
    const duration = (end - start) / (1000 * 60);
    return formatMinutesToHoursAndMinutes(duration);
  };

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

  const exportToPDF = () => {
    if (!businessUnitName || scheduleData.length === 0) {
      setError("No data to export for PDF.");
      return;
    }

    const doc = new jsPDF();

    // Add title and basic info
    doc.setFontSize(18);
    doc.text(`${businessUnitName} - Monthly Schedule`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Month: ${getMonthName()}`, 14, 30);

    // Add summary statistics
    doc.setFontSize(10);
    let yPos = 40;
    doc.text(`Total Shifts: ${monthlyStats.totalShifts}`, 14, yPos);
    doc.text(`Total Employees: ${monthlyStats.totalEmployees}`, 70, yPos);
    doc.text(
      `Confirmed Sessions: ${monthlyStats.confirmedSessions}`,
      130,
      yPos
    );
    yPos += 7;
    doc.text(`Pending Sessions: ${monthlyStats.unconfirmedSessions}`, 14, yPos);
    doc.text(`Scheduled Hours: ${monthlyStats.scheduledHours}`, 70, yPos);
    doc.text(`Worked Hours: ${monthlyStats.workedHours}`, 130, yPos);
    yPos += 7;
    doc.text(`Completion Rate: ${monthlyStats.completionRate}%`, 14, yPos);
    yPos += 15; // Space before table

    // Prepare table data
    const tableColumn = [
      "Date",
      "Employee",
      "Scheduled",
      "Clock In",
      "Clock Out",
      "Duration",
      "Status",
    ];
    const tableRows = [];

    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        const shiftDate = parseTimestamp(shift.startTime);
        const dateStr = shiftDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        const employeeName =
          `${shift.employeeFirstName || ""} ${
            shift.employeeLastName || ""
          }`.trim() || `Employee ${shift.employeeId.slice(-4)}`;
        const scheduledTime = `${formatTime(shift.startTime)} - ${formatTime(
          shift.endTime
        )}`;

        let clockIn = "N/A";
        let clockOut = "N/A";
        let duration = "N/A";
        let status = "Scheduled";

        if (shift.workSession) {
          clockIn = shift.workSession.clockInTime
            ? formatTime(shift.workSession.clockInTime)
            : "N/A";
          clockOut = shift.workSession.clockOutTime
            ? formatTime(shift.workSession.clockOutTime)
            : "N/A";
          duration =
            shift.workSession.clockInTime && shift.workSession.clockOutTime
              ? formatDuration(
                  shift.workSession.clockInTime,
                  shift.workSession.clockOutTime
                )
              : "N/A";
          status = isWorkSessionConfirmed(shift.workSession)
            ? "Confirmed"
            : "Pending";
        }

        tableRows.push([
          dateStr,
          employeeName,
          scheduledTime,
          clockIn,
          clockOut,
          duration,
          status,
        ]);
      });
    });

    // Add table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: yPos,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      didParseCell: function (data) {
        // Apply styles based on status
        if (data.section === "body" && data.column.index === 6) {
          // Status column
          if (data.cell.text[0] === "Confirmed") {
            data.cell.styles.fillColor = [209, 250, 229]; // Light green
            data.cell.styles.textColor = [5, 150, 105]; // Darker green
          } else if (data.cell.text[0] === "Pending") {
            data.cell.styles.fillColor = [254, 243, 199]; // Light amber
            data.cell.styles.textColor = [180, 83, 9]; // Darker amber
          }
        }
      },
    });

    // Save the PDF
    const fileName = `${businessUnitName}_Monthly_Schedule_${getMonthName().replace(
      /\s+/g,
      "_"
    )}.pdf`;
    doc.save(fileName);

    setError(null); // Clear any previous errors
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Building className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {businessUnitName} Calendar
                  </h1>
                  <p className="text-gray-600">
                    Manage shifts and work sessions for your team
                  </p>
                </div>
              </div>

              {/* Month Navigation and Export */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  disabled={loading}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900 min-w-0">
                  {getMonthName()}
                </h2>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  disabled={loading}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={exportToPDF}
                  className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm"
                  disabled={loading || scheduleData.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Total Shifts
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {monthlyStats.totalShifts}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-purple-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-purple-600">
                      Employees
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {monthlyStats.totalEmployees}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Confirmed
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {monthlyStats.confirmedSessions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-orange-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-orange-600">
                      Pending
                    </p>
                    <p className="text-2xl font-bold text-orange-900">
                      {monthlyStats.unconfirmedSessions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-indigo-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-indigo-600">
                      Completion
                    </p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {monthlyStats.completionRate}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-cyan-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-cyan-600">
                      Scheduled Hours
                    </p>
                    <p className="text-2xl font-bold text-cyan-900">
                      {monthlyStats.scheduledHours}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <Clock className="w-5 h-5 text-yellow-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-yellow-600">
                      Worked Hours
                    </p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {monthlyStats.workedHours}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading calendar...</span>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <BusinessUnitMonthlyCalendar
              key={`${selectedDate.year}-${selectedDate.month}-${dataSignature}`}
              scheduleData={scheduleData}
              selectedDate={selectedDate}
              onDayClick={handleDayClick}
            />
          </div>
        )}
      </div>

      {/* Day Detail Modal */}
      <BusinessUnitDayDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        selectedDate={selectedDayDate}
        shifts={selectedDayShifts}
        onWorkSessionUpdate={handleWorkSessionUpdate}
      />
    </div>
  );
};

export default BusinessUnitCalendarView;
