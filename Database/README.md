# Sentinel-X Database

PostgreSQL database definition for Sentinel-X.

## Tables

- `cameras` - registered database cameras
- `watchlist` - vehicle license plates on the watchlist
- `detections` - license plate detections associated with cameras
- `alerts` - alerts generated from detections

## Schema

`schema.sql` contains the PostgreSQL table definitions, relationships, defaults, and indexes.

## Seed Data

`seed.sql` contains initial/demo records.

## Database

The backend currently connects using the `DATABASE_URL` environment variable.

Default development database:

- Database: `sentinel`
- User: `sentinel_user`
- Host: `localhost`
- Port: `5432`

## Important

The `Database` directory contains database definitions and seed/migration files.

The FastAPI application remains in the `Backend` directory.