import React, { useState, useEffect, useContext } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../../Context/AuthContext";
import { api } from "../../config/api";

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filter, setFilter] = useState({
    category: "",
    status: "",
    type: "",
  });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [deleteModal, setDeleteModal] = useState({
    show: false,
    type: null,
    data: null,
  });
  const itemsPerPage = 20;

  const { token } = useContext(AuthContext);

  // Calculate stats from transactions data
  const calculateStats = (transactionsData) => {
    const stats = {
      totalTransactions: transactionsData.length,
      totalIncome: 0,
      totalExpenses: 0,
      pendingCount: 0,
    };

    transactionsData.forEach((transaction) => {
      if (transaction.type === "income") {
        stats.totalIncome += parseFloat(transaction.amount) || 0;
      } else if (transaction.type === "expense") {
        stats.totalExpenses += parseFloat(transaction.amount) || 0;
      }

      if (
        transaction.status === "needs_review" ||
        transaction.status === "pending"
      ) {
        stats.pendingCount += 1;
      }
    });

    return { summary: stats };
  };

  // Load transactions on component mount
  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
    loadTransactions();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTransactions();
  }, [currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTransactions = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (!token) {
        setTransactions([]);
        setTotalPages(1);
        setTotalTransactions(0);
        setStats(null);
        setLoadError("Please login to view your transactions.");
        return;
      }

      const response = await api.transactions.getAll({
        category: filter.category || undefined,
        status: filter.status || undefined,
        type: filter.type || undefined,
        limit: itemsPerPage,
        page: currentPage,
      });

      const transactionsData = response.data?.transactions ?? [];

      console.log("📊 Loaded transactions:", transactionsData.length);
      if (transactionsData.length > 0) {
        const typeCounts = transactionsData.reduce((acc, t) => {
          acc[t.type] = (acc[t.type] || 0) + 1;
          return acc;
        }, {});
        console.log("  Type breakdown:", typeCounts);
        console.log("  Filter applied:", filter);
      }

      setTransactions(transactionsData);
      setTotalPages(response.data?.totalPages || 1);
      setTotalTransactions(response.data?.total || 0);

      if (transactionsData.length === 0 && currentPage === 1) {
        console.log(
          "No transactions found. Upload a file to create transactions."
        );
      }

      // Calculate stats from all transactions (we'll fetch this separately)
      fetchStats();
    } catch (error) {
      // The central API client already shows a useful toast and handles 401 redirects.
      // Keep this page from showing a misleading generic toast.
      console.error(
        "Error loading transactions:",
        error?.response?.data || error?.message
      );
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (error?.message === "Network Error"
          ? "Cannot reach the backend. Make sure it is running on port 5000."
          : "Could not load transactions.");
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.transactions.getStats();
      setStats(response.data);
    } catch (error) {
      console.error(
        "Error fetching stats:",
        error?.response?.data || error?.message
      );
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/pdf",
      ];
      if (
        validTypes.includes(file.type) ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls") ||
        file.name.endsWith(".pdf")
      ) {
        setSelectedFile(file);
      } else {
        toast.error("Please select a valid Excel (.xlsx, .xls) or PDF file");
        event.target.value = "";
      }
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    if (!token) {
      toast.error("Authentication token missing. Please log in again.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await api.transactions.upload(formData);

      const responseData = response.data.data || response.data;
      const transactionsFound =
        responseData.transactionsFound || response.data.transactionsFound || 0;
      const transactionsSaved =
        responseData.transactionsSaved ||
        responseData.totalProcessed ||
        response.data.transactionsSaved ||
        0;

      console.log(
        `📊 Results: Found ${transactionsFound}, Saved ${transactionsSaved}`
      );

      toast.success(
        `File processed! Found ${transactionsFound} transactions, saved ${transactionsSaved}`
      );
      setSelectedFile(null);
      document.getElementById("fileInput").value = "";

      // Reload transactions after a short delay to ensure database is updated
      setTimeout(() => {
        loadTransactions();
      }, 500);
    } catch (error) {
      console.error("Upload failed:", error?.response?.data || error?.message);
      // Central API client already toasted with server-provided message when possible.
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateTransaction = async (id, updates) => {
    try {
      await api.transactions.update(id, updates);
      toast.success("Transaction updated successfully");
      setEditingTransaction(null);
      loadTransactions();
    } catch (error) {
      console.error(
        "Error updating transaction:",
        error?.response?.data || error?.message
      );
    }
  };

  const handleDeleteTransaction = (id) => {
    setDeleteModal({ show: true, type: "single", data: id });
  };

  const confirmDeleteSingle = async () => {
    const id = deleteModal.data;
    setDeleteModal({ show: false, type: null, data: null });

    try {
      await api.transactions.delete(id);
      toast.success("Transaction deleted successfully");
      setSelectedTransactions([]);
      loadTransactions();
    } catch (error) {
      console.error(
        "Error deleting transaction:",
        error?.response?.data || error?.message
      );
      toast.error("Failed to delete transaction");
    }
  };

  // Toggle selection for a single transaction
  const handleToggleSelect = (id) => {
    setSelectedTransactions((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id]
    );
  };

  // Toggle select all transactions on current page
  const handleSelectAll = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map((t) => t._id));
    }
  };

  // Bulk delete selected transactions
  const handleBulkDelete = () => {
    if (selectedTransactions.length === 0) {
      toast.error("Please select transactions to delete");
      return;
    }
    setDeleteModal({ show: true, type: "bulk", data: selectedTransactions });
  };

  const confirmDeleteBulk = async () => {
    const ids = deleteModal.data;
    setDeleteModal({ show: false, type: null, data: null });

    try {
      await api.transactions.bulkDelete(ids);
      toast.success(
        `${ids.length} transaction${
          ids.length > 1 ? "s" : ""
        } deleted successfully`
      );
      setSelectedTransactions([]);
      loadTransactions();
    } catch (error) {
      console.error(
        "Error bulk deleting transactions:",
        error?.response?.data || error?.message
      );
      toast.error("Failed to delete transactions");
    }
  };

  // Delete all transactions
  const handleDeleteAll = () => {
    if (totalTransactions === 0) {
      toast.error("No transactions to delete");
      return;
    }
    setDeleteModal({ show: true, type: "all", data: totalTransactions });
  };

  const confirmDeleteAll = async () => {
    setDeleteModal({ show: false, type: null, data: null });

    try {
      const response = await api.transactions.deleteAll();
      toast.success(
        response.data.message || "All transactions deleted successfully"
      );
      setSelectedTransactions([]);
      loadTransactions();
    } catch (error) {
      console.error(
        "Error deleting all transactions:",
        error?.response?.data || error?.message
      );
      toast.error("Failed to delete all transactions");
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-100";
      case "rejected":
        return "text-red-600 bg-red-100";
      case "needs_review":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "income":
        return "text-green-600";
      case "expense":
        return "text-red-600";
      case "transfer":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
        ))}
      </div>
      <div className="bg-gray-200 h-64 rounded-lg"></div>
    </div>
  );

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-16 px-4">
      <svg
        className="mx-auto h-24 w-24 text-gray-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No transactions yet
      </h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        Upload an Excel or PDF file to get started analyzing your financial data
        with AI
      </p>
      <button
        onClick={() => document.getElementById("fileInput")?.click()}
        className="ui-btn inline-flex items-center gap-2 text-white"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        Upload Your First File
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {loadError && (
        <div className="ui-card p-4 border border-[color:rgba(0,173,181,0.22)] bg-[color:rgba(0,173,181,0.06)]">
          <div className="text-sm text-[color:var(--ui-ink)]">{loadError}</div>
        </div>
      )}
      <div className="flex items-center mb-6">
        <svg
          className="w-8 h-8 text-blue-600 mr-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        <h1 className="text-3xl font-bold text-gray-800">Transactions</h1>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Transactions Card */}
            <div className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors duration-300">
                  <svg
                    className="w-6 h-6 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">
                  Total Transactions
                </p>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {stats.summary?.totalTransactions?.toLocaleString() || 0}
                </p>
                <div className="flex items-center text-xs text-gray-400">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  All time
                </div>
              </div>
            </div>

            {/* Total Income Card */}
            <div className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-green-200 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors duration-300">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 11l5-5m0 0l5 5m-5-5v12"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-lg">
                  <svg
                    className="w-3 h-3 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-semibold text-green-700">
                    Income
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">
                  Total Income
                </p>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {formatCurrency(stats.summary?.totalIncome || 0)}
                </p>
                <div className="flex items-center text-xs text-green-600 font-medium">
                  <span>Revenue generated</span>
                </div>
              </div>
            </div>

            {/* Total Expenses Card */}
            <div className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-red-200 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors duration-300">
                  <svg
                    className="w-6 h-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 13l-5 5m0 0l-5-5m5 5V6"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg">
                  <svg
                    className="w-3 h-3 text-red-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-semibold text-red-700">
                    Expenses
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">
                  Total Expenses
                </p>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {formatCurrency(stats.summary?.totalExpenses || 0)}
                </p>
                <div className="flex items-center text-xs text-red-600 font-medium">
                  <span>Money spent</span>
                </div>
              </div>
            </div>

            {/* Pending Review Card */}
            <div className="group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:border-amber-200 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors duration-300">
                  <svg
                    className="w-6 h-6 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-amber-700">
                    Pending
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium mb-1">
                  Needs Review
                </p>
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {stats.summary?.pendingCount?.toLocaleString() || 0}
                </p>
                <div className="flex items-center text-xs text-amber-600 font-medium">
                  <span>Awaiting approval</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          {stats.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <svg
                  className="w-6 h-6 text-gray-700 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-gray-800">
                  Category Breakdown
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.categoryBreakdown.map((cat, index) => (
                  <div
                    key={index}
                    onClick={() =>
                      setFilter((prev) => ({ ...prev, category: cat._id }))
                    }
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-semibold text-gray-700 truncate flex-1">
                        {cat._id || "Uncategorized"}
                      </h4>
                      <span className="text-xs bg-gray-200 px-2 py-1 rounded-full ml-2">
                        {cat.count}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(cat.totalAmount)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {cat.count} transaction{cat.count !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
              {filter.category && (
                <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <span className="text-sm text-blue-700">
                    <strong>Filtered by:</strong> {filter.category}
                  </span>
                  <button
                    onClick={() =>
                      setFilter((prev) => ({ ...prev, category: "" }))
                    }
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* File Upload Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center mb-4">
          <svg
            className="w-6 h-6 text-gray-700 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800">
            Upload Transactions
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="file"
            id="fileInput"
            accept=".xlsx,.xls,.pdf"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleFileUpload}
            disabled={!selectedFile || isUploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isUploading ? "Processing..." : "Upload & Analyze"}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Supported formats: Excel (.xlsx, .xls) and PDF files. AI will analyze
          and extract transactions automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <svg
            className="w-5 h-5 text-gray-700 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-800">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filter.category}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, category: e.target.value }))
            }
            className="p-2 border border-gray-300 rounded-md text-black"
          >
            <option value="">All Categories</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Travel">Travel</option>
            <option value="Meals & Entertainment">Meals & Entertainment</option>
            <option value="Software">Software</option>
            <option value="Hardware">Hardware</option>
            <option value="Marketing">Marketing</option>
            <option value="Utilities">Utilities</option>
            <option value="Rent">Rent</option>
            <option value="Insurance">Insurance</option>
            <option value="Uncategorized">Uncategorized</option>
          </select>

          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, status: e.target.value }))
            }
            className="p-2 border border-gray-300 rounded-md text-black"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="needs_review">Needs Review</option>
          </select>

          <select
            value={filter.type}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, type: e.target.value }))
            }
            className="p-2 border border-gray-300 rounded-md text-black"
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {isLoading && !transactions.length ? (
        <LoadingSkeleton />
      ) : transactions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center">
            <svg
              className="w-6 h-6 text-gray-700 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-800">
              Transaction History
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading transactions...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mb-4">
                <svg
                  className="w-16 h-16 mx-auto text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Transactions Yet
              </h3>
              <p className="text-gray-500 mb-4">
                Upload an Excel or PDF file to get started!
              </p>
              <p className="text-sm text-gray-400">
                Your transactions will appear here once uploaded and analyzed by
                AI.
              </p>
            </div>
          ) : (
            <>
              {/* Bulk Actions Toolbar */}
              {(selectedTransactions.length > 0 || transactions.length > 0) && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {selectedTransactions.length > 0 && (
                      <span className="text-sm text-gray-700 font-medium">
                        {selectedTransactions.length} selected
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTransactions.length > 0 && (
                      <>
                        <button
                          onClick={() => setSelectedTransactions([])}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Clear Selection
                        </button>
                        <button
                          onClick={handleBulkDelete}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Delete Selected ({selectedTransactions.length})
                        </button>
                      </>
                    )}
                    {transactions.length > 0 && (
                      <button
                        onClick={handleDeleteAll}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Delete All ({totalTransactions})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectedTransactions.length ===
                              transactions.length && transactions.length > 0
                          }
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {transactions.map((transaction, index) => (
                      <tr key={transaction._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedTransactions.includes(
                              transaction._id
                            )}
                            onChange={() => handleToggleSelect(transaction._id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-black max-w-xs truncate">
                          {transaction.desc}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getTypeColor(
                            transaction.type
                          )}`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-black">
                          {transaction.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`capitalize ${getTypeColor(
                              transaction.type
                            )}`}
                          >
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              transaction.status
                            )}`}
                          >
                            {transaction.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setEditingTransaction(transaction)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteTransaction(transaction._id)
                            }
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden divide-y divide-gray-200">
                {transactions.map((transaction, index) => (
                  <div key={transaction._id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.includes(
                            transaction._id
                          )}
                          onChange={() => handleToggleSelect(transaction._id)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">
                              #{(currentPage - 1) * itemsPerPage + index + 1}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(transaction.date)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            {transaction.desc}
                          </p>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                              {transaction.category}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
                                transaction.status
                              )}`}
                            >
                              {transaction.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-lg font-semibold ${getTypeColor(
                          transaction.type
                        )}`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingTransaction(transaction)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteTransaction(transaction._id)
                          }
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-700">
                    Showing{" "}
                    <span className="font-medium">
                      {(currentPage - 1) * itemsPerPage + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, totalTransactions)}
                    </span>{" "}
                    of <span className="font-medium">{totalTransactions}</span>{" "}
                    transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <div className="flex gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = idx + 1;
                        } else if (currentPage <= 3) {
                          pageNum = idx + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + idx;
                        } else {
                          pageNum = currentPage - 2 + idx;
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 border rounded-md text-sm font-medium ${
                              currentPage === pageNum
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-gray-300 text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Edit Transaction
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const updates = {
                  desc: formData.get("desc"),
                  amount: parseFloat(formData.get("amount")),
                  category: formData.get("category"),
                  type: formData.get("type"),
                  status: formData.get("status"),
                };
                handleUpdateTransaction(editingTransaction._id, updates);
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <input
                    type="text"
                    name="desc"
                    defaultValue={editingTransaction.desc}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="amount"
                    defaultValue={editingTransaction.amount}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    defaultValue={editingTransaction.category}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    name="type"
                    defaultValue={editingTransaction.type}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={editingTransaction.status}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-black"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="needs_review">Needs Review</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all"
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl flex items-center justify-center shadow-sm ring-1 ring-red-200/50">
                    <svg
                      className="w-7 h-7 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                    {deleteModal.type === "single" && "Delete Transaction?"}
                    {deleteModal.type === "bulk" &&
                      "Delete Selected Transactions?"}
                    {deleteModal.type === "all" && "Delete All Transactions?"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1.5 font-medium">
                    This action cannot be undone
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-6">
              <div className="space-y-5">
                {/* Warning Badge */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
                        <svg
                          className="w-4 h-4 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-1.5">
                        Warning: Permanent Deletion
                      </p>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        {deleteModal.type === "single" && (
                          <>
                            You are about to permanently delete this
                            transaction.
                          </>
                        )}
                        {deleteModal.type === "bulk" && (
                          <>
                            You are about to permanently delete{" "}
                            <span className="font-bold text-amber-900">
                              {deleteModal.data?.length?.toLocaleString()}
                            </span>{" "}
                            selected transaction
                            {deleteModal.data?.length !== 1 ? "s" : ""}.
                          </>
                        )}
                        {deleteModal.type === "all" && (
                          <>
                            You are about to permanently delete{" "}
                            <span className="font-bold text-amber-900">
                              {deleteModal.data?.toLocaleString()}
                            </span>{" "}
                            transaction{deleteModal.data !== 1 ? "s" : ""}.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Impact List */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/60">
                  <p className="text-sm font-bold text-gray-900 mb-3">
                    This will remove:
                  </p>
                  <ul className="space-y-2">
                    {deleteModal.type === "single" && (
                      <>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>The selected transaction record</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Associated financial data</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Category and status information</span>
                        </li>
                      </>
                    )}
                    {deleteModal.type === "bulk" && (
                      <>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>All selected transaction records</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Associated financial data and history</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Related categorization and tags</span>
                        </li>
                      </>
                    )}
                    {deleteModal.type === "all" && (
                      <>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>All transaction records from your account</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Complete financial data and history</span>
                        </li>
                        <li className="flex items-start gap-2.5 text-sm text-gray-700">
                          <svg
                            className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>All categorization and tags</span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Critical Warning */}
                <div className="relative overflow-hidden bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
                  <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-red-100/30 rounded-full blur-2xl"></div>
                  <div className="relative flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-5 h-5 bg-red-500 rounded-md flex items-center justify-center">
                        <span className="text-white text-xs font-bold">!</span>
                      </div>
                    </div>
                    <p className="text-sm text-red-900 font-semibold leading-relaxed">
                      This action is irreversible. Your data cannot be recovered
                      once deleted.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gradient-to-b from-gray-50 to-gray-100/50 px-6 py-5 rounded-b-2xl border-t border-gray-200/60 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() =>
                  setDeleteModal({ show: false, type: null, data: null })
                }
                className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteModal.type === "single") confirmDeleteSingle();
                  else if (deleteModal.type === "bulk") confirmDeleteBulk();
                  else if (deleteModal.type === "all") confirmDeleteAll();
                }}
                className="px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-700 rounded-xl hover:from-red-700 hover:to-red-800 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-lg hover:shadow-xl flex items-center justify-center gap-2.5 group cursor-pointer"
              >
                <svg
                  className="w-4 h-4 group-hover:scale-110 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {deleteModal.type === "single" && "Delete Transaction"}
                {deleteModal.type === "bulk" &&
                  `Delete ${deleteModal.data?.length} Transaction${
                    deleteModal.data?.length !== 1 ? "s" : ""
                  }`}
                {deleteModal.type === "all" && "Delete All Transactions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
