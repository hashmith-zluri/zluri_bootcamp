-- Setup script for target databases that will be queried by the portal
-- These are separate from the portal's main database (zluri_portal)

-- Create test databases
CREATE DATABASE test_ecommerce;
CREATE DATABASE test_analytics;
CREATE DATABASE test_inventory;

-- Connect to test_ecommerce database
\c test_ecommerce;

-- Create sample tables for e-commerce scenario
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(100),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL
);

-- Insert sample data for e-commerce
INSERT INTO users (email, name, status, last_login) VALUES
('john@example.com', 'John Doe', 'active', NOW() - INTERVAL '2 days'),
('jane@example.com', 'Jane Smith', 'active', NOW() - INTERVAL '1 day'),
('bob@example.com', 'Bob Johnson', 'inactive', NOW() - INTERVAL '30 days'),
('alice@example.com', 'Alice Brown', 'active', NOW() - INTERVAL '1 hour'),
('charlie@example.com', 'Charlie Wilson', 'active', NOW() - INTERVAL '5 days');

INSERT INTO products (name, price, category, stock_quantity) VALUES
('Laptop Pro', 1299.99, 'Electronics', 50),
('Wireless Mouse', 29.99, 'Electronics', 200),
('Office Chair', 199.99, 'Furniture', 25),
('Coffee Mug', 12.99, 'Kitchen', 100),
('Notebook', 5.99, 'Stationery', 500),
('Smartphone', 699.99, 'Electronics', 75),
('Desk Lamp', 45.99, 'Furniture', 30);

INSERT INTO orders (user_id, total_amount, status) VALUES
(1, 1329.98, 'completed'),
(2, 199.99, 'completed'),
(3, 42.98, 'cancelled'),
(1, 699.99, 'pending'),
(4, 18.98, 'completed');

INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
(1, 1, 1, 1299.99),
(1, 2, 1, 29.99),
(2, 3, 1, 199.99),
(3, 4, 2, 12.99),
(3, 5, 3, 5.99),
(4, 6, 1, 699.99),
(5, 4, 1, 12.99),
(5, 5, 1, 5.99);

-- Connect to test_analytics database
\c test_analytics;

-- Create sample tables for analytics scenario
CREATE TABLE page_views (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50),
    page_url VARCHAR(500) NOT NULL,
    session_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    user_id VARCHAR(50),
    properties JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(50),
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    page_count INT DEFAULT 0,
    duration_seconds INT
);

-- Insert sample analytics data
INSERT INTO page_views (user_id, page_url, session_id, timestamp, ip_address) VALUES
('user_123', '/home', 'sess_001', NOW() - INTERVAL '2 hours', '192.168.1.100'),
('user_123', '/products', 'sess_001', NOW() - INTERVAL '1 hour 50 minutes', '192.168.1.100'),
('user_456', '/home', 'sess_002', NOW() - INTERVAL '1 hour', '192.168.1.101'),
('user_789', '/login', 'sess_003', NOW() - INTERVAL '30 minutes', '192.168.1.102'),
('user_123', '/checkout', 'sess_001', NOW() - INTERVAL '1 hour 30 minutes', '192.168.1.100');

INSERT INTO events (event_name, user_id, properties, timestamp) VALUES
('page_view', 'user_123', '{"page": "/home", "referrer": "google.com"}', NOW() - INTERVAL '2 hours'),
('button_click', 'user_123', '{"button": "add_to_cart", "product_id": "prod_001"}', NOW() - INTERVAL '1 hour 45 minutes'),
('purchase', 'user_123', '{"amount": 99.99, "currency": "USD"}', NOW() - INTERVAL '1 hour 30 minutes'),
('signup', 'user_456', '{"method": "email", "source": "homepage"}', NOW() - INTERVAL '1 hour'),
('login', 'user_789', '{"method": "password"}', NOW() - INTERVAL '30 minutes');

