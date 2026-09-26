import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import Layout from "./components/layouts/Layout";

import Dashboard from "./pages/Dashboard";
import Cameras from "./pages/Cameras";
import CameraDetails from "./pages/CameraDetails";
import CommandMap from "./pages/CommandMap";
import Events from "./pages/Events";
import IntegrationHub from "./pages/IntegrationHub";
import VMSConnections from "./pages/VMSConnections";
import Login from "./pages/Login";
import UserManagement from "./pages/UserManagement";

import "./App.css";

function SecurePage({
  children,
  permission,
}) {
  return (
    <ProtectedRoute
      permission={permission}
    >
      <Layout>
        {children}
      </Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/"
            element={
              <SecurePage permission="dashboard.view">
                <Dashboard />
              </SecurePage>
            }
          />

          <Route
            path="/cameras"
            element={
              <SecurePage permission="cameras.view">
                <Cameras />
              </SecurePage>
            }
          />

          <Route
            path="/cameras/:cameraId"
            element={
              <SecurePage permission="cameras.view">
                <CameraDetails />
              </SecurePage>
            }
          />

          <Route
            path="/map"
            element={
              <SecurePage permission="cameras.view">
                <CommandMap />
              </SecurePage>
            }
          />

          <Route
            path="/events"
            element={
              <SecurePage permission="alerts.view">
                <Events />
              </SecurePage>
            }
          />

          <Route
            path="/integrations"
            element={
              <SecurePage permission="integrations.view">
                <IntegrationHub />
              </SecurePage>
            }
          />

          <Route
            path="/vms"
            element={
              <SecurePage permission="integrations.view">
                <VMSConnections />
              </SecurePage>
            }
          />

          <Route
            path="/settings/users"
            element={
              <SecurePage permission="users.view">
                <UserManagement />
              </SecurePage>
            }
          />

          <Route
            path="*"
            element={
              <SecurePage permission="dashboard.view">
                <Dashboard />
              </SecurePage>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;