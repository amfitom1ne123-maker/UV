import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import AdminPanel from "./admin/AdminPanel"; // админка
import './index.css';

const rootEl = document.getElementById("root") || (() => {
  const e = document.createElement("div");
  e.id = "root";
  document.body.appendChild(e);
  return e;
})();

createRoot(rootEl).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* мини-апп на корне */}
        <Route path="/*" element={<App />} />
        {/* админка по /admin */}
        <Route path="/admin/*" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
);
