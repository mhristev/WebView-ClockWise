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
} from "lucide-react";
import MonthlyCalendar from "../components/MonthlyCalendar";
import DayDetailModal from "../components/DayDetailModal";

const ManagerEmployeeScheduleView = () => {
  const { user, getAuthHeaders, getRestaurantId } = useAuth();

  // State management
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to previous month
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      month: prevMonth.getMonth() + 1,
      year: prevMonth.getFullYear(),
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

      // Filter out the current manager from the list (managers shouldn't view their own schedule here)
      const filteredEmployees = employeeList.filter(
        (emp) => emp.id !== user.id
      );
      setEmployees(filteredEmployees);

      // Auto-select first employee if available
      if (filteredEmployees.length > 0) {
        setSelectedEmployee(filteredEmployees[0].id);
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
          headers: getAuthHeaders(),
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
    return new Date();
  };

  const calculateTotalHours = () => {
    let totalMinutes = 0;
    let actualWorkedMinutes = 0;
    let scheduledMinutes = 0;

    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        // Calculate scheduled hours
        try {
          const startTime = parseTimestamp(shift.startTime);
          const endTime = parseTimestamp(shift.endTime);
          const shiftMinutes = (endTime - startTime) / (1000 * 60);
          scheduledMinutes += shiftMinutes;
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
            actualWorkedMinutes += workedMinutes;
          } catch (error) {
            console.error("Error calculating worked hours:", error);
          }
        }
      });
    });

    // Use actual worked hours if available, otherwise use scheduled hours
    totalMinutes =
      actualWorkedMinutes > 0 ? actualWorkedMinutes : scheduledMinutes;
    return {
      total: (totalMinutes / 60).toFixed(1),
      scheduled: (scheduledMinutes / 60).toFixed(1),
      actual: (actualWorkedMinutes / 60).toFixed(1),
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
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName} - {employee.role}
                </option>
              ))}
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
                          {hours.total}h
                        </p>
                        <p className="text-sm text-gray-500">Total Hours</p>
                        {parseFloat(hours.actual) > 0 && (
                          <div className="text-xs text-gray-400">
                            <div>Scheduled: {hours.scheduled}h</div>
                            <div>Actual: {hours.actual}h</div>
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
                      {hours.total}h
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
        />
      )}
    </div>
  );
};

export default ManagerEmployeeScheduleView;
