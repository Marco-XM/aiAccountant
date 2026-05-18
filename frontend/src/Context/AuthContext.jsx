import React, { createContext, useEffect, useState } from "react";

export const AuthContext = createContext();

const AuthContextProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  function SetUserToken(tkn) {
    setToken(tkn);
  }
   function Logout(){
    localStorage.removeItem("token");
    setToken(null);
   }
  useEffect(() => {
    if (localStorage.getItem("token") != null) {
      setToken(localStorage.getItem("token"));
    }
    setAuthReady(true);
  }, []);

  return (
    <AuthContext.Provider value={{ token, authReady, SetUserToken , Logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContextProvider;
