import React, { useState, useContext, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";
import { api } from "../../config/api";

const Chatbot = () => {
  const [searchParams] = useSearchParams();
  const chatIdFromUrl = searchParams.get("chat");
  const [currentChatId, setCurrentChatId] = useState(chatIdFromUrl);
  const [messages, setMessages] = useState([
    {
      role: "model",
      content:
        '👋 Hello! I\'m your **AI Accountant Assistant**.\n\nI can help you analyze your financial data and answer questions like:\n\n• **"How did we perform in Q1 2024?"**\n• **"What are our top expense categories?"**\n• **"Show me travel expenses for last month"**\n• **"Compare monthly performance for 2024"**\n\nWhat would you like to know about your finances?',
      suggestedQuestions: [
        "What was our financial performance in Q1?",
        "Show me the top expense categories",
        "Compare Q1 vs Q2 performance",
        "What's the monthly trend for 2024?",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const { token } = useContext(AuthContext);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat from URL parameter
  useEffect(() => {
    if (chatIdFromUrl) {
      loadChat(chatIdFromUrl);
    } else {
      // Reset to initial state for new chat
      setCurrentChatId(null);
      setMessages([
        {
          role: "model",
          content:
            '👋 Hello! I\'m your **AI Accountant Assistant**.\n\nI can help you analyze your financial data and answer questions like:\n\n• **"How did we perform in Q1 2024?"**\n• **"What are our top expense categories?"**\n• **"Show me travel expenses for last month"**\n• **"Compare monthly performance for 2024"**\n\nWhat would you like to know about your finances?',
          suggestedQuestions: [
            "What was our financial performance in Q1?",
            "Show me the top expense categories",
            "Compare Q1 vs Q2 performance",
            "What's the monthly trend for 2024?",
          ],
        },
      ]);
    }
  }, [chatIdFromUrl]);

  const loadChat = async (chatId) => {
    try {
      const response = await api.chat.getSession(chatId);
      setCurrentChatId(chatId);
      setMessages(
        response.data.messages.length > 0
          ? response.data.messages
          : [messages[0]]
      );
    } catch (error) {
      // API interceptor handles user-facing error toast.
      console.error("Error loading chat:", error);
    }
  };

  const saveChat = async (updatedMessages, newSuggestions) => {
    if (!currentChatId) return;

    try {
      const firstUserMsg = updatedMessages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.substring(0, 50) +
          (firstUserMsg.content.length > 50 ? "..." : "")
        : "New Chat";

      await api.chat.updateSession(currentChatId, {
        messages: updatedMessages,
        title,
      });
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    // Create new chat if none exists
    if (!currentChatId) {
      try {
        const response = await api.chat.createSession({
          title: input.substring(0, 50) + (input.length > 50 ? "..." : ""),
        });

        const newChatId = response.data._id;
        setCurrentChatId(newChatId);

        // Continue with sending message
        await sendMessageToAI(updatedMessages, newChatId);
      } catch (error) {
        // API interceptor handles user-facing error toast.
        console.error("Error creating chat:", error);
        setIsLoading(false);
      }
    } else {
      await sendMessageToAI(updatedMessages, currentChatId);
    }
  };

  const sendMessageToAI = async (updatedMessages, chatId) => {
    try {
      const conversationHistory = updatedMessages.slice(1);

      const response = await api.chatbot.sendMessage({
        message: updatedMessages[updatedMessages.length - 1].content,
        conversationHistory,
      });

      const aiMessage = {
        role: "model",
        content: response.data.message,
        suggestedQuestions: response.data.suggestedQuestions || [],
      };
      const newMessages = [...updatedMessages, aiMessage];
      setMessages(newMessages);

      await saveChat(newMessages);
    } catch (error) {
      // API interceptor handles user-facing error toast.
      console.error("Error sending message:", error);
      setMessages(updatedMessages.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format text with basic markdown-like styling
  const formatMessage = (text) => {
    if (!text) return "";

    // Check if text contains a table (lines starting with |)
    const hasTable = text.includes("|");

    if (hasTable) {
      const lines = text.split("\n");
      let result = [];
      let tableLines = [];
      let inTable = false;

      lines.forEach((line, idx) => {
        const trimmedLine = line.trim();

        // Detect table rows
        if (trimmedLine.startsWith("|") && trimmedLine.endsWith("|")) {
          if (!inTable) {
            inTable = true;
            tableLines = [];
          }
          tableLines.push(trimmedLine);
        } else {
          // If we were in a table, render it
          if (inTable && tableLines.length > 0) {
            result.push(renderTable(tableLines, idx));
            tableLines = [];
            inTable = false;
          }

          // Render non-table content
          if (trimmedLine) {
            result.push(renderTextLine(line, idx));
          }
        }
      });

      // If table was at the end
      if (inTable && tableLines.length > 0) {
        result.push(renderTable(tableLines, lines.length));
      }

      return result;
    }

    // No table, process normally
    return text.split("\n").map((line, idx) => renderTextLine(line, idx));
  };

  const renderTable = (tableLines, startIdx) => {
    if (tableLines.length < 2) return null;

    // Parse table
    const parseRow = (line) => {
      return line
        .split("|")
        .slice(1, -1) // Remove first and last empty elements
        .map((cell) => cell.trim());
    };

    // Process bold text in cell (handles spaces around text)
    const processCellContent = (cell) => {
      const boldRegex = /\*\*\s*(.*?)\s*\*\*/g;
      let parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(cell)) !== null) {
        if (match.index > lastIndex) {
          parts.push(
            <span key={`text-${lastIndex}`}>
              {cell.substring(lastIndex, match.index)}
            </span>
          );
        }
        parts.push(
          <strong key={`bold-${match.index}`} className="font-bold">
            {match[1]}
          </strong>
        );
        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < cell.length) {
        parts.push(
          <span key={`text-${lastIndex}`}>{cell.substring(lastIndex)}</span>
        );
      }

      return parts.length > 0 ? parts : cell;
    };

    const headers = parseRow(tableLines[0]);
    const rows = tableLines.slice(2).map(parseRow); // Skip separator line

    return (
      <div key={`table-${startIdx}`} className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse rounded-lg overflow-hidden shadow-md">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="px-4 py-3 text-left text-sm font-semibold"
                >
                  {processCellContent(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? "bg-gray-50" : "bg-white"}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="px-4 py-3 text-sm text-gray-700 border-t border-gray-200"
                  >
                    {processCellContent(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTextLine = (line, idx) => {
    if (!line.trim()) return <br key={idx} />;

    // Headers (##)
    if (line.trim().startsWith("##")) {
      const headerText = line.replace(/^##\s*/, "");
      return (
        <h2 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">
          {processBoldText(headerText)}
        </h2>
      );
    }

    // Bullet points
    if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
      const bulletText = line.replace(/^[•\-]\s*/, "");
      return (
        <div key={idx} className="flex items-start mb-2">
          <span className="text-blue-600 mr-2">•</span>
          <span>{processBoldText(bulletText)}</span>
        </div>
      );
    }

    // Regular text
    return (
      <p key={idx} className="mb-2">
        {processBoldText(line)}
      </p>
    );
  };

  const processBoldText = (text) => {
    const boldRegex = /\*\*\s*(.*?)\s*\*\*/g;
    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold text-gray-900">
          {match[1]}
        </strong>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg, index) => (
            <div key={index}>
              <div
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                } animate-fadeIn`}
              >
                <div
                  className={`max-w-3xl rounded-2xl p-5 shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white ml-auto"
                      : "bg-white text-gray-900 border border-gray-200"
                  }`}
                  style={{ maxWidth: "85%" }}
                >
                  <div className="flex items-start">
                    {msg.role === "model" && (
                      <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-2 rounded-lg mr-3 flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-blue-600"
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
                      </div>
                    )}
                    <div className="flex-1 text-sm leading-relaxed">
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div>{formatMessage(msg.content)}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Show suggested questions for AI messages */}
              {msg.role === "model" &&
                msg.suggestedQuestions &&
                msg.suggestedQuestions.length > 0 &&
                index === messages.length - 1 &&
                !isLoading && (
                  <div className="flex justify-start mt-3 animate-fadeIn">
                    <div
                      className="max-w-3xl w-full"
                      style={{ maxWidth: "85%" }}
                    >
                      <p className="text-xs font-medium text-gray-600 mb-2 flex items-center">
                        <svg
                          className="w-3 h-3 mr-1 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        Quick Questions:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {msg.suggestedQuestions
                          .slice(0, 4)
                          .map((question, idx) => (
                            <button
                              key={idx}
                              onClick={() => setInput(question)}
                              className="text-left text-xs px-3 py-2 bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 border border-gray-200 hover:border-blue-300 rounded-lg text-gray-700 transition-all duration-200 hover:shadow-md group"
                            >
                              <span className="font-medium group-hover:text-blue-600">
                                {question}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-2 rounded-lg">
                    <svg
                      className="w-5 h-5 text-blue-600"
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
                  </div>
                  <div className="flex space-x-1">
                    <div
                      className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-500">
                    Analyzing your data...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4 md:p-6 bg-white flex-shrink-0">
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about your finances..."
                className="w-full p-4 pr-12 border-2 border-gray-300 rounded-xl resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 transition-all"
                rows="2"
                disabled={isLoading}
              />
              {input.length > 0 && (
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {input.length} chars
                </div>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
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
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center flex items-center justify-center">
            <svg
              className="w-3 h-3 mr-1"
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
            Press Enter to send • Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
