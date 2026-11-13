-- Ejecutar conectado a inventario_db como propietario autorizado. No borra datos.
BEGIN;
CREATE SCHEMA IF NOT EXISTS inventario_mvp;
CREATE TABLE IF NOT EXISTS inventario_mvp.schema_versions (
    version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventario_mvp.products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku varchar(40) NOT NULL UNIQUE CHECK (sku ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'),
    name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
    category varchar(60) NOT NULL CHECK (length(trim(category)) > 0),
    price numeric(12,2) NOT NULL CHECK (price > 0),
    stock integer NOT NULL CHECK (stock BETWEEN 0 AND 1000000),
    minimum_stock integer NOT NULL CHECK (minimum_stock BETWEEN 0 AND 1000000),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventario_mvp.sales (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id uuid NOT NULL UNIQUE,
    payload_hash text NOT NULL,
    total numeric(22,2) NOT NULL CHECK (total > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventario_mvp.sale_items (
    sale_id bigint NOT NULL REFERENCES inventario_mvp.sales(id),
    product_id bigint NOT NULL REFERENCES inventario_mvp.products(id),
    product_name varchar(120) NOT NULL,
    sku varchar(40) NOT NULL,
    quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
    unit_price numeric(12,2) NOT NULL CHECK (unit_price > 0),
    PRIMARY KEY (sale_id, product_id)
);
CREATE TABLE IF NOT EXISTS inventario_mvp.stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint NOT NULL REFERENCES inventario_mvp.products(id),
    delta integer NOT NULL CHECK (delta <> 0),
    reason varchar(200) NOT NULL,
    sale_id bigint REFERENCES inventario_mvp.sales(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventario_mvp.stock_requests (
    request_id uuid PRIMARY KEY, payload_hash text NOT NULL,
    product_id bigint NOT NULL REFERENCES inventario_mvp.products(id),
    resulting_stock integer NOT NULL CHECK (resulting_stock >= 0)
);
CREATE INDEX IF NOT EXISTS ix_sales_created ON inventario_mvp.sales(created_at);
CREATE INDEX IF NOT EXISTS ix_sale_items_product ON inventario_mvp.sale_items(product_id);
CREATE INDEX IF NOT EXISTS ix_movements_product ON inventario_mvp.stock_movements(product_id, id DESC);
INSERT INTO inventario_mvp.schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
COMMIT;
