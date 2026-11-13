-- MySQL 8 / InnoDB. Se aplica a inventario_db sin borrar tablas existentes.
CREATE DATABASE IF NOT EXISTS inventario_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;
USE inventario_db;
CREATE TABLE IF NOT EXISTS schema_versions (
 version INT PRIMARY KEY, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS products (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 sku VARCHAR(40) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL,
 category VARCHAR(60) NOT NULL,
 price DECIMAL(12,2) NOT NULL,
 stock INT NOT NULL,
 minimum_stock INT NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CHECK (REGEXP_LIKE(sku,'^[A-Z0-9][A-Z0-9_-]{0,39}$','c')),
 CHECK (CHAR_LENGTH(TRIM(name))>0), CHECK (CHAR_LENGTH(TRIM(category))>0),
 CHECK (price>0), CHECK (stock BETWEEN 0 AND 1000000),
 CHECK (minimum_stock BETWEEN 0 AND 1000000)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sales (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 payload_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 total DECIMAL(22,2) NOT NULL CHECK (total>0),
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX ix_sales_created(created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sale_items (
 sale_id BIGINT NOT NULL, product_id BIGINT NOT NULL,
 product_name VARCHAR(120) NOT NULL, sku VARCHAR(40) NOT NULL,
 quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
 unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price>0),
 PRIMARY KEY(sale_id,product_id), INDEX ix_items_product(product_id),
 FOREIGN KEY(sale_id) REFERENCES sales(id), FOREIGN KEY(product_id) REFERENCES products(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS stock_movements (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 product_id BIGINT NOT NULL, delta INT NOT NULL CHECK (delta<>0),
 reason VARCHAR(200) NOT NULL, sale_id BIGINT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX ix_movements_product(product_id,id DESC),
 FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(sale_id) REFERENCES sales(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS stock_requests (
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 payload_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 product_id BIGINT NOT NULL, resulting_stock INT NOT NULL CHECK (resulting_stock>=0),
 FOREIGN KEY(product_id) REFERENCES products(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS request_locks (
 request_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY
) ENGINE=InnoDB;
