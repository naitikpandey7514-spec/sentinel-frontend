import { Bell, Wifi } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";

function TopBar() {
  const {
  user,
  logout,
} = useAuth();
  return (
    <header className="topbar">
      <div>
        <h1>Sentinel-X</h1>
        <p>Live CCTV Monitoring & Command Center</p>
      </div>

      <div className="topbar-actions">
        <div className="system-status">
          {user && (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
    }}
  >
    <div
      style={{
        textAlign: "right",
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: "13px",
        }}
      >
        {user.full_name}
      </strong>

      <span
        style={{
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        {user.role}
      </span>
    </div>

    <button
      className="refresh-button"
      onClick={logout}
    >
      Sign Out
    </button>
  </div>
)}
          <span className="online-dot"></span>
          <Wifi size={17} />
          System Online
        </div>

        <button className="icon-button">
          <Bell size={19} />
        </button>
      </div>
    </header>
  );
}

export default TopBar;