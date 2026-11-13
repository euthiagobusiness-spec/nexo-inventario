--
-- PostgreSQL database dump
--

\restrict GI7Cong5x2gNb1biXx4cIUVHhIHIR38YPt2KmJuSdIE0gs87KvaS8x5iDmePdoF

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: inventario_mvp; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA inventario_mvp;


ALTER SCHEMA inventario_mvp OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: products; Type: TABLE; Schema: inventario_mvp; Owner: postgres
--

CREATE TABLE inventario_mvp.products (
    id bigint NOT NULL,
    sku character varying(40) NOT NULL,
    name character varying(120) NOT NULL,
    category character varying(60) NOT NULL,
    price numeric(12,2) NOT NULL,
    stock integer NOT NULL,
    minimum_stock integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_category_check CHECK ((length(TRIM(BOTH FROM category)) > 0)),
    CONSTRAINT products_minimum_stock_check CHECK (((minimum_stock >= 0) AND (minimum_stock <= 1000000))),
    CONSTRAINT products_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT products_price_check CHECK ((price > (0)::numeric)),
    CONSTRAINT products_sku_check CHECK (((sku)::text ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'::text)),
    CONSTRAINT products_stock_check CHECK (((stock >= 0) AND (stock <= 1000000)))
);


ALTER TABLE inventario_mvp.products OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE inventario_mvp.products ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario_mvp.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sale_items; Type: TABLE; Schema: inventario_mvp; Owner: postgres
--

CREATE TABLE inventario_mvp.sale_items (
    sale_id bigint NOT NULL,
    product_id bigint NOT NULL,
    product_name character varying(120) NOT NULL,
    sku character varying(40) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    CONSTRAINT sale_items_quantity_check CHECK (((quantity >= 1) AND (quantity <= 1000000))),
    CONSTRAINT sale_items_unit_price_check CHECK ((unit_price > (0)::numeric))
);


ALTER TABLE inventario_mvp.sale_items OWNER TO postgres;

--
-- Name: sales; Type: TABLE; Schema: inventario_mvp; Owner: postgres
--

CREATE TABLE inventario_mvp.sales (
    id bigint NOT NULL,
    request_id uuid NOT NULL,
    payload_hash text NOT NULL,
    total numeric(22,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_total_check CHECK ((total > (0)::numeric))
);


ALTER TABLE inventario_mvp.sales OWNER TO postgres;

--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE inventario_mvp.sales ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario_mvp.sales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_versions; Type: TABLE; Schema: inventario_mvp; Owner: postgres
--

CREATE TABLE inventario_mvp.schema_versions (
    version integer NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE inventario_mvp.schema_versions OWNER TO postgres;

--
-- Name: stock_movements; Type: TABLE; Schema: inventario_mvp; Owner: postgres
--

CREATE TABLE inventario_mvp.stock_movements (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    delta integer NOT NULL,
    reason character varying(200) NOT NULL,
    sale_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT stock_movements_delta_check CHECK ((delta <> 0))
);


ALTER TABLE inventario_mvp.stock_movements OWNER TO postgres;

--
-- Name: stock_movements_id_seq; Type: SEQUENCE; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE inventario_mvp.stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME inventario_mvp.stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: stock_requests; Type: TABLE; Schema: inventario_mvp; Owner: postgres
--

CREATE TABLE inventario_mvp.stock_requests (
    request_id uuid NOT NULL,
    payload_hash text NOT NULL,
    product_id bigint NOT NULL,
    resulting_stock integer NOT NULL,
    CONSTRAINT stock_requests_resulting_stock_check CHECK ((resulting_stock >= 0))
);


ALTER TABLE inventario_mvp.stock_requests OWNER TO postgres;

--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (sale_id, product_id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sales sales_request_id_key; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.sales
    ADD CONSTRAINT sales_request_id_key UNIQUE (request_id);


--
-- Name: schema_versions schema_versions_pkey; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.schema_versions
    ADD CONSTRAINT schema_versions_pkey PRIMARY KEY (version);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock_requests stock_requests_pkey; Type: CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.stock_requests
    ADD CONSTRAINT stock_requests_pkey PRIMARY KEY (request_id);


--
-- Name: ix_movements_product; Type: INDEX; Schema: inventario_mvp; Owner: postgres
--

CREATE INDEX ix_movements_product ON inventario_mvp.stock_movements USING btree (product_id, id DESC);


--
-- Name: ix_sale_items_product; Type: INDEX; Schema: inventario_mvp; Owner: postgres
--

CREATE INDEX ix_sale_items_product ON inventario_mvp.sale_items USING btree (product_id);


--
-- Name: ix_sales_created; Type: INDEX; Schema: inventario_mvp; Owner: postgres
--

CREATE INDEX ix_sales_created ON inventario_mvp.sales USING btree (created_at);


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario_mvp.products(id);


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES inventario_mvp.sales(id);


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario_mvp.products(id);


--
-- Name: stock_movements stock_movements_sale_id_fkey; Type: FK CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.stock_movements
    ADD CONSTRAINT stock_movements_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES inventario_mvp.sales(id);


--
-- Name: stock_requests stock_requests_product_id_fkey; Type: FK CONSTRAINT; Schema: inventario_mvp; Owner: postgres
--

ALTER TABLE ONLY inventario_mvp.stock_requests
    ADD CONSTRAINT stock_requests_product_id_fkey FOREIGN KEY (product_id) REFERENCES inventario_mvp.products(id);


--
-- Name: SCHEMA inventario_mvp; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA inventario_mvp TO inventario_app;


--
-- Name: TABLE products; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE inventario_mvp.products TO inventario_app;


--
-- Name: SEQUENCE products_id_seq; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE inventario_mvp.products_id_seq TO inventario_app;


--
-- Name: TABLE sale_items; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE inventario_mvp.sale_items TO inventario_app;


--
-- Name: TABLE sales; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE inventario_mvp.sales TO inventario_app;


--
-- Name: SEQUENCE sales_id_seq; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE inventario_mvp.sales_id_seq TO inventario_app;


--
-- Name: TABLE schema_versions; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE inventario_mvp.schema_versions TO inventario_app;


--
-- Name: TABLE stock_movements; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE inventario_mvp.stock_movements TO inventario_app;


--
-- Name: SEQUENCE stock_movements_id_seq; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,USAGE ON SEQUENCE inventario_mvp.stock_movements_id_seq TO inventario_app;


--
-- Name: TABLE stock_requests; Type: ACL; Schema: inventario_mvp; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE inventario_mvp.stock_requests TO inventario_app;


--
-- PostgreSQL database dump complete
--

\unrestrict GI7Cong5x2gNb1biXx4cIUVHhIHIR38YPt2KmJuSdIE0gs87KvaS8x5iDmePdoF
