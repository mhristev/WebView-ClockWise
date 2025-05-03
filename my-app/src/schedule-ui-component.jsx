import React, { useState, useEffect } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart2,
  Plus,
  Edit2,
  Trash2,
  Users,
  MapPin,
  Briefcase,
  Layout,
  Save,
} from "lucide-react";
import "./index.css";
import { useAuth } from "./auth/AuthContext";

// Define API base URL - use a hardcoded fallback for development
const API_BASE_URL = "http://localhost:8888/v1";

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

  // Get epoch seconds which are timezone-neutral
  const startTimestamp = Math.floor(startDate.getTime() / 1000);
  const endTimestamp = Math.floor(endDate.getTime() / 1000);

  console.log(
    `Creating shift with times: Start=${startTimeStr} → ${startTimestamp}, End=${endTimeStr} → ${endTimestamp}, Position=${position}`
  );

  // Log ISO strings for debugging
  console.log("ISO strings:", {
    startDateISO: startDate.toISOString(),
    endDateISO: endDate.toISOString(),
  });

  return {
    scheduleId,
    employeeId,
    startTime: startTimestamp,
    endTime: endTimestamp,
    position: position,
  };
};

function ScheduleApp() {
  // Get auth context
  const { user, getAuthHeaders, getRestaurantId, logout } = useAuth();

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

  const positions = ["Server", "Cook", "Host"];

  // Position colors
  const positionColors = {
    Server: "bg-blue-100 border-blue-300",
    Cook: "bg-yellow-100 border-yellow-300",
    Host: "bg-red-100 border-red-300",
  };

  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // Helper function to get Monday of a given week
  function getMonday(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
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
    setIsLoading(true);
    try {
      // Using the endpoint to get users for a specific business unit
      const restaurantId = getRestaurantId();
      const response = await fetch(
        `http://localhost:8081/v1/users/restaurant/${restaurantId}`,
        { headers: getAuthHeaders() }
      );
      console.log("User response", response);
      if (!response.ok) {
        if (response.status === 401) {
          // Handle unauthorized - token might be expired
          logout();
          throw new Error("Session expired. Please login again.");
        }
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Employee data from API:", data);

      // Transform the user data to match our employee structure
      const formattedEmployees = data.map((user) => ({
        id: String(user.id), // Ensure ID is a string for consistent comparisons
        name:
          `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
          user.username ||
          "Unknown", // Format as firstName lastName, fallback to username
        email: user.email,
        hourlyRate: "$0.00", // Default value, could be fetched from another endpoint
        hours: "0h", // Default value, will be calculated based on shifts
        role: user.role,
        businessUnitId: user.businessUnitId,
        businessUnitName: user.businessUnitName,
      }));

      console.log("Formatted employees:", formattedEmployees);

      // Check for duplicate IDs before setting state
      const uniqueEmployees = [];
      const employeeIds = new Set();

      formattedEmployees.forEach((emp) => {
        if (!employeeIds.has(emp.id)) {
          employeeIds.add(emp.id);
          uniqueEmployees.push(emp);
        } else {
          console.warn(
            `Duplicate employee ID detected: ${emp.id}. Skipping duplicate.`
          );
        }
      });

      console.log("Unique employees to set:", uniqueEmployees);
      setEmployees(uniqueEmployees);
      setIsLoading(false);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setError(err.message);
      setIsLoading(false);

      // Fallback to sample data if API fails
      const sampleEmployees = [
        {
          id: "AT",
          name: "Ahsoka Tano",
          hourlyRate: "$330.00",
          hours: "16h 30min",
        },
        { id: "AS", name: "Arya Stark", hourlyRate: "$0.00", hours: "11h" },
        {
          id: "DT",
          name: "Danny Targeryen",
          hourlyRate: "$0.00",
          hours: "11h",
        },
      ];
      setEmployees(sampleEmployees);
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
      const response = await fetch(
        `${API_BASE_URL}/business-units/${businessUnitId}/availabilities?startDate=${startDateStr}&endDate=${endDateStr}`,
        { headers: getAuthHeaders() }
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
      const restaurantId = getRestaurantId();

      // Format the current week start date properly
      const weekStart = new Date(currentWeekStart);

      // Format the date consistently for API - use full ISO string
      const dateString = weekStart.toISOString();
      console.log(`Creating schedule for week: ${dateString}`);

      // Create schedule first
      const scheduleResponse = await fetch(`${API_BASE_URL}/schedules`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId,
          weekStart: dateString,
          status: "DRAFT",
        }),
      });

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

        const savePromise = fetch(`${API_BASE_URL}/shifts`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
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
      const response = await fetch(
        `${API_BASE_URL}/schedules/${currentScheduleId}/draft`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
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
      const response = await fetch(
        `${API_BASE_URL}/schedules/${currentScheduleId}/publish`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
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
    fetchEmployees();
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
      fetch(`${API_BASE_URL}/schedules/${currentScheduleId}/shifts`)
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
        position: "Server",
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

        // Format the date consistently for API
        const dateString = weekStart.toISOString();

        // Create schedule request
        const scheduleRequest = {
          restaurantId: getRestaurantId(),
          weekStart: dateString,
        };

        // Save the schedule first
        const scheduleResponse = await fetch(`${API_BASE_URL}/schedules`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
          },
          body: JSON.stringify(scheduleRequest),
        });

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
          ? `${API_BASE_URL}/shifts/${currentShift.backendId}`
          : `${API_BASE_URL}/shifts`;

      const method =
        existingShiftIndex >= 0 && currentShift.backendId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method: method,
        headers: {
          ...getAuthHeaders(),
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
        const response = await fetch(
          `${API_BASE_URL}/shifts/${shiftToDelete.backendId}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
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
      const restaurantId = getRestaurantId();
      console.log(`Fetching schedule for restaurant ID: ${restaurantId}`);

      // Format the weekStart date as ISO string for the API parameter
      const weekStartISO = formattedWeekStart.toISOString();

      console.log(`Using date string for API request: ${weekStartISO}`);

      // Use the correct endpoint format matching the backend implementation
      // GET /restaurants/{id}/schedules/week?weekStart=<dateTime>
      const response = await fetch(
        `${API_BASE_URL}/restaurants/${restaurantId}/schedules/week?weekStart=${weekStartISO}`,
        { headers: getAuthHeaders() }
      );

      console.log(`Schedule API response status: ${response.status}`);

      if (!response.ok) {
        console.warn(`No schedule found for week: ${response.status}`);
        setCurrentScheduleId(null);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      console.log("Schedule API response:", data);

      // Handle the schedule response
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

        // Immediately fetch shifts for this schedule
        console.log(`Fetching shifts for schedule ID: ${scheduleId}`);
        try {
          const shiftsResponse = await fetch(
            `${API_BASE_URL}/schedules/${scheduleId}/shifts`,
            { headers: getAuthHeaders() }
          );

          if (shiftsResponse.ok) {
            const shifts = await shiftsResponse.json();
            console.log(
              `Fetched ${shifts.length} shifts for schedule ID ${scheduleId}:`,
              shifts
            );

            if (shifts && shifts.length > 0) {
              await processShifts(shifts);
            } else {
              // Set empty shifts for this week if none were found
              const weekId = getWeekIdentifier(currentWeekStart);
              setWeeklySchedules((prev) => ({
                ...prev,
                [weekId]: {},
              }));
            }
          } else {
            console.error(
              `Failed to fetch shifts: ${shiftsResponse.status} - ${shiftsResponse.statusText}`
            );

            // If we get a 404, it might mean no shifts exist yet for this schedule
            if (shiftsResponse.status === 404) {
              console.log(
                "No shifts found for this schedule yet (404 response)"
              );
              const weekId = getWeekIdentifier(currentWeekStart);
              setWeeklySchedules((prev) => ({
                ...prev,
                [weekId]: {},
              }));
            }
          }
        } catch (shiftError) {
          console.error("Error fetching shifts:", shiftError);
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
        name: `Employee ${id}`, // Use a more user-friendly name for missing employees
        hourlyRate: "$0.00",
        hours: "0h",
        role: "Employee",
        businessUnitName: "Unknown Business",
      }));

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

  // Get availability for a specific employee on a specific day
  const getAvailabilitiesForDay = (employeeId, day) => {
    if (!employeeAvailabilities[employeeId]) return [];

    // Create a date object for the specific day in the current week
    const dayDate = new Date(currentWeekStart);
    // Add the day offset (0 = Monday, 6 = Sunday)
    dayDate.setDate(dayDate.getDate() + Number(day));
    // Reset time to start of day
    dayDate.setHours(0, 0, 0, 0);

    if (DEBUG_TIMEZONE) {
      console.log(
        `Checking availabilities for employee ${employeeId} on day ${day}, date: ${dayDate.toDateString()}`
      );
    }

    const availabilities = employeeAvailabilities[employeeId].filter(
      (availability) => {
        // Get the date from availability's start time, ignoring time part
        const availabilityDate = new Date(availability.startTime);
        availabilityDate.setHours(0, 0, 0, 0);

        // Compare just the dates (ignoring time)
        const match = availabilityDate.getTime() === dayDate.getTime();

        if (DEBUG_TIMEZONE && match) {
          console.log(
            `Found availability match: ${availabilityDate.toDateString()} (${formatTime(
              availability.startTime
            )}-${formatTime(availability.endTime)})`
          );
        }

        return match;
      }
    );

    if (DEBUG_TIMEZONE) {
      console.log(
        `Found ${
          availabilities.length
        } availabilities for day ${day} (${dayDate.toDateString()})`
      );
    }

    return availabilities;
  };

  // Using the formatTime function defined above for availability display

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
              <Edit2 size={16} className="mr-1" />
              {isSaving ? "Publishing..." : "Publish Schedule"}
            </button>
          )}

          {currentScheduleId && isSchedulePublished && (
            <button
              className="px-3 lg:px-4 py-1 lg:py-2 bg-blue-500 text-white rounded flex items-center text-xs lg:text-sm"
              onClick={editPublishedSchedule}
              disabled={isSaving}
            >
              <Edit2 size={16} className="mr-1" />
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
            <span>Server</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-yellow-100 border border-yellow-300 mr-1 rounded"></div>
            <span>Cook</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 lg:w-4 lg:h-4 bg-red-100 border border-red-300 mr-1 rounded"></div>
            <span>Host</span>
          </div>
        </div>
        <div className="flex flex-wrap space-x-2 lg:space-x-4">
          <div className="font-medium">Availability:</div>
          <div className="flex items-center">
            <div className="inline-block bg-green-50 border border-green-300 rounded px-1 py-0.5 text-[10px] text-green-800 mr-1">
              10:00-14:00
            </div>
            <span>Employee submitted availability</span>
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
            <div className="p-1 lg:p-2 font-medium text-gray-500 border-r w-16 md:w-20 lg:w-32 min-w-[4rem] md:min-w-[5rem] lg:min-w-[8rem]">
              SHIFTS
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
          ) : employees.length === 0 ? (
            <div className="text-center p-4 lg:p-8 text-gray-500">
              No employees found
            </div>
          ) : (
            <div className="overflow-x-auto">
              {employees.map((employee) => {
                return (
                  <div
                    key={employee.id}
                    className="grid grid-cols-8 border-b hover:bg-gray-50 text-[10px] sm:text-xs lg:text-sm"
                  >
                    {/* Employee Info */}
                    <div className="p-1 lg:p-2 border-r flex items-center w-16 md:w-20 lg:w-32 min-w-[4rem] md:min-w-[5rem] lg:min-w-[8rem] sticky left-0 bg-white z-10">
                      <div className="bg-gray-200 rounded-full h-5 w-5 md:h-6 md:w-6 lg:h-8 lg:w-8 flex items-center justify-center mr-1 text-[9px] sm:text-xs lg:text-sm shrink-0">
                        {employee.name
                          ?.split(" ")
                          .map((part) => part[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase() || "EE"}
                      </div>
                      <div className="truncate">
                        <div className="font-medium truncate text-[10px] sm:text-xs">
                          {employee.name || "Unknown Employee"}
                        </div>
                        <div className="text-[8px] sm:text-[10px] text-gray-500 hidden sm:block">
                          <span className="capitalize">
                            {employee.role?.toLowerCase() || "Staff"}
                          </span>{" "}
                          • {employee.hours}
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
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
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