INSERT INTO user_sessions (session_id, user_id, start_time, end_time, page_count, duration_seconds) VALUES
('sess_001', 'user_123', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 20 minutes', 5, 2400),
('sess_002', 'user_456', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', 3, 900),
('sess_003', 'user_789', NOW() - INTERVAL '30 minutes', NULL, 2, NULL);

-- Create a view for common analytics queries
CREATE VIEW daily_stats AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as total_page_views,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as total_sessions
FROM page_views 
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Connect to test_inventory database
\c test_inventory;

-- Create sample tables for inventory management scenario
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category_id INT REFERENCES categories(id),
    supplier_id INT REFERENCES suppliers(id),
    unit_cost DECIMAL(10,2),
    selling_price DECIMAL(10,2),
    current_stock INT DEFAULT 0,
    min_stock_level INT DEFAULT 10,
    max_stock_level INT DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES inventory_products(id),
    movement_type VARCHAR(20) CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')) NOT NULL,
    quantity INT NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INT REFERENCES suppliers(id),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')) DEFAULT 'DRAFT',
    total_amount DECIMAL(12,2),
    order_date DATE DEFAULT CURRENT_DATE,
    expected_delivery DATE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INT REFERENCES purchase_orders(id),
    product_id INT REFERENCES inventory_products(id),
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);

-- Insert sample inventory data
INSERT INTO categories (name, description) VALUES
('Electronics', 'Electronic devices and components'),
('Office Supplies', 'General office supplies and stationery'),
('Furniture', 'Office and home furniture'),
('Software', 'Software licenses and subscriptions');

INSERT INTO suppliers (name, contact_email, contact_phone, address) VALUES
('TechCorp Solutions', 'orders@techcorp.com', '+1-555-0101', '123 Tech Street, Silicon Valley, CA'),
('Office Plus', 'sales@officeplus.com', '+1-555-0102', '456 Supply Ave, Business District, NY'),
('Furniture World', 'info@furnitureworld.com', '+1-555-0103', '789 Furniture Blvd, Design City, TX'),
('SoftwarePro', 'licensing@softwarepro.com', '+1-555-0104', '321 Code Lane, Developer Town, WA');

INSERT INTO inventory_products (sku, name, category_id, supplier_id, unit_cost, selling_price, current_stock, min_stock_level, max_stock_level) VALUES
('LAPTOP-001', 'Business Laptop Pro', 1, 1, 800.00, 1200.00, 25, 5, 50),
('MOUSE-001', 'Wireless Optical Mouse', 1, 1, 15.00, 25.00, 150, 20, 200),
('CHAIR-001', 'Ergonomic Office Chair', 3, 3, 120.00, 200.00, 8, 3, 20),
('PEN-001', 'Blue Ballpoint Pen (Pack of 10)', 2, 2, 3.00, 8.00, 500, 50, 1000),
('PAPER-001', 'A4 Copy Paper (500 sheets)', 2, 2, 5.00, 12.00, 200, 25, 500),
('MONITOR-001', '24" LED Monitor', 1, 1, 180.00, 280.00, 15, 5, 30),
('DESK-001', 'Standing Desk Converter', 3, 3, 150.00, 250.00, 12, 3, 25),
('SOFTWARE-001', 'Office Suite License', 4, 4, 100.00, 150.00, 50, 10, 100);

INSERT INTO stock_movements (product_id, movement_type, quantity, reference_number, notes, created_by) VALUES
(1, 'IN', 30, 'PO-2024-001', 'Initial stock purchase', 'admin'),
(2, 'IN', 200, 'PO-2024-002', 'Bulk mouse order', 'admin'),
(3, 'IN', 10, 'PO-2024-003', 'Office chair delivery', 'admin'),
(1, 'OUT', 5, 'SO-2024-001', 'Sales order fulfillment', 'sales_team'),
(2, 'OUT', 50, 'SO-2024-002', 'Bulk sale to corporate client', 'sales_team'),
(4, 'IN', 1000, 'PO-2024-004', 'Stationery restock', 'admin'),
(4, 'OUT', 500, 'SO-2024-003', 'Office supply distribution', 'admin'),
(5, 'IN', 250, 'PO-2024-005', 'Paper supply', 'admin'),
(5, 'OUT', 50, 'SO-2024-004', 'Department allocation', 'admin');

INSERT INTO purchase_orders (supplier_id, order_number, status, total_amount, order_date, expected_delivery) VALUES
(1, 'PO-2024-001', 'RECEIVED', 24000.00, '2024-01-15', '2024-01-22'),
(1, 'PO-2024-002', 'RECEIVED', 3000.00, '2024-01-20', '2024-01-25'),
(3, 'PO-2024-003', 'RECEIVED', 1200.00, '2024-02-01', '2024-02-08'),
(2, 'PO-2024-004', 'RECEIVED', 3000.00, '2024-02-10', '2024-02-15'),
(1, 'PO-2024-006', 'SENT', 5400.00, '2024-02-20', '2024-02-28');

INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost) VALUES
(1, 1, 30, 800.00),
(2, 2, 200, 15.00),
(3, 3, 10, 120.00),
(4, 4, 1000, 3.00),
(5, 6, 30, 180.00);

-- Create useful views for inventory management
CREATE VIEW low_stock_products AS
SELECT 
    ip.sku,
    ip.name,
    c.name as category,
    s.name as supplier,
    ip.current_stock,
    ip.min_stock_level,
    (ip.min_stock_level - ip.current_stock) as shortage
FROM inventory_products ip
JOIN categories c ON ip.category_id = c.id
JOIN suppliers s ON ip.supplier_id = s.id
WHERE ip.current_stock < ip.min_stock_level
ORDER BY shortage DESC;

CREATE VIEW inventory_value AS
SELECT 
    c.name as category,
    COUNT(ip.id) as product_count,
    SUM(ip.current_stock * ip.unit_cost) as total_cost_value,
    SUM(ip.current_stock * ip.selling_price) as total_selling_value,
    SUM(ip.current_stock * (ip.selling_price - ip.unit_cost)) as potential_profit
FROM inventory_products ip
JOIN categories c ON ip.category_id = c.id
GROUP BY c.id, c.name
ORDER BY total_cost_value DESC;

CREATE VIEW recent_stock_movements AS
SELECT 
    sm.id,
    ip.sku,
    ip.name as product_name,
    sm.movement_type,
    sm.quantity,
    sm.reference_number,
    sm.created_at,
    sm.created_by
FROM stock_movements sm
JOIN inventory_products ip ON sm.product_id = ip.id
ORDER BY sm.created_at DESC
LIMIT 50;