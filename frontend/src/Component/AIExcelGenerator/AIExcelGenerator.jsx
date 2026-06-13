import React, { useState, useContext } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "../../components/Head/Helmet";
import toast from "react-hot-toast";
import { AuthContext } from "../../Context/AuthContext";
import { useSubscription } from "../../Context/SubscriptionContext";
import { api, API_ORIGIN } from "../../config/api";
import FormulaBox from "../../components/FormulaBox";

const AIExcelGenerator = () => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedFile, setGeneratedFile] = useState(null);
  const { token, userId } = useContext(AuthContext);
  const { isAtLimit, usage, planDetails } = useSubscription();
  const excelAtLimit = isAtLimit("aiExcelGenerations");

  // Surface the cell formulas the AI wrote into the sheet so the user can audit them.
  const excelFormulas = (generatedFile?.config?.formulas || []).map((f) => ({
    label: `Cell ${f.cell}`,
    formula: f.formula,
  }));

  const examples = [
    "Create an excel sheet with 10 green rows where I can enter values, then save the sum in the first row second column with yellow background",
    "Make a budget tracker with 5 columns: Date, Category, Amount, Notes, and Balance. Add formulas to calculate running balance",
    "Create a grade sheet with student names in column A, 3 test scores in columns B-D, and average in column E with conditional formatting",
    "Generate a monthly expense tracker with categories in rows and months in columns, include total row at bottom",
    "Create an inventory sheet with item name, quantity, unit price, and total value columns. Make headers blue with white text",
  ];

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setLoading(true);
    setGeneratedFile(null);

    try {
      const response = await api.aiExcel.generate({ prompt });
      const data = response.data;
      if (data?.success) {
        setGeneratedFile(data);
        toast.success("Excel file generated successfully!");
      }
    } catch (error) {
      // API interceptor handles user-facing error toast.
      console.error("Error generating Excel:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedFile) return;

    try {
      const response = await fetch(
        `${API_ORIGIN}${generatedFile.downloadUrl}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = generatedFile.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("File downloaded successfully!");
      } else {
        toast.error("Failed to download file");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Helmet>
        <title>AI Excel Generator - AI Accountant</title>
      </Helmet>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink-2 mb-2">
          AI Excel Generator
        </h1>
        <p className="text-muted-2">
          Describe your Excel sheet in natural language and let AI create it for
          you
        </p>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Input */}
        <div className="lg:col-span-2 space-y-6">
          {/* Prompt Input */}
          <div className="bg-surface rounded-2xl shadow-lg p-6">              {excelAtLimit && (
                <div className="mb-4 rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#dc2626" }}>
                  <span>You've used all your AI Excel generations for this month ({usage.aiExcelGenerations || 0}/{planDetails?.limits?.aiExcelGenerations}).</span>
                  <Link to={`/app/${userId}/subscription`} className="ml-3 shrink-0 underline font-semibold hover:opacity-80">Upgrade plan</Link>
                </div>
              )}            <label className="block text-sm font-medium text-ink mb-3">
              Describe Your Excel Sheet
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Create an excel sheet with 10 green rows where I can enter values, then save the sum in the first row second column with yellow background"
              className="w-full h-48 px-4 py-3 border border-theme rounded-lg focus:ring-2 focus:ring-[color:var(--ui-accent)] focus:border-transparent resize-none text-ink bg-surface placeholder-[color:var(--ui-muted)]"
              disabled={loading}
            />

            {/* Action Buttons */}
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setPrompt("")}
                className="text-muted-2 hover:text-ink font-medium"
                disabled={loading}
              >
                Clear
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || excelAtLimit}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
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
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    <span>Generate Excel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result Card */}
          {generatedFile && (
            <div className="bg-surface rounded-2xl shadow-lg p-6 border border-theme">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="bg-emerald-500 p-3 rounded-xl">
                    <svg
                      className="w-8 h-8 text-white"
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
                  <div>
                    <h3 className="text-lg font-bold text-ink-2 mb-1">
                      Excel File Generated!
                    </h3>
                    <p className="text-sm text-muted mb-3">
                      {generatedFile.fileName}
                    </p>
                    <button
                      onClick={handleDownload}
                      className="flex items-center space-x-2 bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition-colors font-medium"
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>Download Excel</span>
                    </button>
                  </div>
                </div>
              </div>

              {excelFormulas.length > 0 && (
                <FormulaBox
                  className="mt-5"
                  defaultOpen
                  title="Formulas used in this sheet"
                  subtitle="Each formula is written into the cell shown — open the file to verify the results."
                  formulas={excelFormulas}
                />
              )}
            </div>
          )}
        </div>

        {/* Right Column - Examples & Tips */}
        <div className="space-y-6">
          {/* Examples */}
          <div className="bg-surface rounded-2xl shadow-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <svg
                className="w-5 h-5 text-[color:var(--ui-accent)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <h3 className="font-bold text-ink-2">Example Prompts</h3>
            </div>
            <div className="space-y-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  disabled={loading}
                  className="w-full text-left p-3 bg-surface-alt hover:bg-[color:var(--ui-surface-2)] rounded-lg text-sm text-ink hover:text-[color:var(--ui-accent)] transition-colors border border-theme hover:border-[color:var(--ui-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="bg-surface-alt rounded-2xl shadow-lg p-6 border border-theme">
            <div className="flex items-center space-x-2 mb-4">
              <svg
                className="w-5 h-5 text-[color:var(--ui-accent)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="font-bold text-ink-2">Tips</h3>
            </div>
            <ul className="space-y-3 text-sm text-ink">
              <li className="flex items-start space-x-2">
                <span className="text-[color:var(--ui-accent)] mt-1">•</span>
                <span>Specify colors (green, yellow, blue, red, etc.)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[color:var(--ui-accent)] mt-1">•</span>
                <span>Mention number of rows and columns</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[color:var(--ui-accent)] mt-1">•</span>
                <span>Request formulas (SUM, AVERAGE, etc.)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[color:var(--ui-accent)] mt-1">•</span>
                <span>Define cell positions (first row, second column)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[color:var(--ui-accent)] mt-1">•</span>
                <span>Ask for headers, borders, and formatting</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-[color:var(--ui-accent)] mt-1">•</span>
                <span>Be specific about data types and structure</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIExcelGenerator;
