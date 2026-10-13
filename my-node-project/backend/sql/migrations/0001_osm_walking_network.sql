CREATE TABLE IF NOT EXISTS campus_routing_nodes (
  osm_node_id BIGINT PRIMARY KEY,
  geom GEOMETRY(Point, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS campus_routing_edges (
  id BIGSERIAL PRIMARY KEY,
  source_way_id BIGINT NOT NULL,
  segment_index INTEGER NOT NULL,
  from_node_id BIGINT NOT NULL REFERENCES campus_routing_nodes(osm_node_id) ON DELETE CASCADE,
  to_node_id BIGINT NOT NULL REFERENCES campus_routing_nodes(osm_node_id) ON DELETE CASCADE,
  distance_m DOUBLE PRECISION NOT NULL CHECK (distance_m > 0),
  name TEXT NOT NULL,
  highway TEXT NOT NULL,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  UNIQUE (source_way_id, segment_index),
  CHECK (from_node_id <> to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_campus_routing_nodes_geom ON campus_routing_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_campus_routing_edges_geom ON campus_routing_edges USING GIST (geom);
