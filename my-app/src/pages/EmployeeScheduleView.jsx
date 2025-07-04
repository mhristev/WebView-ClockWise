import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import MonthlyCalendar from "../components/MonthlyCalendar";
import DayDetailModal from "../components/DayDetailModal";

const EmployeeScheduleView = () => {
  const { user, getAuthHeaders, getRestaurantId } = useAuth();

  // State management
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

  // Fetch schedule data when date changes
  useEffect(() => {
    if (user && selectedDate.month && selectedDate.year) {
      fetchMonthlySchedule();
    }
  }, [user, selectedDate]);

  const fetchMonthlySchedule = async () => {
    if (!user || !selectedDate.month || !selectedDate.year) return;

    setLoading(true);
    setError(null);

    try {
      const businessUnitId = getRestaurantId();
      const response = await fetch(
        API_ENDPOINTS_CONFIG.monthlySchedule(
          businessUnitId,
          user.id,
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

  const getEmployeeName = () => {
    return user ? `${user.firstName} ${user.lastName}` : "Unknown Employee";
  };

  const calculateTotalHours = () => {
    let totalMinutes = 0;
    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        if (shift.workSession && shift.workSession.clockOutTime) {
          const start = new Date(shift.workSession.clockInTime);
          const end = new Date(shift.workSession.clockOutTime);
          totalMinutes += (end - start) / (1000 * 60);
        }
      });
    });
    return (totalMinutes / 60).toFixed(1);
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

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Schedule</h1>
        <p className="text-gray-600">
          View your monthly schedule and work sessions
        </p>
      </div>

      {/* Month/Year Selector */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Previous month"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-6 py-2 bg-gray-50 rounded-md min-w-[200px] text-center">
            <span className="font-medium text-lg">{getMonthName()}</span>
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
          <p className="text-gray-500">Loading your schedule...</p>
        </div>
      )}

      {/* Schedule Content */}
      {!loading && user && (
        <>
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {getEmployeeName()}
                </h2>
                <p className="text-gray-600">{getMonthName()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Hours Worked</p>
                <p className="text-2xl font-bold text-blue-600">
                  {calculateTotalHours()}h
                </p>
              </div>
            </div>
          </div>

          {/* Calendar */}
          {scheduleData.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm border">
              <Calendar size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Schedule Data
              </h3>
              <p className="text-gray-500">
                No shifts found for {getMonthName()}.
              </p>
            </div>
          ) : (
            <MonthlyCalendar
              scheduleData={scheduleData}
              selectedDate={selectedDate}
              employeeName={getEmployeeName()}
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
          employeeName={getEmployeeName()}
        />
      )}
    </div>
  );
};

export default EmployeeScheduleView;
