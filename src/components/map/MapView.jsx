import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { cameras } from "../../data/mockData";

function MapView() {
  const center = [23.0225, 72.5714];

  return (
    <div className="map-container">
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {cameras.map((camera) => (
          <Marker
            key={camera.id}
            position={[camera.latitude, camera.longitude]}
          >
            <Popup>
              <strong>{camera.name}</strong>
              <br />
              {camera.location}
              <br />
              Status: {camera.status}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapView;