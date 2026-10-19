import { useEffect, useState } from "react";
import { api, getToken, setUnauthorizedHandler } from "./api.js";
import LoginPage from "./components/LoginPage.jsx";
import Dashboard from "./components/Dashboard.jsx";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => !!getToken());

  useEffect(() => {
    // Any 401 from the API (token expired / server restarted with new secret) -> back to login.
    setUnauthorizedHandler(() => setLoggedIn(false));
  }, []);

  if (!loggedIn) return <LoginPage onLogin={() => setLoggedIn(true)} />;

  return (
    <Dashboard
      onLogout={() => {
        api.logout();
        setLoggedIn(false);
      }}
    />
  );
}
