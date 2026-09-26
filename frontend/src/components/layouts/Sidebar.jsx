import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
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
  const { hasPermission } = useAuth();

  const menu = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      permission: "dashboard.view",
    },
    {
      name: "Camera Registry",
      path: "/cameras",
      icon: Camera,
      permission: "cameras.view",
    },
    {
      name: "Command Map",
      path: "/map",
      icon: Map,
      permission: "cameras.view",
    },
    {
      name: "Event Stream",
      path: "/events",
      icon: Activity,
      permission: "alerts.view",
    },
    {
      name: "Integration Hub",
      path: "/integrations",
      icon: Plug,
      permission: "integrations.view",
    },
    {
      name: "VMS Connections",
      path: "/vms",
      icon: Server,
      permission: "integrations.view",
    },
    {
      name: "Access Control",
      path: "/settings/users",
      icon: Shield,
      permission: "users.view",
    },
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
        {menu
          .filter((item) => {
            if (!item.permission) {
              return true;
            }

            return hasPermission(item.permission);
          })
          .map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  isActive
                    ? "nav-item active"
                    : "nav-item"
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