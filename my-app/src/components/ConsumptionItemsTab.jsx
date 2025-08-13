import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { ORGANIZATION_BASE_URL } from "../config/api";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  DollarSign,
  Save,
  X,
  AlertCircle,
  Eye,
} from "lucide-react";

const ConsumptionItemsTab = ({ onViewUsage }) => {
  const { user, authenticatedFetch, getRestaurantId } = useAuth();

  // State management
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [, setBusinessUnitName] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    type: "food",
  });

  // Fetch business unit info and consumption items
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchBusinessUnitInfo();
      fetchConsumptionItems();
    }
  }, [user]);

  const fetchBusinessUnitInfo = async () => {
    try {
      const businessUnitId = getRestaurantId();
      console.log("Fetching business unit info for ID:", businessUnitId);

      const response = await authenticatedFetch(
        `${ORGANIZATION_BASE_URL}/business-units/${businessUnitId}`,
        { method: "GET" }
      );

      console.log("Business unit fetch response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Business unit data:", data);
        setBusinessUnitName(data.name || "Business Unit");
      } else {
        console.error("Failed to fetch business unit:", response.status);
        const errorText = await response.text();
        console.error("Business unit error response:", errorText);
        setError(
          `Business unit not found (${response.status}). This may be why consumption items cannot be created.`
        );
      }
    } catch (error) {
      console.error("Error fetching business unit info:", error);
      setError(`Failed to fetch business unit info: ${error.message}`);
    }
  };

  const fetchConsumptionItems = async () => {
    setLoading(true);
    setError(null);

    try {
      const businessUnitId = getRestaurantId();
      const response = await authenticatedFetch(
        `${ORGANIZATION_BASE_URL}/business-units/${businessUnitId}/consumption-items`,
        { method: "GET" }
      );

      if (response.ok) {
        const data = await response.json();
        setItems(Array.isArray(data) ? data : []);
      } else if (response.status === 404) {
        // No items found, set empty array
        setItems([]);
      } else {
        throw new Error(
          `Failed to fetch consumption items: ${response.status}`
        );
      }
    } catch (error) {
      console.error("Error fetching consumption items:", error);
      setError(`Failed to load consumption items: ${error.message}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.name.trim() ||
      !formData.price ||
      isNaN(parseFloat(formData.price))
    ) {
      setError("Please provide a valid name and price");
      return;
    }

    // Check if we have a valid business unit
    const businessUnitId = getRestaurantId();
    if (!businessUnitId || businessUnitId === "1") {
      setError(
        "Cannot create consumption items: No valid business unit found. Please ensure you're assigned to a business unit."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Business Unit ID:", businessUnitId);

      const itemData = {
        name: formData.name.trim(),
        price: parseFloat(formData.price),
        type: formData.type,
      };

      console.log("Sending item data:", itemData);

      const isEditing = editingItem !== null;
      const url = isEditing
        ? `${ORGANIZATION_BASE_URL}/business-units/${businessUnitId}/consumption-items/${editingItem.id}`
        : `${ORGANIZATION_BASE_URL}/business-units/${businessUnitId}/consumption-items`;

      console.log("Request URL:", url);

      const method = isEditing ? "PUT" : "POST";

      const response = await authenticatedFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(itemData),
      });

      if (response.ok) {
        await fetchConsumptionItems(); // Refresh the list
        resetForm();
        setShowModal(false);
        setError(null);
      } else {
        let errorMessage = `Failed to ${isEditing ? "update" : "create"} item`;
        try {
          const errorData = await response.text();
          console.error("Server error response:", errorData);
          errorMessage = errorData || errorMessage;
        } catch (e) {
          console.error("Could not parse error response:", e);
        }
        console.error("Request failed with status:", response.status);
        console.error("Request payload:", itemData);
        console.error("Request URL:", url);
        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }
    } catch (error) {
      console.error("Error saving consumption item:", error);
      setError(
        `Failed to ${editingItem ? "update" : "create"} item: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm("Are you sure you want to delete this consumption item?")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const businessUnitId = getRestaurantId();
      const response = await authenticatedFetch(
        `${ORGANIZATION_BASE_URL}/business-units/${businessUnitId}/consumption-items/${itemId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        await fetchConsumptionItems(); // Refresh the list
      } else {
        throw new Error("Failed to delete item");
      }
    } catch (error) {
      console.error("Error deleting consumption item:", error);
      setError(`Failed to delete item: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      type: item.type,
    });
    setShowModal(true);
  };

  const startAdding = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      price: "",
      type: "food",
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      type: "food",
    });
    setShowModal(false);
    setEditingItem(null);
  };

  // Filter items based on search term and type
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesType;
  });

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Items Catalog</h3>
          <button
            onClick={startAdding}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="food">Food</option>
            <option value="drink">Drink</option>
          </select>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading items...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || filterType !== "all"
                ? "No items found"
                : "No consumption items yet"}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filterType !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Start by adding your first food or drink item"}
            </p>
            {!searchTerm && filterType === "all" && (
              <button
                onClick={startAdding}
                className="flex items-center mx-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Item
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Added
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {formatCurrency(item.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onViewUsage(item)}
                          disabled={loading}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          title="View Usage Records"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditing(item)}
                          disabled={loading}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="Edit Item"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={loading}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for Add/Edit Item */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <form onSubmit={handleFormSubmit}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingItem ? "Edit Item" : "Add New Item"}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter item name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="food">Food</option>
                    <option value="drink">Drink</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingItem ? "Update" : "Add"} Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsumptionItemsTab;