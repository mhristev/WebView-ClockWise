import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  API_ENDPOINTS_CONFIG,
  PLANNING_BASE_URL,
  USER_BASE_URL,
} from "../config/api";
import { DollarSign, Building, Download, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AdminPaycheckGenerator = () => {
  const { authenticatedFetch, getRestaurantId } = useAuth();
  const [businessUnits, setBusinessUnits] = useState([]);
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState("");
  const [paychecks, setPaychecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taxAmount, setTaxAmount] = useState(30);

  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const response = await authenticatedFetch(
          API_ENDPOINTS_CONFIG.getAllBusinessUnits(),
          { method: "GET" }
        );
        if (response.ok) {
          const data = await response.json();
          setBusinessUnits(data);
        } else {
          setError("Failed to fetch business units.");
        }
      } catch (err) {
        setError("An error occurred while fetching business units.");
        console.error(err);
      }
    };

    fetchBusinessUnits();
  }, [authenticatedFetch]);

  const handleGeneratePaychecks = async () => {
    if (!selectedBusinessUnit) {
      setError("Please select a business unit.");
      return;
    }

    setLoading(true);
    setError(null);
    setPaychecks([]);

    try {
      const response = await authenticatedFetch(
        `${USER_BASE_URL}/users/business-unit/${selectedBusinessUnit}`,
        { method: "GET" }
      );

      if (response.ok) {
        const employeeData = await response.json();

        const calculatedPaychecks = employeeData.map((employee) => {
          return {
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            tax: taxAmount,
          };
        });
        setPaychecks(calculatedPaychecks);
      } else {
        setError("Failed to fetch employees for the selected business unit.");
      }
    } catch (err) {
      setError("An error occurred while generating paychecks.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const selectedUnitName =
      businessUnits.find((bu) => bu.id === selectedBusinessUnit)?.name || "N/A";

    doc.setFontSize(18);
    doc.text(`Paychecks for ${selectedUnitName}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Employee Name", "Tax (BGN)"];
    const tableRows = [];

    paychecks.forEach((pc) => {
      const row = [pc.employeeName, pc.tax.toFixed(2)];
      tableRows.push(row);
    });

    const totalTax = paychecks.length * taxAmount;

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      foot: [["Total Tax", totalTax.toFixed(2) + " BGN"]],
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: 0,
        fontStyle: "bold",
        halign: "right",
      },
    });

    doc.save(
      `paychecks-${selectedUnitName.replace(/\s+/g, "_")}-${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center mb-6">
            <DollarSign className="w-8 h-8 text-green-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">
              Paycheck Generator
            </h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <div className="md:col-span-2">
              <label
                htmlFor="business-unit"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Business Unit
              </label>
              <select
                id="business-unit"
                value={selectedBusinessUnit}
                onChange={(e) => setSelectedBusinessUnit(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select a Business Unit</option>
                {businessUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="tax-amount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Tax per Person (BGN)
              </label>
              <input
                type="number"
                id="tax-amount"
                value={taxAmount}
                onChange={(e) => setTaxAmount(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                min="0"
              />
            </div>
            <div className="md:col-span-3 flex justify-center">
              <button
                onClick={handleGeneratePaychecks}
                disabled={loading || !selectedBusinessUnit}
                className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:bg-gray-400 w-full md:w-auto"
              >
                {loading ? "Generating..." : "Generate Paychecks"}
              </button>
            </div>
          </div>

          {paychecks.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Generated Paychecks
                </h2>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tax
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paychecks.map((pc) => (
                      <tr key={pc.employeeId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {pc.employeeName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {pc.tax.toFixed(2)} BGN
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 font-bold">
                    <tr>
                      <td className="px-6 py-3 text-right text-sm text-gray-800">
                        Total Tax
                      </td>
                      <td className="px-6 py-3 text-left text-sm text-gray-800">
                        {(paychecks.length * taxAmount).toFixed(2)} BGN
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPaycheckGenerator;
