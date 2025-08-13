import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import {
  Search,
  User,
  Clock,
  Coffee,
  CheckCircle,
  Download,
  ChevronUp,
  ChevronDown,
  X,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Utensils,
  Package,
  ShoppingCart
} from "lucide-react";
import WorkSessionDetailsModal from "./WorkSessionDetailsModal";

const ConsumptionRecordsTab = ({ selectedContext }) => {
  const { user, authenticatedFetch, getRestaurantId } = useAuth();
  
  // State management
  const [consumptionRecords, setConsumptionRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [consumptionItems, setConsumptionItems] = useState([]);
  const [workSessions, setWorkSessions] = useState([]);
  const [, setBusinessUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal state
  const [selectedWorkSessionId, setSelectedWorkSessionId] = useState(null);
  const [showWorkSessionModal, setShowWorkSessionModal] = useState(false);
  
  // Filter states
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [selectedWorkSession, setSelectedWorkSession] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Pagination and sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(20);
  const [sortField, setSortField] = useState("consumedAt");
  const [sortDirection, setSortDirection] = useState("desc");

  // Apply context-based filtering when selectedContext changes
  useEffect(() => {
    if (selectedContext && selectedContext.type === "item") {
      setSelectedItem(selectedContext.data.id);
    }
  }, [selectedContext]);

  // Fetch initial data
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchInitialData();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const businessUnitId = getRestaurantId();
      
      // Fetch business unit info, employees, consumption items, and initial records
      const [businessUnitResponse, employeesResponse, itemsResponse] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS_CONFIG.businessUnit(businessUnitId)),
        authenticatedFetch(API_ENDPOINTS_CONFIG.getEmployeesByBusinessUnit(businessUnitId)),
        authenticatedFetch(API_ENDPOINTS_CONFIG.consumptionItems(businessUnitId))
      ]);
      
      // Also fetch work sessions for the filter
      await fetchWorkSessions();

      if (businessUnitResponse.ok) {
        const businessUnitData = await businessUnitResponse.json();
        setBusinessUnit(businessUnitData);
      }

      if (employeesResponse.ok) {
        const employeesData = await employeesResponse.json();
        setEmployees(employeesData);
      }

      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setConsumptionItems(itemsData);
      }

      // Fetch consumption records
      await fetchConsumptionRecords();
      
    } catch (error) {
      console.error("Error fetching initial data:", error);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkSessions = async () => {
    try {
      const businessUnitId = getRestaurantId();
      // Get work sessions from unconfirmed work sessions endpoint for now
      // This will give us a list of work sessions in the business unit
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.unconfirmedWorkSessions(businessUnitId)
      );

      if (response.ok) {
        // Extract unique work session IDs from consumption records or use the unconfirmed sessions
        // For now, we'll build this from consumption records
        const uniqueWorkSessions = [...new Set(
          consumptionRecords
            .filter(record => record.workSessionId)
            .map(record => record.workSessionId)
        )].map(id => ({ id, displayName: `Session #${id}` }));
        
        setWorkSessions(uniqueWorkSessions);
      }
    } catch (error) {
      console.error("Error fetching work sessions:", error);
      // Don't show error for work sessions as it's not critical
    }
  };

  const fetchConsumptionRecords = async () => {
    try {
      const businessUnitId = getRestaurantId();
      let params = new URLSearchParams();
      
      if (startDate) params.append('startDate', new Date(startDate).toISOString());
      if (endDate) params.append('endDate', new Date(endDate).toISOString());
      
      const response = await authenticatedFetch(
        API_ENDPOINTS_CONFIG.consumptionRecords(businessUnitId, params.toString())
      );

      if (response.ok) {
        const data = await response.json();
        // Transform the data to include full user names
        const transformedData = data.map(record => ({
          ...record,
          userName: `${record.userFirstName || ''} ${record.userLastName || ''}`.trim() || 'Unknown User'
        }));
        setConsumptionRecords(transformedData);
      } else {
        throw new Error("Failed to fetch consumption records");
      }
    } catch (error) {
      console.error("Error fetching consumption records:", error);
      setError("Failed to load consumption records. Please try again.");
    }
  };

  // Refetch records when date filters change
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN") && !loading) {
      fetchConsumptionRecords();
    }
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Update work sessions when consumption records change
  useEffect(() => {
    if (consumptionRecords.length > 0) {
      const uniqueWorkSessions = [...new Set(
        consumptionRecords
          .filter(record => record.workSessionId)
          .map(record => record.workSessionId)
      )].map(id => ({ id, displayName: `Session #${id}` }));
      
      setWorkSessions(uniqueWorkSessions);
    }
  }, [consumptionRecords]);

  // Filtered and sorted records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = consumptionRecords.filter(record => {
      const matchesSearch = 
        record.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.consumptionItemName || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesEmployee = !selectedEmployee || record.userId === selectedEmployee;
      const matchesItem = !selectedItem || record.consumptionItemId === selectedItem;
      const matchesWorkSession = !selectedWorkSession || record.workSessionId === selectedWorkSession;
      
      return matchesSearch && matchesEmployee && matchesItem && matchesWorkSession;
    });

    // Sort records
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'consumedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortField === 'quantity') {
        aValue = parseFloat(aValue);
        bValue = parseFloat(bValue);
      } else if (sortField === 'userName') {
        aValue = aValue || '';
        bValue = bValue || '';
      } else if (sortField === 'consumptionItemName') {
        aValue = aValue || '';
        bValue = bValue || '';
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [consumptionRecords, searchTerm, selectedEmployee, selectedItem, selectedWorkSession, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / recordsPerPage);
  const currentPageRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedEmployee, selectedItem, selectedWorkSession, startDate, endDate]);

  // Helper functions for formatting
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (dateString) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  };

  const getItemTypeIcon = (itemType) => {
    switch (itemType?.toLowerCase()) {
      case 'food':
        return <Utensils className="w-4 h-4 text-orange-500" />;
      case 'beverage':
        return <Coffee className="w-4 h-4 text-blue-500" />;
      case 'supply':
        return <Package className="w-4 h-4 text-gray-500" />;
      default:
        return <ShoppingCart className="w-4 h-4 text-gray-500" />;
    }
  };

  // Active filters
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedEmployee) {
      const employee = employees.find(emp => emp.id === selectedEmployee);
      filters.push({
        key: 'employee',
        label: `Employee: ${employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}`
      });
    }
    if (selectedItem) {
      const item = consumptionItems.find(item => item.id === selectedItem);
      filters.push({
        key: 'item',
        label: `Item: ${item ? item.name : 'Unknown'}`
      });
    }
    if (startDate) {
      filters.push({
        key: 'startDate',
        label: `From: ${formatDate(startDate)}`
      });
    }
    if (endDate) {
      filters.push({
        key: 'endDate',
        label: `To: ${formatDate(endDate)}`
      });
    }
    if (selectedWorkSession) {
      filters.push({
        key: 'workSession',
        label: `Work Session: #${selectedWorkSession}`
      });
    }
    return filters;
  }, [selectedEmployee, selectedItem, selectedWorkSession, startDate, endDate, employees, consumptionItems]);

  // Helper functions
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />;
  };

  const removeFilter = (filterKey) => {
    switch (filterKey) {
      case 'employee':
        setSelectedEmployee("");
        break;
      case 'item':
        setSelectedItem("");
        break;
      case 'startDate':
        setStartDate("");
        break;
      case 'endDate':
        setEndDate("");
        break;
      case 'workSession':
        setSelectedWorkSession("");
        break;
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedEmployee("");
    setSelectedItem("");
    setSelectedWorkSession("");
    setStartDate("");
    setEndDate("");
  };
  
  const handleWorkSessionClick = (workSessionId) => {
    if (workSessionId) {
      setSelectedWorkSessionId(workSessionId);
      setShowWorkSessionModal(true);
    }
  };
  
  const closeWorkSessionModal = () => {
    setShowWorkSessionModal(false);
    setSelectedWorkSessionId(null);
  };

  return (
    <div>
      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Filters & Search</h3>
            <button 
              onClick={() => setFiltersExpanded(!filtersExpanded)} 
              className="text-gray-500 hover:text-gray-700"
            >
              {filtersExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        {filtersExpanded && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Employee Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Consumption Item Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                >
                  <option value="">All Items</option>
                  {consumptionItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Session Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Session
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={selectedWorkSession}
                  onChange={(e) => setSelectedWorkSession(e.target.value)}
                >
                  <option value="">All Sessions</option>
                  {workSessions.map(session => (
                    <option key={session.id} value={session.id}>
                      {session.displayName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Search Bar */}
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by employee name or item name..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex flex-wrap gap-2">
                {activeFilters.map(filter => (
                  <span key={filter.key} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {filter.label}
                    <button onClick={() => removeFilter(filter.key)} className="ml-1 text-blue-600 hover:text-blue-800">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {activeFilters.length > 0 && (
                <button 
                  onClick={clearAllFilters}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        {/* Table Header with Summary Stats */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Coffee className="w-6 h-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Usage Records
                </h3>
                <p className="text-sm text-gray-600">
                  {filteredAndSortedRecords.length} records found
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                <Download className="w-4 h-4 mr-2" />
                CSV
              </button>
              <button className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                <Download className="w-4 h-4 mr-2" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading consumption records...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAndSortedRecords.length === 0 && (
          <div className="text-center py-8">
            <Coffee className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Records Found</h4>
            <p className="text-gray-600">
              {activeFilters.length > 0 
                ? "Try adjusting your search criteria or date range" 
                : "No consumption records found for this period"}
            </p>
          </div>
        )}

        {/* Desktop Table */}
        {!loading && filteredAndSortedRecords.length > 0 && (
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('consumedAt')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date & Time</span>
                      {getSortIcon('consumedAt')}
                    </div>
                  </th>
                  
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('userName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Employee</span>
                      {getSortIcon('userName')}
                    </div>
                  </th>
                  
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('consumptionItemName')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Item</span>
                      {getSortIcon('consumptionItemName')}
                    </div>
                  </th>
                  
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Quantity</span>
                      {getSortIcon('quantity')}
                    </div>
                  </th>
                  
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Work Session
                  </th>
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-gray-200">
                {currentPageRecords.map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        <div>
                          <div className="font-medium">
                            {formatDate(record.consumedAt)}
                          </div>
                          <div className="text-gray-500">
                            {formatTime(record.consumedAt)}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {record.userName}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getItemTypeIcon('food')}
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">
                            {record.consumptionItemName || 'Unknown Item'}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {record.quantity}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.workSessionId ? (
                        <button
                          onClick={() => handleWorkSessionClick(record.workSessionId)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Session #{record.workSessionId}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Card Layout */}
        {!loading && filteredAndSortedRecords.length > 0 && (
          <div className="lg:hidden space-y-4 p-4">
            {currentPageRecords.map((record) => (
              <div key={record.id} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{record.userName}</div>
                      <div className="text-sm text-gray-500">{formatDateTime(record.consumedAt)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Item:</span>
                    <div className="font-medium">{record.consumptionItemName || 'Unknown Item'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Quantity:</span>
                    <div className="font-medium">{record.quantity}</div>
                  </div>
                </div>
                
                {record.workSessionId && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => handleWorkSessionClick(record.workSessionId)}
                      className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Work Session #{record.workSessionId}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredAndSortedRecords.length > recordsPerPage && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * recordsPerPage) + 1} to {Math.min(currentPage * recordsPerPage, filteredAndSortedRecords.length)} of {filteredAndSortedRecords.length} results
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-md border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Work Session Details Modal */}
      {showWorkSessionModal && selectedWorkSessionId && (
        <WorkSessionDetailsModal
          workSessionId={selectedWorkSessionId}
          onClose={closeWorkSessionModal}
        />
      )}
    </div>
  );
};

export default ConsumptionRecordsTab;