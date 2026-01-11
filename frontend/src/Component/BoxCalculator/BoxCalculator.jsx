import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ExcelGenerator = () => {
  const [recordCount, setRecordCount] = useState(10000);
  const [stats, setStats] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [datasetType, setDatasetType] = useState('expenses'); // 'expenses' or 'sales'

  const generateExcel = async () => {
    setIsGenerating(true);
    try {
      const endpoint = datasetType === 'expenses' 
        ? `http://localhost:5000/api/excel/expenses/download?count=${recordCount}`
        : `http://localhost:5000/api/excel/sales/download?count=${recordCount}`;
      
      const response = await axios.get(endpoint, {
        responseType: 'blob' // Important for file download
      });

      // Create blob and download file
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${datasetType}_report_${recordCount}_records_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`${datasetType === 'expenses' ? 'Expense' : 'Sales'} Excel file with ${recordCount} records downloaded successfully!`);
    } catch (error) {
      console.error('Error generating Excel:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate Excel file';
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const endpoint = datasetType === 'expenses'
        ? `http://localhost:5000/api/excel/expenses/stats?count=${Math.min(recordCount, 1000)}`
        : `http://localhost:5000/api/excel/sales/stats?count=${Math.min(recordCount, 1000)}`;
      
      const response = await axios.get(endpoint);
      setStats(response.data);
      toast.success('Statistics loaded successfully!');
    } catch (error) {
      console.error('Error loading stats:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load statistics';
      toast.error(errorMessage);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const getDisplayTitle = () => {
    return datasetType === 'expenses' 
      ? 'Excel Expense Report Generator' 
      : 'Excel Sales Report Generator';
  };

  const getGenerateButtonText = () => {
    return datasetType === 'expenses' 
      ? `Download Expense Excel (${recordCount.toLocaleString()} records)`
      : `Download Sales Excel (${recordCount.toLocaleString()} records)`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        {getDisplayTitle()}
      </h2>
      
      {/* Dataset Type Selector */}
      <div className="mb-6 flex justify-center">
        <div className="bg-gray-100 rounded-lg p-1 flex">
          <button
            onClick={() => {
              setDatasetType('expenses');
              setStats(null); // Clear stats when switching
            }}
            className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center ${
              datasetType === 'expenses'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Expenses
          </button>
          <button
            onClick={() => {
              setDatasetType('sales');
              setStats(null); // Clear stats when switching
            }}
            className={`px-6 py-2 rounded-md font-medium transition-colors flex items-center ${
              datasetType === 'sales'
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Sales
          </button>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Excel Generation Section */}
        <div className={`${datasetType === 'expenses' ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-lg p-6`}>
          <h3 className={`text-xl font-semibold ${datasetType === 'expenses' ? 'text-blue-800' : 'text-green-800'} mb-4`}>
            Generate {datasetType === 'expenses' ? 'Expense' : 'Sales'} Report
          </h3>
          
          <div className="mb-4">
            <label htmlFor="recordCount" className="block text-sm font-medium text-gray-700 mb-2">
              Number of Records:
            </label>
            <input
              id="recordCount"
              type="number"
              value={recordCount}
              onChange={(e) => setRecordCount(Math.max(1, Math.min(50000, parseInt(e.target.value) || 1)))}
              min="1"
              max="50000"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-1">Maximum: 50,000 records</p>
          </div>
          
          <button
            onClick={generateExcel}
            disabled={isGenerating}
            className={`w-full ${datasetType === 'expenses' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white py-3 px-6 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Excel...
              </span>
            ) : (
              getGenerateButtonText()
            )}
          </button>
        </div>

        {/* Statistics Section */}
        <div className={`${datasetType === 'expenses' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-6`}>
          <h3 className={`text-xl font-semibold ${datasetType === 'expenses' ? 'text-green-800' : 'text-blue-800'} mb-4`}>Preview Statistics</h3>
          
          <button
            onClick={loadStats}
            disabled={isLoadingStats}
            className={`w-full ${datasetType === 'expenses' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white py-3 px-6 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium mb-4`}
          >
            {isLoadingStats ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              'Load Preview Stats'
            )}
          </button>

          {stats && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3 shadow-sm">
                <h4 className="font-medium text-black mb-1">Total Records</h4>
                <p className="text-2xl font-bold text-black">{stats.totalRecords.toLocaleString()}</p>
              </div>
              
              {datasetType === 'expenses' ? (
                <>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <h4 className="font-medium text-black mb-1">Total Amount</h4>
                    <p className="text-xl font-bold text-black">${stats.totalAmount}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <h4 className="font-medium text-black mb-1">Average Expense</h4>
                    <p className="text-lg font-bold text-black">${stats.averageAmount}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <h4 className="font-medium text-black mb-1">Total Sales</h4>
                    <p className="text-xl font-bold text-black">${stats.totalNetAmount}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <h4 className="font-medium text-black mb-1">Average Sale</h4>
                    <p className="text-lg font-bold text-black">${stats.averageSaleAmount}</p>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <h4 className="font-medium text-black mb-1">Total Commission</h4>
                    <p className="text-lg font-bold text-black">${stats.totalCommission}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Features Description */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 What's Included in the Excel File</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-black mb-2">🆔 Expense Details</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Unique Expense IDs</li>
              <li>• Dates (2023-2024)</li>
              <li>• Employee Names</li>
              <li>• Departments</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4 className="font-medium text-black">Financial Data</h4>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Expense Amounts</li>
              <li>• Categories & Vendors</li>
              <li>• Tax Calculations</li>
              <li>• Payment Methods</li>
            </ul>
          </div>
          
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-black mb-2">� Business Logic</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Approval Status</li>
              <li>• Project Codes</li>
              <li>• Receipt Tracking</li>
              <li>• Reimbursement Flags</li>
            </ul>
          </div>
        </div>
      </div>

      {stats && stats.sampleData && (
        <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">👀 Sample Data Preview</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left text-black">Employee</th>
                  <th className="px-3 py-2 text-left text-black">Category</th>
                  <th className="px-3 py-2 text-left text-black">Amount</th>
                  <th className="px-3 py-2 text-left text-black">Date</th>
                  <th className="px-3 py-2 text-left text-black">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.sampleData.slice(0, 5).map((expense, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 text-black">{expense.Employee}</td>
                    <td className="px-3 py-2 text-black">{expense.Category}</td>
                    <td className="px-3 py-2 text-black">${expense.Amount}</td>
                    <td className="px-3 py-2 text-black">{expense.Date}</td>
                    <td className="px-3 py-2 text-black">{expense.Status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExcelGenerator;