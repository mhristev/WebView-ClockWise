import React, { useState, useEffect } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart2,
  Plus,
  Edit2,
  Save,
  Edit,
  Trash2,
  Users,
  MapPin,
  Briefcase,
  Layout,
  Clock,
  AlertCircle,
  CheckCircle,
  Building2,
  Loader2,
  FileText,
  Download,
} from "lucide-react";
import "./index.css";
import { useAuth } from "./auth/AuthContext";
import { API_ENDPOINTS_CONFIG, USER_BASE_URL } from "./config/api";

// Import jsPDF and autoTable
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Timezone information for debugging
const DEBUG_TIMEZONE = true; // Set to true to see timezone debugging logs
const TIMEZONE_OFFSET = new Date().getTimezoneOffset() / 60; // Get local timezone offset in hours

// Helper function to handle numeric timestamps (epoch seconds) from the backend
const parseTimestamp = (timestamp) => {
  console.log("Parsing timestamp:", timestamp, "Type:", typeof timestamp);

  // Check if it's a numeric timestamp
  if (typeof timestamp === "number") {
    // Check if it's in nanoseconds (very large number)
    if (timestamp > 1000000000000) {
      // Handle nanosecond precision by converting to milliseconds
      // If the timestamp is longer than 13 digits, it's likely nanoseconds (older Java/Kotlin format)
      const timestampStr = timestamp.toString();
      if (timestampStr.length > 13) {
        // Convert nanoseconds to milliseconds (divide by 1,000,000)
        const milliseconds = Math.floor(timestamp / 1000000);
        console.log(
          "Converting nanosecond timestamp to milliseconds:",
          milliseconds
        );
        return new Date(milliseconds);
      } else {
        // Regular millisecond timestamp (JavaScript standard)
        console.log("Using millisecond timestamp directly:", timestamp);
        return new Date(timestamp);
      }
    } else {
      // It's in seconds (standard Unix timestamp)
      console.log(
        "Converting second timestamp to milliseconds:",
        timestamp * 1000
      );
      return new Date(timestamp * 1000);
    }
  } else if (typeof timestamp === "string") {
    // Check if it's a numeric string (e.g., "1746421200.000000000")
    if (/^\d+(\.\d+)?$/.test(timestamp)) {
      // Parse as float to handle decimal part
      const numericTimestamp = parseFloat(timestamp);
      // Check if it appears to be in nanoseconds
      if (timestamp.length > 13 || timestamp.includes(".")) {
        // Convert to milliseconds if it includes nanoseconds
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
    // Handle array format for backward compatibility
    try {
      const [year, month, day, hour, minute, second = 0, nano = 0] = timestamp;
      console.log(
        `Parsing array timestamp: [${year}, ${month}, ${day}, ${hour}, ${minute}, ${second}, ${nano}]`
      );
      return new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second,
        nano / 1000000
      );
    } catch (e) {
      console.error("Failed to parse timestamp array:", e);
      return null;
    }
  }

  console.error("Unknown timestamp format:", timestamp);
  return null;
};

// Updated createShiftRequest function to support timezone-aware times
const createShiftRequest = (
  scheduleId,
  employeeId,
  shiftDate,
  startTimeStr,
  endTimeStr,
  position
) => {
  // Parse the time strings
  const [startHour, startMinStr] = startTimeStr.split(":");
  const [endHour, endMinStr] = endTimeStr.split(":");

  const startMin = parseInt(startMinStr);
  const endMin = parseInt(endMinStr);

  // Create a copy of the date to avoid modifying the original
  const startDate = new Date(shiftDate);
  startDate.setHours(parseInt(startHour), startMin, 0, 0);

  // Handle overnight shifts
  const startHourNum = parseInt(startHour);
  const endHourNum = parseInt(endHour);
  const isNextDay =
    endHourNum < startHourNum ||
    (endHourNum === startHourNum && endMin < startMin);

  // Create end date
  const endDate = new Date(shiftDate);
  if (isNextDay) {
    endDate.setDate(endDate.getDate() + 1);
  }
  endDate.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

  // Convert to ISO strings for ZonedDateTime format
  const startTimeISO = startDate.toISOString();
  const endTimeISO = endDate.toISOString();

  console.log(
    `Creating shift with times: Start=${startTimeStr} → ${startTimeISO}, End=${endTimeStr} → ${endTimeISO}, Position=${position}`
  );

  // Log ISO strings for debugging
  console.log("ISO strings:", {
    startDateISO: startTimeISO,
    endDateISO: endTimeISO,
  });

  return {
    scheduleId,
    employeeId,
    startTime: startTimeISO,
    endTime: endTimeISO,
    position: position,
    businessUnitId: null, // Let the backend handle this
  };
};

function ScheduleApp() {
  // Extract auth context
  const { authenticatedFetch, user, getRestaurantId } = useAuth();

  // Debug component mounting
  useEffect(() => {
    console.log("ScheduleApp component mounted");
    document.title = "Weekly Schedule | ClockWise";
  }, []);

  // Log user info for debugging
  useEffect(() => {
    if (user) {
      console.log("Current user info:", user);
      console.log("Using restaurant ID:", getRestaurantId());
    }
  }, [user]);

  // Initialize component by fetching employees and availabilities when mounted
  useEffect(() => {
    console.log("Initializing ScheduleApp - fetching employees");
    fetchEmployees();
    fetchAvailabilities(currentWeekStart);
  }, []); // Empty dependency array to run only once on mount

  // State
  const [employees, setEmployees] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    getMonday(new Date())
  );
  const [weeklySchedules, setWeeklySchedules] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [isSchedulePublished, setIsSchedulePublished] = useState(false);
  const [employeeAvailabilities, setEmployeeAvailabilities] = useState({});
  const [stats, setStats] = useState({
    estWages: "$0.00",
    otCost: "$0.00",
    scheduledHours: "0h",
    otHours: "0h",
    laborPercent: "0%",
    absences: 0,
    totalShifts: 0,
  });

  const positions = ["Waiter", "Bartender", "Cleaner"];

  // Position colors
  const positionColors = {
    Waiter: "bg-blue-100 border-blue-300",
    Bartender: "bg-purple-100 border-purple-300",
    Cleaner: "bg-green-100 border-green-300",
  };

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // Helper function to get Monday of a given week
  function getMonday(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0); // Reset to start of day
    return monday;
  }

  // Get unique week identifier
  function getWeekIdentifier(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const weekNumber = Math.ceil((day + 6 - date.getDay()) / 7);
    return `${year}-${month}-${weekNumber}`;
  }

  // Fetch employees from the API
  const fetchEmployees = async () => {
    const businessUnitId = getRestaurantId();
    const fetchStartTime = new Date().toISOString();
    console.log("🔥 [WEEKLY SCHEDULE] Starting user fetch process");
    console.log("📅 Fetch initiated at:", fetchStartTime);
    console.log("🏢 Fetching employees for business unit:", businessUnitId);
    console.log("👤 Current user making request:", user?.email || "Unknown");

    try {
      console.log(
        "🔑 [WEEKLY SCHEDULE] Auth token available, proceeding with request"
      );

      const requestUrl = `${USER_BASE_URL}/users/business-unit/${businessUnitId}`;
      console.log("🌐 [WEEKLY SCHEDULE] Making API request to:", requestUrl);

      const response = await authenticatedFetch(requestUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const fetchEndTime = new Date().toISOString();
      console.log(
        "⏱️ [WEEKLY SCHEDULE] API response received at:",
        fetchEndTime
      );
      console.log("📊 [WEEKLY SCHEDULE] Response status:", response.status);

      if (response.status === 401) {
        console.error(
          "🔐 [WEEKLY SCHEDULE] Unauthorized access - token may be expired"
        );
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("📦 [WEEKLY SCHEDULE] Raw employee data received:", data);
      console.log(
        "📈 [WEEKLY SCHEDULE] Data type:",
        Array.isArray(data) ? "Array" : typeof data
      );

      // Handle the response based on the actual API structure
      let employeeList = [];
      if (Array.isArray(data)) {
        employeeList = data;
        console.log("✅ [WEEKLY SCHEDULE] Data is direct array format");
      } else if (data.users && Array.isArray(data.users)) {
        employeeList = data.users;
        console.log("✅ [WEEKLY SCHEDULE] Data extracted from .users property");
      } else if (data.content && Array.isArray(data.content)) {
        employeeList = data.content;
        console.log(
          "✅ [WEEKLY SCHEDULE] Data extracted from .content property"
        );
      }

      console.log(
        "📋 [WEEKLY SCHEDULE] Extracted employee list count:",
        employeeList.length
      );
      console.log("📋 [WEEKLY SCHEDULE] Employee list details:", employeeList);

      // Format employees for the schedule UI
      const formattedEmployees = employeeList.map((emp, index) => {
        // Check if this employee is the current user
        const isCurrentUser = user && emp.id === user.id;

        console.log(`👤 [WEEKLY SCHEDULE] Processing employee ${index + 1}:`, {
          id: emp.id,
          name: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(),
          role: emp.role,
          isCurrentUser,
          originalRoleData: emp.role, // Log the original role data
        });

        return {
          id: emp.id || emp.userId || `emp-${Math.random()}`,
          name:
            `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
            emp.username ||
            "Unknown Employee",
          role: emp.role || "Staff",
          hours: emp.workingHours || "40h/week",
          businessUnitName: emp.businessUnitName || "Restaurant",
          isCurrentUser: isCurrentUser,
          isGhost: false, // Initially fetched employees are current, not ghost
        };
      });

      // Remove duplicates based on ID
      const uniqueEmployees = formattedEmployees.filter(
        (emp, index, self) => index === self.findIndex((e) => e.id === emp.id)
      );

      console.log(
        "🔄 [WEEKLY SCHEDULE] Formatted employees count:",
        formattedEmployees.length
      );
      console.log(
        "✨ [WEEKLY SCHEDULE] Unique employees count after deduplication:",
        uniqueEmployees.length
      );
      console.log("✨ [WEEKLY SCHEDULE] Final employee list:", uniqueEmployees);

      const processingEndTime = new Date().toISOString();
      console.log(
        "⏱️ [WEEKLY SCHEDULE] Employee processing completed at:",
        processingEndTime
      );
      console.log(
        "🎉 [WEEKLY SCHEDULE] User fetch process completed successfully!"
      );

      setEmployees(uniqueEmployees);
    } catch (error) {
      const errorTime = new Date().toISOString();
      console.error("💥 [WEEKLY SCHEDULE] Error occurred at:", errorTime);
      console.error("💥 [WEEKLY SCHEDULE] Error fetching employees:", error);
      console.error("💥 [WEEKLY SCHEDULE] Error details:", {
        message: error.message,
        stack: error.stack,
        businessUnitId,
        userEmail: user?.email,
      });

      // Instead of falling back to sample data, set empty array
      // This will trigger the "No employees found" message in the UI
      setEmployees([]);
      setError(`Failed to load employees: ${error.message}`);
    }
  };

  // Fetch availabilities from the API
  const fetchAvailabilities = async (weekStart) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const businessUnitId = getRestaurantId();

      // Create a date object for Monday (start of week) at 00:00:00
      const startDate = new Date(weekStart);
      startDate.setHours(0, 0, 0, 0);

      // Create a date object for Sunday (end of week) at 23:59:59
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6); // Add 6 days to get to Sunday
      endDate.setHours(23, 59, 59, 999);

      // Format dates for API call - use standard ISO strings with timezone
      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      if (DEBUG_TIMEZONE) {
        console.log("Current timezone offset:", TIMEZONE_OFFSET);
        console.log(`Fetching availabilities for week: ${formatDateRange()}`);
        console.log(
          `Date range: ${startDate.toDateString()} - ${endDate.toDateString()}`
        );
        console.log(`Start date: ${startDateStr}, End date: ${endDateStr}`);
      }

      // Fetch availabilities for the week
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.availabilities(
          businessUnitId,
          startDateStr,
          endDateStr
        ),
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error(`Error fetching availabilities: ${response.status}`);
      }

      const data = await response.json();
      console.log(`Received ${data.length} availabilities from API:`, data);

      // Process the availabilities
      const availabilitiesByEmployee = {};

      for (const availability of data) {
        // Initialize array for this employee if not exists
        if (!availabilitiesByEmployee[availability.employeeId]) {
          availabilitiesByEmployee[availability.employeeId] = [];
        }

        try {
          // Use the helper function to parse timestamps properly
          const startTime = parseTimestamp(availability.startTime);
          const endTime = parseTimestamp(availability.endTime);

          if (!startTime || !endTime) {
            console.warn(
              "Invalid date in availability, skipping:",
              availability
            );
            continue;
          }

          // Add the availability with properly parsed dates
          availabilitiesByEmployee[availability.employeeId].push({
            ...availability,
            startTime,
            endTime,
          });
        } catch (e) {
          console.error("Error processing availability:", e, availability);
        }
      }

      setEmployeeAvailabilities(availabilitiesByEmployee);
      console.log(
        "Processed availabilities by employee:",
        availabilitiesByEmployee
      );

      if (DEBUG_TIMEZONE) {
        // Log each availability's date for debugging
        Object.keys(availabilitiesByEmployee).forEach((employeeId) => {
          const empAvails = availabilitiesByEmployee[employeeId];
          console.log(
            `Employee ${employeeId} has ${empAvails.length} availabilities:`
          );
          empAvails.forEach((avail, index) => {
            console.log(
              `  ${index + 1}. ${avail.startTime.toDateString()} (${formatTime(
                avail.startTime
              )}-${formatTime(avail.endTime)})`
            );
          });
        });
      }
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      setError("Failed to load employee availabilities");
    } finally {
      setIsLoading(false);
    }
  };

  // Update the saveScheduleDraft function
  const saveScheduleDraft = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const businessUnitId = getRestaurantId();

      // Format the current week start date properly
      const weekStart = new Date(currentWeekStart);

      // Format the date for API - use LocalDate format (YYYY-MM-DD)
      // Use a timezone-safe method to avoid date shifting
      const year = weekStart.getFullYear();
      const month = String(weekStart.getMonth() + 1).padStart(2, "0");
      const day = String(weekStart.getDate()).padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      console.log(`Creating schedule for week: ${dateString}`);

      // Create schedule first
      const scheduleResponse = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.schedules(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessUnitId,
            weekStart: dateString,
            status: "DRAFT",
          }),
        }
      );

      if (!scheduleResponse.ok) {
        throw new Error(`Error creating schedule: ${scheduleResponse.status}`);
      }

      const scheduleData = await scheduleResponse.json();
      console.log("Created schedule:", scheduleData);

      setCurrentScheduleId(scheduleData.id);

      // Save all shifts in the current week's schedule
      const currentShifts = getCurrentWeekShifts();
      console.log("Saving shifts:", currentShifts);

      const savePromises = [];

      for (const shift of currentShifts) {
        // Create a date object for the shift day
        const shiftDate = new Date(currentWeekStart);
        shiftDate.setDate(shiftDate.getDate() + shift.day);

        const shiftRequest = createShiftRequest(
          scheduleData.id,
          shift.employeeId,
          shiftDate,
          shift.startTime,
          shift.endTime,
          shift.position
        );

        const savePromise = authenticatedFetch(API_ENDPOINTS_CONFIG.shifts(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(shiftRequest),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`Failed to save shift: ${res.status}`);
            return res.json();
          })
          .then((data) => {
            console.log("Saved shift:", data);
            return data;
          })
          .catch((error) => {
            console.error("Error saving shift:", error);
            throw error;
          });

        savePromises.push(savePromise);
      }

      // Wait for all shifts to be saved
      const results = await Promise.allSettled(savePromises);
      console.log("Shift save results:", results);

      // Check for any failed promises
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error(`${failures.length} shifts failed to save`);
        setError(`${failures.length} shifts could not be saved`);
      }

      // Refresh the schedule data from the server
      await fetchScheduleForWeek(currentWeekStart);

      // Show success
      alert("Schedule draft saved successfully!");
    } catch (error) {
      console.error("Error saving schedule:", error);
      setError("Failed to save schedule draft");
    } finally {
      setIsSaving(false);
    }
  };

  // Add a function to edit a published schedule
  const editPublishedSchedule = async () => {
    if (!currentScheduleId) {
      alert("No schedule selected.");
      return;
    }

    setIsSaving(true);

    try {
      console.log(
        `Enabling editing for published schedule with ID: ${currentScheduleId}`
      );

      // Call the revert to draft endpoint with auth headers
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.scheduleDraft(currentScheduleId),
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to revert schedule to draft: ${response.statusText}`
        );
      }

      const updatedSchedule = await response.json();
      console.log("Successfully reverted schedule to draft:", updatedSchedule);

      alert("Schedule can now be edited!");

      // Set schedule as not published (editable)
      setIsSchedulePublished(false);

      // Refresh the schedule data
      fetchScheduleForWeek(currentWeekStart);
    } catch (err) {
      console.error("Failed to revert schedule to draft:", err);
      alert(`Failed to revert schedule to draft: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Modify publishSchedule to set the published state
  const publishSchedule = async () => {
    if (!currentScheduleId) {
      alert("No schedule to publish. Please create a schedule first.");
      return;
    }

    setIsSaving(true);

    try {
      console.log(`Publishing schedule with ID: ${currentScheduleId}`);

      // Call the publish endpoint with auth headers
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.schedulePublish(currentScheduleId),
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to publish schedule: ${response.statusText}`);
      }

      const publishedSchedule = await response.json();
      console.log("Successfully published schedule:", publishedSchedule);

      // Set schedule as published
      setIsSchedulePublished(true);

      alert("Schedule published successfully!");

      // Refresh the schedule data
      fetchScheduleForWeek(currentWeekStart);
    } catch (err) {
      console.error("Failed to publish schedule:", err);
      alert(`Failed to publish schedule: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Load employees on component mount
  useEffect(() => {
    // fetchEmployees(); // Commented out - duplicate call, already handled in component init
  }, []);

  // Initialize sample shifts data for current week only if not loaded from backend
  useEffect(() => {
    if (employees.length === 0) return;
    console.log(
      "Checking if we need to fetch shifts for employees:",
      employees
    );

    const weekId = getWeekIdentifier(currentWeekStart);

    // Only fetch data if this week doesn't have data yet and we have a schedule ID
    if (!weeklySchedules[weekId] && currentScheduleId) {
      console.log(`Fetching shifts for schedule ID: ${currentScheduleId}`);

      // Fetch shifts from the backend API
      authenticatedFetch(API_ENDPOINTS_CONFIG.scheduleShifts(currentScheduleId))
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            console.error(
              `Failed to fetch shifts: ${response.status} - ${response.statusText}`
            );
            return [];
          }
        })
        .then((shifts) => {
          if (shifts && shifts.length > 0) {
            console.log(
              `Fetched ${shifts.length} shifts from the backend`,
              shifts
            );
            processShifts(shifts);
          } else {
            console.log("No shifts found for this schedule");
            // Set empty shifts for this week
            const weekId = getWeekIdentifier(currentWeekStart);
            setWeeklySchedules((prev) => ({
              ...prev,
              [weekId]: {},
            }));
          }
        })
        .catch((error) => {
          console.error("Error fetching shifts:", error);
        });
    }
  }, [employees, weeklySchedules, currentWeekStart, currentScheduleId]);

  // Format date for display
  const formatDateRange = () => {
    const start = new Date(currentWeekStart);
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);

    const startDate = start.getDate();
    const endDate = end.getDate();
    const month = start.toLocaleString("default", { month: "short" });

    return `${startDate} - ${endDate} ${month}`;
  };

  // Go to previous week
  const goToPreviousWeek = () => {
    console.log("Going to previous week");
    // Clear current schedule ID before changing weeks
    setCurrentScheduleId(null);
    setIsSchedulePublished(false);
    setIsLoading(true);

    // Get the previous week by subtracting 7 days
    const prevWeek = new Date(currentWeekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    prevWeek.setHours(0, 0, 0, 0); // Reset to start of day
    setCurrentWeekStart(prevWeek);
  };

  // Go to next week
  const goToNextWeek = () => {
    console.log("Going to next week");
    // Clear current schedule ID before changing weeks
    setCurrentScheduleId(null);
    setIsSchedulePublished(false);
    setIsLoading(true);

    // Get the next week by adding 7 days
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0); // Reset to start of day
    setCurrentWeekStart(nextWeek);
  };

  // Go to current week
  const goToToday = () => {
    console.log("Going to current week");
    // Clear current schedule ID before changing weeks
    setCurrentScheduleId(null);
    setIsSchedulePublished(false);
    setIsLoading(true);

    // Get the start of the current week (Monday)
    const today = new Date();
    const monday = getMonday(today);
    monday.setHours(0, 0, 0, 0); // Reset to start of day

    // Only trigger state update if we're not already on this week
    // Otherwise manually trigger a refresh
    if (monday.getTime() !== currentWeekStart.getTime()) {
      setCurrentWeekStart(monday);
    } else {
      // We're already on this week, just refresh the data
      fetchScheduleForWeek(monday);
    }
  };

  // Get current week's shifts
  const getCurrentWeekShifts = () => {
    const weekId = getWeekIdentifier(currentWeekStart);
    const shifts = weeklySchedules[weekId] || {};

    if (DEBUG_TIMEZONE) {
      console.log(`Getting shifts for week: ${weekId}`);
      console.log(`Current week starts on: ${currentWeekStart.toDateString()}`);
      console.log(`Found ${Object.keys(shifts).length} employees with shifts`);

      // Count total shifts
      let totalShifts = 0;
      Object.values(shifts).forEach((employeeShifts) => {
        totalShifts += employeeShifts.length;
      });
      console.log(`Total shifts for the week: ${totalShifts}`);
    }

    return shifts;
  };

  // Open modal to create/edit shift
  const openShiftModal = (employeeId, day, existingShift = null) => {
    // Don't allow editing shifts if the schedule is published
    if (isSchedulePublished) {
      alert(
        "This schedule is published and cannot be edited. Please use the 'Edit Schedule' button to make changes."
      );
      return;
    }

    setCurrentShift(
      existingShift || {
        id: `shift-${employeeId}-${day}-${Date.now()}`,
        employeeId,
        day,
        startTime: "08:00",
        endTime: "14:00",
        duration: "6h",
        position: positions[0],
        business:
          employees.find((emp) => emp.id === employeeId)?.businessUnitName ||
          "Test Business",
      }
    );
    setIsModalOpen(true);
  };

  // Update the saveShift function to use our new time-preserving approach
  const saveShift = async () => {
    const { employeeId, day } = currentShift;
    const weekId = getWeekIdentifier(currentWeekStart);
    const weekShifts = weeklySchedules[weekId] || {};
    const employeeShifts = weekShifts[employeeId] || [];

    console.log("Saving shift for employee ID:", employeeId);
    console.log("Current shift data:", currentShift);
    console.log("Current week shifts before save:", weekShifts);

    // Check if we're editing an existing shift
    const existingShiftIndex = employeeShifts.findIndex(
      (s) => s.id === currentShift.id
    );

    let updatedWeekShifts;

    if (existingShiftIndex >= 0) {
      // Update existing shift
      const updatedShifts = [...employeeShifts];
      updatedShifts[existingShiftIndex] = currentShift;

      updatedWeekShifts = {
        ...weekShifts,
        [employeeId]: updatedShifts,
      };
    } else {
      // Add new shift
      updatedWeekShifts = {
        ...weekShifts,
        [employeeId]: [...employeeShifts, currentShift],
      };
    }

    console.log("Updated week shifts after save:", updatedWeekShifts);

    // Update the weekly schedules state
    setWeeklySchedules({
      ...weeklySchedules,
      [weekId]: updatedWeekShifts,
    });

    console.log("Final weeklySchedules state:", {
      ...weeklySchedules,
      [weekId]: updatedWeekShifts,
    });

    // Update stats with the new shifts
    updateStats(updatedWeekShifts);

    // Now save the shift to the backend
    try {
      // First, ensure we have a schedule ID for the current week
      let scheduleId = currentScheduleId;

      // If we don't have a schedule ID, create a new schedule first
      if (!scheduleId) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setHours(0, 0, 0, 0);

        // Format the date for API - use LocalDate format (YYYY-MM-DD)
        // Use a timezone-safe method to avoid date shifting
        const year = weekStart.getFullYear();
        const month = String(weekStart.getMonth() + 1).padStart(2, "0");
        const day = String(weekStart.getDate()).padStart(2, "0");
        const dateString = `${year}-${month}-${day}`;

        // Create schedule request
        const scheduleRequest = {
          businessUnitId: getRestaurantId(),
          weekStart: dateString,
        };

        // Save the schedule first
        const scheduleResponse = await authenticatedFetch(
          API_ENDPOINTS_CONFIG.schedules(),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(scheduleRequest),
          }
        );

        if (!scheduleResponse.ok) {
          throw new Error(
            `Failed to create schedule: ${scheduleResponse.statusText}`
          );
        }

        const savedSchedule = await scheduleResponse.json();
        scheduleId = savedSchedule.id;
        setCurrentScheduleId(scheduleId);
      }

      // Create a date object for the shift day
      const shiftDate = new Date(currentWeekStart);
      shiftDate.setDate(shiftDate.getDate() + day);

      // Create the shift request using our time-preserving function
      const shiftRequest = createShiftRequest(
        scheduleId,
        employeeId,
        shiftDate,
        currentShift.startTime,
        currentShift.endTime,
        currentShift.position
      );

      console.log("Shift request with preserved times:", shiftRequest);

      // Save the shift to the backend with auth headers
      const endpoint =
        existingShiftIndex >= 0 && currentShift.backendId
          ? API_ENDPOINTS_CONFIG.shiftById(currentShift.backendId)
          : API_ENDPOINTS_CONFIG.shifts();

      const method =
        existingShiftIndex >= 0 && currentShift.backendId ? "PUT" : "POST";

      const response = await authenticatedFetch(endpoint, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(shiftRequest),
      });

      if (!response.ok) {
        throw new Error(`Failed to save shift: ${response.statusText}`);
      }

      const savedShift = await response.json();
      console.log("Successfully saved shift:", savedShift);

      // If it's a new shift, update our local state with the backend ID
      if (!currentShift.backendId) {
        const updatedShifts = updatedWeekShifts[employeeId].map((s) =>
          s.id === currentShift.id ? { ...s, backendId: savedShift.id } : s
        );

        setWeeklySchedules({
          ...weeklySchedules,
          [weekId]: {
            ...updatedWeekShifts,
            [employeeId]: updatedShifts,
          },
        });
      }
    } catch (err) {
      console.error("Failed to save shift to backend:", err);
      alert(`Failed to save shift: ${err.message}`);
    }

    setIsModalOpen(false);
    setCurrentShift(null);
  };

  // Delete shift
  const deleteShift = async (employeeId, shiftId) => {
    const weekId = getWeekIdentifier(currentWeekStart);
    const weekShifts = weeklySchedules[weekId] || {};
    const employeeShifts = weekShifts[employeeId] || [];

    // Find the shift before we remove it from local state
    const shiftToDelete = employeeShifts.find((s) => s.id === shiftId);

    const updatedShifts = employeeShifts.filter((s) => s.id !== shiftId);

    const newWeekShifts = { ...weekShifts };

    if (updatedShifts.length === 0) {
      delete newWeekShifts[employeeId];
    } else {
      newWeekShifts[employeeId] = updatedShifts;
    }

    setWeeklySchedules({
      ...weeklySchedules,
      [weekId]: newWeekShifts,
    });

    // Update stats
    updateStats(newWeekShifts);

    // If the shift has a backendId, delete it from the backend
    if (shiftToDelete && shiftToDelete.backendId) {
      try {
        console.log(
          `Deleting shift with backend ID ${shiftToDelete.backendId}`
        );
        const response = await authenticatedFetch(
          API_ENDPOINTS_CONFIG.shiftById(shiftToDelete.backendId),
          {
            method: "DELETE",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete shift: ${response.statusText}`);
        }

        console.log(`Shift ${shiftToDelete.backendId} deleted from backend`);
      } catch (err) {
        console.error("Failed to delete shift from backend:", err);
        alert(
          `The shift was removed from the UI but could not be deleted from the backend: ${err.message}`
        );
      }
    }

    setIsModalOpen(false);
    setCurrentShift(null);
  };

  // Calculate dates for each column
  const getColumnDates = () => {
    return daysOfWeek.map((day, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + index);
      return date.getDate();
    });
  };

  // Update stats based on current week's schedule
  const updateStats = (currentShifts = null) => {
    if (!employees || employees.length === 0) return;

    const shifts = currentShifts || getCurrentWeekShifts();
    let totalShifts = 0;
    let totalHours = 0;
    let totalWages = 0;

    // Calculate employee hours
    const employeeHours = {};

    Object.entries(shifts).forEach(([empId, employeeShifts]) => {
      totalShifts += employeeShifts.length;
      let empHours = 0;

      employeeShifts.forEach(() => {
        // Simple calculation - 5.5 hours per shift
        empHours += 5.5;
        totalHours += 5.5;

        // Estimate wages (assuming $40/hour average rate)
        totalWages += 5.5 * 40;
      });

      employeeHours[empId] = empHours;
    });

    // Update employee hours
    const updatedEmployees = employees.map((emp) => {
      if (!emp || !emp.id) return emp;

      const hours = employeeHours[emp.id] || 0;
      const formattedHours = `${Math.floor(hours)}h ${
        (hours % 1) * 60 > 0 ? `${(hours % 1) * 60}min` : ""
      }`;

      return {
        ...emp,
        hours: formattedHours,
      };
    });

    setEmployees(updatedEmployees);

    const formattedHours = `${Math.floor(totalHours)}h ${
      totalHours % 1 > 0 ? `${(totalHours % 1) * 60}min` : ""
    }`;
    const estimatedWages = `$${totalWages.toFixed(2)}`;
    const laborPercent =
      totalHours > 0 ? `${((totalWages / 750) * 100).toFixed(2)}%` : "0%";

    setStats({
      totalShifts,
      scheduledHours: formattedHours,
      estWages: estimatedWages,
      otCost: "$0.00",
      otHours: "0h",
      laborPercent,
      absences: 0,
    });
  };

  // Effect to update stats when week changes
  useEffect(() => {
    updateStats();
  }, [currentWeekStart]);

  const columnDates = getColumnDates();

  // Get shift for employee on specific day
  const getShiftForDay = (employeeId, day) => {
    const currentShifts = getCurrentWeekShifts();

    if (DEBUG_TIMEZONE) {
      console.log(
        `Getting shift for employee ${employeeId} (type: ${typeof employeeId}) on day ${day}`
      );
    }

    // Try multiple ID formats to ensure matching
    const stringEmployeeId = String(employeeId);
    const numericEmployeeId =
      employeeId && !isNaN(employeeId) ? Number(employeeId) : null;

    if (DEBUG_TIMEZONE) {
      console.log(`Looking for shifts with employee IDs: 
        - String: "${stringEmployeeId}" (${typeof stringEmployeeId})
        - Numeric: ${numericEmployeeId} (${typeof numericEmployeeId})`);

      // Log what we're looking for in the current shifts
      console.log(`Current shifts keys:`, Object.keys(currentShifts));
    }

    // Try all possible ID formats
    let employeeShifts = currentShifts[employeeId] || [];

    if (employeeShifts.length === 0 && stringEmployeeId) {
      employeeShifts = currentShifts[stringEmployeeId] || [];
      if (employeeShifts.length > 0 && DEBUG_TIMEZONE) {
        console.log(`Found shifts using string ID "${stringEmployeeId}"`);
      }
    }

    if (employeeShifts.length === 0 && numericEmployeeId !== null) {
      employeeShifts = currentShifts[numericEmployeeId] || [];
      if (employeeShifts.length > 0 && DEBUG_TIMEZONE) {
        console.log(`Found shifts using numeric ID ${numericEmployeeId}`);
      }
    }

    if (DEBUG_TIMEZONE) {
      console.log(
        `Found ${employeeShifts.length} shifts for employee ${employeeId}`
      );

      if (employeeShifts.length > 0) {
        console.log("Available shifts:", employeeShifts);
      }
    }

    if (employeeShifts.length > 0) {
      // Try to find the shift for this specific day
      const shift = employeeShifts.find((shift) => {
        // Ensure both are treated as numbers for comparison
        const shiftDay = Number(shift.day);
        const targetDay = Number(day);

        if (DEBUG_TIMEZONE) {
          console.log(
            `Comparing shift day ${shiftDay} (${typeof shiftDay}) with target day ${targetDay} (${typeof targetDay})`
          );
          console.log(`Equal?: ${shiftDay === targetDay}`);
        }

        return shiftDay === targetDay;
      });

      if (DEBUG_TIMEZONE) {
        console.log(`Shift found for day ${day}:`, shift);

        if (!shift) {
          console.log(
            `No shift found for day ${day}. Available days:`,
            employeeShifts.map((shift) => shift.day)
          );
        }
      }

      return shift;
    }

    return null;
  };

  // Format shift display with correct position color
  const formatShiftDisplay = (shift) => {
    console.log("formatShiftDisplay called with shift:", shift);

    if (!shift) {
      console.log("Shift is null or undefined, returning null");
      return null;
    }

    // Check if shift has all required properties
    if (!shift.startTime || !shift.endTime || !shift.position) {
      console.log("Shift is missing required properties:", shift);
      // Return a fallback display with error styling
      return (
        <div className="bg-red-100 border border-red-300 p-2 rounded text-xs">
          <div className="font-medium">Invalid shift data</div>
        </div>
      );
    }

    const colorClass =
      positionColors[shift.position] || "bg-gray-100 border-gray-300";
    console.log(
      `Using color class: ${colorClass} for position: ${shift.position}`
    );

    const shiftElement = (
      <div
        className={`${colorClass} border shadow-sm p-2 rounded text-xs w-full h-full flex flex-col justify-between`}
      >
        <div className="font-medium text-gray-800">
          {shift.startTime} - {shift.endTime}
        </div>
        <div className="text-gray-600 mt-1 text-xs">{shift.position}</div>
        <div className="text-gray-500 text-xs mt-auto">{shift.duration}</div>
      </div>
    );

    console.log("Returning shift element:", shiftElement);
    return shiftElement;
  };

  // Function to validate and clean up employees who are no longer in the business unit
  const validateAndCleanupEmployees = async (shiftsForWeek = []) => {
    console.log(
      "[WEEKLY SCHEDULE] 🧹 Starting employee validation and cleanup..."
    );

    try {
      const businessUnitId = getRestaurantId();
      console.log(
        `[WEEKLY SCHEDULE] 🔍 Validating employees for business unit: ${businessUnitId}`
      );

      // Get current employees in our state
      const currentEmployees = [...employees];
      console.log(
        `[WEEKLY SCHEDULE] 📋 Current employees in state: ${currentEmployees.length}`
      );

      // Get employees who have shifts for this week
      const employeesWithShifts = new Set(
        shiftsForWeek.map((shift) => String(shift.employeeId))
      );
      console.log(
        `[WEEKLY SCHEDULE] 📅 Employees with shifts this week: ${Array.from(
          employeesWithShifts
        ).join(", ")}`
      );

      // Fetch fresh employee data from the business unit
      console.log(
        `[WEEKLY SCHEDULE] 🔄 Fetching fresh employee data from business unit...`
      );
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.restaurantUsers(businessUnitId),
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!response.ok) {
        console.warn(
          `[WEEKLY SCHEDULE] ⚠️ Failed to fetch fresh employee data: ${response.status}`
        );
        return; // Skip validation if we can't fetch data
      }

      const freshEmployeeData = await response.json();
      console.log(
        `[WEEKLY SCHEDULE] ✅ Fetched ${freshEmployeeData.length} employees from business unit`
      );

      // Create a map of valid employee IDs (still in the business unit)
      const validEmployeeIds = new Set(
        freshEmployeeData.map((emp) => String(emp.id))
      );
      console.log(
        `[WEEKLY SCHEDULE] 🎯 Valid employee IDs: ${Array.from(
          validEmployeeIds
        ).join(", ")}`
      );

      // Update existing employees: mark those no longer in business unit as "ghost"
      const updatedEmployees = currentEmployees.map((emp) => {
        const empId = String(emp.id);
        const isValidEmployee = validEmployeeIds.has(empId);
        const hasShiftsThisWeek = employeesWithShifts.has(empId);

        if (!isValidEmployee && hasShiftsThisWeek) {
          console.log(
            `[WEEKLY SCHEDULE] 👻 Marking employee ${emp.name} (ID: ${empId}) as ghost - removed from business unit but has shifts`
          );
          return {
            ...emp,
            isGhost: true, // Mark as ghost - removed from business unit but has shifts
          };
        } else if (isValidEmployee) {
          console.log(
            `[WEEKLY SCHEDULE] ✅ Employee ${emp.name} (ID: ${empId}) is still valid - marking as current`
          );
          return {
            ...emp,
            isGhost: false, // Mark as current employee
          };
        } else {
          // Employee is no longer valid and has no shifts - will be filtered out by display logic
          console.log(
            `[WEEKLY SCHEDULE] 🗑️ Employee ${emp.name} (ID: ${empId}) - no longer in business unit and no shifts (will be hidden)`
          );
          return {
            ...emp,
            isGhost: true, // Still mark as ghost for consistency
          };
        }
      });

      // Add any new employees from the fresh data that we don't have yet
      const currentEmployeeIds = new Set(
        updatedEmployees.map((emp) => String(emp.id))
      );
      const newEmployees = freshEmployeeData.filter(
        (emp) => !currentEmployeeIds.has(String(emp.id))
      );

      if (newEmployees.length > 0) {
        console.log(
          `[WEEKLY SCHEDULE] ➕ Adding ${newEmployees.length} new employees to the list`
        );

        // Format new employees properly
        const formattedNewEmployees = newEmployees.map((emp) => {
          // Check if this employee is the current user
          const isCurrentUser = user && emp.id === user.id;

          return {
            id: emp.id || emp.userId || `emp-${Math.random()}`,
            name:
              `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
              emp.username ||
              "Unknown Employee",
            role: emp.role || "Staff",
            hours: emp.workingHours || "40h/week",
            businessUnitName: emp.businessUnitName || "Restaurant",
            isCurrentUser: isCurrentUser,
            isGhost: false, // New employees are current, not ghost
          };
        });

        // Update the employees list with both updated existing and new employees
        setEmployees([...updatedEmployees, ...formattedNewEmployees]);
      } else {
        // Just update existing employees if no new ones
        setEmployees(updatedEmployees);
      }

      console.log(`[WEEKLY SCHEDULE] 🔄 Employee validation completed`);
    } catch (error) {
      console.error(
        "[WEEKLY SCHEDULE] ❌ Error during employee validation:",
        error
      );
    }
  };

  // Fetch schedule for the specified week
  const fetchScheduleForWeek = async (weekStart) => {
    try {
      setIsLoading(true);
      // Ensure published state is reset when fetching a new week
      setIsSchedulePublished(false);

      // Format the date to ensure it's at midnight on Monday
      const formattedWeekStart = new Date(weekStart);
      formattedWeekStart.setHours(0, 0, 0, 0);

      if (DEBUG_TIMEZONE) {
        console.log(
          `Fetching schedule for week starting: ${formattedWeekStart.toDateString()}`
        );
        console.log(`ISO date: ${formattedWeekStart.toISOString()}`);
        console.log(`Current timezone offset: ${TIMEZONE_OFFSET} hours`);
      }

      // Clear current schedule when switching weeks
      setCurrentScheduleId(null);

      // Use the endpoint to fetch a schedule for this specific week
      const businessUnitId = getRestaurantId();
      console.log(`Fetching schedule for business unit ID: ${businessUnitId}`);

      // Format the weekStart date as LocalDate string for the API parameter
      // Use a timezone-safe method to avoid date shifting
      const year = formattedWeekStart.getFullYear();
      const month = String(formattedWeekStart.getMonth() + 1).padStart(2, "0");
      const day = String(formattedWeekStart.getDate()).padStart(2, "0");
      const weekStartLocalDate = `${year}-${month}-${day}`;

      console.log(`Using date string for API request: ${weekStartLocalDate}`);

      // Log the complete API call details
      const apiUrl = API_ENDPOINTS_CONFIG.restaurantSchedulesWeekWithShifts(
        businessUnitId,
        weekStartLocalDate
      );
      console.log("🔥 API CALL DETAILS:");
      console.log(`- URL: ${apiUrl}`);
      console.log(`- Business Unit ID: ${businessUnitId}`);
      console.log(`- Week Start: ${weekStartLocalDate}`);

      // Use the new endpoint that returns schedule with shifts
      // GET /business-units/{id}/schedules/week?weekStart=<localDate>
      const response = await authenticatedFetch(apiUrl);

      console.log("🔥 API RESPONSE DETAILS:");
      console.log(`- Status: ${response.status} ${response.statusText}`);
      console.log(`- Headers:`, Object.fromEntries(response.headers.entries()));
      console.log(`- OK: ${response.ok}`);

      if (!response.ok) {
        console.warn(`❌ No schedule found for week: ${response.status}`);

        // Try to read the error response body
        try {
          const errorText = await response.text();
          console.warn(`❌ Error response body:`, errorText);
        } catch (e) {
          console.warn(`❌ Could not read error response body:`, e);
        }

        setCurrentScheduleId(null);
        setIsLoading(false);
        return;
      }

      // Log the raw response text first
      const responseText = await response.text();
      console.log("🔥 RAW RESPONSE TEXT:");
      console.log(responseText);

      // Parse the JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log("🔥 PARSED JSON DATA:");
        console.log(JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error("❌ Failed to parse JSON response:", parseError);
        console.error("❌ Raw response that failed to parse:", responseText);
        setCurrentScheduleId(null);
        setIsLoading(false);
        return;
      }

      console.log("🔥 DATA STRUCTURE ANALYSIS:");
      console.log(`- Type: ${typeof data}`);
      console.log(`- Is Array: ${Array.isArray(data)}`);
      console.log(`- Keys:`, data ? Object.keys(data) : "null/undefined");
      console.log(`- Has ID: ${data?.id ? "YES" : "NO"}`);
      console.log(`- Has shifts: ${data?.shifts ? "YES" : "NO"}`);
      if (data?.shifts) {
        console.log(`- Shifts count: ${data.shifts.length}`);
        console.log(`- First shift:`, data.shifts[0]);
      }

      // Handle the schedule response with shifts
      if (data && data.id) {
        console.log(`Found schedule with ID: ${data.id}`);
        const scheduleId = data.id;
        setCurrentScheduleId(scheduleId);

        // Check if the schedule is published
        setIsSchedulePublished(data.status === "PUBLISHED");
        console.log(
          `Schedule status: ${data.status}, isPublished: ${
            data.status === "PUBLISHED"
          }`
        );

        // Process the shifts that came with the schedule
        if (data.shifts && data.shifts.length > 0) {
          console.log(
            `Processing ${data.shifts.length} shifts included in schedule response:`,
            data.shifts
          );
          await processShifts(data.shifts);

          // Validate and cleanup employees after processing shifts
          await validateAndCleanupEmployees(data.shifts);
        } else {
          console.log("No shifts found in the schedule response");
          // Set empty shifts for this week if none were found
          const weekId = getWeekIdentifier(currentWeekStart);
          setWeeklySchedules((prev) => ({
            ...prev,
            [weekId]: {},
          }));

          // Validate employees even when there are no shifts (cleanup removed employees)
          await validateAndCleanupEmployees([]);
        }
      } else {
        console.log("No schedule found for the selected week");
        setCurrentScheduleId(null);

        // If we don't have a schedule yet for this week, create an empty schedule object
        const weekId = getWeekIdentifier(currentWeekStart);
        setWeeklySchedules((prev) => ({
          ...prev,
          [weekId]: {},
        }));

        // Validate employees even when there's no schedule (cleanup removed employees)
        await validateAndCleanupEmployees([]);
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setCurrentScheduleId(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to process shifts data
  const processShifts = async (shifts) => {
    if (!shifts || shifts.length === 0) {
      console.log("No shifts to process");
      return;
    }

    console.log(`Processing ${shifts.length} shifts`, shifts);

    // Log the date format from API for debugging
    if (shifts.length > 0 && DEBUG_TIMEZONE) {
      console.log("First shift from API:", shifts[0]);
      console.log("Start time type:", typeof shifts[0].startTime);
      console.log("Start time value:", shifts[0].startTime);
    }

    // Make sure we have the employee data
    if (employees.length === 0) {
      await fetchEmployees();
    }

    // Log employee IDs for debugging
    if (DEBUG_TIMEZONE) {
      console.log(
        "Available employee IDs:",
        employees.map((emp) => emp.id)
      );

      // Log shift employee IDs for debugging
      console.log(
        "Shift employee IDs:",
        shifts.map((shift) => shift.employeeId)
      );
    }

    // Create map of employee IDs for faster lookup
    const employeeMap = {};
    employees.forEach((emp) => {
      if (emp && emp.id) {
        employeeMap[emp.id] = true;
        employeeMap[String(emp.id)] = true; // Also add string version
      }
    });

    if (DEBUG_TIMEZONE) {
      console.log("Employee ID lookup map:", employeeMap);
    }

    // Gather all unique employee IDs from shifts to add missing employees at once
    const missingEmployeeIds = new Set();

    // First, identify all missing employee IDs
    shifts.forEach((shift) => {
      const employeeId = shift.employeeId;
      if (DEBUG_TIMEZONE) {
        console.log(
          `Checking if employee ID '${employeeId}' exists in our employee list`
        );
      }

      // Use the map for faster lookup
      if (!employeeMap[employeeId]) {
        console.log(
          `Employee ID '${employeeId}' not found in the current employee list, will add`
        );
        missingEmployeeIds.add(employeeId);
      }
    });

    // Add missing employees all at once if needed
    if (missingEmployeeIds.size > 0) {
      console.log("Adding missing employees:", Array.from(missingEmployeeIds));

      // Create all the missing employee placeholders at once
      const missingEmployees = Array.from(missingEmployeeIds).map((id) => ({
        id: id,
        name: `Former Employee ${id}`, // More descriptive name for ghost employees
        hourlyRate: "$0.00",
        hours: "0h",
        role: "Former Employee",
        businessUnitName: "No longer in business unit",
        isGhost: true, // Missing employees are ghost - not in current business unit but have shifts
      }));

      console.log(
        `[WEEKLY SCHEDULE] 👻 Creating ${missingEmployees.length} ghost employees:`,
        missingEmployees.map((emp) => `${emp.name} (ID: ${emp.id})`).join(", ")
      );

      // Update state once with all missing employees
      setEmployees((prev) => {
        // Double check that we're not adding duplicates
        const updatedEmployees = [...prev];
        const existingIds = new Set(prev.map((e) => e.id));

        missingEmployees.forEach((emp) => {
          if (!existingIds.has(emp.id)) {
            updatedEmployees.push(emp);
            existingIds.add(emp.id);
          }
        });

        return updatedEmployees;
      });
    }

    // Process the shifts into our application format
    const processedShifts = {};

    shifts.forEach((shift) => {
      // Ensure employeeId is a string
      const employeeId = String(shift.employeeId);

      // Make sure the date strings are properly parsed
      if (DEBUG_TIMEZONE) {
        console.log(
          "Processing shift with dates:",
          shift.startTime,
          shift.endTime
        );
      }

      let startTime, endTime;

      // Parse start and end times using the parseTimestamp function
      try {
        // Use the enhanced parseTimestamp function to handle various timestamp formats
        startTime = parseTimestamp(shift.startTime);
        endTime = parseTimestamp(shift.endTime);

        if (DEBUG_TIMEZONE) {
          console.log(
            "Parsed dates:",
            "startTime:",
            startTime ? startTime.toISOString() : "Invalid date",
            "endTime:",
            endTime ? endTime.toISOString() : "Invalid date"
          );
        }

        // Skip shifts with invalid dates
        if (
          !startTime ||
          !endTime ||
          isNaN(startTime.getTime()) ||
          isNaN(endTime.getTime())
        ) {
          console.error("Invalid date detected, skipping shift:", shift);
          return; // Skip this shift
        }

        // Additional format debugging
        if (DEBUG_TIMEZONE) {
          console.log("Date components:", {
            startYear: startTime.getFullYear(),
            startMonth: startTime.getMonth() + 1, // +1 for human-readable month
            startDay: startTime.getDate(),
            startDayOfWeek: startTime.getDay(),
            startHours: startTime.getHours(),
            startMinutes: startTime.getMinutes(),
          });
        }
      } catch (e) {
        console.error("Error parsing shift dates:", e, shift);
        return; // Skip this shift
      }

      // Calculate the day of week (0-6) based on the start time
      const weekStartDay = new Date(currentWeekStart);

      if (DEBUG_TIMEZONE) {
        console.log("Calculating day for shift:", shift.id);
        console.log("Shift date:", startTime.toDateString());
        console.log("Week start day:", weekStartDay.toDateString());
      }

      // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
      const shiftDayOfWeek = startTime.getDay();

      // Convert from Sunday=0 to Monday=0 (our app uses Monday as first day)
      const adjustedDay = shiftDayOfWeek === 0 ? 6 : shiftDayOfWeek - 1;

      if (DEBUG_TIMEZONE) {
        const dayNames = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ];

        console.log(`Day calculation results:
          - Day of week: ${shiftDayOfWeek} (${dayNames[shiftDayOfWeek]})
          - Adjusted to Monday-first format: ${adjustedDay} (${
          adjustedDay === 6 ? "Sunday" : dayNames[adjustedDay + 1]
        })
        `);
      }

      // Final day value (0 = Monday, 6 = Sunday)
      const day = adjustedDay;

      // Sanity check
      if (day < 0 || day > 6) {
        console.error("Invalid day calculated:", day);
        return; // Skip this shift
      }

      if (DEBUG_TIMEZONE) {
        console.log(`Final day value for shift: ${day}`);
      }

      // Format times for display
      const formattedStartTime = formatTime(startTime);
      const formattedEndTime = formatTime(endTime);

      // Calculate duration
      const durationMs = endTime - startTime;
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMinutes = Math.floor(
        (durationMs % (1000 * 60 * 60)) / (1000 * 60)
      );
      const formattedDuration = `${durationHours}h ${
        durationMinutes > 0 ? `${durationMinutes}min` : ""
      }`;

      // Create shift object
      const processedShift = {
        id: `shift-${employeeId}-${day}-${Date.now()}`,
        backendId: shift.id,
        employeeId,
        day,
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        duration: formattedDuration,
        position: shift.position || getRandomPosition(),
        business: shift.businessName || "Business",
      };

      if (DEBUG_TIMEZONE) {
        console.log(`Created processed shift for day ${day}:`, processedShift);
      }

      // Add to processed shifts
      if (!processedShifts[employeeId]) {
        processedShifts[employeeId] = [];
      }

      processedShifts[employeeId].push(processedShift);
    });

    console.log("Processed shifts by employee ID:", processedShifts);

    // Update the weekly schedules
    const weekId = getWeekIdentifier(currentWeekStart);

    if (DEBUG_TIMEZONE) {
      console.log("---CRITICAL DEBUG---");
      console.log(
        "Before state update - current weeklySchedules:",
        weeklySchedules
      );
      console.log("Processed shifts to add:", processedShifts);
      console.log("Week ID being used:", weekId);
    }

    // Create a new object with the updated data to ensure React detects the change
    const updatedWeeklySchedules = {
      ...weeklySchedules,
      [weekId]: processedShifts,
    };

    if (DEBUG_TIMEZONE) {
      console.log("New state that will be set:", updatedWeeklySchedules);
    }

    setWeeklySchedules(updatedWeeklySchedules);

    // Force a console log after the state should be updated
    if (DEBUG_TIMEZONE) {
      setTimeout(() => {
        console.log(
          "AFTER STATE UPDATE - Current weeklySchedules:",
          weeklySchedules
        );
        console.log(
          "Current shifts from getCurrentWeekShifts():",
          getCurrentWeekShifts()
        );
        console.log("---END CRITICAL DEBUG---");
      }, 100);
    }

    // Update stats
    updateStats(processedShifts);
  };

  // Helper function to format time from Date object to "08:00" format or 12-hour format
  const formatTime = (date, use12Hour = false) => {
    if (use12Hour) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Helper function to get random position (temporary until we add positions to backend)
  const getRandomPosition = () => {
    return positions[Math.floor(Math.random() * positions.length)];
  };

  // Effect to load schedule when current week changes
  useEffect(() => {
    console.log("Week changed to:", currentWeekStart);
    setIsLoading(true);

    // Reset weekly schedules for this week
    const weekId = getWeekIdentifier(currentWeekStart);
    setWeeklySchedules((prev) => {
      const newSchedules = { ...prev };
      if (newSchedules[weekId]) {
        delete newSchedules[weekId];
      }
      return newSchedules;
    });

    // First fetch availabilities
    fetchAvailabilities(currentWeekStart);

    // Then fetch the schedule (and then shifts) for the current week
    fetchScheduleForWeek(currentWeekStart);
  }, [currentWeekStart]);

  // This useEffect runs when the current schedule ID changes
  useEffect(() => {
    if (!currentScheduleId) {
      // Clear shifts when no schedule is selected
      console.log("No schedule ID available, clearing shift data");
      // Clear any existing shift data
      const weekId = getWeekIdentifier(currentWeekStart);
      setWeeklySchedules((prev) => {
        const newSchedules = { ...prev };
        delete newSchedules[weekId];
        return newSchedules;
      });
      // Set loading to false
      setIsLoading(false);
    }
  }, [currentScheduleId]);

  // Fetch availabilities when week changes
  useEffect(() => {
    fetchAvailabilities(currentWeekStart);
  }, [currentWeekStart]);

  // Fetch schedule with employee validation when week changes
  useEffect(() => {
    console.log(
      `[WEEK NAVIGATION] Week changed to: ${currentWeekStart.toDateString()}`
    );
    fetchScheduleForWeek(currentWeekStart);
  }, [currentWeekStart]);

  // Get availability for a specific employee on a specific day
  const getAvailabilitiesForDay = (employeeId, day) => {
    if (!employeeAvailabilities[employeeId]) return [];

    // Create a date object for the specific day in the current week
    const dayDate = new Date(currentWeekStart);
    // Add the day offset (0 = Monday, 6 = Sunday)
    dayDate.setDate(dayDate.getDate() + Number(day));
    // Reset time to start of day
    dayDate.setHours(0, 0, 0, 0);

    const availabilities = employeeAvailabilities[employeeId].filter(
      (availability) => {
        // Get the date from availability's start time, ignoring time part
        const availabilityDate = new Date(availability.startTime);
        availabilityDate.setHours(0, 0, 0, 0);

        // Compare just the dates (ignoring time)
        const match = availabilityDate.getTime() === dayDate.getTime();
        return match;
      }
    );

    return availabilities;
  };

  // Render a shift cell with availabilities
  const renderShiftCell = (employeeId, day) => {
    const shift = getShiftForDay(employeeId, day);
    const availabilities = getAvailabilitiesForDay(employeeId, day);

    return (
      <div className="h-full w-full flex flex-col relative min-h-[4rem]">
        {/* Display availabilities in top right corner */}
        {availabilities && availabilities.length > 0 ? (
          <div className="absolute top-0 right-0 z-10 flex flex-wrap gap-0.5 max-w-[90%]">
            {availabilities.map((availability, index) => {
              // Format start and end times
              const startTime = availability.startTime;
              const endTime = availability.endTime;

              // Skip invalid dates
              if (
                !startTime ||
                !endTime ||
                isNaN(startTime) ||
                isNaN(endTime)
              ) {
                console.error("Invalid date in availability:", availability);
                return null;
              }

              const timeStr = `${formatTime(startTime)}-${formatTime(endTime)}`;

              return (
                <div
                  key={`avail-${index}`}
                  className="bg-green-50 border border-green-300 rounded px-1 py-0.5 text-[9px] text-green-800 hover:bg-green-100 shadow-sm"
                  title={`Available: ${timeStr}`}
                >
                  {timeStr}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Display the shift */}
        {shift && (
          <div
            className={`${
              positionColors[shift.position] || "bg-gray-100 border-gray-300"
            } border rounded p-1 text-xs relative mb-1 cursor-pointer mt-5`}
            onClick={(e) => {
              e.stopPropagation();
              openShiftModal(employeeId, day, shift);
            }}
          >
            {formatShiftDisplay(shift)}
            {!isSchedulePublished && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteShift(employeeId, shift.id);
                }}
                className="absolute top-0 right-0 text-red-500 opacity-0 group-hover:opacity-100"
                title="Delete shift"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}

        {/* Add empty div for clickable area if no shift */}
        {!shift && (
          <div
            className={`h-full w-full cursor-${
              isSchedulePublished ? "default" : "pointer"
            } mt-5`}
            onClick={() =>
              !isSchedulePublished && openShiftModal(employeeId, day)
            }
          ></div>
        )}
      </div>
    );
  };

  // Function to get employees to display for the current week
  const getEmployeesToDisplayForWeek = () => {
    console.log(
      "[WEEKLY SCHEDULE] 🎯 Determining employees to display for current week..."
    );

    // Get shifts for the current week
    const currentWeekShifts = getCurrentWeekShifts();
    const employeesWithShifts = new Set();

    // Collect all employee IDs that have shifts this week
    Object.keys(currentWeekShifts).forEach((employeeId) => {
      if (
        currentWeekShifts[employeeId] &&
        currentWeekShifts[employeeId].length > 0
      ) {
        employeesWithShifts.add(String(employeeId));
      }
    });

    console.log(
      `[WEEKLY SCHEDULE] 📅 Employees with shifts this week: ${Array.from(
        employeesWithShifts
      ).join(", ")}`
    );

    // Separate current and ghost employees for better visibility
    const currentEmployees = employees.filter((emp) => !emp.isGhost);
    const ghostEmployees = employees.filter((emp) => emp.isGhost);

    console.log(
      `[WEEKLY SCHEDULE] 👥 Current employees: ${currentEmployees.length}, Ghost employees: ${ghostEmployees.length}`
    );

    // Filter employees to show:
    // 1. Employees who have shifts this week, OR
    // 2. Employees who are currently active in the business unit (fetched employees are the "truth")
    const employeesToDisplay = employees.filter((employee) => {
      const empId = String(employee.id);
      const hasShiftsThisWeek = employeesWithShifts.has(empId);

      // For the "truth" check, we need to verify if this employee was fetched
      // If they're in our employees array and don't have a "ghost" marker, they're current
      const isCurrentEmployee = !employee.isGhost; // We'll mark removed employees as "ghost"

      const shouldDisplay = hasShiftsThisWeek || isCurrentEmployee;

      if (shouldDisplay) {
        const statusMsg = employee.isGhost
          ? `👻 Ghost employee (has shifts but removed from business unit)`
          : `✅ Current employee`;
        console.log(
          `[WEEKLY SCHEDULE] ${statusMsg} - ${employee.name} (ID: ${empId}) - hasShifts: ${hasShiftsThisWeek}`
        );
      } else {
        console.log(
          `[WEEKLY SCHEDULE] ❌ Hiding employee ${employee.name} (ID: ${empId}) - no shifts and not current`
        );
      }

      return shouldDisplay;
    });

    const displayedGhostCount = employeesToDisplay.filter(
      (emp) => emp.isGhost
    ).length;
    const displayedCurrentCount = employeesToDisplay.filter(
      (emp) => !emp.isGhost
    ).length;

    console.log(
      `[WEEKLY SCHEDULE] 📋 Total employees to display: ${employeesToDisplay.length} out of ${employees.length} (${displayedCurrentCount} current + ${displayedGhostCount} ghost)`
    );
    return employeesToDisplay;
  };

  // Export functions
  const exportToPDF = () => {
    const doc = new jsPDF("l", "mm", "a4"); // landscape orientation
    const weekRange = formatDateRange();
    const businessUnit = user?.businessUnitName || "Restaurant";

    // Add title
    doc.setFontSize(16);
    doc.text(`${businessUnit} - Weekly Schedule`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Week of ${weekRange}`, 20, 30);

    // Prepare data for the table
    const employeesToDisplay = getEmployeesToDisplayForWeek();
    const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const columnDates = getColumnDates();

    // Create headers
    const headers = ["Employee"];
    daysOfWeek.forEach((day, index) => {
      headers.push(`${day} ${columnDates[index]}`);
    });

    // Create rows
    const rows = [];
    employeesToDisplay.forEach((employee) => {
      const row = [employee.name];

      for (let day = 0; day < 7; day++) {
        const shift = getShiftForDay(employee.id, day);
        if (shift) {
          row.push(
            `${shift.startTime}-${shift.endTime}\n${shift.position}\n${shift.duration}`
          );
        } else {
          row.push("-");
        }
      }
      rows.push(row);
    });

    // Add table
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontSize: 9,
      },
      columnStyles: {
        0: { cellWidth: 35 }, // Employee name column
      },
      didParseCell: function (data) {
        // Add colors based on position
        if (data.section === "body" && data.column.index > 0) {
          const cellText = data.cell.text.join("\n");
          if (cellText.includes("Waiter")) {
            data.cell.styles.fillColor = [173, 216, 230]; // Light blue
          } else if (cellText.includes("Bartender")) {
            data.cell.styles.fillColor = [221, 160, 221]; // Light purple
          } else if (cellText.includes("Cleaner")) {
            data.cell.styles.fillColor = [144, 238, 144]; // Light green
          }
        }
      },
    });

    // Save the PDF
    doc.save(`${businessUnit}_Schedule_${weekRange.replace(/\s+/g, "_")}.pdf`);
  };

  const exportToExcel = () => {
    const weekRange = formatDateRange();
    const businessUnit = user?.businessUnitName || "Restaurant";

    // Prepare data for Excel
    const employeesToDisplay = getEmployeesToDisplayForWeek();
    const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const columnDates = getColumnDates();

    // Create headers
    const headers = ["Employee"];
    daysOfWeek.forEach((day, index) => {
      headers.push(`${day} ${columnDates[index]}`);
    });

    // Create data array
    const data = [headers];

    employeesToDisplay.forEach((employee) => {
      const row = [employee.name];

      for (let day = 0; day < 7; day++) {
        const shift = getShiftForDay(employee.id, day);
        if (shift) {
          row.push(
            `${shift.startTime}-${shift.endTime} | ${shift.position} | ${shift.duration}`
          );
        } else {
          row.push("-");
        }
      }
      data.push(row);
    });

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Employee name
      { wch: 25 }, // Monday
      { wch: 25 }, // Tuesday
      { wch: 25 }, // Wednesday
      { wch: 25 }, // Thursday
      { wch: 25 }, // Friday
      { wch: 25 }, // Saturday
      { wch: 25 }, // Sunday
    ];
    ws["!cols"] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Weekly Schedule");

    // Save the file
    const fileName = `${businessUnit}_Schedule_${weekRange.replace(
      /\s+/g,
      "_"
    )}.xlsx`;
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, fileName);
  };

  // Calculate scheduled hours for an employee
  const calculateScheduledHours = (employeeId) => {
    const currentWeekShifts = getCurrentWeekShifts();
    const employeeShifts = currentWeekShifts[employeeId] || [];

    let totalHours = 0;
    employeeShifts.forEach((shift) => {
      try {
        // Parse the duration from the shift (e.g., "5h 30min" or "8h")
        if (shift.duration) {
          const duration = shift.duration;
          const hoursMatch = duration.match(/(\d+)h/);
          const minutesMatch = duration.match(/(\d+)min/);

          let hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
          let minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

          totalHours += hours + minutes / 60;
        } else {
          // Fallback: calculate from start and end time if available
          if (shift.startTime && shift.endTime) {
            const start = parseTimestamp(shift.startTime);
            const end = parseTimestamp(shift.endTime);
            const durationMs = end - start;
            const durationHours = durationMs / (1000 * 60 * 60);
            totalHours += durationHours > 0 ? durationHours : 0;
          }
        }
      } catch (error) {
        console.error("Error calculating shift duration:", error);
        // Use a fallback of 8 hours for shifts with parsing errors
        totalHours += 8;
      }
    });

    return Math.round(totalHours * 10) / 10; // Round to 1 decimal place
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-2xl text-gray-700 flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          Loading schedule data...
        </div>
      </div>
    );
  }

  if (error && employees.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl text-red-500">
          Error loading data: {error}
          <div className="mt-4">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={() => {
                setError(null);
                fetchEmployees();
                fetchScheduleForWeek(currentWeekStart);
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50">
      {/* Schedule Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-2 lg:p-4 border-b space-y-2 lg:space-y-0">
        <div className="flex items-center space-x-2 lg:space-x-4 mt-10 lg:mt-0">
          <div className="flex border rounded">
            <button
              className="px-2 lg:px-3 py-1 text-gray-700 flex items-center"
              onClick={goToPreviousWeek}
            >
              <ChevronLeft size={16} />
            </button>
            <button className="px-2 lg:px-3 py-1 text-blue-500 flex items-center text-xs lg:text-sm">
              {formatDateRange()}{" "}
              <ChevronRight className="ml-1 transform rotate-90" size={16} />
            </button>
            <button
              className="px-2 lg:px-3 py-1 text-gray-700 flex items-center"
              onClick={goToNextWeek}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            className="px-2 lg:px-3 py-1 border rounded text-gray-700 text-xs lg:text-sm"
            onClick={goToToday}
          >
            Today
          </button>

          {/* Export buttons */}
          <div className="flex items-center space-x-1 lg:space-x-2">
            <button
              className="px-2 lg:px-3 py-1 bg-red-500 text-white rounded flex items-center text-xs lg:text-sm hover:bg-red-600 transition-colors"
              onClick={exportToPDF}
              title="Export schedule as PDF"
            >
              <FileText size={14} className="mr-1" />
              PDF
            </button>
            <button
              className="px-2 lg:px-3 py-1 bg-green-500 text-white rounded flex items-center text-xs lg:text-sm hover:bg-green-600 transition-colors"
              onClick={exportToExcel}
              title="Export schedule as Excel"
            >
              <Download size={14} className="mr-1" />
              Excel
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2 lg:space-x-4 w-full lg:w-auto">
          {/* Only show Create Schedule button when no schedule exists */}
          {!currentScheduleId && (
            <button
              className="px-3 lg:px-4 py-1 lg:py-2 bg-green-500 text-white rounded flex items-center text-xs lg:text-sm"
              onClick={saveScheduleDraft}
              disabled={isSaving}
            >
              <Save size={16} className="mr-1" />
              {isSaving ? "Saving..." : "Create Schedule"}
            </button>
          )}

          {currentScheduleId && !isSchedulePublished && (
            <button
              className="px-3 lg:px-4 py-1 lg:py-2 bg-green-600 text-white rounded flex items-center text-xs lg:text-sm"
              onClick={publishSchedule}
              disabled={isSaving}
            >
              <Edit size={16} className="mr-1" />
              {isSaving ? "Publishing..." : "Publish Schedule"}
            </button>
          )}

          {currentScheduleId && isSchedulePublished && (
            <button
              className="px-3 lg:px-4 py-1 lg:py-2 bg-blue-500 text-white rounded flex items-center text-xs lg:text-sm"
              onClick={editPublishedSchedule}
              disabled={isSaving}
            >
              <Edit size={16} className="mr-1" />
              {isSaving ? "Processing..." : "Edit Schedule"}
            </button>
          )}

          {/* Keep only restaurant ID, remove username and logout button */}
          <div className="hidden lg:flex items-center">
            {user && (
              <div className="flex flex-col text-sm mr-3">
                <span className="text-xs text-gray-500">
                  {user.businessUnitName || "Restaurant"} (ID:{" "}
                  {getRestaurantId()})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Published Schedule Indicator */}
      {isSchedulePublished && (
        <div className="bg-yellow-100 px-4 py-2 border-t border-b border-yellow-200 text-yellow-800 text-xs lg:text-sm">
          <span className="font-medium">Published Schedule</span> - This
          schedule is published and cannot be edited. Use the 'Edit Schedule'
          button to make changes.
        </div>
      )}

      {/* Position Legend */}
      <div className="flex flex-col space-y-2 px-2 lg:px-4 py-2 border-t text-xs lg:text-sm">
        <div className="flex flex-wrap space-x-2 lg:space-x-4">
          <div className="font-medium">Position Colors:</div>
          <div className="flex items-center">
            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-blue-100 border border-blue-300 mr-1 rounded"></div>
            <span>Waiter</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-purple-100 border border-purple-300 mr-1 rounded"></div>
            <span>Bartender</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-green-100 border border-green-300 mr-1 rounded"></div>
            <span>Cleaner</span>
          </div>
        </div>
        <div className="flex flex-wrap space-x-2 lg:space-x-4">
          <div className="font-medium">Employee Status:</div>
          <div className="flex items-center">
            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-red-100 border border-red-300 mr-1 rounded"></div>
            <span>Former employee with scheduled shifts</span>
          </div>
          <div className="flex items-center">
            <div className="inline-block bg-green-50 border border-green-300 rounded px-1 py-0.5 text-[10px] text-green-800 mr-1">
              10:00-14:00
            </div>
            <span>Employee availability</span>
          </div>
        </div>
      </div>

      {/* Stats Bar - fixed to prevent horizontal scrolling */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 bg-gray-100 p-2 border-t border-b text-center text-xs gap-1">
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.estWages}
          </div>
          <div className="text-gray-500 truncate">WAGES</div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.scheduledHours}
          </div>
          <div className="text-gray-500 truncate">HOURS</div>
        </div>
        <div className="flex flex-col justify-center">
          <div
            className={`font-medium truncate ${
              parseFloat(stats.laborPercent) > 100
                ? "text-red-500"
                : "text-green-500"
            }`}
          >
            {stats.laborPercent}
          </div>
          <div className="text-gray-500 truncate">LABOR%</div>
        </div>
        <div className="hidden md:flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.otCost}
          </div>
          <div className="text-gray-500 truncate">OT COST</div>
        </div>
        <div className="hidden lg:flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.otHours}
          </div>
          <div className="text-gray-500 truncate">OT HRS</div>
        </div>
        <div className="hidden lg:flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.absences}
          </div>
          <div className="text-gray-500 truncate">ABS</div>
        </div>
        <div className="hidden lg:flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.totalShifts}
          </div>
          <div className="text-gray-500 truncate">SHIFTS</div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="flex-grow overflow-auto w-full h-full">
        <div className="min-w-full h-full">
          {/* Day Headers - Enhanced visibility */}
          <div className="grid grid-cols-8 border-b sticky top-0 bg-white z-10">
            <div className="p-1 lg:p-2 font-medium text-gray-500 border-r w-20 md:w-32 lg:w-48 min-w-[5rem] md:min-w-[8rem] lg:min-w-[12rem]">
              <div className="text-[10px] sm:text-xs">EMPLOYEE</div>
              <div className="text-[8px] sm:text-[10px] text-blue-600">
                & ID
              </div>
            </div>
            {daysOfWeek.map((day, i) => (
              <div
                key={day}
                className="p-1 lg:p-2 text-center border-r bg-gray-50"
              >
                <div className="font-semibold text-gray-700 text-[10px] sm:text-xs">
                  {day}
                </div>
                <div className="font-bold text-gray-900 text-xs md:text-sm lg:text-lg">
                  {columnDates[i]}
                </div>
              </div>
            ))}
          </div>

          {/* Employee Rows or No Schedule Message */}
          {!currentScheduleId ? (
            <div className="text-center p-6 lg:p-12 text-gray-500 text-base lg:text-xl">
              No schedule found for this week. Please create a schedule first.
            </div>
          ) : getEmployeesToDisplayForWeek().length === 0 ? (
            <div className="text-center p-4 lg:p-8 text-gray-500">
              <div className="text-lg font-medium mb-2">No employees found</div>
              <div className="text-sm">
                No employees have shifts this week and no current employees are
                assigned to business unit ID: {getRestaurantId()}
              </div>
              <div className="text-sm mt-2 text-gray-400">
                Please add employees to this business unit or create shifts to
                see the schedule.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {getEmployeesToDisplayForWeek()
                .sort((a, b) => {
                  // Current user always comes first
                  if (a.isCurrentUser && !b.isCurrentUser) return -1;
                  if (!a.isCurrentUser && b.isCurrentUser) return 1;

                  // If both are current user or both are not, sort alphabetically by name
                  const nameA = (a.name || "Unknown Employee").toLowerCase();
                  const nameB = (b.name || "Unknown Employee").toLowerCase();
                  return nameA.localeCompare(nameB);
                })
                .map((employee) => {
                  return (
                    <div
                      key={employee.id}
                      className={`grid grid-cols-8 border-b hover:bg-gray-50 text-[10px] sm:text-xs lg:text-sm ${
                        employee.isGhost ? "bg-red-50 opacity-75" : ""
                      }`}
                    >
                      {/* Employee Info */}
                      <div
                        className={`p-1 lg:p-2 border-r flex items-center w-20 md:w-32 lg:w-48 min-w-[5rem] md:min-w-[8rem] lg:min-w-[12rem] sticky left-0 z-10 ${
                          employee.isGhost ? "bg-red-50" : "bg-white"
                        }`}
                      >
                        <div
                          className={`rounded-full h-5 w-5 md:h-6 md:w-6 lg:h-8 lg:w-8 flex items-center justify-center mr-1 lg:mr-2 text-[9px] sm:text-xs lg:text-sm shrink-0 ${
                            employee.isGhost ? "bg-red-200" : "bg-gray-200"
                          }`}
                        >
                          {employee.name
                            ?.split(" ")
                            .map((part) => part[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase() || "EE"}
                        </div>
                        <div className="truncate">
                          <div className="font-medium text-[10px] sm:text-xs lg:text-sm">
                            {employee.isCurrentUser ? (
                              <span style={{ fontWeight: "bold" }}>
                                {employee.name || "Unknown Employee"} (me)
                              </span>
                            ) : (
                              <span
                                className={
                                  employee.isGhost ? "text-red-600" : ""
                                }
                              >
                                {employee.name || "Unknown Employee"}
                                {employee.isGhost ? " (former)" : ""}
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] sm:text-[10px] lg:text-xs text-gray-500">
                            <div className="hidden sm:block">
                              <span className="capitalize">
                                {employee.role
                                  ? employee.role
                                      .toLowerCase()
                                      .replace(/_/g, " ")
                                  : "staff"}
                              </span>
                              {(() => {
                                const contractHours =
                                  employee.contractHours || 40;
                                const scheduledHours = calculateScheduledHours(
                                  employee.id
                                );

                                // Determine color based on comparison
                                let colorClass = "text-gray-600"; // Default
                                if (scheduledHours < contractHours) {
                                  colorClass = "text-red-600"; // Below contract hours
                                } else if (scheduledHours > contractHours) {
                                  colorClass = "text-green-600"; // Above contract hours
                                }

                                return (
                                  <div>
                                    <div className="text-[7px] sm:text-[8px] lg:text-[9px] text-gray-700 font-medium">
                                      Contract: {contractHours}h/week
                                    </div>
                                    <div
                                      className={`text-[7px] sm:text-[8px] lg:text-[9px] font-medium ${colorClass}`}
                                    >
                                      Scheduled: {scheduledHours}h
                                    </div>
                                  </div>
                                );
                              })()}
                              {employee.isGhost && (
                                <span className="text-red-500 ml-1">
                                  • No longer in business unit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Shifts */}
                      {Array.from({ length: 7 }, (_, day) => (
                        <div
                          key={day}
                          className="p-1 md:p-2 border-r relative min-h-[4rem] flex-1"
                        >
                          {renderShiftCell(employee.id, day)}
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 lg:p-6 w-full max-w-xs lg:max-w-md">
            <h2 className="text-lg lg:text-xl font-bold mb-3 lg:mb-4">
              {currentShift.id.includes("new") ? "Create Shift" : "Edit Shift"}
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <select
                className="w-full border rounded p-2"
                value={currentShift.employeeId}
                onChange={(e) =>
                  setCurrentShift({
                    ...currentShift,
                    employeeId: e.target.value,
                    business:
                      employees.find((emp) => emp.id === e.target.value)
                        ?.businessUnitName || "Test Business",
                  })
                }
              >
                {employees
                  .sort((a, b) => {
                    // Current user always comes first
                    if (a.isCurrentUser && !b.isCurrentUser) return -1;
                    if (!a.isCurrentUser && b.isCurrentUser) return 1;

                    // If both are current user or both are not, sort alphabetically by name
                    const nameA = (a.name || "Unknown Employee").toLowerCase();
                    const nameB = (b.name || "Unknown Employee").toLowerCase();
                    return nameA.localeCompare(nameB);
                  })
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {emp.isCurrentUser ? " (me)" : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                className="w-full border rounded p-2"
                value={currentShift.position}
                onChange={(e) =>
                  setCurrentShift({ ...currentShift, position: e.target.value })
                }
              >
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time
                </label>
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  placeholder="e.g. 08:00"
                  value={currentShift.startTime}
                  onChange={(e) => {
                    // Get the input value
                    let inputValue = e.target.value;

                    // Only allow numbers and colon
                    inputValue = inputValue.replace(/[^0-9:]/g, "");

                    // Apply 24-hour format masking
                    if (inputValue) {
                      const numbers = inputValue.replace(/[^0-9]/g, "");

                      // Format hours (00-23)
                      if (numbers.length >= 1) {
                        // Format the hours part
                        if (numbers.length === 1) {
                          // Single digit, keep as is
                          inputValue = numbers;
                        } else {
                          // Ensure hour is 0-23
                          const hours = parseInt(numbers.substring(0, 2));

                          if (hours > 23) {
                            // Clamp to 23
                            inputValue = "23";
                          } else {
                            // Pad with zero if needed
                            inputValue =
                              hours < 10 ? "0" + hours : hours.toString();
                          }

                          // Add colon after hours if we have more digits
                          if (numbers.length >= 3) {
                            inputValue += ":";

                            // Add minutes if available
                            if (numbers.length >= 3) {
                              // First minute digit
                              const firstMinDigit = numbers.substring(2, 3);
                              inputValue += firstMinDigit;

                              // Add second minute digit if available
                              if (numbers.length >= 4) {
                                const secondMinDigit = numbers.substring(3, 4);
                                inputValue += secondMinDigit;
                              }
                            }
                          }
                        }
                      }
                    }

                    // Set the updated value
                    const startTime = inputValue;
                    let endTime = currentShift.endTime;
                    let duration = currentShift.duration;

                    // If both start and end times are valid, calculate duration
                    if (
                      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) &&
                      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)
                    ) {
                      try {
                        // Parse start time
                        const [startHour, startMin] = startTime
                          .split(":")
                          .map((num) => parseInt(num));

                        // Parse end time
                        const [endHour, endMin] = endTime
                          .split(":")
                          .map((num) => parseInt(num));

                        // Calculate duration
                        let durationHours = endHour - startHour;
                        let durationMinutes = endMin - startMin;

                        // Handle next day scenario
                        if (durationHours < 0) {
                          durationHours += 24;
                        }

                        // Handle negative minutes
                        if (durationMinutes < 0) {
                          durationHours--;
                          durationMinutes += 60;
                        }

                        duration = `${durationHours}h${
                          durationMinutes > 0 ? ` ${durationMinutes}min` : ""
                        }`;
                      } catch (e) {
                        console.error("Error calculating duration:", e);
                      }
                    }

                    setCurrentShift({
                      ...currentShift,
                      startTime,
                      duration,
                    });
                  }}
                />
                {!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(
                  currentShift.startTime
                ) &&
                  currentShift.startTime && (
                    <div className="text-red-500 text-xs mt-1">
                      Please use 24-hour format (00:00 - 23:59)
                    </div>
                  )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time
                </label>
                <input
                  type="text"
                  className="w-full border rounded p-2"
                  placeholder="e.g. 17:00"
                  value={currentShift.endTime}
                  onChange={(e) => {
                    // Get the input value
                    let inputValue = e.target.value;

                    // Only allow numbers and colon
                    inputValue = inputValue.replace(/[^0-9:]/g, "");

                    // Apply 24-hour format masking
                    if (inputValue) {
                      const numbers = inputValue.replace(/[^0-9]/g, "");

                      // Format hours (00-23)
                      if (numbers.length >= 1) {
                        // Format the hours part
                        if (numbers.length === 1) {
                          // Single digit, keep as is
                          inputValue = numbers;
                        } else {
                          // Ensure hour is 0-23
                          const hours = parseInt(numbers.substring(0, 2));

                          if (hours > 23) {
                            // Clamp to 23
                            inputValue = "23";
                          } else {
                            // Pad with zero if needed
                            inputValue =
                              hours < 10 ? "0" + hours : hours.toString();
                          }

                          // Add colon after hours if we have more digits
                          if (numbers.length >= 3) {
                            inputValue += ":";

                            // Add minutes if available
                            if (numbers.length >= 3) {
                              // First minute digit
                              const firstMinDigit = numbers.substring(2, 3);
                              inputValue += firstMinDigit;

                              // Add second minute digit if available
                              if (numbers.length >= 4) {
                                const secondMinDigit = numbers.substring(3, 4);
                                inputValue += secondMinDigit;
                              }
                            }
                          }
                        }
                      }
                    }

                    // Set the updated value
                    const endTime = inputValue;
                    const startTime = currentShift.startTime;
                    let duration = currentShift.duration;

                    // If both start and end times are valid, calculate duration
                    if (
                      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) &&
                      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)
                    ) {
                      try {
                        // Parse start time
                        const [startHour, startMin] = startTime
                          .split(":")
                          .map((num) => parseInt(num));

                        // Parse end time
                        const [endHour, endMin] = endTime
                          .split(":")
                          .map((num) => parseInt(num));

                        // Calculate duration
                        let durationHours = endHour - startHour;
                        let durationMinutes = endMin - startMin;

                        // Handle next day scenario
                        if (durationHours < 0) {
                          durationHours += 24;
                        }

                        // Handle negative minutes
                        if (durationMinutes < 0) {
                          durationHours--;
                          durationMinutes += 60;
                        }

                        duration = `${durationHours}h${
                          durationMinutes > 0 ? ` ${durationMinutes}min` : ""
                        }`;
                      } catch (e) {
                        console.error("Error calculating duration:", e);
                      }
                    }

                    setCurrentShift({
                      ...currentShift,
                      endTime,
                      duration,
                    });
                  }}
                />
                {!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(
                  currentShift.endTime
                ) &&
                  currentShift.endTime && (
                    <div className="text-red-500 text-xs mt-1">
                      Please use 24-hour format (00:00 - 23:59)
                    </div>
                  )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between sm:items-center mt-6 gap-2">
              {!currentShift.id.includes("new") && (
                <button
                  className="bg-red-500 text-white px-4 py-2 rounded flex items-center justify-center"
                  onClick={() => {
                    deleteShift(currentShift.employeeId, currentShift.id);
                  }}
                >
                  <Trash2 size={16} className="mr-1" /> Delete
                </button>
              )}
              <div className="flex ml-auto space-x-2">
                <button
                  className="border px-4 py-2 rounded"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  onClick={saveShift}
                >
                  Create Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleApp;
