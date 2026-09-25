import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "./components/layouts/Layout";

import Dashboard from "./pages/Dashboard";
import Cameras from "./pages/Cameras";
import CameraDetails from "./pages/CameraDetails";
import CommandMap from "./pages/CommandMap";
import Events from "./pages/Events";
import IntegrationHub from "./pages/IntegrationHub";
import VMSConnections from "./pages/VMSConnections";

import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route
            path="/cameras/:cameraId"
            element={<CameraDetails />}
          />
          <Route path="/map" element={<CommandMap />} />
          <Route path="/events" element={<Events />} />
          <Route
            path="/integrations"
            element={<IntegrationHub />}
          />
          <Route
            path="/vms"
            element={<VMSConnections />}
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;