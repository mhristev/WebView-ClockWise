import React from "react";
import { X, Clock, FileText, User, Calendar } from "lucide-react";

const DayDetailModal = ({
  isOpen,
  onClose,
  selectedDate,
  shifts,
  employeeName,
}) => {
  if (!isOpen) return null;

  // Format time for display
  const formatTime = (timeString) => {
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch (error) {
      console.error("Error formatting time:", timeString, error);
      return "Invalid time";
    }
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Calculate total hours for the day
  const calculateTotalHours = () => {
    let totalMinutes = 0;
    shifts.forEach((shift) => {
      if (shift.workSession && shift.workSession.clockOutTime) {
        try {
          const start = new Date(shift.workSession.clockInTime);
          const end = new Date(shift.workSession.clockOutTime);
          totalMinutes += (end - start) / (1000 * 60);
        } catch (error) {
          console.error("Error calculating hours:", error);
        }
      }
    });
    return (totalMinutes / 60).toFixed(1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {formatDate(selectedDate)}
              </h2>
              <p className="text-sm text-gray-600">{employeeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {shifts.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Shifts Scheduled
              </h3>
              <p className="text-gray-500">
                No shifts are scheduled for this day.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Total Hours
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {calculateTotalHours()}h
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Shifts</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {shifts.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Shifts */}
              <div className="space-y-4">
                {shifts.map((shift, index) => (
                  <div key={shift.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-500" />
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Shift {index + 1}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatTime(shift.startTime)} -{" "}
                            {formatTime(shift.endTime)}
                          </p>
                        </div>
                      </div>
                      {shift.role && (
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {shift.role}
                        </span>
                      )}
                    </div>

                    {/* Work Session */}
                    {shift.workSession ? (
                      <div className="bg-green-50 border border-green-200 rounded-md p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <User className="h-4 w-4 text-green-600" />
                          <h4 className="font-medium text-green-800">
                            Work Session
                          </h4>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-green-600 font-medium">
                              Clock In
                            </p>
                            <p className="text-sm text-green-800">
                              {formatTime(shift.workSession.clockInTime)}
                            </p>
                          </div>
                          {shift.workSession.clockOutTime && (
                            <div>
                              <p className="text-xs text-green-600 font-medium">
                                Clock Out
                              </p>
                              <p className="text-sm text-green-800">
                                {formatTime(shift.workSession.clockOutTime)}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Session Note */}
                        {shift.workSession.note && (
                          <div className="bg-white border border-green-200 rounded-md p-3">
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-green-600 mt-0.5" />
                              <div>
                                <p className="text-xs font-medium text-green-800 mb-1">
                                  Session Note
                                </p>
                                <p className="text-sm text-green-700">
                                  {shift.workSession.note.noteContent}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <p className="text-sm text-yellow-800">
                            No work session recorded for this shift
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DayDetailModal;
