import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Camera,
  Map,
  Activity,
  Plug,
  Server,
  Shield,
} from "lucide-react";

function Sidebar() {
  const menu = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Camera Registry", path: "/cameras", icon: Camera },
    { name: "Command Map", path: "/map", icon: Map },
    { name: "Event Stream", path: "/events", icon: Activity },
    { name: "Integration Hub", path: "/integrations", icon: Plug },
    { name: "VMS Connections", path: "/vms", icon: Server },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={24} />
        </div>

        <div>
          <h2>Sentinel-X</h2>
          <span>Command Center</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menu.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="online-dot"></span>
        Sentinel CCTV Grid
      </div>
    </aside>
  );
}

export default Sidebar;