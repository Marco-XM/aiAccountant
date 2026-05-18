import React from "react";

const Header = ({ title = "AI Charts" }) => (
  <header className="mb-6 flex items-center justify-between">
    <h1 className="text-2xl font-semibold text-white">{title}</h1>
  </header>
);

export default Header;
