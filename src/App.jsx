import React, { useContext } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthContext } from "./Context/AuthContext";
import Login from "./Component/Login/Login.jsx";
import Register from "./Component/Register/Register.jsx";
import Home from "./Component/Home/Home.jsx";
import ProtectedRoute from "./Component/ProtectedRoute/ProtectedRoute.jsx";

export default function App() {
  const { token, Logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    Logout();
    navigate("/login");
  };

  return (
    <div>
      <Toaster position="top-right" />
      <nav
        style={{
          padding: "20px",
          backgroundColor: "#f3f4f6",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Link
            to="/"
            style={{ marginRight: "15px", fontWeight: "bold", fontSize: "18px" }}
          >
            AI Accountant
          </Link>
        </div>
        <div>
          {!token ? (
            <>
              <Link to="/login" style={{ marginRight: "15px" }}>
                Login
              </Link>
              <Link to="/register">Register</Link>
            </>
          ) : (
            <>
              <Link to="/" style={{ marginRight: "15px" }}>
                Home
              </Link>
              <button
                onClick={handleLogout}
                style={{
                  padding: "5px 15px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="*"
          element={
            <div style={{ textAlign: "center", marginTop: "50px" }}>
              <h1>404 - Page Not Found</h1>
              <Link to="/">Go to Home</Link>
            </div>
          }
        />
      </Routes>
    </div>
  );
}
