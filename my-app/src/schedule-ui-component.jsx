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
const API_BASE_URL = "http://localhost:8080/v1";

// Timezone information for debugging
const DEBUG_TIMEZONE = true; // Set to true to see timezone debugging logs
const TIMEZONE_OFFSET = new Date().getTimezoneOffset() / 60; // Get local timezone offset in hours

// Add a helper function that creates an ISO string without timezone conversion
const createTimeUnadjustedISOString = (date, timeString) => {
  // Extract hours and minutes from the time string (HH:MM format)
  const [hours, minutes] = timeString.split(":").map((num) => parseInt(num));

  // Create a copy of the date to avoid modifying the original
  const newDate = new Date(date);

  // Set the hours and minutes
  newDate.setHours(hours, minutes, 0, 0);

  // Get the date portions we need
  const year = newDate.getFullYear();
  const month = String(newDate.getMonth() + 1).padStart(2, "0");
  const day = String(newDate.getDate()).padStart(2, "0");

  // Create an ISO string but with the exact hours/minutes from user input
  // This bypasses JavaScript's automatic timezone conversion
  return `${year}-${month}-${day}T${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:00`;
};

// Update the createShiftRequest function to use our time-preserving approach
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

  // Create ISO strings without timezone adjustment
  const startISOString = createTimeUnadjustedISOString(shiftDate, startTimeStr);
  const endISOString = createTimeUnadjustedISOString(shiftDate, endTimeStr);

  // Check if end is before start (next day)
  const startHourNum = parseInt(startHour);
  const endHourNum = parseInt(endHour);
  const isNextDay =
    endHourNum < startHourNum ||
    (endHourNum === startHourNum && endMin < startMin);

  // If it's the next day, adjust the date part of the end time
  let finalEndISOString = endISOString;
  if (isNextDay) {
    const nextDay = new Date(shiftDate);
    nextDay.setDate(nextDay.getDate() + 1);
    finalEndISOString = createTimeUnadjustedISOString(nextDay, endTimeStr);
  }

  console.log(
    `Creating shift with preserved times: Start=${startTimeStr} → ${startISOString}, End=${endTimeStr} → ${finalEndISOString}, Position=${position}`
  );

  return {
    scheduleId,
    employeeId,
    startTime: startISOString,
    endTime: finalEndISOString,
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

  // Initialize component by fetching employees when mounted
  useEffect(() => {
    console.log("Initializing ScheduleApp - fetching employees");
    fetchEmployees();
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
        name: user.username,
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

  // Update the saveScheduleDraft function to use our time-preserving approach
  const saveScheduleDraft = async () => {
    setIsSaving(true);

    try {
      // Format the current week start date properly
      const weekStart = new Date(currentWeekStart);
      weekStart.setHours(0, 0, 0, 0);

      // Format the date consistently for API - use full ISO string
      const dateString = weekStart.toISOString();
      console.log(`Creating schedule for week: ${dateString}`);

      // Create schedule request with restaurant ID from user's business unit
      const scheduleRequest = {
        restaurantId: getRestaurantId(),
        weekStart: dateString,
      };

      // Save the schedule first with auth headers
      const scheduleResponse = await fetch(`${API_BASE_URL}/schedules`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: JSON.stringify(scheduleRequest),
      });

      if (!scheduleResponse.ok) {
        throw new Error(
          `Failed to save schedule: ${scheduleResponse.statusText}`
        );
      }

      const savedSchedule = await scheduleResponse.json();
      console.log("Successfully created schedule:", savedSchedule);

      // Store the schedule ID for later use
      setCurrentScheduleId(savedSchedule.id);

      // Now save all the shifts
      const weekId = getWeekIdentifier(currentWeekStart);
      const currentShifts = weeklySchedules[weekId] || {};

      // Create an array of promises for saving each shift
      const shiftPromises = [];

      Object.entries(currentShifts).forEach(([employeeId, shifts]) => {
        shifts.forEach((shift) => {
          // Create a date object for the shift day
          const shiftDate = new Date(currentWeekStart);
          shiftDate.setDate(shiftDate.getDate() + shift.day);

          // Create the shift request using our time-preserving function
          const shiftRequest = createShiftRequest(
            savedSchedule.id,
            employeeId,
            shiftDate,
            shift.startTime,
            shift.endTime,
            shift.position
          );

          console.log(
            `Adding shift to batch with preserved times: ${shift.startTime} - ${shift.endTime}`
          );
          console.log("Shift request:", shiftRequest);

          // Add the fetch promise to our array
          const shiftPromise = fetch(`${API_BASE_URL}/shifts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(shiftRequest),
          });

          shiftPromises.push(shiftPromise);
        });
      });

      // Wait for all shifts to be saved
      await Promise.all(shiftPromises);

      alert("Schedule saved successfully!");

      // Refresh the schedule data
      fetchScheduleForWeek(currentWeekStart);
    } catch (err) {
      console.error("Failed to save schedule:", err);
      alert(`Failed to save schedule: ${err.message}`);
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
    return weeklySchedules[weekId] || {};
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
    console.log(
      `Getting shift for employee ${employeeId} (type: ${typeof employeeId}) on day ${day}`
    );

    // Try multiple ID formats to ensure matching
    const stringEmployeeId = String(employeeId);
    const numericEmployeeId =
      employeeId && !isNaN(employeeId) ? Number(employeeId) : null;

    console.log(`Looking for shifts with employee IDs: 
      - String: "${stringEmployeeId}" (${typeof stringEmployeeId})
      - Numeric: ${numericEmployeeId} (${typeof numericEmployeeId})`);

    // Log what we're looking for in the current shifts
    console.log(`Current shifts keys:`, Object.keys(currentShifts));

    // Try all possible ID formats
    let employeeShifts = currentShifts[employeeId] || [];

    if (employeeShifts.length === 0 && stringEmployeeId) {
      employeeShifts = currentShifts[stringEmployeeId] || [];
      if (employeeShifts.length > 0) {
        console.log(`Found shifts using string ID "${stringEmployeeId}"`);
      }
    }

    if (employeeShifts.length === 0 && numericEmployeeId !== null) {
      employeeShifts = currentShifts[numericEmployeeId] || [];
      if (employeeShifts.length > 0) {
        console.log(`Found shifts using numeric ID ${numericEmployeeId}`);
      }
    }

    console.log(
      `Found ${employeeShifts.length} shifts for employee ${employeeId}`
    );

    if (employeeShifts.length > 0) {
      console.log("Available shifts:", employeeShifts);

      // Try to find the shift for this specific day
      const shift = employeeShifts.find((shift) => {
        // Ensure both are treated as numbers for comparison
        const shiftDay = Number(shift.day);
        const targetDay = Number(day);

        console.log(
          `Comparing shift day ${shiftDay} (${typeof shiftDay}) with target day ${targetDay} (${typeof targetDay})`
        );
        console.log(`Equal?: ${shiftDay === targetDay}`);

        return shiftDay === targetDay;
      });

      console.log(`Shift found for day ${day}:`, shift);

      if (!shift) {
        console.log(
          `No shift found for day ${day}. Available days:`,
          employeeShifts.map((shift) => shift.day)
        );
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

      // Format the date to ensure it's at midnight
      const formattedWeekStart = new Date(weekStart);
      formattedWeekStart.setHours(0, 0, 0, 0);

      console.log(
        `Fetching schedule for week starting: ${formattedWeekStart.toISOString()}`
      );

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
          }
        } catch (shiftError) {
          console.error("Error fetching shifts:", shiftError);
        }
      } else {
        console.log("No schedule found for the selected week");
        setCurrentScheduleId(null);
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
    if (shifts.length > 0) {
      console.log("First shift from API:", shifts[0]);
      console.log("Start time type:", typeof shifts[0].startTime);
      console.log("Start time value:", shifts[0].startTime);
    }

    // Make sure we have the employee data
    if (employees.length === 0) {
      await fetchEmployees();
    }

    // Log employee IDs for debugging
    console.log(
      "Available employee IDs:",
      employees.map((emp) => emp.id)
    );

    // Log shift employee IDs for debugging
    console.log(
      "Shift employee IDs:",
      shifts.map((shift) => shift.employeeId)
    );

    // Create map of employee IDs for faster lookup
    const employeeMap = {};
    employees.forEach((emp) => {
      if (emp && emp.id) {
        employeeMap[emp.id] = true;
        employeeMap[String(emp.id)] = true; // Also add string version
      }
    });

    console.log("Employee ID lookup map:", employeeMap);

    // Gather all unique employee IDs from shifts to add missing employees at once
    const missingEmployeeIds = new Set();

    // First, identify all missing employee IDs
    shifts.forEach((shift) => {
      const employeeId = shift.employeeId;
      console.log(
        `Checking if employee ID '${employeeId}' exists in our employee list`
      );
      console.log("employeeMap:", employeeMap);
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
        name: `Employee ${id}`,
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
      console.log(
        "Processing shift with dates:",
        shift.startTime,
        shift.endTime
      );

      let startTime, endTime;

      // Handle different date formats
      try {
        // Check if startTime is an array (the API format)
        if (Array.isArray(shift.startTime)) {
          console.log("Parsing startTime array:", shift.startTime);
          // Array format is [year, month, day, hour, minute]
          // Note: JS months are 0-indexed, so we subtract 1 from the month
          const [year, month, day, hour, minute] = shift.startTime;
          startTime = new Date(year, month - 1, day, hour, minute);
        } else if (typeof shift.startTime === "string") {
          console.log("Parsing startTime string:", shift.startTime);
          startTime = new Date(shift.startTime);
        } else if (shift.startTime instanceof Date) {
          startTime = shift.startTime;
        } else {
          console.error("Invalid startTime format:", shift.startTime);
          startTime = new Date(); // Fallback to current time
        }

        // Check if endTime is an array (the API format)
        if (Array.isArray(shift.endTime)) {
          console.log("Parsing endTime array:", shift.endTime);
          // Array format is [year, month, day, hour, minute]
          // Note: JS months are 0-indexed, so we subtract 1 from the month
          const [year, month, day, hour, minute] = shift.endTime;
          endTime = new Date(year, month - 1, day, hour, minute);
        } else if (typeof shift.endTime === "string") {
          endTime = new Date(shift.endTime);
        } else if (shift.endTime instanceof Date) {
          endTime = shift.endTime;
        } else {
          console.error("Invalid endTime format:", shift.endTime);
          endTime = new Date(); // Fallback to current time
        }

        console.log(
          "Parsed dates:",
          "startTime:",
          startTime.toISOString(),
          "endTime:",
          endTime.toISOString(),
          "startTime valid:",
          !isNaN(startTime.getTime()),
          "endTime valid:",
          !isNaN(endTime.getTime())
        );

        // Additional format debugging
        console.log("Date components:", {
          startYear: startTime.getFullYear(),
          startMonth: startTime.getMonth() + 1, // +1 for human-readable month
          startDay: startTime.getDate(),
          startDayOfWeek: startTime.getDay(),
          startHours: startTime.getHours(),
          startMinutes: startTime.getMinutes(),
        });

        // Skip shifts with invalid dates
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          console.error("Invalid date detected, skipping shift:", shift);
          return; // Skip this shift
        }
      } catch (e) {
        console.error("Error parsing shift dates:", e, shift);
        return; // Skip this shift
      }

      // Calculate the day of week (0-6) based on the start time
      const weekStartDay = new Date(currentWeekStart);

      console.log("Calculating day for shift:", shift.id);
      console.log("Shift date:", startTime.toDateString());
      console.log("Week start day:", weekStartDay.toDateString());

      // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
      const shiftDayOfWeek = startTime.getDay();

      // Convert from Sunday=0 to Monday=0 (our app uses Monday as first day)
      const adjustedDay = shiftDayOfWeek === 0 ? 6 : shiftDayOfWeek - 1;

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

      // Final day value (0 = Monday, 6 = Sunday)
      const day = adjustedDay;

      // Sanity check
      if (day < 0 || day > 6) {
        console.error("Invalid day calculated:", day);
        return; // Skip this shift
      }

      console.log(`Final day value for shift: ${day}`);

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

      console.log(`Created processed shift for day ${day}:`, processedShift);

      // Add to processed shifts
      if (!processedShifts[employeeId]) {
        processedShifts[employeeId] = [];
      }

      processedShifts[employeeId].push(processedShift);
    });

    console.log("Processed shifts by employee ID:", processedShifts);

    // Update the weekly schedules
    const weekId = getWeekIdentifier(currentWeekStart);

    console.log("---CRITICAL DEBUG---");
    console.log(
      "Before state update - current weeklySchedules:",
      weeklySchedules
    );
    console.log("Processed shifts to add:", processedShifts);
    console.log("Week ID being used:", weekId);

    // Create a new object with the updated data to ensure React detects the change
    const updatedWeeklySchedules = {
      ...weeklySchedules,
      [weekId]: processedShifts,
    };

    console.log("New state that will be set:", updatedWeeklySchedules);

    setWeeklySchedules(updatedWeeklySchedules);

    // Force a console log after the state should be updated
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

    // Update stats
    updateStats(processedShifts);
  };

  // Helper function to format time from Date object to "08:00" format
  const formatTime = (date) => {
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

    // Fetch the schedule (and then shifts) for the current week
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
      <div className="flex flex-wrap space-x-2 lg:space-x-4 px-2 lg:px-4 py-2 border-t text-xs lg:text-sm">
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

      {/* Stats Bar - fixed to prevent horizontal scrolling */}
      <div className="grid grid-cols-7 bg-gray-100 p-2 border-t border-b text-center text-xs">
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.estWages}
          </div>
          <div className="text-gray-500 truncate">WAGES</div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.otCost}
          </div>
          <div className="text-gray-500 truncate">OT COST</div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.scheduledHours}
          </div>
          <div className="text-gray-500 truncate">HOURS</div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.otHours}
          </div>
          <div className="text-gray-500 truncate">OT HRS</div>
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
        <div className="flex flex-col justify-center">
          <div className="text-gray-800 font-medium truncate">
            {stats.absences}
          </div>
          <div className="text-gray-500 truncate">ABS</div>
        </div>
        <div className="flex flex-col justify-center">
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
            <div className="p-1 lg:p-2 font-medium text-gray-500 border-r w-20 lg:w-32 min-w-20 lg:min-w-32">
              SHIFTS
            </div>
            {daysOfWeek.map((day, i) => (
              <div
                key={day}
                className="p-1 lg:p-2 text-center border-r bg-gray-50"
              >
                <div className="font-semibold text-gray-700">{day}</div>
                <div className="font-bold text-gray-900 text-base lg:text-lg">
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
                console.log(
                  `Rendering employee row for: ${employee.name} (ID: ${employee.id})`
                );

                // Get all shifts for this employee to check
                const weekId = getWeekIdentifier(currentWeekStart);
                const allWeekShifts = weeklySchedules[weekId] || {};
                const shiftsForEmployee =
                  allWeekShifts[String(employee.id)] || [];

                if (shiftsForEmployee.length > 0) {
                  console.log(
                    `Found ${shiftsForEmployee.length} shifts for employee ${employee.id} in current week`,
                    shiftsForEmployee
                  );
                } else {
                  console.log(
                    `No shifts found for employee ${employee.id} in current week. Available shifts:`,
                    allWeekShifts
                  );
                }

                return (
                  <div
                    key={employee.id}
                    className="grid grid-cols-8 border-b hover:bg-gray-50 text-xs lg:text-sm min-w-max lg:min-w-0"
                  >
                    {/* Employee Info */}
                    <div className="p-1 lg:p-2 border-r flex items-center w-20 lg:w-32 min-w-20 lg:min-w-32">
                      <div className="bg-gray-200 rounded-full h-6 w-6 lg:h-8 lg:w-8 flex items-center justify-center mr-1 lg:mr-2 text-xs lg:text-sm">
                        {employee.id?.substring(0, 2)?.toUpperCase() || "EE"}
                      </div>
                      <div className="truncate">
                        <div className="font-medium truncate">
                          {employee.name || "Unknown Employee"}
                        </div>
                        <div className="text-xs text-gray-500 hidden lg:block">
                          {employee.hours} • {employee.hourlyRate}
                        </div>
                      </div>
                    </div>

                    {/* Shifts */}
                    {(() => {
                      console.log(
                        `-----Rendering shifts row for employee ${employee.name} (ID: ${employee.id})-----`
                      );
                      console.log(`Employee ID type: ${typeof employee.id}`);

                      // Deep check of current week's shifts
                      const currentWeekShifts = getCurrentWeekShifts();
                      console.log(
                        "All current week shifts:",
                        currentWeekShifts
                      );

                      // Check if this employee has shifts in the current week
                      const employeeShifts =
                        currentWeekShifts[String(employee.id)];
                      console.log(
                        `Shifts for employee ${employee.id}:`,
                        employeeShifts
                      );

                      // Return the actual cells
                      return Array.from({ length: 7 }, (_, day) => {
                        console.log(
                          `Checking day ${day} for employee ${employee.id}`
                        );
                        const shift = getShiftForDay(employee.id, day);
                        console.log(
                          `getShiftForDay result for day ${day}:`,
                          shift
                        );

                        // Make sure shifts are being found correctly
                        if (employeeShifts) {
                          const shiftFromEmployeeShifts = employeeShifts.find(
                            (s) => s.day === day
                          );
                          console.log(
                            `Direct check for shift on day ${day}:`,
                            shiftFromEmployeeShifts
                          );
                          console.log(
                            `Shift match: ${shift === shiftFromEmployeeShifts}`
                          );
                        }

                        return (
                          <div
                            key={day}
                            className="p-2 border-r relative min-h-16 flex-1"
                          >
                            {shift ? (
                              <div
                                className={`cursor-${
                                  isSchedulePublished ? "default" : "pointer"
                                } w-full h-full`}
                                onClick={() =>
                                  !isSchedulePublished &&
                                  openShiftModal(employee.id, day, shift)
                                }
                              >
                                {console.log(
                                  `Rendering shift for employee ${employee.id} on day ${day}`,
                                  shift
                                )}
                                {formatShiftDisplay(shift)}
                              </div>
                            ) : (
                              <div
                                className={`h-full w-full cursor-${
                                  isSchedulePublished ? "default" : "pointer"
                                }`}
                                onClick={() =>
                                  !isSchedulePublished &&
                                  openShiftModal(employee.id, day)
                                }
                              ></div>
                            )}
                          </div>
                        );
                      });
                    })()}
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

            <div className="flex justify-between mt-6">
              {!currentShift.id.includes("new") && (
                <button
                  className="bg-red-500 text-white px-4 py-2 rounded flex items-center"
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
