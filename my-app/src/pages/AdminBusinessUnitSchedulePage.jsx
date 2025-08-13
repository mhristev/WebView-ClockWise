import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNotification } from "../components/NotificationContext";
import {
  API_ENDPOINTS_CONFIG,
  ORGANIZATION_BASE_URL,
  USER_BASE_URL,
  PLANNING_BASE_URL, // Re-add this import
} from "../config/api";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf"; // Re-add this import
import autoTable from "jspdf-autotable"; // Re-add this import
import { Building2, Filter } from "lucide-react";

const AdminBusinessUnitSchedulePage = () => {
  const { user, authenticatedFetch } = useAuth(); // Removed getRestaurantId
  const { showSuccess, showError, showWarning } = useNotification();

  // State for business units
  const [businessUnits, setBusinessUnits] = useState([]);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState(null);
  const [isLoadingBusinessUnits, setIsLoadingBusinessUnits] = useState(true);

  // State for schedule data
  const [employees, setEmployees] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    getMonday(new Date())
  );
  const [weeklySchedules, setWeeklySchedules] = useState({});
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [isSchedulePublished, setIsSchedulePublished] = useState(false);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Constants
  const daysOfWeek = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const positions = ["Waiter", "Bartender", "Cleaner"];
  const positionColors = {
    Waiter: "bg-blue-100 border-blue-300",
    Bartender: "bg-purple-100 border-purple-300",
    Cleaner: "bg-green-100 border-green-300",
  };

  // Helper function to get Monday of a given week
  function getMonday(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
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

  // Fetch all business units
  const fetchBusinessUnits = async () => {
    setIsLoadingBusinessUnits(true);
    setError(null);

    try {
      console.log("Fetching business units for admin view...");
      const response = await authenticatedFetch(
        `${ORGANIZATION_BASE_URL}/business-units`,
        {
          method: "GET",
        }
      );

      if (response.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch business units: ${response.status}`);
      }

      const data = await response.json();
      console.log("Fetched business units:", data);
      setBusinessUnits(data);

      // Auto-select first business unit if available
      if (data.length > 0 && !selectedBusinessUnit) {
        setSelectedBusinessUnit(data[0]);
      }
    } catch (error) {
      console.error("Error fetching business units:", error);
      setError(`Failed to load business units: ${error.message}`);
      setBusinessUnits([]);
    } finally {
      setIsLoadingBusinessUnits(false);
    }
  };

  // Fetch employees for selected business unit
  const fetchEmployeesForBusinessUnit = async (businessUnit) => {
    if (!businessUnit) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(
        `Fetching employees for business unit: ${businessUnit.name} (${businessUnit.id})`
      );

      const response = await authenticatedFetch(`${USER_BASE_URL}/users`, {
        method: "GET",
      });

      if (response.status === 401) {
        setError("Session expired. Please log in again.");
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Raw user data:", data);

      // Handle different response formats
      let userList = [];
      if (Array.isArray(data)) {
        userList = data;
      } else if (data.users && Array.isArray(data.users)) {
        userList = data.users;
      } else if (data.content && Array.isArray(data.content)) {
        userList = data.content;
      }

      // Filter employees by business unit
      const businessUnitEmployees = userList.filter(
        (emp) => emp.businessUnitId === businessUnit.id
      );

      console.log(
        `Found ${businessUnitEmployees.length} employees for business unit ${businessUnit.name}`
      );

      // Format employees for display
      const formattedEmployees = businessUnitEmployees.map((emp) => ({
        id: emp.id || emp.userId || `emp-${Math.random()}`,
        name:
          `${emp.firstName || ""} ${emp.lastName || ""}`.trim() ||
          emp.username ||
          "Unknown Employee",
        role: emp.role || "EMPLOYEE",
        hours: emp.workingHours || "40h/week",
        businessUnitName: emp.businessUnitName || businessUnit.name,
        isCurrentUser: user && emp.id === user.id,
        isGhost: false,
      }));

      // Sort employees alphabetically
      const sortedEmployees = formattedEmployees.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setEmployees(sortedEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError(`Failed to load employees: ${error.message}`);
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch schedule for selected business unit and week
  const fetchScheduleForWeek = async (weekStart, businessUnit) => {
    if (!businessUnit) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log(
        `Fetching schedule for ${
          businessUnit.name
        } for week starting: ${weekStart.toDateString()}`
      );
      console.log("Week start details:", {
        date: weekStart,
        iso: weekStart.toISOString(),
        dateString: weekStart.toDateString(),
        day: weekStart.getDay(),
        fullYear: weekStart.getFullYear(),
        month: weekStart.getMonth() + 1,
        dayOfMonth: weekStart.getDate(),
      });

      // Format the weekStart date as LocalDate string for the API
      const year = weekStart.getFullYear();
      const month = String(weekStart.getMonth() + 1).padStart(2, "0");
      const day = String(weekStart.getDate()).padStart(2, "0");
      const weekStartLocalDate = `${year}-${month}-${day}`;

      console.log(`Formatted weekStart for API: ${weekStartLocalDate}`);

      const apiUrl = `${PLANNING_BASE_URL}/business-units/${businessUnit.id}/schedules/week?weekStart=${weekStartLocalDate}`;
      console.log(`API URL: ${apiUrl}`);

      const response = await authenticatedFetch(apiUrl, { method: "GET" });

      console.log(`API Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        if (response.status === 404) {
          console.log("No schedule found for this week");
          setCurrentScheduleId(null);
          setIsSchedulePublished(false);
          // Set empty schedule for this week
          const weekId = getWeekIdentifier(currentWeekStart);
          setWeeklySchedules((prev) => ({
            ...prev,
            [weekId]: {},
          }));
          return;
        }
        throw new Error(`Failed to fetch schedule: ${response.status}`);
      }

      const data = await response.json();
      console.log("Schedule data:", data);

      if (data && data.id) {
        setCurrentScheduleId(data.id);
        setIsSchedulePublished(data.status === "PUBLISHED");

        // Process shifts if available
        if (data.shifts && data.shifts.length > 0) {
          console.log(`Processing ${data.shifts.length} shifts`);
          processShifts(data.shifts);
        } else {
          console.log("No shifts found in schedule");
          const weekId = getWeekIdentifier(currentWeekStart);
          setWeeklySchedules((prev) => ({
            ...prev,
            [weekId]: {},
          }));
        }
      } else {
        console.log("No schedule found for the selected week");
        setCurrentScheduleId(null);
        setIsSchedulePublished(false);
        const weekId = getWeekIdentifier(currentWeekStart);
        setWeeklySchedules((prev) => ({
          ...prev,
          [weekId]: {},
        }));
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
      setError(`Failed to load schedule: ${error.message}`);
      setCurrentScheduleId(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Process shifts from API response
  const processShifts = (shifts) => {
    console.log("Processing shifts:", shifts);
    console.log("Current week start:", currentWeekStart);

    const processedShifts = {};

    shifts.forEach((shift, index) => {
      const employeeId = shift.employeeId;

      if (!employeeId) {
        console.warn("Shift without employee ID:", shift);
        return;
      }

      console.log(`\n=== Processing Shift ${index + 1} ===`);
      console.log("Raw shift data:", shift);

      // Parse shift times with enhanced logging
      const startTime = parseTimestamp(shift.startTime);
      const endTime = parseTimestamp(shift.endTime);

      console.log(`Raw times for employee ${employeeId}:`, {
        rawStartTime: shift.startTime,
        rawEndTime: shift.endTime,
        parsedStartTime: startTime,
        parsedEndTime: endTime,
        startTimeISO: startTime ? startTime.toISOString() : "Invalid",
        endTimeISO: endTime ? endTime.toISOString() : "Invalid",
        startTimeLocal: startTime ? startTime.toLocaleString() : "Invalid",
        endTimeLocal: endTime ? endTime.toLocaleString() : "Invalid",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      // Validate parsed times
      if (
        !startTime ||
        !endTime ||
        isNaN(startTime.getTime()) ||
        isNaN(endTime.getTime())
      ) {
        console.error(`Invalid times for shift:`, {
          startTime: shift.startTime,
          endTime: shift.endTime,
          parsedStart: startTime,
          parsedEnd: endTime,
        });
        return;
      }

      // Calculate which day of the current week this shift belongs to
      // Get the date of the shift (without time)
      const shiftDate = new Date(startTime);
      shiftDate.setHours(0, 0, 0, 0);

      // Get the current week start date (without time)
      const weekStart = new Date(currentWeekStart);
      weekStart.setHours(0, 0, 0, 0);

      // Calculate the day index (0 = Monday, 1 = Tuesday, ..., 6 = Sunday)
      const dayDifference = Math.floor(
        (shiftDate - weekStart) / (1000 * 60 * 60 * 24)
      );

      console.log(`Day calculation for employee ${employeeId}:`, {
        shiftDate: shiftDate.toDateString(),
        weekStart: weekStart.toDateString(),
        dayDifference,
        calculatedDay: dayDifference,
        shiftDay: startTime.getDay(), // 0=Sunday, 1=Monday, etc.
        adjustedShiftDay: startTime.getDay() === 0 ? 6 : startTime.getDay() - 1, // Convert to 0=Monday
      });

      // Skip shifts that are not in the current week (dayDifference should be 0-6)
      if (dayDifference < 0 || dayDifference > 6) {
        console.warn(`Shift is outside current week range:`, {
          employeeId,
          shiftDate: shiftDate.toDateString(),
          weekStart: weekStart.toDateString(),
          dayDifference,
        });
        return;
      }

      // Format times for display with enhanced logging
      const formattedStartTime = formatTime(startTime);
      const formattedEndTime = formatTime(endTime);

      console.log(`Formatted times for employee ${employeeId}:`, {
        formattedStartTime,
        formattedEndTime,
        startHour: startTime.getHours(),
        startMinute: startTime.getMinutes(),
        endHour: endTime.getHours(),
        endMinute: endTime.getMinutes(),
      });

      // Calculate duration
      const durationMs = endTime - startTime;
      const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
      const durationMinutes = Math.floor(
        (durationMs % (1000 * 60 * 60)) / (1000 * 60)
      );
      const formattedDuration = `${durationHours}h ${
        durationMinutes > 0 ? `${durationMinutes}min` : ""
      }`.trim();

      console.log(`Duration calculation:`, {
        durationMs,
        durationHours,
        durationMinutes,
        formattedDuration,
      });

      // Create shift object
      const processedShift = {
        id: `shift-${employeeId}-${dayDifference}-${startTime.getTime()}`,
        backendId: shift.id,
        employeeId,
        day: dayDifference, // This should correctly map to 0-6 (Mon-Sun)
        startTime: formattedStartTime,
        endTime: formattedEndTime,
        duration: formattedDuration,
        position: shift.position || getRandomPosition(),
        business:
          shift.businessName || selectedBusinessUnit?.name || "Business",
        // Add raw times for debugging
        rawStartTime: shift.startTime,
        rawEndTime: shift.endTime,
      };

      console.log(
        `✅ Created processed shift for day ${dayDifference}:`,
        processedShift
      );

      if (!processedShifts[employeeId]) {
        processedShifts[employeeId] = [];
      }

      processedShifts[employeeId].push(processedShift);
    });

    console.log("\n=== Final Summary ===");
    console.log("Final processed shifts by employee:", processedShifts);

    // Log a summary of shifts per day
    const shiftsByDay = {};
    Object.values(processedShifts)
      .flat()
      .forEach((shift) => {
        if (!shiftsByDay[shift.day]) shiftsByDay[shift.day] = 0;
        shiftsByDay[shift.day]++;
      });
    console.log("Shifts per day:", shiftsByDay);

    // Update weekly schedules
    const weekId = getWeekIdentifier(currentWeekStart);
    setWeeklySchedules((prev) => ({
      ...prev,
      [weekId]: processedShifts,
    }));
  };

  // Helper function to parse timestamps from various formats
  const parseTimestamp = (timestamp) => {
    if (!timestamp) {
      console.warn("parseTimestamp called with null/undefined timestamp");
      return null;
    }

    if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === "number") {
      // Handle numeric timestamps (milliseconds or seconds)
      if (timestamp > 1000000000000) {
        // Milliseconds
        console.log("Parsing millisecond timestamp:", timestamp);
        return new Date(timestamp);
      } else {
        // Seconds
        console.log("Parsing second timestamp:", timestamp * 1000);
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
          console.log(
            "Parsing string millisecond timestamp:",
            numericTimestamp
          );
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
        const [year, month, day, hour, minute, second = 0, nano = 0] =
          timestamp;
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

  // Helper function to format time
  const formatTime = (dateTime) => {
    if (!dateTime) {
      console.warn("formatTime called with null/undefined dateTime");
      return "";
    }

    let date;
    if (typeof dateTime === "string") {
      date = new Date(dateTime);
    } else if (dateTime instanceof Date) {
      date = dateTime;
    } else {
      console.warn(
        "formatTime called with unsupported type:",
        typeof dateTime,
        dateTime
      );
      return "";
    }

    if (isNaN(date.getTime())) {
      console.warn("formatTime called with invalid date:", dateTime);
      return "";
    }

    // Get local time components
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Format as HH:MM
    const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;

    console.log(`formatTime conversion:`, {
      input: dateTime,
      parsedDate: date.toISOString(),
      localString: date.toLocaleString(),
      hours,
      minutes,
      formattedTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    return formattedTime;
  };

  // Helper function to get random position
  const getRandomPosition = () => {
    return positions[Math.floor(Math.random() * positions.length)];
  };

  // Format date range for display
  const formatDateRange = () => {
    const start = new Date(currentWeekStart);
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);

    const startDate = start.getDate();
    const endDate = end.getDate();
    const month = start.toLocaleString("default", { month: "short" });

    return `${startDate} - ${endDate} ${month}`;
  };

  // Navigation functions
  const goToPreviousWeek = () => {
    const prevWeek = new Date(currentWeekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    prevWeek.setHours(0, 0, 0, 0);
    setCurrentWeekStart(prevWeek);
  };

  const goToNextWeek = () => {
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);
    setCurrentWeekStart(nextWeek);
  };

  const goToToday = () => {
    const today = new Date();
    const monday = getMonday(today);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  // Get current week's shifts
  const getCurrentWeekShifts = () => {
    const weekId = getWeekIdentifier(currentWeekStart);
    return weeklySchedules[weekId] || {};
  };

  // Calculate column dates
  const getColumnDates = () => {
    return daysOfWeek.map((day, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + index);
      return date.getDate();
    });
  };

  // Get shift for employee on specific day
  const getShiftForDay = (employeeId, day) => {
    const shifts = getCurrentWeekShifts();
    const employeeShifts = shifts[employeeId] || [];
    return employeeShifts.find((shift) => shift.day === day);
  };

  // Handle business unit selection
  const handleBusinessUnitChange = (businessUnit) => {
    console.log("Selected business unit:", businessUnit);
    setSelectedBusinessUnit(businessUnit);
    setEmployees([]);
    setCurrentScheduleId(null);
    setIsSchedulePublished(false);
    // Clear current week schedules
    const weekId = getWeekIdentifier(currentWeekStart);
    setWeeklySchedules((prev) => {
      const newSchedules = { ...prev };
      delete newSchedules[weekId];
      return newSchedules;
    });
  };

  // Export functions
  const exportToPDF = () => {
    if (!selectedBusinessUnit) {
      showWarning("Please select a business unit first.");
      return;
    }

    const doc = new jsPDF("l", "mm", "a4"); // landscape orientation
    const weekRange = formatDateRange();
    const businessUnit = selectedBusinessUnit.name;

    // Add title
    doc.setFontSize(16);
    doc.text(`${businessUnit} - Weekly Schedule`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Week of ${weekRange}`, 20, 30);
    doc.text(`Location: ${selectedBusinessUnit.location}`, 20, 40);

    // Prepare data for the table
    const columnDates = getColumnDates();

    // Create headers
    const headers = ["Employee"];
    daysOfWeek.forEach((day, index) => {
      headers.push(`${day} ${columnDates[index]}`);
    });

    // Create rows
    const rows = [];
    employees.forEach((employee) => {
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
      startY: 50,
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
    showSuccess("Schedule PDF exported successfully!");
  };

  const exportToExcel = () => {
    if (!selectedBusinessUnit) {
      showWarning("Please select a business unit first.");
      return;
    }

    const weekRange = formatDateRange();
    const businessUnit = selectedBusinessUnit.name;

    // Prepare data for Excel
    const columnDates = getColumnDates();

    // Create headers
    const headers = ["Employee"];
    daysOfWeek.forEach((day, index) => {
      headers.push(`${day} ${columnDates[index]}`);
    });

    // Create data array
    const data = [headers];

    employees.forEach((employee) => {
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

    showSuccess("Schedule Excel file exported successfully!");
  };

  // Effects
  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchBusinessUnits();
    }
  }, [user, authenticatedFetch]); // Add authenticatedFetch

  useEffect(() => {
    if (selectedBusinessUnit) {
      fetchEmployeesForBusinessUnit(selectedBusinessUnit);
    }
  }, [selectedBusinessUnit, authenticatedFetch]); // Add authenticatedFetch

  useEffect(() => {
    if (selectedBusinessUnit) {
      fetchScheduleForWeek(currentWeekStart, selectedBusinessUnit);
    }
  }, [currentWeekStart, selectedBusinessUnit, authenticatedFetch]); // Add authenticatedFetch

  // Clear messages after timeout
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Check admin access
  if (user?.role !== "ADMIN") {
    return (
      <div className="p-6 sm:p-8 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle size={48} className="text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-500">
            This page is only accessible to administrators.
          </p>
        </div>
      </div>
    );
  }

  const columnDates = getColumnDates();

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-4 border-b space-y-4 lg:space-y-0 bg-white shadow-sm">
        <div className="flex items-center">
          <div className="bg-purple-100 rounded-full p-3 mr-4">
            <Building2 size={28} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Business Unit Schedules
            </h1>
            <p className="text-gray-500">
              Admin Panel • View schedules across business units
            </p>
          </div>
        </div>

        {/* Business Unit Selector */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter size={20} className="text-gray-400" />
            <label className="text-sm font-medium text-gray-700">
              Business Unit:
            </label>
          </div>
          <select
            value={selectedBusinessUnit?.id || ""}
            onChange={(e) => {
              const selectedUnit = businessUnits.find(
                (unit) => unit.id === e.target.value
              );
              handleBusinessUnitChange(selectedUnit);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent min-w-[200px]"
            disabled={isLoadingBusinessUnits}
          >
            <option value="">Select Business Unit</option>
            {businessUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} - {unit.location}
              </option>
            ))}
          </select>
          {isLoadingBusinessUnits && (
            <Loader2 size={16} className="animate-spin text-gray-400" />
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Business Unit Info */}
      {selectedBusinessUnit && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center">
            <Building2 className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                {selectedBusinessUnit.name}
              </h3>
              <div className="mt-1 flex items-center space-x-4 text-sm text-blue-700">
                <span className="flex items-center">
                  <MapPin size={12} className="mr-1" />
                  {selectedBusinessUnit.location}
                </span>
                <span className="flex items-center">
                  <Users size={12} className="mr-1" />
                  {employees.length} employees
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Controls */}
      <div className="flex justify-between items-center p-4 bg-white border-b">
        <div className="flex items-center space-x-4">
          <div className="flex border rounded">
            <button
              className="px-3 py-1 text-gray-700 flex items-center hover:bg-gray-50"
              onClick={goToPreviousWeek}
              disabled={!selectedBusinessUnit}
            >
              <ChevronLeft size={16} />
            </button>
            <button className="px-3 py-1 text-blue-500 flex items-center text-sm font-medium">
              {formatDateRange()}
              <ChevronRight className="ml-1 transform rotate-90" size={16} />
            </button>
            <button
              className="px-3 py-1 text-gray-700 flex items-center hover:bg-gray-50"
              onClick={goToNextWeek}
              disabled={!selectedBusinessUnit}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            className="px-3 py-1 border rounded text-gray-700 text-sm hover:bg-gray-50"
            onClick={goToToday}
            disabled={!selectedBusinessUnit}
          >
            Today
          </button>

          {/* Export buttons */}
          {selectedBusinessUnit && employees.length > 0 && (
            <div className="flex items-center space-x-2 ml-4">
              <button
                className="px-3 py-1 bg-red-500 text-white rounded flex items-center text-sm hover:bg-red-600 transition-colors"
                onClick={exportToPDF}
                title="Export schedule as PDF"
              >
                <FileText size={14} className="mr-1" />
                PDF
              </button>
              <button
                className="px-3 py-1 bg-green-500 text-white rounded flex items-center text-sm hover:bg-green-600 transition-colors"
                onClick={exportToExcel}
                title="Export schedule as Excel"
              >
                <Download size={14} className="mr-1" />
                Excel
              </button>
            </div>
          )}
        </div>

        {/* Schedule Info */}
        {selectedBusinessUnit && currentScheduleId && (
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center">
              <Calendar size={16} className="text-gray-400 mr-1" />
              <span className="text-gray-600">
                Schedule: {isSchedulePublished ? "Published" : "Draft"}
              </span>
            </div>
            {isSchedulePublished && (
              <div className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                PUBLISHED
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-grow overflow-hidden">
        {!selectedBusinessUnit ? (
          <div className="text-center py-12">
            <Building2 size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Select a Business Unit
            </h3>
            <p className="text-gray-500">
              Choose a business unit to view its schedule.
            </p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <Loader2
              size={48}
              className="text-purple-300 mx-auto mb-4 animate-spin"
            />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Loading Schedule
            </h3>
            <p className="text-gray-500">
              Fetching schedule data for {selectedBusinessUnit.name}...
            </p>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Employees Found
            </h3>
            <p className="text-gray-500">
              No employees found for {selectedBusinessUnit.name}.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            {/* Schedule Grid */}
            <div className="min-w-full h-full">
              {/* Day Headers */}
              <div className="grid grid-cols-8 border-b sticky top-0 bg-white z-10">
                <div className="p-2 font-medium text-gray-500 border-r w-48 min-w-[12rem]">
                  <div className="text-xs">EMPLOYEE</div>
                  <div className="text-[10px] text-blue-600">& ROLE</div>
                </div>
                {daysOfWeek.map((day, i) => (
                  <div
                    key={day}
                    className="p-2 text-center border-r bg-gray-50"
                  >
                    <div className="font-semibold text-gray-700 text-xs">
                      {day}
                    </div>
                    <div className="font-bold text-gray-900 text-lg">
                      {columnDates[i]}
                    </div>
                  </div>
                ))}
              </div>

              {/* Employee Rows */}
              {!currentScheduleId ? (
                <div className="text-center p-12 text-gray-500 text-xl">
                  No schedule found for this week.
                </div>
              ) : (
                <div>
                  {employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="grid grid-cols-8 border-b hover:bg-gray-50"
                    >
                      {/* Employee Info */}
                      <div className="p-3 border-r bg-white">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
                            {employee.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="ml-3 min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {employee.name}
                              {employee.isCurrentUser && (
                                <span className="ml-1 text-xs text-purple-600">
                                  (You)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {employee.role}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Schedule Days */}
                      {daysOfWeek.map((day, dayIndex) => {
                        const shift = getShiftForDay(employee.id, dayIndex);
                        return (
                          <div
                            key={day}
                            className="p-1 border-r min-h-[4rem] flex items-center justify-center"
                          >
                            {shift ? (
                              <div
                                className={`w-full mx-1 p-2 rounded text-xs text-center ${
                                  positionColors[shift.position] ||
                                  "bg-gray-100 border-gray-300"
                                } border`}
                              >
                                <div className="font-medium text-gray-800">
                                  {shift.startTime} - {shift.endTime}
                                </div>
                                <div className="text-gray-600 mt-1">
                                  {shift.position}
                                </div>
                                <div className="text-gray-500 text-[10px] mt-1">
                                  {shift.duration}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-300 text-xs">-</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBusinessUnitSchedulePage;
