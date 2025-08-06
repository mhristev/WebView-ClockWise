import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import {
  X,
  Clock,
  User,
  CheckCircle,
  AlertCircle,
  Calendar,
  Edit3,
  Eye,
  Loader2
} from "lucide-react";

const WorkSessionDetailsModal = ({ workSessionId, onClose }) => {
  const { authenticatedFetch } = useAuth();
  const [workSession, setWorkSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (workSessionId) {
      fetchWorkSessionDetails();
    }
  }, [workSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchWorkSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.workSessionById(workSessionId)
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Work session data received:', data);
        console.log('Clock in time format:', data.clockInTime, typeof data.clockInTime);
        console.log('Clock out time format:', data.clockOutTime, typeof data.clockOutTime);
        setWorkSession(data);
      } else {
        throw new Error("Failed to fetch work session details");
      }
    } catch (error) {
      console.error("Error fetching work session details:", error);
      setError("Failed to load work session details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return "Not recorded";
    
    console.log('Formatting dateTimeString:', dateTimeString, 'Type:', typeof dateTimeString);
    
    try {
      let date;
      
      if (typeof dateTimeString === 'string') {
        // Handle OffsetDateTime format from Java/Kotlin backend
        // Examples: "2023-12-01T14:30:00+02:00", "2023-12-01T14:30:00Z", "2023-12-01T14:30:00.123456+02:00"
        
        // First, try direct parsing with Date constructor (works for most ISO formats)
        date = new Date(dateTimeString);
        
        // If direct parsing failed, try manual parsing
        if (isNaN(date.getTime())) {
          // Handle formats like "2023-12-01T14:30:00+02:00" or with microseconds
          const cleanedString = dateTimeString
            .replace(/\\.\\d{6}/, '') // Remove microseconds if present (keep only milliseconds)
            .replace(/\\.\\d{3}\\d+/, '.000'); // Truncate nanoseconds to milliseconds
          
          date = new Date(cleanedString);
        }
        
        // Last resort: try parsing as timestamp string
        if (isNaN(date.getTime())) {
          const timestamp = parseInt(dateTimeString);
          if (!isNaN(timestamp)) {
            // Determine if it's seconds or milliseconds based on magnitude
            date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
          }
        }
        
      } else if (typeof dateTimeString === 'number') {
        // Handle numeric timestamp (milliseconds or seconds since epoch)
        date = new Date(dateTimeString > 1000000000000 ? dateTimeString : dateTimeString * 1000);
        
      } else {
        // Fallback for other types
        date = new Date(dateTimeString);
      }
      
      // Final validation
      if (isNaN(date.getTime())) {
        console.warn('Failed to parse date:', dateTimeString);
        return `Invalid date: ${dateTimeString}`;
      }
      
      console.log('Parsed date:', date.toISOString(), 'Local:', date.toString());
      
      // Format the date in user's local timezone
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }).format(date);
      
    } catch (error) {
      console.error('Error formatting date:', error, 'Input was:', dateTimeString);
      return `Date error: ${dateTimeString}`;
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "0 minutes";
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return 'text-green-700 bg-green-100';
      case 'COMPLETED':
        return 'text-blue-700 bg-blue-100';
      case 'CANCELLED':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return <Clock className="w-4 h-4" />;
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4" />;
      case 'CANCELLED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Eye className="w-4 h-4" />;
    }
  };

  const hasBeenModified = workSession?.originalClockInTime || workSession?.originalClockOutTime;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Clock className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Work Session Details
              </h2>
              <p className="text-sm text-gray-600">
                Session ID: {workSessionId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-3" />
              <span className="text-gray-600">Loading work session details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          {workSession && !loading && (
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(workSession.status)}`}>
                    {getStatusIcon(workSession.status)}
                    <span className="ml-1 capitalize">{workSession.status?.toLowerCase()}</span>
                  </span>
                </div>
                
                {workSession.confirmed && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Confirmed
                  </span>
                )}
              </div>

              {/* Time Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-gray-600" />
                  Time Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clock In Time
                    </label>
                    <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                      {formatDateTime(workSession.clockInTime)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clock Out Time
                    </label>
                    <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                      {formatDateTime(workSession.clockOutTime)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Duration
                    </label>
                    <p className="text-sm font-semibold text-blue-600 bg-white p-2 rounded border">
                      {formatDuration(workSession.totalMinutes)}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <p className="text-sm text-gray-900 bg-white p-2 rounded border capitalize">
                      {workSession.status?.toLowerCase()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modification History */}
              {hasBeenModified && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Edit3 className="w-5 h-5 mr-2 text-yellow-600" />
                    Modification History
                  </h4>
                  
                  <div className="space-y-3">
                    {workSession.originalClockInTime && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Original Clock In Time
                        </label>
                        <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                          {formatDateTime(workSession.originalClockInTime)}
                        </p>
                      </div>
                    )}
                    
                    {workSession.originalClockOutTime && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Original Clock Out Time
                        </label>
                        <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                          {formatDateTime(workSession.originalClockOutTime)}
                        </p>
                      </div>
                    )}
                    
                  </div>
                </div>
              )}

              {/* Confirmation Information */}
              {workSession.confirmed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                    Confirmation Details
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmed At
                      </label>
                      <p className="text-sm text-gray-900 bg-white p-2 rounded border">
                        {formatDateTime(workSession.confirmedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkSessionDetailsModal;