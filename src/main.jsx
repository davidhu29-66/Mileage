import "./storagePolyfill.js";
import React from "react";
import ReactDOM from "react-dom/client";
import ErrorBoundary from "./ErrorBoundary.jsx";
import MileageLogger from "./MileageLogger.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MileageLogger />
    </ErrorBoundary>
  </React.StrictMode>
);
