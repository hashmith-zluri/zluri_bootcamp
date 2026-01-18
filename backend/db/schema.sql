CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(20) CHECK (role IN ('DEVELOPER', 'MANAGER', 'ADMIN')) NOT NULL
);

CREATE TABLE db_instances (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INT NOT NULL,
  engine VARCHAR(20) CHECK (engine IN ('POSTGRES', 'MONGO')) NOT NULL,
  username VARCHAR(255),
  password VARCHAR(255)
);

CREATE TABLE query_requests (
  id SERIAL PRIMARY KEY,
  requester_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  db_instance_id INT NOT NULL REFERENCES db_instances(id) ON DELETE RESTRICT,
  database_name VARCHAR(100) NOT NULL,
  query_text TEXT,
  script_path TEXT,
  comments TEXT NOT NULL,
  pod_id VARCHAR(50) NOT NULL,
  status VARCHAR(20)
    CHECK (status IN ('PENDING','APPROVED','REJECTED','EXECUTING','EXECUTED','FAILED'))DEFAULT 'PENDING',
  approved_by INT REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP,
  CONSTRAINT valid_request_payload CHECK (
    (query_text IS NOT NULL AND script_path IS NULL)
    OR
    (query_text IS NULL AND script_path IS NOT NULL)
  )
);

CREATE TABLE execution_logs (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES query_requests(id),
  executed_at TIMESTAMP,
  success BOOLEAN NOT NULL,
  output TEXT,
  error TEXT,
  execution_time_ms INT
);

CREATE TABLE instance_databases (
  id SERIAL PRIMARY KEY,
  instance_id INT NOT NULL REFERENCES db_instances(id) ON DELETE CASCADE,
  database_name VARCHAR(100) NOT NULL,
  description TEXT,
  UNIQUE(instance_id, database_name)
);

INSERT INTO users (email, name, password, role) VALUES
('test@zluri.com', 'Test User', '$2b$10$cVQoCtZ8IKEnY7blN06p2Obsv0LE9JtyirozDr4.9recvhP/6swiq', 'DEVELOPER'), -- password: pass1
('dev1@zluri.com', 'Dev1', '$2b$10$QKVigt.b9thPMAaJwuJNQuQczcVB90Eef09XeBxtS.uIzk6lp8fxi', 'DEVELOPER'), -- password: pass2
('dev2@zluri.com', 'Dev2', '$2b$10$rstR1f.uJiOQBr13FfLrsODFIdXmbReN6rfM0NBCWFugzyf3b96X6', 'DEVELOPER'), -- password: pass3
('manager1@zluri.com', 'Pod 1', '$2b$10$qKeddCyz9jikwF5asCaoHOvrfmsrfkM6R6tGEnNvo6Wo1K0.M3B.y', 'MANAGER'), -- password: pass4
('de-lead@zluri.com', 'DE', '$2b$10$ieTwoS378Pd.9N3d2LRrN.3Kot9eOGsmw.cH0ZHfI8SORPsEuWWJG', 'MANAGER'), -- password: pass5
('db-admin@zluri.com', 'DB', '$2b$10$q0tGMhXNVpqDYKuZfsIIi./26h4/7jVTentIovS/DRxOzyNgSuRyG', 'MANAGER'), -- password: pass6
('admin@zluri.com', 'Admin', '$2b$10$qRxJ2OqqPvanVsfTsYS1EOq6hC10vwTvruE8ak8fFv43..h.UhJN6', 'ADMIN'); -- password: pass7

INSERT INTO db_instances (name, host, port, engine, username, password) VALUES
('postgres-1', 'ep-little-sound-ahuc250q-pooler.c-3.us-east-1.aws.neon.tech', 5432, 'POSTGRES', 'neondb_owner', 'npg_pVcCRqNK7zM8'),
('postgres-2', 'ep-bold-frog-ahjzgmj9-pooler.c-3.us-east-1.aws.neon.tech', 5432, 'POSTGRES', 'neondb_owner', 'npg_ox0ZUA1feQWM'),
('local-mongo', 'localhost', 27017, 'MONGO', NULL, NULL);

INSERT INTO instance_databases (instance_id, database_name, description) VALUES
-- postgres-1 databases (instance_id = 1)
(1, 'test_analytics', 'Analytics database for reporting and metrics'),
(1, 'test_ecommerce', 'E-commerce application database'),
(1, 'zluri_portal', 'Main portal database'),
-- postgres-2 databases (instance_id = 2)
(2, 'test_inventory', 'Inventory management database'),
-- local-mongo databases (instance_id = 3)
(3, 'test_mongo', 'MongoDB test database with analytics');
