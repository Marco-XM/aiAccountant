import React, { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
};

const AuthContextProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // { id, email, isAdmin }
  const [authReady, setAuthReady] = useState(false);

  const applyToken = (tkn) => {
    const decoded = decodeJwt(tkn);
    setToken(tkn);
    setUser(decoded ? { id: decoded._id, email: decoded.email, isAdmin: decoded.isAdmin || false } : null);
  };

  function SetUserToken(tkn) {
    applyToken(tkn);
  }

  function Logout() {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      applyToken(saved);
    }
    setAuthReady(true);
  }, []);

  const userId = user?.id || null;
  const isAdmin = user?.isAdmin || false;

  return (
    <AuthContext.Provider value={{ token, user, userId, isAdmin, authReady, SetUserToken, Logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContextProvider;
