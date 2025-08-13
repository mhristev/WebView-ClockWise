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
import { useNotification } from "./components/NotificationContext";
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
        // console.log("Using millisecond timestamp directly:", timestamp);
        return new Date(timestamp);
      }
    } else {
      // It's in seconds (standard Unix timestamp)
      // console.log(
      //   "Converting second timestamp to milliseconds:",
      //   timestamp * 1000
      // );
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
  position,
  userFirstName,
  userLastName
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
    userFirstName,
    userLastName,
  };
};

// Helper function to check if a date is today
function isDateToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

// Helper function to get Monday of a given week (moved outside component)
function getMonday(date) {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0); // Reset to start of day
  return monday;
}

// Get unique week identifier (moved outside component)
function getWeekIdentifier(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const weekNumber = Math.ceil((day + 6 - date.getDay()) / 7);
  return `${year}-${month}-${weekNumber}`;
}

function ScheduleApp() {
  // Extract auth context
  const { authenticatedFetch, user, getRestaurantId } = useAuth();

  // Extract notification context
  const { showSuccess, showError, showWarning, showInfo } = useNotification();

  // State declarations
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

  // Constants
  const positions = ["Waiter", "Bartender", "Cleaner"];
  // Enhanced position colors with gradients
  const positionColors = {
    Waiter:
      "bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300 text-blue-800 hover:from-blue-200 hover:to-blue-300",
    Bartender:
      "bg-gradient-to-br from-purple-100 to-purple-200 border-purple-300 text-purple-800 hover:from-purple-200 hover:to-purple-300",
    Cleaner:
      "bg-gradient-to-br from-emerald-100 to-emerald-200 border-emerald-300 text-emerald-800 hover:from-emerald-200 hover:to-emerald-300",
  };
  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // Fetch employees from the API (moved here)
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

      // Remove 401 check, as authenticatedFetch handles it
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

        // Log employee fields for debugging
        if (index === 0) {
          console.log(
            "📋 [WEEKLY SCHEDULE] Sample employee fields:",
            Object.keys(emp)
          );
          console.log("📋 [WEEKLY SCHEDULE] Sample employee data:", {
            id: emp.id,
            name: emp.firstName + " " + emp.lastName,
            contractHours: emp.contractHours,
            hourlyPayment: emp.hourlyPayment,
            role: emp.role,
          });
        }

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
          contractHours: emp.contractHours || null, // Keep as null if not provided
          hourlyPayment: emp.hourlyPayment || null, // Keep as null if not provided
          breakDurationMinutes: emp.breakDurationMinutes || null, // Keep as null if not provided
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

      setEmployees(uniqueEmployees);
    } catch (error) {
      console.error("❌ [WEEKLY SCHEDULE] Error fetching employees:", error);
      setError(`Failed to load employees: ${error.message}`);
      setEmployees([]); // Clear employees on error
    }
  };

  // Fetch availabilities for the week (moved here)
  const fetchAvailabilities = async (weekStart) => {
    if (!user) return; // Ensure user is available

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
      data.forEach((availability) => {
        const employeeId = availability.employeeId; // Use employeeId instead of userId
        if (!availabilitiesByEmployee[employeeId]) {
          availabilitiesByEmployee[employeeId] = [];
        }

        // Store the raw availability data as it comes from the API
        // The timestamps will be parsed later when needed
        availabilitiesByEmployee[employeeId].push({
          id: availability.id,
          startTime: availability.startTime,
          endTime: availability.endTime,
          businessUnitId: availability.businessUnitId,
        });
      });

      console.log(
        "Processed availabilities by employee:",
        availabilitiesByEmployee
      );
      setEmployeeAvailabilities(availabilitiesByEmployee);
    } catch (error) {
      console.error("Error fetching availabilities:", error);
      setError(`Failed to load availabilities: ${error.message}`);
      setEmployeeAvailabilities({}); // Clear availabilities on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch schedule for the current week (moved here)
  const fetchScheduleForWeek = async (weekStart) => {
    try {
      setIsLoading(true);
      // Ensure published state is reset when fetching a new week
      setIsSchedulePublished(false);

      // Format the date to ensure it's at midnight on Monday
      const formattedWeekStart = new Date(weekStart);
      formattedWeekStart.setHours(0, 0, 0, 0);

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
        setCurrentScheduleId(data.id);
        setIsSchedulePublished(data.status === "PUBLISHED");

        // Process shifts if available
        if (data.shifts && data.shifts.length > 0) {
          console.log(`Processing ${data.shifts.length} shifts`);
          processShifts(data.shifts);
        } else {
          console.log("No shifts found in schedule for this week.");
          // If no shifts, ensure weeklySchedules for this week is empty
          const weekId = getWeekIdentifier(currentWeekStart);
          setWeeklySchedules((prev) => ({ ...prev, [weekId]: {} }));
        }
      } else {
        console.log("No schedule found for the selected week.");
        setCurrentScheduleId(null);
        setIsSchedulePublished(false);
        const weekId = getWeekIdentifier(currentWeekStart);
        setWeeklySchedules((prev) => ({ ...prev, [weekId]: {} }));
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setError(`Failed to load schedule: ${error.message}`);
      setCurrentScheduleId(null);
    } finally {
      setIsLoading(false);
    }
  };

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
    if (user) {
      // Only fetch if user data is available after potential refresh
      fetchEmployees();
      fetchAvailabilities(currentWeekStart);
      fetchScheduleForWeek(currentWeekStart); // Also trigger schedule fetch
    }
  }, [user, authenticatedFetch, currentWeekStart]); // Add user, authenticatedFetch, and currentWeekStart to dependencies

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

        // Find employee data to get firstName and lastName
        const employee = employees.find((emp) => emp.id === shift.employeeId);
        const userFirstName =
          employee?.firstName || employee?.name?.split(" ")[0] || "";
        const userLastName =
          employee?.lastName || employee?.name?.split(" ")[1] || "";

        const shiftRequest = createShiftRequest(
          scheduleData.id,
          shift.employeeId,
          shiftDate,
          shift.startTime,
          shift.endTime,
          shift.position,
          userFirstName,
          userLastName
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
      showSuccess("Schedule draft saved successfully!");
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
      showWarning("No schedule selected.");
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

      showSuccess("Schedule can now be edited!");

      // Set schedule as not published (editable)
      setIsSchedulePublished(false);

      // Refresh the schedule data
      fetchScheduleForWeek(currentWeekStart);
    } catch (err) {
      console.error("Failed to revert schedule to draft:", err);
      showError(`Failed to revert schedule to draft: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Modify publishSchedule to set the published state
  const publishSchedule = async () => {
    if (!currentScheduleId) {
      showWarning("No schedule to publish. Please create a schedule first.");
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

      showSuccess("Schedule published successfully!");

      // Refresh the schedule data
      fetchScheduleForWeek(currentWeekStart);
    } catch (err) {
      console.error("Failed to publish schedule:", err);
      showError(`Failed to publish schedule: ${err.message}`);
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
      showWarning(
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

      // Find employee data to get firstName and lastName
      const employee = employees.find((emp) => emp.id === employeeId);
      const userFirstName =
        employee?.firstName || employee?.name?.split(" ")[0] || "";
      const userLastName =
        employee?.lastName || employee?.name?.split(" ")[1] || "";

      // Create the shift request using our time-preserving function
      const shiftRequest = createShiftRequest(
        scheduleId,
        employeeId,
        shiftDate,
        currentShift.startTime,
        currentShift.endTime,
        currentShift.position,
        userFirstName,
        userLastName
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
      showError(`Failed to save shift: ${err.message}`);
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
        showError(
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

  // Update stats based on current week's schedule with actual hourly payments
  const updateStats = (currentShifts = null) => {
    if (!employees || employees.length === 0) return;

    const shifts = currentShifts || getCurrentWeekShifts();
    let totalShifts = 0;
    let totalHours = 0;
    let totalWages = 0;
    let totalOvertimeHours = 0;
    let totalOvertimeCost = 0;

    // Calculate employee hours and wages
    const employeeHours = {};

    Object.entries(shifts).forEach(([empId, employeeShifts]) => {
      totalShifts += employeeShifts.length;
      let empHours = 0;

      // Find the employee to get their hourly rate
      const employee = employees.find(
        (emp) => emp.id.toString() === empId.toString()
      );
      const hourlyRate = employee?.hourlyPayment || null;
      const contractHours = employee?.contractHours || null;

      employeeShifts.forEach((shift) => {
        let shiftHours = 0;

        // Calculate hours from shift duration
        if (shift.duration) {
          const duration = shift.duration;
          const hoursMatch = duration.match(/(\d+)h/);
          const minutesMatch = duration.match(/(\d+)min/);

          let hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
          let minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;

          shiftHours = hours + minutes / 60;
        } else if (shift.startTime && shift.endTime) {
          // Fallback: calculate from start and end time
          const start = parseTimestamp(shift.startTime);
          const end = parseTimestamp(shift.endTime);
          if (start && end) {
            const durationMs = end - start;
            shiftHours = durationMs / (1000 * 60 * 60);
            shiftHours = shiftHours > 0 ? shiftHours : 0;
          }
        } else {
          // Default fallback
          shiftHours = 8;
        }

        empHours += shiftHours;
        totalHours += shiftHours;

        // Calculate wages for this shift (only if hourly rate is available)
        if (hourlyRate !== null) {
          const shiftWages = shiftHours * hourlyRate;
          totalWages += shiftWages;
        }
      });

      // Calculate overtime (hours over contract hours)
      if (
        contractHours !== null &&
        hourlyRate !== null &&
        empHours > contractHours
      ) {
        const overtimeHours = empHours - contractHours;
        totalOvertimeHours += overtimeHours;
        // Overtime cost is 1x regular rate
        totalOvertimeCost += overtimeHours * hourlyRate * 1.0;
      }

      employeeHours[empId] = empHours;
    });

    // Update employee hours
    const updatedEmployees = employees.map((emp) => {
      if (!emp || !emp.id) return emp;

      const hours = employeeHours[emp.id] || 0;
      const formattedHours = `${Math.floor(hours)}h ${
        Math.round((hours % 1) * 60) > 0
          ? `${Math.round((hours % 1) * 60)}min`
          : ""
      }`.trim();

      return {
        ...emp,
        hours: formattedHours,
      };
    });

    setEmployees(updatedEmployees);

    // Format totals
    const formattedHours = `${Math.floor(totalHours)}h ${
      Math.round((totalHours % 1) * 60) > 0
        ? `${Math.round((totalHours % 1) * 60)}min`
        : ""
    }`.trim();

    const formattedOtHours = `${Math.floor(totalOvertimeHours)}h ${
      Math.round((totalOvertimeHours % 1) * 60) > 0
        ? `${Math.round((totalOvertimeHours % 1) * 60)}min`
        : ""
    }`.trim();

    const estimatedWages = `$${totalWages.toFixed(2)}`;
    const overtimeCost =
      totalOvertimeCost > 0 ? `$${totalOvertimeCost.toFixed(2)}` : "$0.00";

    // Calculate labor percentage (assuming $1000 weekly budget as baseline)
    const weeklyBudget = 1000;
    const laborPercent =
      totalWages > 0
        ? `${((totalWages / weeklyBudget) * 100).toFixed(1)}%`
        : "N/A";

    setStats({
      totalShifts,
      scheduledHours: formattedHours || "0h",
      estWages: estimatedWages,
      otCost: overtimeCost,
      otHours: formattedOtHours || "0h",
      laborPercent,
      absences: 0, // This would need to be calculated from actual absence data
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
    // Reset time to start of day for comparison
    dayDate.setHours(0, 0, 0, 0);

    console.log(
      `Getting availabilities for employee ${employeeId} on day ${day}`,
      {
        dayDate: dayDate.toDateString(),
        availabilities: employeeAvailabilities[employeeId],
      }
    );

    const availabilities = employeeAvailabilities[employeeId].filter(
      (availability) => {
        const availStartDate = parseTimestamp(availability.startTime);
        const availEndDate = parseTimestamp(availability.endTime);

        if (!availStartDate || !availEndDate) {
          console.warn("Invalid availability dates:", availability);
          return false;
        }

        // Check if the availability date matches this specific day
        const availStartDay = new Date(availStartDate);
        availStartDay.setHours(0, 0, 0, 0);

        console.log(
          `Comparing availability date ${availStartDay.toDateString()} with day ${dayDate.toDateString()}`
        );

        // Check if the availability starts on this day
        const isOnThisDay = availStartDay.getTime() === dayDate.getTime();

        if (isOnThisDay) {
          console.log(`Found availability for day ${day}:`, {
            startTime: availStartDate.toLocaleTimeString(),
            endTime: availEndDate.toLocaleTimeString(),
          });
        }

        return isOnThisDay;
      }
    );

    return availabilities;
  };

  // Enhanced shift cell rendering
  const renderShiftCell = (employeeId, day) => {
    const shift = getShiftForDay(employeeId, day);
    const availabilities = getAvailabilitiesForDay(employeeId, day);
    const isToday = isDateToday(
      new Date(currentWeekStart.getTime() + day * 24 * 60 * 60 * 1000)
    );

    // Debug logging for availability display
    if (availabilities && availabilities.length > 0) {
      console.log(
        `Rendering shift cell for employee ${employeeId}, day ${day} with ${availabilities.length} availabilities:`,
        availabilities
      );
    }

    return (
      <div
        className={`h-full w-full flex flex-col relative min-h-[5rem] p-2 transition-all duration-200 ${
          isToday ? "bg-blue-50/30" : ""
        }`}
      >
        {/* Display availabilities in top section */}
        {availabilities && availabilities.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-2">
            {availabilities.map((availability, index) => {
              // Parse timestamps first
              const startTimeDate = parseTimestamp(availability.startTime);
              const endTimeDate = parseTimestamp(availability.endTime);

              // Skip invalid dates
              if (!startTimeDate || !endTimeDate) {
                console.error("Invalid date in availability:", availability);
                return null;
              }

              const timeStr = `${formatTime(startTimeDate)}-${formatTime(
                endTimeDate
              )}`;

              return (
                <div
                  key={`avail-${index}`}
                  className="bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-300 rounded-md px-2 py-1 text-xs text-emerald-800 hover:from-emerald-100 hover:to-emerald-200 shadow-sm transition-all duration-200 cursor-help"
                  title={`Available: ${timeStr}`}
                >
                  <Clock className="w-3 h-3 inline mr-1" />
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
              positionColors[shift.position] ||
              "bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300 text-slate-800"
            } border-2 rounded-lg p-3 text-sm relative cursor-pointer shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105 group`}
            onClick={(e) => {
              e.stopPropagation();
              openShiftModal(employeeId, day, shift);
            }}
          >
            {/* Shift Details */}
            <div className="font-semibold mb-1">
              {formatShiftDisplay(shift)}
            </div>
            <div className="text-xs opacity-75 mb-1">{shift.position}</div>
            <div className="text-xs font-medium">{shift.duration}</div>

            {/* Delete Button - Only show when schedule is not published */}
            {!isSchedulePublished && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteShift(employeeId, shift.id);
                }}
                className="absolute top-1 right-1 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded-full p-1 transition-all duration-200"
                title="Delete shift"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {/* Add empty area for creating new shifts */}
        {!shift && (
          <div
            className={`h-full w-full cursor-${
              isSchedulePublished ? "default" : "pointer"
            } border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 group`}
            onClick={() =>
              !isSchedulePublished && openShiftModal(employeeId, day)
            }
          >
            {!isSchedulePublished && (
              <div className="text-slate-400 group-hover:text-slate-600 transition-colors duration-200">
                <Plus className="w-6 h-6 mx-auto mb-1" />
                <div className="text-xs font-medium">Add Shift</div>
              </div>
            )}
          </div>
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
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Loading Schedule
            </h3>
            <p className="text-slate-600">
              Please wait while we fetch your schedule data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && employees.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md">
            <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              Error Loading Data
            </h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
              onClick={() => {
                setError(null);
                fetchEmployees();
                fetchScheduleForWeek(currentWeekStart);
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Professional Navigation & Action Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        {/* Primary Navigation Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center px-6 py-4 space-y-4 lg:space-y-0">
          {/* Left: Navigation Controls */}
          <div className="flex items-center space-x-6">
            {/* Week Navigation */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 shadow-inner">
              <button
                className="px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-all duration-200 flex items-center shadow-sm hover:shadow-md"
                onClick={goToPreviousWeek}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="px-4 py-2 text-slate-800 font-semibold text-sm lg:text-base bg-white rounded-lg shadow-sm mx-1 min-w-0">
                <div className="text-center">
                  <div className="font-bold text-slate-900">
                    {formatDateRange()}
                  </div>
                  <div className="text-xs text-slate-500 font-normal">
                    Week Schedule
                  </div>
                </div>
              </div>
              <button
                className="px-3 py-2 text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-all duration-200 flex items-center shadow-sm hover:shadow-md"
                onClick={goToNextWeek}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Today Button */}
            <button
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
              onClick={goToToday}
            >
              <Calendar size={16} className="inline mr-2" />
              Today
            </button>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center space-x-3 w-full lg:w-auto">
            {/* Export Actions */}
            <div className="flex items-center space-x-2 bg-slate-50 rounded-lg p-1">
              <button
                className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-md flex items-center text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={exportToPDF}
                title="Export PDF"
              >
                <FileText size={14} className="mr-1.5" />
                PDF
              </button>
              <button
                className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-md flex items-center text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                onClick={exportToExcel}
                title="Export Excel"
              >
                <Download size={14} className="mr-1.5" />
                CSV
              </button>
            </div>

            {/* Primary Action Button */}
            {!currentScheduleId && (
              <button
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-lg flex items-center font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={saveScheduleDraft}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Plus size={16} className="mr-2" />
                )}
                <span>{isSaving ? "Creating..." : "Create Schedule"}</span>
              </button>
            )}

            {currentScheduleId && !isSchedulePublished && (
              <button
                className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg flex items-center font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={publishSchedule}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <CheckCircle size={16} className="mr-2" />
                )}
                <span>{isSaving ? "Publishing..." : "Publish"}</span>
              </button>
            )}

            {currentScheduleId && isSchedulePublished && (
              <button
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg flex items-center font-medium transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={editPublishedSchedule}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Edit2 size={16} className="mr-2" />
                )}
                <span>{isSaving ? "Processing..." : "Edit"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Restaurant Info - Subtle Bottom Bar */}
        {user && (
          <div className="px-6 py-2 bg-slate-50 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Building2 size={12} />
                  <span>{user.businessUnitName || "Restaurant"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>•</span>
                  <span>ID: {getRestaurantId()}</span>
                </div>
              </div>
              <div className="text-slate-400">Schedule Management System</div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Published Schedule Indicator */}
      {isSchedulePublished && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-amber-400 px-6 py-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-amber-800 text-sm">
                  Published Schedule
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  Live
                </span>
              </div>
              <p className="text-amber-700 text-sm mt-1">
                This schedule is live and visible to all employees. Use the
                'Edit Schedule' button to make changes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Position Legend & Info */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          {/* Position Colors */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center text-sm font-medium text-slate-700">
              <Layout className="w-4 h-4 mr-2 text-slate-500" />
              Position Types:
            </div>
            <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full mr-2 shadow-sm"></div>
              <span className="text-blue-800 font-medium text-sm">Waiter</span>
            </div>
            <div className="flex items-center bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full mr-2 shadow-sm"></div>
              <span className="text-purple-800 font-medium text-sm">
                Bartender
              </span>
            </div>
            <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full mr-2 shadow-sm"></div>
              <span className="text-emerald-800 font-medium text-sm">
                Cleaner
              </span>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center text-sm font-medium text-slate-700">
              <Users className="w-4 h-4 mr-2 text-slate-500" />
              Status:
            </div>
            <div className="flex items-center bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <div className="w-3 h-3 bg-gradient-to-r from-red-400 to-red-500 rounded-full mr-2 shadow-sm"></div>
              <span className="text-red-800 font-medium text-sm">
                Former Employee
              </span>
            </div>
            <div className="flex items-center bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
              <Clock className="w-3 h-3 text-emerald-600 mr-2" />
              <span className="text-emerald-800 font-medium text-sm">
                Available Time
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Professional Stats Dashboard - One Row */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-6">
          {/* Stats Title */}
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-slate-800 mb-1">
              Weekly Overview
            </h3>
            <p className="text-sm text-slate-600">
              Schedule metrics and cost analysis
            </p>
          </div>

          {/* Single Row Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Estimated Wages */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900">
                    {stats.estWages}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Est. Wages
                  </div>
                </div>
              </div>
            </div>

            {/* Scheduled Hours */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900">
                    {stats.scheduledHours}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Scheduled Hours
                  </div>
                </div>
              </div>
            </div>

            {/* OT Hours */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900">
                    {stats.otHours}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    OT Hours
                  </div>
                </div>
              </div>
            </div>

            {/* Overtime Cost */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900">
                    {stats.otCost}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    OT Cost
                  </div>
                </div>
              </div>
            </div>

            {/* Total Shifts */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-slate-900">
                    {stats.totalShifts}
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    Total Shifts
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Schedule Grid - No Separate Scrolling */}
      <div className="flex-grow w-full bg-white">
        {/* Schedule Section Header */}
        <div className="bg-white border-b border-slate-300 px-6 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              Weekly Schedule
            </h3>
            <div className="text-sm text-slate-500">
              Drag shifts to reschedule • Click to edit details
            </div>
          </div>
        </div>

        <div className="w-full">
          {/* Enhanced Day Headers */}
          <div className="grid grid-cols-8 border-b-2 border-slate-300 bg-gradient-to-r from-slate-100 to-slate-200 shadow-md">
            {/* Ultra Compact Employee Column Header */}
            <div className="p-1 md:p-2 font-semibold text-slate-700 border-r border-slate-300 w-16 md:w-24 lg:w-32 min-w-[4rem] md:min-w-[6rem] lg:min-w-[8rem] bg-slate-200">
              <div className="flex flex-col">
                <div className="text-xs font-bold text-slate-800 truncate">
                  TEAM
                </div>
                <div className="text-[10px] text-slate-500 font-normal truncate hidden md:block">
                  Hours & Rate
                </div>
              </div>
            </div>

            {/* Day Headers */}
            {daysOfWeek.map((day, i) => {
              const isToday = isDateToday(
                new Date(currentWeekStart.getTime() + i * 24 * 60 * 60 * 1000)
              );
              return (
                <div
                  key={day}
                  className={`p-4 text-center border-r border-slate-300 transition-all duration-200 hover:bg-slate-300 ${
                    isToday
                      ? "bg-gradient-to-b from-blue-200 to-blue-100 border-blue-300"
                      : "bg-gradient-to-b from-slate-100 to-slate-50"
                  }`}
                >
                  <div
                    className={`font-bold text-sm mb-1 ${
                      isToday ? "text-blue-700" : "text-slate-600"
                    }`}
                  >
                    {day}
                  </div>
                  <div
                    className={`font-bold text-lg ${
                      isToday ? "text-blue-800" : "text-slate-800"
                    }`}
                  >
                    {columnDates[i]}
                  </div>
                  {isToday && (
                    <div className="text-xs text-blue-600 font-medium mt-1 bg-blue-100 px-2 py-1 rounded-full">
                      TODAY
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Enhanced Employee Rows or No Schedule Message */}
          {!currentScheduleId ? (
            <div className="flex flex-col items-center justify-center p-12 lg:p-16 text-center">
              <div className="bg-slate-100 rounded-full p-6 mb-6">
                <Calendar className="w-12 h-12 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No Schedule Available
              </h3>
              <p className="text-slate-500 mb-6 max-w-md">
                No schedule found for this week. Create a new schedule to start
                managing shifts and assignments.
              </p>
              <button
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl flex items-center font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
                onClick={saveScheduleDraft}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : (
                  <Plus size={18} className="mr-2" />
                )}
                <span>{isSaving ? "Creating..." : "Create Schedule"}</span>
              </button>
            </div>
          ) : getEmployeesToDisplayForWeek().length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 lg:p-16 text-center">
              <div className="bg-amber-100 rounded-full p-6 mb-6">
                <Users className="w-12 h-12 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                No Employees Found
              </h3>
              <p className="text-slate-500 mb-2 max-w-md">
                No employees have shifts this week and no current employees are
                assigned to business unit ID: {getRestaurantId()}
              </p>
              <p className="text-sm text-slate-400 max-w-md">
                Please add employees to this business unit or create shifts to
                see the schedule.
              </p>
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
                      className={`grid grid-cols-8 border-b border-slate-200 hover:bg-slate-50 transition-all duration-200 text-sm group ${
                        employee.isGhost ? "bg-red-50/50" : ""
                      }`}
                    >
                      {/* Ultra Compact Employee Info */}
                      <div
                        className={`p-1 md:p-2 border-r border-slate-200 w-16 md:w-24 lg:w-32 min-w-[4rem] md:min-w-[6rem] lg:min-w-[8rem] sticky left-0 z-10 transition-all duration-200 ${
                          employee.isGhost
                            ? "bg-red-50/50"
                            : "bg-white group-hover:bg-slate-50"
                        }`}
                      >
                        {/* Employee Details */}
                        <div className="w-full">
                          {/* Name and Status */}
                          <div className="flex flex-col mb-1">
                            <div
                              className={`font-semibold text-xs truncate leading-tight ${
                                employee.isCurrentUser
                                  ? "text-blue-700"
                                  : employee.isGhost
                                  ? "text-red-600"
                                  : "text-slate-800"
                              }`}
                            >
                              {employee.name || "Unknown"}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {employee.isCurrentUser && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                  You
                                </span>
                              )}
                              {employee.isGhost && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                  Ex
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Compact Info Grid - Only show on md screens and up */}
                          <div className="hidden md:block text-[10px] space-y-0.5">
                            {/* Contract Hours */}
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 truncate">
                                Contract:
                              </span>
                              <span className="font-medium text-slate-700 ml-1">
                                {employee.contractHours
                                  ? `${employee.contractHours}h`
                                  : "N/A"}
                              </span>
                            </div>

                            {/* Hourly Rate */}
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 truncate">
                                Rate:
                              </span>
                              <span className="font-medium text-emerald-600 ml-1">
                                {employee.hourlyPayment
                                  ? `$${employee.hourlyPayment.toFixed(2)}`
                                  : "N/A"}
                              </span>
                            </div>

                            {/* Break Duration */}
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 truncate">
                                Break:
                              </span>
                              <span className="font-medium text-slate-600 ml-1">
                                {employee.breakDurationMinutes
                                  ? `${employee.breakDurationMinutes}min`
                                  : "N/A"}
                              </span>
                            </div>

                            {/* Scheduled Hours - Only show if we have contract hours */}
                            {employee.contractHours && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 truncate">
                                  Sched:
                                </span>
                                {(() => {
                                  const scheduledHours =
                                    calculateScheduledHours(employee.id);
                                  const contractHours = employee.contractHours;

                                  let colorClass = "text-slate-600";
                                  if (scheduledHours < contractHours) {
                                    colorClass = "text-red-600";
                                  } else if (scheduledHours > contractHours) {
                                    colorClass = "text-emerald-600";
                                  }

                                  return (
                                    <span
                                      className={`font-semibold ml-1 ${colorClass}`}
                                    >
                                      {scheduledHours}h
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>

                          {/* Mobile-only minimal info */}
                          <div className="md:hidden text-[9px] text-slate-500">
                            {employee.contractHours
                              ? `${employee.contractHours}h`
                              : "N/A"}{" "}
                            •
                            {employee.hourlyPayment
                              ? `$${employee.hourlyPayment.toFixed(2)}`
                              : "N/A"}{" "}
                            •
                            {employee.breakDurationMinutes
                              ? `${employee.breakDurationMinutes}min`
                              : "N/A"}
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Shift Cells */}
                      {Array.from({ length: 7 }, (_, day) => {
                        const isToday = isDateToday(
                          new Date(
                            currentWeekStart.getTime() +
                              day * 24 * 60 * 60 * 1000
                          )
                        );
                        return (
                          <div
                            key={day}
                            className={`border-r border-slate-200 relative min-h-[6rem] transition-all duration-200 ${
                              isToday ? "bg-blue-50/20" : ""
                            }`}
                          >
                            {renderShiftCell(employee.id, day)}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 transform transition-all duration-300 scale-100">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-2xl px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                {currentShift.id.includes("new") ? (
                  <>
                    <Plus className="w-5 h-5 mr-2 text-emerald-600" />
                    Create New Shift
                  </>
                ) : (
                  <>
                    <Edit2 className="w-5 h-5 mr-2 text-blue-600" />
                    Edit Shift
                  </>
                )}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {currentShift.id.includes("new")
                  ? "Add a new shift to the schedule"
                  : "Modify the existing shift details"}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Employee Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  <Users className="w-4 h-4 mr-2 text-slate-500" />
                  Employee
                </label>
                <select
                  className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
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
                      const nameA = (
                        a.name || "Unknown Employee"
                      ).toLowerCase();
                      const nameB = (
                        b.name || "Unknown Employee"
                      ).toLowerCase();
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

              {/* Position Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                  <Briefcase className="w-4 h-4 mr-2 text-slate-500" />
                  Position
                </label>
                <select
                  className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                  value={currentShift.position}
                  onChange={(e) =>
                    setCurrentShift({
                      ...currentShift,
                      position: e.target.value,
                    })
                  }
                >
                  {positions.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-slate-500" />
                    Start Time
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    placeholder="e.g. 08:00"
                    value={currentShift.startTime}
                    onChange={(e) => {
                      // Time validation and formatting logic (keeping existing logic)
                      let inputValue = e.target.value;
                      inputValue = inputValue.replace(/[^0-9:]/g, "");

                      if (inputValue) {
                        const numbers = inputValue.replace(/[^0-9]/g, "");

                        if (numbers.length >= 1) {
                          if (numbers.length === 1) {
                            inputValue = numbers;
                          } else {
                            const hours = parseInt(numbers.substring(0, 2));

                            if (hours > 23) {
                              inputValue = "23";
                            } else {
                              inputValue =
                                hours < 10 ? "0" + hours : hours.toString();
                            }

                            if (numbers.length >= 3) {
                              inputValue += ":";

                              if (numbers.length >= 3) {
                                const firstMinDigit = numbers.substring(2, 3);
                                inputValue += firstMinDigit;

                                if (numbers.length >= 4) {
                                  const secondMinDigit = numbers.substring(
                                    3,
                                    4
                                  );
                                  inputValue += secondMinDigit;
                                }
                              }
                            }
                          }
                        }
                      }

                      const startTime = inputValue;
                      let endTime = currentShift.endTime;
                      let duration = currentShift.duration;

                      if (
                        /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) &&
                        /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)
                      ) {
                        try {
                          const [startHour, startMin] = startTime
                            .split(":")
                            .map((num) => parseInt(num));
                          const [endHour, endMin] = endTime
                            .split(":")
                            .map((num) => parseInt(num));

                          let durationHours = endHour - startHour;
                          let durationMinutes = endMin - startMin;

                          if (durationHours < 0) {
                            durationHours += 24;
                          }

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
                      <div className="text-red-500 text-xs mt-2 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Please use 24-hour format (00:00 - 23:59)
                      </div>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-slate-500" />
                    End Time
                  </label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-200 rounded-lg p-3 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200"
                    placeholder="e.g. 17:00"
                    value={currentShift.endTime}
                    onChange={(e) => {
                      // Similar time validation logic for end time (keeping existing logic)
                      let inputValue = e.target.value;
                      inputValue = inputValue.replace(/[^0-9:]/g, "");

                      if (inputValue) {
                        const numbers = inputValue.replace(/[^0-9]/g, "");

                        if (numbers.length >= 1) {
                          if (numbers.length === 1) {
                            inputValue = numbers;
                          } else {
                            const hours = parseInt(numbers.substring(0, 2));

                            if (hours > 23) {
                              inputValue = "23";
                            } else {
                              inputValue =
                                hours < 10 ? "0" + hours : hours.toString();
                            }

                            if (numbers.length >= 3) {
                              inputValue += ":";

                              if (numbers.length >= 3) {
                                const firstMinDigit = numbers.substring(2, 3);
                                inputValue += firstMinDigit;

                                if (numbers.length >= 4) {
                                  const secondMinDigit = numbers.substring(
                                    3,
                                    4
                                  );
                                  inputValue += secondMinDigit;
                                }
                              }
                            }
                          }
                        }
                      }

                      const endTime = inputValue;
                      const startTime = currentShift.startTime;
                      let duration = currentShift.duration;

                      if (
                        /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(startTime) &&
                        /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(endTime)
                      ) {
                        try {
                          const [startHour, startMin] = startTime
                            .split(":")
                            .map((num) => parseInt(num));
                          const [endHour, endMin] = endTime
                            .split(":")
                            .map((num) => parseInt(num));

                          let durationHours = endHour - startHour;
                          let durationMinutes = endMin - startMin;

                          if (durationHours < 0) {
                            durationHours += 24;
                          }

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
                      <div className="text-red-500 text-xs mt-2 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Please use 24-hour format (00:00 - 23:59)
                      </div>
                    )}
                </div>
              </div>

              {/* Duration Display */}
              {currentShift.duration && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center text-sm text-slate-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="font-medium">Duration: </span>
                    <span className="ml-1 font-bold text-slate-800">
                      {currentShift.duration}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 rounded-b-2xl px-6 py-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                {/* Delete Button - Only for existing shifts */}
                {!currentShift.id.includes("new") && (
                  <button
                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg flex items-center justify-center font-medium transition-all duration-200 shadow-md hover:shadow-lg"
                    onClick={() => {
                      deleteShift(currentShift.employeeId, currentShift.id);
                    }}
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete Shift
                  </button>
                )}

                {/* Action Buttons */}
                <div className="flex ml-auto space-x-3">
                  <button
                    className="border-2 border-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-medium"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center"
                    onClick={saveShift}
                  >
                    <Save size={16} className="mr-2" />
                    {currentShift.id.includes("new")
                      ? "Create Shift"
                      : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleApp;
