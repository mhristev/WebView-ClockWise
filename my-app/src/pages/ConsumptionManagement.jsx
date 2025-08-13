import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  Package,
  ClipboardList,
  AlertCircle,
  Building,
  X,
  Eye,
} from "lucide-react";
import ConsumptionItemsTab from "../components/ConsumptionItemsTab";
import ConsumptionRecordsTab from "../components/ConsumptionRecordsTab";

const ConsumptionManagement = () => {
  const { user } = useAuth();

  // State management
  const [activeTab, setActiveTab] = useState("items");
  const [selectedContext, setSelectedContext] = useState(null);
  const [businessUnitName, setBusinessUnitName] = useState("");

  // Check access permissions
  useEffect(() => {
    if (user && user.role !== "MANAGER" && user.role !== "ADMIN") {
      return;
    }
  }, [user]);

  // Access denied check
  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500 mr-3" />
            <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
          </div>
          <p className="text-gray-600">
            This page is only accessible to managers and administrators.
          </p>
        </div>
      </div>
    );
  }

  // Handle tab switching
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };

  // Handle context bridging - when viewing usage for a specific item
  const handleViewItemUsage = (item) => {
    setSelectedContext({
      type: "item",
      data: item,
      label: `Viewing usage for: ${item.name}`,
    });
    setActiveTab("records");
  };

  // Clear context selection
  const clearContext = () => {
    setSelectedContext(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Building className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Consumption Management
                  </h1>
                  <p className="text-gray-600">
                    Manage items and track consumption records
                  </p>
                </div>
              </div>
            </div>

            {/* Tabbed Navigation */}
            <div className="mt-6">
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => handleTabSwitch("items")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "items"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center">
                      <Package className="w-4 h-4 mr-2" />
                      Items Catalog
                    </div>
                  </button>
                  <button
                    onClick={() => handleTabSwitch("records")}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === "records"
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center">
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Usage Records
                    </div>
                  </button>
                </nav>
              </div>
            </div>

            {/* Context Bridge - Shows current selection/filter context */}
            {selectedContext && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Eye className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-blue-800 font-medium">
                      {selectedContext.label}
                    </span>
                  </div>
                  <button
                    onClick={clearContext}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "items" && (
          <ConsumptionItemsTab onViewUsage={handleViewItemUsage} />
        )}
        {activeTab === "records" && (
          <ConsumptionRecordsTab selectedContext={selectedContext} />
        )}
      </div>
    </div>
  );
};

export default ConsumptionManagement;