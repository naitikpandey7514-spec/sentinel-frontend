
export const cameras = [
  {
    id: "CAM-001",
    name: "Main Gate Camera",
    location: "Main Gate",
    type: "Fixed",
    status: "Online",
    fps: 25,
    resolution: "1920x1080",
    uptime: "99.8%",
    detection: "Active",
    latitude: 23.0225,
    longitude: 72.5714,
  },
  {
    id: "CAM-002",
    name: "Parking Area",
    location: "Parking",
    type: "PTZ",
    status: "Online",
    fps: 24,
    resolution: "1920x1080",
    uptime: "99.4%",
    detection: "Active",
    latitude: 23.024,
    longitude: 72.574,
  },
  {
    id: "CAM-003",
    name: "North Road",
    location: "North Road",
    type: "Fixed",
    status: "Offline",
    fps: 0,
    resolution: "1280x720",
    uptime: "94.2%",
    detection: "Inactive",
    latitude: 23.0255,
    longitude: 72.568,
  },
  {
    id: "CAM-004",
    name: "Market Junction",
    location: "Market",
    type: "PTZ",
    status: "Online",
    fps: 30,
    resolution: "2560x1440",
    uptime: "99.9%",
    detection: "Active",
    latitude: 23.0205,
    longitude: 72.576,
  },
];

export function normalizeCameras(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((camera, index) => {
    const id = camera.id || `cam${String(index + 1).padStart(2, "0")}`;

    return {
      id: id,
      name: camera.name || id,
      location: camera.name || id,
      type: "CCTV",
      status: "Online",
      fps: 0,
      resolution: "Live",
      uptime: "N/A",
      detection: "Active",

      latitude: 23.0225,
      longitude: 72.5714,

      hls: `https://cctv.corp8.cloud/${id}/index.m3u8`,

      whep: `http://103.250.160.189:8889/stream/${id}/whep`,
    };
  });
}

export const events = [
  {
    id: 1,
    type: "Motion",
    camera: "CAM-001",
    location: "Main Gate",
    severity: "Low",
    time: "10:42:18",
  },
  {
    id: 2,
    type: "Person Detected",
    camera: "CAM-002",
    location: "Parking",
    severity: "Medium",
    time: "10:41:05",
  },
  {
    id: 3,
    type: "Camera Offline",
    camera: "CAM-003",
    location: "North Road",
    severity: "High",
    time: "10:39:22",
  },
  {
    id: 4,
    type: "Vehicle Detected",
    camera: "CAM-004",
    location: "Market",
    severity: "Low",
    time: "10:37:51",
  },
];

export const integrations = [
  {
    id: 1,
    name: "Sentinel VMS",
    type: "VMS",
    status: "Connected",
    description: "Primary video management system",
  },
  {
    id: 2,
    name: "CCTV Gateway",
    type: "Gateway",
    status: "Connected",
    description: "Live camera gateway",
  },
  {
    id: 3,
    name: "Event Server",
    type: "API",
    status: "Disconnected",
    description: "Event processing service",
  },
];
