import React from "react";
import {
  DollarSign,
  Download,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Coffee,
  CheckCircle,
  User,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PayrollSummaryTable = ({
  payrollData,
  payrollTotals,
  payrollLoading,
  sortConfig,
  handleSort,
  formatMinutesToHoursAndMinutes,
  formatCurrency,
  getMonthName,
  businessUnitName,
  setError,
}) => {
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const getSortedPayrollData = () => {
    if (!sortConfig.key) return payrollData;

    return [...payrollData].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle numeric sorting
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  };

  const sortedPayrollData = getSortedPayrollData();

  const exportPayrollToPDF = () => {
    if (!businessUnitName || sortedPayrollData.length === 0) {
      setError("No payroll data to export.");
      return;
    }

    const doc = new jsPDF();
    
    // Add title and basic info
    doc.setFontSize(18);
    doc.text(`${businessUnitName} - Monthly Payroll Summary`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Month: ${getMonthName()}`, 14, 30);
    
    // Add summary totals
    doc.setFontSize(10);
    let yPos = 40;
    doc.text(`Total Employees: ${sortedPayrollData.length}`, 14, yPos);
    doc.text(`Total Hours Worked: ${payrollTotals.totalHours.toFixed(1)}h`, 70, yPos);
    doc.text(`Total Payable Hours: ${payrollTotals.totalPayableHours.toFixed(1)}h`, 130, yPos);
    yPos += 7;
    doc.text(`Total Break Hours: ${payrollTotals.totalBreakHours.toFixed(1)}h`, 14, yPos);
    doc.text(`Total Payroll Cost: ${formatCurrency(payrollTotals.totalPay)}`, 130, yPos);
    yPos += 15;

    // Prepare table data
    const tableColumn = [
      "Employee",
      "Shifts",
      "Hours Worked",
      "Break Duration",
      "Payable Hours",
      "Hourly Rate",
      "Total Pay"
    ];
    const tableRows = [];

    sortedPayrollData.forEach((employee) => {
      const workedHours = formatMinutesToHoursAndMinutes(employee.totalWorkedMinutes);
      const breakHours = formatMinutesToHoursAndMinutes(employee.totalBreakMinutes) + 
        (employee.breakDurationMinutes > 0 ? ` (${employee.breakDurationMinutes}min/shift)` : '');
      const payableHours = formatMinutesToHoursAndMinutes(employee.payableMinutes);
      
      tableRows.push([
        employee.fullName,
        `${employee.completedShifts}/${employee.numberOfShifts}`,
        workedHours,
        breakHours,
        payableHours,
        formatCurrency(employee.hourlyRate),
        formatCurrency(employee.totalPay)
      ]);
    });

    // Add table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: yPos,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });

    // Save the PDF
    const fileName = `${businessUnitName}_Payroll_Summary_${getMonthName().replace(/\s+/g, "_")}.pdf`;
    doc.save(fileName);
    
    setError(null);
  };

  const exportPayrollToCSV = () => {
    if (sortedPayrollData.length === 0) {
      setError("No payroll data to export.");
      return;
    }

    const headers = [
      "Employee Name",
      "Shifts (Completed/Total)",
      "Hours Worked",
      "Break Duration",
      "Payable Hours",
      "Hourly Rate",
      "Total Pay"
    ];

    const csvContent = [
      headers.join(","),
      ...sortedPayrollData.map(employee => [
        `"${employee.fullName}"`,
        `"${employee.completedShifts}/${employee.numberOfShifts}"`,
        (employee.totalWorkedMinutes / 60).toFixed(2),
        `"${(employee.totalBreakMinutes / 60).toFixed(2)}h${employee.breakDurationMinutes > 0 ? ` (${employee.breakDurationMinutes}min/shift)` : ''}"`,
        (employee.payableMinutes / 60).toFixed(2),
        employee.hourlyRate.toFixed(2),
        employee.totalPay.toFixed(2)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${businessUnitName}_Payroll_Summary_${getMonthName().replace(/\s+/g, "_")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setError(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="w-6 h-6 text-green-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Monthly Payroll Summary
              </h3>
              <p className="text-sm text-gray-600">
                Payroll calculations for {getMonthName()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportPayrollToCSV}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={payrollLoading || sortedPayrollData.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </button>
            <button
              onClick={exportPayrollToPDF}
              className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={payrollLoading || sortedPayrollData.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {payrollLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading payroll data...</span>
        </div>
      )}

      {/* Empty State */}
      {!payrollLoading && sortedPayrollData.length === 0 && (
        <div className="text-center py-8">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Payroll Data</h4>
          <p className="text-gray-600">
            No confirmed work sessions found for {getMonthName()}.
          </p>
        </div>
      )}

      {/* Table */}
      {!payrollLoading && sortedPayrollData.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('fullName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Employee</span>
                      {getSortIcon('fullName')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalWorkedMinutes')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Hours Worked</span>
                      {getSortIcon('totalWorkedMinutes')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalBreakMinutes')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Break Duration</span>
                      {getSortIcon('totalBreakMinutes')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('payableMinutes')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Payable Hours</span>
                      {getSortIcon('payableMinutes')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('hourlyRate')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Hourly Rate</span>
                      {getSortIcon('hourlyRate')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalPay')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Total Pay</span>
                      {getSortIcon('totalPay')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedPayrollData.map((employee, index) => (
                  <tr key={employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {employee.avatar ? (
                            <img 
                              className="h-10 w-10 rounded-full object-cover" 
                              src={employee.avatar} 
                              alt={employee.fullName}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.fullName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.completedShifts} completed / {employee.numberOfShifts} total shift{employee.numberOfShifts !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        {formatMinutesToHoursAndMinutes(employee.totalWorkedMinutes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Coffee className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          {formatMinutesToHoursAndMinutes(employee.totalBreakMinutes)}
                          {employee.breakDurationMinutes > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({employee.breakDurationMinutes}min/shift)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                        {formatMinutesToHoursAndMinutes(employee.payableMinutes)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                        {formatCurrency(employee.hourlyRate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      {formatCurrency(employee.totalPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500">Total Hours</div>
                <div className="text-lg font-bold text-blue-600">
                  {formatMinutesToHoursAndMinutes(payrollTotals.totalHours * 60)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500">Payable Hours</div>
                <div className="text-lg font-bold text-green-600">
                  {formatMinutesToHoursAndMinutes(payrollTotals.totalPayableHours * 60)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500">Break Hours</div>
                <div className="text-lg font-bold text-orange-600">
                  {formatMinutesToHoursAndMinutes(payrollTotals.totalBreakHours * 60)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm font-medium text-gray-500">Total Payroll</div>
                <div className="text-xl font-bold text-green-700">
                  {formatCurrency(payrollTotals.totalPay)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PayrollSummaryTable;