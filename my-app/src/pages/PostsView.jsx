import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNotification } from "../components/NotificationContext";
import { API_ENDPOINTS_CONFIG } from "../config/api";
import {
  MessageSquare,
  Plus,
  Search,
  User,
  Clock,
  Users,
  X,
  AlertCircle,
  Send,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Filter,
} from "lucide-react";

const PostsView = () => {
  const { user, authenticatedFetch, getRestaurantId } = useAuth();
  const { showSuccess, showError } = useNotification();

  // State management
  const [posts, setPosts] = useState([]);
  const [businessUnit, setBusinessUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  // Post detail modal state
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [postDetailLoading, setPostDetailLoading] = useState(false);

  // Modal state for creating new post
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPostData, setCreatePostData] = useState({
    title: "",
    body: "",
    targetAudience: "ALL_EMPLOYEES",
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Filter and search states
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTargetAudience, setSelectedTargetAudience] = useState("");

  // Pagination and sorting
  const [currentPage] = useState(0);
  const [postsPerPage] = useState(20);

  // Target audience options
  const targetAudienceOptions = useMemo(
    () => [
      { value: "ALL_EMPLOYEES", label: "All Employees" },
      { value: "MANAGERS_ONLY", label: "Managers Only" },
    ],
    []
  );

  // Access control check
  useEffect(() => {
    if (user && user.role !== "MANAGER" && user.role !== "ADMIN") {
      showError(
        "Access denied. This page is only accessible to managers and administrators."
      );
    }
  }, [user]);

  // Fetch initial data
  useEffect(() => {
    if (user && (user.role === "MANAGER" || user.role === "ADMIN")) {
      fetchInitialData();
    }
  }, [user, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const businessUnitId = getRestaurantId();

      // Fetch business unit info and posts
      const [businessUnitResponse, postsResponse] = await Promise.all([
        authenticatedFetch(API_ENDPOINTS_CONFIG.businessUnit(businessUnitId)),
        authenticatedFetch(
          API_ENDPOINTS_CONFIG.postsForBusinessUnit(
            businessUnitId,
            currentPage,
            postsPerPage
          )
        ),
      ]);

      if (businessUnitResponse.ok) {
        const businessUnitData = await businessUnitResponse.json();
        setBusinessUnit(businessUnitData);
      }

      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        setPosts(postsData.posts || []);
      } else {
        throw new Error("Failed to fetch posts");
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
      showError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filtered and sorted posts
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = posts.filter((post) => {
      const matchesSearch =
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.body.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTargetAudience =
        !selectedTargetAudience ||
        post.targetAudience === selectedTargetAudience;

      return matchesSearch && matchesTargetAudience;
    });

    // Sort posts by creation date (newest first)
    filtered.sort((a, b) => {
      const aDate = new Date(a.createdAt);
      const bDate = new Date(b.createdAt);
      return bDate - aDate;
    });

    return filtered;
  }, [posts, searchTerm, selectedTargetAudience]);

  // Handle create post
  const handleCreatePost = async (e) => {
    e.preventDefault();

    if (!createPostData.title.trim() || !createPostData.body.trim()) {
      showError("Please fill in all required fields");
      return;
    }

    try {
      setCreateLoading(true);
      const businessUnitId = getRestaurantId();

      const response = await authenticatedFetch(API_ENDPOINTS_CONFIG.posts(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...createPostData,
          businessUnitId,
        }),
      });

      if (response.ok) {
        const newPost = await response.json();
        setPosts((prevPosts) => [newPost, ...prevPosts]);
        setShowCreateModal(false);
        setCreatePostData({
          title: "",
          body: "",
          targetAudience: "ALL_EMPLOYEES",
        });
        showSuccess("Post created successfully!");
      } else {
        throw new Error("Failed to create post");
      }
    } catch (error) {
      console.error("Error creating post:", error);
      showError("Failed to create post. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  // Helper functions
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAuthorName = (post) => {
    if (post.creatorUserFirstName || post.creatorUserLastName) {
      return `${post.creatorUserFirstName || ""} ${
        post.creatorUserLastName || ""
      }`.trim();
    }
    return `User ${post.authorUserId}`;
  };

  const openPostModal = async (post) => {
    try {
      setPostDetailLoading(true);
      setShowPostModal(true);
      setSelectedPost(post); // Set initial post data first

      // Fetch detailed post information
      const response = await authenticatedFetch(API_ENDPOINTS_CONFIG.postById(post.id));
      
      if (response.ok) {
        const detailedPost = await response.json();
        setSelectedPost(detailedPost);
      } else {
        console.error("Failed to fetch post details");
        showError("Failed to load post details. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching post details:", error);
      showError("Failed to load post details. Please try again.");
    } finally {
      setPostDetailLoading(false);
    }
  };

  const closePostModal = () => {
    setShowPostModal(false);
    setSelectedPost(null);
  };

  const getTargetAudienceLabel = useCallback(
    (targetAudience) => {
      const option = targetAudienceOptions.find(
        (opt) => opt.value === targetAudience
      );
      return option ? option.label : targetAudience;
    },
    [targetAudienceOptions]
  );

  const getTargetAudienceIcon = (targetAudience) => {
    switch (targetAudience) {
      case "ALL_EMPLOYEES":
        return <Users className="w-4 h-4 text-blue-500" />;
      case "MANAGERS_ONLY":
        return <Users className="w-4 h-4 text-green-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  // Active filters
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedTargetAudience) {
      filters.push({
        key: "targetAudience",
        label: `Audience: ${getTargetAudienceLabel(selectedTargetAudience)}`,
      });
    }
    return filters;
  }, [selectedTargetAudience, getTargetAudienceLabel]);

  const removeFilter = (filterKey) => {
    switch (filterKey) {
      case "targetAudience":
        setSelectedTargetAudience("");
        break;
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedTargetAudience("");
  };

  // Access denied check
  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Access Denied</h3>
          <p className="text-gray-500">
            You need manager or administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="w-8 h-8 text-blue-600 mr-3" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
                  <p className="text-gray-600">
                    Manage announcements and posts for{" "}
                    {businessUnit?.name || "your business unit"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <button
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="text-gray-500 hover:text-gray-700"
              >
                {filtersExpanded ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {filtersExpanded && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Target Audience Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Audience
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    value={selectedTargetAudience}
                    onChange={(e) => setSelectedTargetAudience(e.target.value)}
                  >
                    <option value="">All Audiences</option>
                    {targetAudienceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search posts by title or content..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Active Filters */}
              {activeFilters.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="flex flex-wrap gap-2">
                    {activeFilters.map((filter) => (
                      <span
                        key={filter.key}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {filter.label}
                        <button
                          onClick={() => removeFilter(filter.key)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Posts List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Posts Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <MessageSquare className="w-6 h-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Posts</h3>
                  <p className="text-sm text-gray-600">
                    {filteredAndSortedPosts.length} posts found
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading posts...</span>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredAndSortedPosts.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                No Posts Found
              </h4>
              <p className="text-gray-600">
                {activeFilters.length > 0 || searchTerm
                  ? "Try adjusting your search criteria"
                  : "Create your first post to get started"}
              </p>
              {!activeFilters.length && !searchTerm && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Post
                </button>
              )}
            </div>
          )}

          {/* Posts List */}
          {!loading && filteredAndSortedPosts.length > 0 && (
            <div className="divide-y divide-gray-200">
              {filteredAndSortedPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                  onClick={() => openPostModal(post)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3">
                        <h4 className="text-lg font-medium text-gray-900 truncate">
                          {post.title}
                        </h4>
                        <div className="flex items-center space-x-1">
                          {getTargetAudienceIcon(post.targetAudience)}
                          <span className="text-xs text-gray-500">
                            {getTargetAudienceLabel(post.targetAudience)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center text-sm text-gray-500 space-x-4 mt-1">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          {getAuthorName(post)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {formatDate(post.createdAt)}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex-shrink-0">
                      <button className="text-gray-400 hover:text-gray-500">
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Create New Post
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreatePost}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={200}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      value={createPostData.title}
                      onChange={(e) =>
                        setCreatePostData({
                          ...createPostData,
                          title: e.target.value,
                        })
                      }
                      placeholder="Enter post title..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Content *
                    </label>
                    <textarea
                      required
                      maxLength={5000}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      value={createPostData.body}
                      onChange={(e) =>
                        setCreatePostData({
                          ...createPostData,
                          body: e.target.value,
                        })
                      }
                      placeholder="Write your post content..."
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      {createPostData.body.length}/5000 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Audience
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      value={createPostData.targetAudience}
                      onChange={(e) =>
                        setCreatePostData({
                          ...createPostData,
                          targetAudience: e.target.value,
                        })
                      }
                    >
                      {targetAudienceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Create Post
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {showPostModal && selectedPost && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl font-semibold text-gray-900">
                    Post Details
                  </h3>
                </div>
                <button
                  onClick={closePostModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Post Content */}
              {postDetailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading post details...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Title and Audience */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-2xl font-bold text-gray-900">
                        {selectedPost.title}
                      </h4>
                      <div className="flex items-center space-x-2">
                        {getTargetAudienceIcon(selectedPost.targetAudience)}
                        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                          {getTargetAudienceLabel(selectedPost.targetAudience)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Author and Date Info */}
                  <div className="flex items-center justify-between py-3 border-y border-gray-200">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {getAuthorName(selectedPost)}
                          </p>
                          <p className="text-xs text-gray-500">Author</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-2" />
                      {formatDate(selectedPost.createdAt)}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Message
                    </h5>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {selectedPost.body}
                      </p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {/* <div className="bg-blue-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-900">Post ID:</span>
                        <p className="text-blue-800">{selectedPost.id}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-900">Created:</span>
                        <p className="text-blue-800">{formatDate(selectedPost.createdAt)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-blue-900">Last Updated:</span>
                        <p className="text-blue-800">{formatDate(selectedPost.updatedAt)}</p>
                      </div>
                    </div>
                  </div> */}
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={closePostModal}
                  className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostsView;
