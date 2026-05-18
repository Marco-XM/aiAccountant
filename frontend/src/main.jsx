import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import AuthContextProvider from "./Context/AuthContext.jsx";
import { QueryClientProvider } from "@tanstack/react-query";
import queryClient from "./services/queryClient";
import { BackendHealthProvider } from "./Context/BackendHealthContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthContextProvider>
      <BackendHealthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </BackendHealthProvider>
    </AuthContextProvider>
  </React.StrictMode>
);
