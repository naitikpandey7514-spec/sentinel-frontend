import { Bell, Wifi } from "lucide-react";

function TopBar() {
  return (
    <header className="topbar">
      <div>
        <h1>Sentinel-X</h1>
        <p>Live CCTV Monitoring & Command Center</p>
      </div>

      <div className="topbar-actions">
        <div className="system-status">
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