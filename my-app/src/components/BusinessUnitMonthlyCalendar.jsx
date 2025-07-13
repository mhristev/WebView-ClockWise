import React from "react";

// Helper function to parse timestamps (same as in schedule-ui-component.jsx)
const parseTimestamp = (timestamp) => {
  console.log("Parsing timestamp:", timestamp, "Type:", typeof timestamp);

  if (typeof timestamp === "number") {
    if (timestamp > 1000000000000) {
      const timestampStr = timestamp.toString();
      if (timestampStr.length > 13) {
        const milliseconds = Math.floor(timestamp / 1000000);
        console.log(
          "Converting nanosecond timestamp to milliseconds:",
          milliseconds
        );
        return new Date(milliseconds);
      } else {
        // console.log("Using millisecond timestamp directly:", timestamp);
        return new Date(timestamp);
      }
    } else {
      // console.log(
      //   "Converting second timestamp to milliseconds:",
      //   timestamp * 1000
      // );
      return new Date(timestamp * 1000);
    }
  } else if (typeof timestamp === "string") {
    if (/^\d+(\.\d+)?$/.test(timestamp)) {
      const numericTimestamp = parseFloat(timestamp);
      if (timestamp.length > 13 || timestamp.includes(".")) {
        const milliseconds = Math.floor(numericTimestamp * 1000);
        console.log(
          "Converting string nanosecond timestamp to milliseconds:",
          milliseconds
        );
        return new Date(milliseconds);
      } else if (numericTimestamp > 1000000000000) {
        console.log("Parsing string millisecond timestamp:", numericTimestamp);
        return new Date(numericTimestamp);
      } else {
        console.log(
          "Parsing string second timestamp:",
          numericTimestamp * 1000
        );
        return new Date(numericTimestamp * 1000);
      }
    }
    // It's already an ISO string, just parse it
    console.log("Parsing ISO string timestamp:", timestamp);
    return new Date(timestamp);
  } else if (Array.isArray(timestamp)) {
    // Handle array format [year, month, day, hour, minute, second, nano]
    const [year, month, day, hour = 0, minute = 0, second = 0] = timestamp;
    console.log("Parsing array timestamp:", [
      year,
      month,
      day,
      hour,
      minute,
      second,
    ]);
    return new Date(year, month - 1, day, hour, minute, second);
  }
  console.log("Returning null as fallback for:", timestamp);
  return null;
};

