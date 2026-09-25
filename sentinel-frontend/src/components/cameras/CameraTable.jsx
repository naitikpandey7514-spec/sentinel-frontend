import { Link } from "react-router-dom";
import CameraStatus from "./CameraStatus";

function CameraTable({ cameras }) {
  return (
    <div className="table-wrapper">
      <table className="camera-table">
        <thead>
          <tr>
            <th>Camera ID</th>
            <th>Name</th>
            <th>Location</th>
            <th>Type</th>
            <th>Status</th>
            <th>FPS</th>
            <th>Details</th>
          </tr>
        </thead>

        <tbody>
          {cameras.map((camera) => (
            <tr key={camera.id}>
              <td>{camera.id}</td>
              <td>{camera.name}</td>
              <td>{camera.location}</td>
              <td>{camera.type}</td>
              <td>
                <CameraStatus status={camera.status} />
              </td>
              <td>{camera.fps}</td>
              <td>
                <Link
                  className="small-button"
                  to={`/cameras/${camera.id}`}
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CameraTable;