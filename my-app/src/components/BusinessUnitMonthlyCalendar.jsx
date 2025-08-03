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

  // Get visual indicator for a day's shifts with enhanced status visualization
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
    const totalShifts = shifts.length;

    // Enhanced status badge with better visual hierarchy
    if (hasUnconfirmed && hasConfirmed) {
      return (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <div className="flex space-x-0.5">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full ring-1 ring-amber-200"></div>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full ring-1 ring-emerald-200"></div>
              </div>
              <span className="text-xs font-medium text-slate-700">
                {totalEmployees}
              </span>
            </div>
          </div>
          <div className="px-2 py-1 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-md border-l-2 border-gradient-to-b from-amber-400 to-emerald-400">
            <div className="text-xs font-medium text-slate-800">
              Mixed Status
            </div>
            <div className="text-xs text-slate-600">{totalShifts} shifts</div>
          </div>
        </div>
      );
    } else if (hasUnconfirmed) {
      return (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-amber-500 rounded-full ring-2 ring-amber-200 shadow-sm"></div>
              <span className="text-xs font-medium text-slate-700">
                {totalEmployees}
              </span>
            </div>
          </div>
          <div className="px-2 py-1 bg-amber-50 rounded-md border-l-2 border-amber-400">
            <div className="text-xs font-medium text-amber-900">
              Pending Review
            </div>
            <div className="text-xs text-amber-700">{totalShifts} shifts</div>
          </div>
        </div>
      );
    } else if (hasConfirmed) {
      return (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-emerald-200 shadow-sm"></div>
              <span className="text-xs font-medium text-slate-700">
                {totalEmployees}
              </span>
            </div>
          </div>
          <div className="px-2 py-1 bg-emerald-50 rounded-md border-l-2 border-emerald-400">
            <div className="text-xs font-medium text-emerald-900">
              Confirmed
            </div>
            <div className="text-xs text-emerald-700">{totalShifts} shifts</div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-1.5 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <div className="w-2 h-2 bg-blue-500 rounded-full ring-2 ring-blue-200 shadow-sm"></div>
              <span className="text-xs font-medium text-slate-700">
                {totalEmployees}
              </span>
            </div>
          </div>
          <div className="px-2 py-1 bg-blue-50 rounded-md border-l-2 border-blue-400">
            <div className="text-xs font-medium text-blue-900">Scheduled</div>
            <div className="text-xs text-blue-700">{totalShifts} shifts</div>
          </div>
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Enhanced Calendar Header with Statistics */}
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">
                Business Unit Calendar
              </h3>
              <p className="text-sm text-slate-600">
                {new Date(
                  selectedDate.year,
                  selectedDate.month - 1
                ).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Enhanced Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Employees
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {stats.employeeCount}
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Total Shifts
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {stats.totalShifts}
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Confirmed
                </div>
                <div className="text-lg font-bold text-emerald-700">
                  {stats.confirmedShifts}
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2 border border-slate-200 shadow-sm">
                <div className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Total Hours
                </div>
                <div className="text-lg font-bold text-blue-700">
                  {stats.totalHours.toFixed(1)}h
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Status Legend */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-3 sr-only">
              Status Legend
            </h4>
            <div
              className="flex flex-wrap items-center gap-6 text-sm"
              role="group"
              aria-label="Shift status indicators"
            >
              {/* <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full ring-2 ring-blue-200 shadow-sm" aria-hidden="true"></div>
                <span className="font-medium text-slate-700">Scheduled</span>
              </div> */}
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 bg-amber-500 rounded-full ring-2 ring-amber-200 shadow-sm"
                  aria-hidden="true"
                ></div>
                <span className="font-medium text-slate-700">
                  Pending Review
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-emerald-200 shadow-sm"
                  aria-hidden="true"
                ></div>
                <span className="font-medium text-slate-700">Confirmed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="flex space-x-0.5" aria-hidden="true">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                </div>
                <span className="font-medium text-slate-700">Mixed Status</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Calendar Grid */}
      <div className="p-6">
        {/* Enhanced Days of week header */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((day, index) => (
            <div
              key={day}
              className={`p-3 text-center text-sm font-semibold rounded-lg transition-colors ${
                index === 0 || index === 6
                  ? "text-slate-600 bg-slate-100"
                  : "text-slate-700 bg-slate-50"
              }`}
            >
              <div className="hidden sm:block">{day}</div>
              <div className="sm:hidden">{day.slice(0, 3)}</div>
            </div>
          ))}
        </div>

        {/* Enhanced Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((week, weekIndex) =>
            week.map((dayData, dayIndex) => {
              const isToday =
                isCurrentMonth && dayData && dayData.date === today.getDate();
              const hasShifts = dayData && dayData.shifts.length > 0;
              const isWeekend = dayIndex === 0 || dayIndex === 6;

              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`
                    min-h-[120px] p-3 rounded-xl transition-all duration-200 border-2
                    ${
                      dayData
                        ? hasShifts
                          ? "bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300 cursor-pointer hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          : "bg-white border-slate-100 hover:border-slate-200"
                        : "bg-slate-50 border-slate-100"
                    }
                    ${
                      isToday
                        ? "ring-2 ring-blue-500 ring-offset-2 bg-blue-50 border-blue-300"
                        : ""
                    }
                    ${isWeekend && dayData ? "bg-slate-50" : ""}
                  `}
                  onClick={() => {
                    if (dayData && hasShifts) {
                      onDayClick(dayData.dateObj, dayData.shifts);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === " ") &&
                      dayData &&
                      hasShifts
                    ) {
                      e.preventDefault();
                      onDayClick(dayData.dateObj, dayData.shifts);
                    }
                  }}
                  tabIndex={dayData && hasShifts ? 0 : -1}
                  role={dayData && hasShifts ? "button" : undefined}
                  aria-label={
                    dayData && hasShifts
                      ? `View details for ${dayData.dateObj.toLocaleDateString()}, ${
                          dayData.shifts.length
                        } shifts scheduled`
                      : undefined
                  }
                >
                  {dayData ? (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`text-base font-bold transition-colors ${
                            isToday
                              ? "text-blue-700"
                              : hasShifts
                              ? "text-slate-900"
                              : "text-slate-600"
                          }`}
                        >
                          {dayData.date}
                        </div>
                        {hasShifts && (
                          <div className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                            {dayData.shifts.length}
                          </div>
                        )}
                      </div>
                      {hasShifts && getDayIndicator(dayData)}
                    </>
                  ) : (
                    <div className="text-slate-400 font-medium opacity-50">
                      {/* Empty day cell */}
                    </div>
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