const BusinessUnitMonthlyCalendar = ({
  scheduleData,
  selectedDate,
  onDayClick,
}) => {
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

  // Calculate monthly statistics for the business unit
  const calculateMonthlyStats = () => {
    let scheduledMinutes = 0;
    let actualMinutes = 0;
    let totalShifts = 0;
    let confirmedShifts = 0;
    let employeeCount = new Set();
    const targetYear = selectedDate.year;
    const targetMonth = selectedDate.month - 1; // JavaScript months are 0-indexed

    console.log(
      `[BusinessUnitMonthlyCalendar] 📊 Calculating statistics for ${targetYear}-${String(
        targetMonth + 1
      ).padStart(2, "0")} (Selected Month Only)`
    );

    scheduleData.forEach((week, weekIndex) => {
      week.shifts.forEach((shift, shiftIndex) => {
        const shiftDate = parseTimestamp(shift.startTime);
        const shiftYear = shiftDate.getFullYear();
        const shiftMonth = shiftDate.getMonth();
        const shiftDay = shiftDate.getDate();

        console.log(
          `[BusinessUnitMonthlyCalendar] 📅 Checking shift ${shiftIndex} in week ${weekIndex}: ${shiftYear}-${String(
            shiftMonth + 1
          ).padStart(2, "0")}-${String(shiftDay).padStart(2, "0")}`
        );

        // Only count shifts from the selected month and year
        if (shiftYear === targetYear && shiftMonth === targetMonth) {
          totalShifts++;
          employeeCount.add(shift.employeeId);
          console.log(
            `[BusinessUnitMonthlyCalendar] ✅ Shift ${totalShifts} included in month ${targetYear}-${String(
              targetMonth + 1
            ).padStart(2, "0")}`
          );

          // Calculate scheduled hours for this shift
          try {
            const startTime = parseTimestamp(shift.startTime);
            const endTime = parseTimestamp(shift.endTime);
            const shiftMinutes = (endTime - startTime) / (1000 * 60);
            scheduledMinutes += shiftMinutes;
            console.log(
              `[BusinessUnitMonthlyCalendar] 📋 Scheduled: ${(
                shiftMinutes / 60
              ).toFixed(1)}h for shift on ${shiftDay}`
            );
          } catch (error) {
            console.error(
              "[BusinessUnitMonthlyCalendar] ❌ Error calculating scheduled hours:",
              error
            );
          }

          // Check for confirmed work sessions
          if (shift.workSession && isWorkSessionConfirmed(shift.workSession)) {
            confirmedShifts++;
            console.log(
              `[BusinessUnitMonthlyCalendar] ✅ Confirmed work session on ${shiftDay}`
            );
          }

          // Calculate actual worked hours from work sessions (separate from confirmation)
          if (
            shift.workSession &&
            shift.workSession.clockInTime &&
            shift.workSession.clockOutTime
          ) {
            try {
              const clockIn = parseTimestamp(shift.workSession.clockInTime);
              const clockOut = parseTimestamp(shift.workSession.clockOutTime);
              const minutesWorked = (clockOut - clockIn) / (1000 * 60);
              actualMinutes += minutesWorked;
              console.log(
                `[BusinessUnitMonthlyCalendar] ⏰ Actual work on ${shiftDay}: ${(
                  minutesWorked / 60
                ).toFixed(1)}h (${clockIn
                  .toTimeString()
                  .slice(0, 5)} - ${clockOut.toTimeString().slice(0, 5)})`
              );
            } catch (error) {
              console.error(
                "[BusinessUnitMonthlyCalendar] ❌ Error calculating actual hours:",
                error
              );
            }
          } else {
            console.log(
              `[BusinessUnitMonthlyCalendar] ⚠️ No work session recorded for shift on ${shiftDay}`
            );
          }
        }
      });
    });

    const scheduledHours = scheduledMinutes / 60;
    const actualHours = actualMinutes / 60;
    const totalHours = actualHours > 0 ? actualHours : scheduledHours;

    console.log(`[BusinessUnitMonthlyCalendar] 📈 FINAL MONTHLY STATISTICS:`);
    console.log(
      `[BusinessUnitMonthlyCalendar] 📅 Month: ${targetYear}-${String(
        targetMonth + 1
      ).padStart(2, "0")}`
    );
    console.log(
      `[BusinessUnitMonthlyCalendar] 👥 Employees: ${employeeCount.size}`
    );
    console.log(
      `[BusinessUnitMonthlyCalendar] 📊 Total Shifts: ${totalShifts}`
    );
    console.log(
      `[BusinessUnitMonthlyCalendar] ✅ Completed Shifts: ${confirmedShifts}`
    );
    console.log(
      `[BusinessUnitMonthlyCalendar] ⏰ Total Scheduled Hours: ${scheduledHours.toFixed(
        1
      )}`
    );
    console.log(
      `[BusinessUnitMonthlyCalendar] ⏰ Total Actual Hours: ${actualHours.toFixed(
        1
      )}`
    );

    return {
      employeeCount: employeeCount.size,
      totalShifts,
      confirmedShifts,
      scheduledHours,
      actualHours,
      totalHours,
    };
  };

  const stats = React.useMemo(
    () => calculateMonthlyStats(),
    [scheduleData, selectedDate]
  );

  // Generate calendar grid
  const generateCalendar = () => {
    const firstDayOfMonth = new Date(
      selectedDate.year,
      selectedDate.month - 1,
      1
    );
    const lastDayOfMonth = new Date(selectedDate.year, selectedDate.month, 0);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    const calendar = [];
    let date = 1;

    // Create 6 weeks (rows) with 7 days (columns) each
    for (let week = 0; week < 6; week++) {
      const weekRow = [];
      for (let day = 0; day < 7; day++) {
        if (week === 0 && day < firstDayOfWeek) {
          // Empty cells before the first day
          weekRow.push(null);
        } else if (date > daysInMonth) {
          // Empty cells after the last day
          weekRow.push(null);
        } else {
          // Valid calendar day
          const currentDate = new Date(
            selectedDate.year,
            selectedDate.month - 1,
            date
          );
          const shiftsForDay = getShiftsForDate(currentDate);
          weekRow.push({
            date: date,
            dateObj: currentDate,
            shifts: shiftsForDay,
          });
          date++;
        }
      }
      calendar.push(weekRow);
    }

    return calendar;
  };

  // Get all shifts for a specific date
  const getShiftsForDate = (date) => {
    const shifts = [];
    const targetDateStr = date.toDateString();

    scheduleData.forEach((week) => {
      week.shifts.forEach((shift) => {
        const shiftDate = parseTimestamp(shift.startTime);
        if (shiftDate && shiftDate.toDateString() === targetDateStr) {
          shifts.push(shift);
        }
      });
    });

    return shifts.sort((a, b) => {
      const timeA = parseTimestamp(a.startTime);
      const timeB = parseTimestamp(b.startTime);
      return timeA - timeB;
    });
  };

  // Get visual indicator for a day's shifts
  const getDayIndicator = (dayData) => {
    if (!dayData || dayData.shifts.length === 0) {
      return null;
    }

    const shifts = dayData.shifts;

    const hasUnconfirmed = shifts.some(
      (shift) => shift.workSession && !isWorkSessionConfirmed(shift.workSession)
    );
    const hasConfirmed = shifts.some(
      (shift) => shift.workSession && isWorkSessionConfirmed(shift.workSession)
    );
    const totalEmployees = new Set(shifts.map((shift) => shift.employeeId))
      .size;

    if (hasUnconfirmed && hasConfirmed) {
      return (
        <div className="flex space-x-1 mt-1">
          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-xs text-gray-600 ml-1">{totalEmployees}</span>
        </div>
      );
    } else if (hasUnconfirmed) {
      return (
        <div className="flex items-center mt-1">
          <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
          <span className="text-xs text-gray-600 ml-1">{totalEmployees}</span>
        </div>
      );
    } else if (hasConfirmed) {
      return (
        <div className="flex items-center mt-1">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span className="text-xs text-gray-600 ml-1">{totalEmployees}</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center mt-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
          <span className="text-xs text-gray-600 ml-1">{totalEmployees}</span>
        </div>
      );
    }
  };

  const calendar = generateCalendar();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === selectedDate.year &&
    today.getMonth() === selectedDate.month - 1;

  return (
    <div className="bg-white rounded-lg">
      {/* Calendar Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Business Unit Calendar
          </h3>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
              <span>Scheduled</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-400 rounded-full mr-2"></div>
              <span>Pending Approval</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
              <span>Confirmed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-px mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-gray-700 bg-gray-50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-px border border-gray-200">
          {calendar.map((week, weekIndex) =>
            week.map((dayData, dayIndex) => {
              const isToday =
                isCurrentMonth && dayData && dayData.date === today.getDate();
              const hasShifts = dayData && dayData.shifts.length > 0;

              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`
                    min-h-[100px] p-2 border-gray-200 cursor-pointer transition-colors
                    ${dayData ? "bg-white hover:bg-gray-50" : "bg-gray-100"}
                    ${hasShifts ? "border-l-4 border-l-blue-500" : ""}
                    ${isToday ? "bg-blue-50 ring-2 ring-blue-500" : ""}
                  `}
                  onClick={() => {
                    if (dayData && hasShifts) {
                      onDayClick(dayData.dateObj, dayData.shifts);
                    }
                  }}
                >
                  {dayData && (
                    <>
                      <div
                        className={`text-sm font-medium ${
                          isToday ? "text-blue-600" : "text-gray-900"
                        }`}
                      >
                        {dayData.date}
                      </div>
                      {hasShifts && (
                        <div className="mt-1">
                          <div className="text-xs text-gray-600 mb-1">
                            {dayData.shifts.length} shift
                            {dayData.shifts.length !== 1 ? "s" : ""}
                          </div>
                          {getDayIndicator(dayData)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessUnitMonthlyCalendar;
