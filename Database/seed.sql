-- Sentinel-X development seed data
-- Matches the demo data currently defined in Backend/app/main.py

INSERT INTO cameras (
    camera_code,
    name,
    department,
    location,
    latitude,
    longitude,
    status
)
VALUES
(
    'CAM-001',
    'SG Highway North',
    'Police',
    'Ahmedabad',
    23.0395,
    72.5100,
    'ONLINE'
),
(
    'CAM-002',
    'Satellite Junction',
    'Municipal',
    'Ahmedabad',
    23.0258,
    72.5300,
    'ONLINE'
),
(
    'CAM-003',
    'Gandhinagar Road',
    'Police',
    'Gandhinagar',
    23.2156,
    72.6369,
    'ONLINE'
)
ON CONFLICT (camera_code) DO NOTHING;


INSERT INTO watchlist (
    plate_number,
    category,
    priority,
    description
)
VALUES (
    'GJ01AB1234',
    'STOLEN',
    'HIGH',
    'Demo watchlist record — fictional'
)
ON CONFLICT (plate_number) DO NOTHING;