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
        console.log("Using millisecond timestamp directly:", timestamp);
        return new Date(timestamp);
      }
    } else {
      console.log(
        "Converting second timestamp to milliseconds:",
        timestamp * 1000
      );
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

// Helper function to format time
const formatTime = (date) => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

const MonthlyCalendar = ({
  scheduleData,
  selectedDate,
  employeeName,
  onDayClick,
}) => {
  // Calculate monthly statistics - only for the selected month
  const calculateMonthlyStats = () => {
    let scheduledMinutes = 0;
    let actualMinutes = 0;
    let totalShifts = 0;
    let completedShifts = 0;
    const targetYear = selectedDate.year;
    const targetMonth = selectedDate.month - 1; // JavaScript months are 0-indexed

    console.log(
      `[MonthlyCalendar] 📊 Calculating statistics for ${targetYear}-${String(
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
          `[MonthlyCalendar] 📅 Checking shift ${shiftIndex} in week ${weekIndex}: ${shiftYear}-${String(
            shiftMonth + 1
          ).padStart(2, "0")}-${String(shiftDay).padStart(2, "0")}`
        );

        // Only count shifts from the selected month and year
        if (shiftYear === targetYear && shiftMonth === targetMonth) {
          totalShifts++;
          console.log(
            `[MonthlyCalendar] ✅ Shift ${totalShifts} included in month ${targetYear}-${String(
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
              `[MonthlyCalendar] 📋 Scheduled: ${(shiftMinutes / 60).toFixed(
                1
              )}h for shift on ${shiftDay}`
            );
          } catch (error) {
            console.error(
              "[MonthlyCalendar] ❌ Error calculating scheduled hours:",
              error
            );
          }

          // Calculate actual worked hours from work sessions
          if (
            shift.workSession &&
            shift.workSession.clockInTime &&
            shift.workSession.clockOutTime
          ) {
            completedShifts++;
            try {
              const clockIn = parseTimestamp(shift.workSession.clockInTime);
              const clockOut = parseTimestamp(shift.workSession.clockOutTime);
              const minutesWorked = (clockOut - clockIn) / (1000 * 60);
              actualMinutes += minutesWorked;
              console.log(
                `[MonthlyCalendar] ⏰ Actual work on ${shiftDay}: ${(
                  minutesWorked / 60
                ).toFixed(1)}h (${clockIn
                  .toTimeString()
                  .slice(0, 5)} - ${clockOut.toTimeString().slice(0, 5)})`
              );
            } catch (error) {
              console.error(
                "[MonthlyCalendar] ❌ Error calculating actual hours:",
                error
              );
            }
          } else {
            console.log(
              `[MonthlyCalendar] ⚠️ No work session recorded for shift on ${shiftDay}`
            );
          }
        } else {
          console.log(
            `[MonthlyCalendar] ❌ Shift excluded: ${shiftYear}-${String(
              shiftMonth + 1
            ).padStart(2, "0")}-${String(shiftDay).padStart(
              2,
              "0"
            )} (different month)`
          );
        }
      });
    });

    const scheduledHours = scheduledMinutes / 60;
    const actualHours = actualMinutes / 60;
    // Use actual hours if available, otherwise scheduled hours
    const totalHours = actualHours > 0 ? actualHours : scheduledHours;
    const weeksInMonth = scheduleData.filter((week) => {
      // Count weeks that have at least one shift in the selected month
      return week.shifts.some((shift) => {
        const shiftDate = parseTimestamp(shift.startTime);
        return (
          shiftDate.getFullYear() === targetYear &&
          shiftDate.getMonth() === targetMonth
        );
      });
    }).length;

    console.log(`[MonthlyCalendar] 📈 FINAL MONTHLY STATISTICS:`);
    console.log(
      `[MonthlyCalendar] 📅 Month: ${targetYear}-${String(
        targetMonth + 1
      ).padStart(2, "0")}`
    );
    console.log(`[MonthlyCalendar] 📊 Total Shifts: ${totalShifts}`);
    console.log(`[MonthlyCalendar] ✅ Completed Shifts: ${completedShifts}`);
    console.log(
      `[MonthlyCalendar] 📋 Scheduled Hours: ${scheduledHours.toFixed(1)}h`
    );
    console.log(
      `[MonthlyCalendar] ⏰ Actual Hours: ${actualHours.toFixed(1)}h`
    );
    console.log(
      `[MonthlyCalendar] 📈 Display Hours: ${totalHours.toFixed(1)}h`
    );
    console.log(`[MonthlyCalendar] 📅 Weeks with shifts: ${weeksInMonth}`);

    return {
      totalHours: totalHours.toFixed(1),
      scheduledHours: scheduledHours.toFixed(1),
      actualHours: actualHours.toFixed(1),
      totalShifts,
      completedShifts,
      weeksScheduled: weeksInMonth,
    };
  };
  // Generate calendar grid
  const generateCalendar = () => {
    const year = selectedDate.year;
    const month = selectedDate.month - 1; // JavaScript months are 0-indexed

    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);

    // Start from Monday (1) instead of Sunday (0)
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // If Sunday (0), subtract 6 days; otherwise subtract (dayOfWeek - 1)
    startDate.setDate(startDate.getDate() - daysToSubtract);

    const calendar = [];
    const currentDate = new Date(startDate);

    for (let week = 0; week < 6; week++) {
      const weekRow = [];
      for (let day = 0; day < 7; day++) {
        const dayDate = new Date(currentDate);
        const isCurrentMonth = dayDate.getMonth() === month;
        const dayShifts = getShiftsForDate(dayDate);

        weekRow.push({
          date: dayDate,
          isCurrentMonth,
          shifts: dayShifts,
          hasShifts: dayShifts.length > 0,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
      calendar.push(weekRow);

      // Stop if we've covered all days of the month and started the next month
      if (currentDate.getMonth() !== month && week >= 3) break;
    }

    return calendar;
  };

  // Get shifts for a specific date
  const getShiftsForDate = (date) => {
    // Create date strings in local timezone to avoid timezone conversion issues
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    console.log(
      `[MonthlyCalendar] Looking for shifts on ${targetYear}-${
        targetMonth + 1
      }-${targetDay}`
    );

    const allShifts = [];

    scheduleData.forEach((week, weekIndex) => {
      week.shifts.forEach((shift, shiftIndex) => {
        const shiftDate = parseTimestamp(shift.startTime);

        // Compare year, month, and day directly without timezone conversion
        const shiftYear = shiftDate.getFullYear();
        const shiftMonth = shiftDate.getMonth();
        const shiftDay = shiftDate.getDate();

        console.log(
          `[MonthlyCalendar] Week ${weekIndex}, Shift ${shiftIndex}: ${shiftYear}-${
            shiftMonth + 1
          }-${shiftDay} (${shift.startTime})`
        );

        if (
          shiftYear === targetYear &&
          shiftMonth === targetMonth &&
          shiftDay === targetDay
        ) {
          console.log(
            `[MonthlyCalendar] ✅ Match found! Adding shift to ${targetYear}-${
              targetMonth + 1
            }-${targetDay}`
          );
          allShifts.push(shift);
        }
      });
    });

    console.log(
      `[MonthlyCalendar] Found ${allShifts.length} shifts for ${targetYear}-${
        targetMonth + 1
      }-${targetDay}`
    );

    return allShifts.sort((a, b) => {
      const timeA = parseTimestamp(a.startTime);
      const timeB = parseTimestamp(b.startTime);
      return timeA - timeB;
    });
  };

  const calendar = generateCalendar();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // Changed order to start with Monday
  const monthlyStats = calculateMonthlyStats();
  const monthName = new Date(
    selectedDate.year,
    selectedDate.month - 1
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Monthly Summary Header */}
      <div className="bg-blue-50 border-b px-4 py-4">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {employeeName} - {monthName}
            </h3>
            <p className="text-sm text-gray-600">Monthly Schedule Overview</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {monthlyStats.totalHours}h
            </div>
            <div className="text-sm text-gray-600">
              {monthlyStats.actualHours > 0
                ? "Actual Hours"
                : "Scheduled Hours"}
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-md p-3 text-center">
            <div className="text-lg font-semibold text-gray-900">
              {monthlyStats.totalShifts}
            </div>
            <div className="text-xs text-gray-600">Total Shifts</div>
          </div>
          <div className="bg-white rounded-md p-3 text-center">
            <div className="text-lg font-semibold text-green-600">
              {monthlyStats.completedShifts}
            </div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
          <div className="bg-white rounded-md p-3 text-center">
            <div className="text-lg font-semibold text-blue-600">
              {monthlyStats.scheduledHours}h
            </div>
            <div className="text-xs text-gray-600">Scheduled</div>
          </div>
          <div className="bg-white rounded-md p-3 text-center">
            <div className="text-lg font-semibold text-purple-600">
              {monthlyStats.weeksScheduled}
            </div>
            <div className="text-xs text-gray-600">Weeks</div>
          </div>
        </div>

        {/* Additional info if actual hours are different from scheduled */}
        {monthlyStats.actualHours > 0 &&
          monthlyStats.actualHours !== monthlyStats.scheduledHours && (
            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
              <span className="text-amber-800">
                Actual: {monthlyStats.actualHours}h vs Scheduled:{" "}
                {monthlyStats.scheduledHours}h
                {parseFloat(monthlyStats.actualHours) >
                parseFloat(monthlyStats.scheduledHours)
                  ? " (Overtime)"
                  : " (Under-time)"}
              </span>
            </div>
          )}
      </div>

      {/* Calendar Header */}
      <div className="grid grid-cols-7 bg-gray-50 border-b">
        {dayNames.map((day) => (
          <div
            key={day}
            className="p-3 text-center text-sm font-medium text-gray-700"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Body */}
      <div className="grid grid-cols-7">
        {calendar.map((week, weekIndex) =>
          week.map((day, dayIndex) => (
            <div
              key={`${weekIndex}-${dayIndex}`}
              className={`
                min-h-[120px] p-2 border-r border-b cursor-pointer hover:bg-gray-50 transition-colors
                ${
                  !day.isCurrentMonth
                    ? "bg-gray-200 text-gray-500 border-gray-400"
                    : "bg-blue-50 border-blue-300"
                }
                ${day.hasShifts && day.isCurrentMonth ? "bg-blue-100" : ""}
                ${day.hasShifts && !day.isCurrentMonth ? "bg-gray-300" : ""}
              `}
              onClick={() => onDayClick && onDayClick(day.date, day.shifts)}
            >
              {/* Day Number */}
              <div
                className={`text-sm font-medium mb-1 px-2 py-1 text-center ${
                  !day.isCurrentMonth
                    ? "text-gray-600"
                    : "text-blue-800 font-semibold"
                }`}
              >
                {day.date.getDate()}
              </div>

              {/* Shifts */}
              <div className="space-y-1">
                {day.shifts.slice(0, 2).map((shift) => {
                  // Use work session times if available, otherwise use scheduled times
                  let displayStartTime, displayEndTime, timeSource;

                  if (shift.workSession && shift.workSession.clockInTime) {
                    // Use actual work session times
                    displayStartTime = parseTimestamp(
                      shift.workSession.clockInTime
                    );
                    displayEndTime = shift.workSession.clockOutTime
                      ? parseTimestamp(shift.workSession.clockOutTime)
                      : null;
                    timeSource = "actual";
                  } else {
                    // Fallback to scheduled times
                    displayStartTime = parseTimestamp(shift.startTime);
                    displayEndTime = parseTimestamp(shift.endTime);
                    timeSource = "scheduled";
                  }

                  const startTimeStr = formatTime(displayStartTime);
                  const endTimeStr = displayEndTime
                    ? formatTime(displayEndTime)
                    : "In Progress";

                  // Calculate duration based on available times
                  let durationMinutes = 0;
                  let durationHours = "0.0";

                  if (displayEndTime) {
                    durationMinutes =
                      (displayEndTime - displayStartTime) / (1000 * 60);
                    durationHours = (durationMinutes / 60).toFixed(1);
                  } else if (timeSource === "scheduled") {
                    // For scheduled times without work session, calculate planned duration
                    const scheduledEnd = parseTimestamp(shift.endTime);
                    durationMinutes =
                      (scheduledEnd - displayStartTime) / (1000 * 60);
                    durationHours = (durationMinutes / 60).toFixed(1);
                  }

                  // Check work session status
                  const hasWorkSession = shift.workSession;
                  const isConfirmed =
                    hasWorkSession && isWorkSessionConfirmed(shift.workSession);
                  const needsApproval = hasWorkSession && !isConfirmed;
                  const isInProgress =
                    hasWorkSession &&
                    shift.workSession.clockInTime &&
                    !shift.workSession.clockOutTime;

                  // Create detailed tooltip
                  const tooltip = [
                    `${
                      timeSource === "actual" ? "Actual" : "Scheduled"
                    }: ${startTimeStr} - ${endTimeStr}`,
                    `Duration: ${durationHours}h`,
                    `Role: ${shift.role}`,
                    hasWorkSession
                      ? isConfirmed
                        ? "✓ Confirmed"
                        : isInProgress
                        ? "🕒 In Progress"
                        : "⚠ Needs Approval"
                      : "⏱ No Work Session",
                  ].join(" • ");

                  return (
                    <div
                      key={shift.id}
                      className={`text-xs px-2 py-1 rounded relative ${
                        isConfirmed
                          ? "bg-green-600 text-white"
                          : needsApproval
                          ? "bg-amber-500 text-white"
                          : isInProgress
                          ? "bg-blue-500 text-white"
                          : "bg-blue-600 text-white"
                      }`}
                      title={tooltip}
                    >
                      <div className="font-medium text-center">
                        {startTimeStr} - {endTimeStr}
                      </div>
                      <div className="text-xs truncate text-center opacity-90">
                        {shift.role} ({durationHours}h)
                        {timeSource === "actual" && (
                          <span className="ml-1 font-bold">🕒</span>
                        )}
                      </div>

                      {/* Work session indicator */}
                      {hasWorkSession && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-white text-xs flex items-center justify-center">
                          {isConfirmed ? (
                            <span className="text-white text-xs">✓</span>
                          ) : isInProgress ? (
                            <span className="text-white text-xs">⏰</span>
                          ) : (
                            <span className="text-white text-xs">!</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {day.shifts.length > 2 && (
                  <div className="text-xs text-gray-500 px-2 text-center">
                    +{day.shifts.length - 2} more
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MonthlyCalendar;
