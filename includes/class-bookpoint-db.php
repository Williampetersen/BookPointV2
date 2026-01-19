<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class BookPoint_DB {
    const DB_VERSION = '1.0.0';

    private $wpdb;

    public function __construct() {
        global $wpdb;
        $this->wpdb = $wpdb;
    }

    public static function install() {
        $self = new self();
        $self->install_tables();
    }

    public static function deactivate() {
        // Reserved for future cleanup tasks.
    }

    public function maybe_upgrade() {
        $current = get_option( 'bookpoint_db_version', '0.0.0' );
        if ( version_compare( $current, self::DB_VERSION, '<' ) ) {
            $this->install_tables();
        }
    }

    private function table( $name ) {
        return $this->wpdb->prefix . 'bookpoint_' . $name;
    }

    private function install_tables() {
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $this->wpdb->get_charset_collate();
        $queries = array(
            "CREATE TABLE {$this->table( 'services' )} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                name VARCHAR(190) NOT NULL,
                slug VARCHAR(190) NOT NULL,
                duration INT NOT NULL DEFAULT 60,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                active TINYINT(1) NOT NULL DEFAULT 1,
                image_url TEXT NULL,
                buffer_before INT NOT NULL DEFAULT 0,
                buffer_after INT NOT NULL DEFAULT 0,
                capacity_min INT NOT NULL DEFAULT 1,
                capacity_max INT NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY slug (slug)
            ) {$charset};",
            "CREATE TABLE {$this->table( 'staff' )} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                name VARCHAR(190) NOT NULL,
                slug VARCHAR(190) NOT NULL,
                title VARCHAR(190) NULL,
                bio TEXT NULL,
                active TINYINT(1) NOT NULL DEFAULT 1,
                avatar_url TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY slug (slug)
            ) {$charset};",
            "CREATE TABLE {$this->table( 'extras' )} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                service_id BIGINT UNSIGNED NOT NULL,
                name VARCHAR(190) NOT NULL,
                duration INT NOT NULL DEFAULT 0,
                price DECIMAL(10,2) NOT NULL DEFAULT 0,
                active TINYINT(1) NOT NULL DEFAULT 1,
                image_url TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY service_id (service_id)
            ) {$charset};",
            "CREATE TABLE {$this->table( 'settings' )} (
                setting_key VARCHAR(190) NOT NULL,
                setting_value LONGTEXT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (setting_key)
            ) {$charset};",
            "CREATE TABLE {$this->table( 'bookings' )} (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                booking_code VARCHAR(32) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                service_id BIGINT UNSIGNED NOT NULL,
                staff_id BIGINT UNSIGNED NULL,
                start_at DATETIME NOT NULL,
                end_at DATETIME NOT NULL,
                currency VARCHAR(10) NULL,
                subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
                total DECIMAL(10,2) NOT NULL DEFAULT 0,
                customer_json LONGTEXT NULL,
                custom_fields_json LONGTEXT NULL,
                notes_customer TEXT NULL,
                notes_admin TEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY booking_code (booking_code),
                KEY service_id (service_id),
                KEY staff_id (staff_id)
            ) {$charset};",
        );
        foreach ( $queries as $sql ) {
            dbDelta( $sql );
        }
        update_option( 'bookpoint_db_version', self::DB_VERSION );
    }

    private function prepare( $sql, $params = array() ) {
        if ( empty( $params ) ) {
            return $sql;
        }
        return $this->wpdb->prepare( $sql, $params );
    }

    private function format_payload( $data ) {
        $payload = array();
        $formats = array();
        foreach ( $data as $key => $value ) {
            if ( is_bool( $value ) ) {
                $value = $value ? 1 : 0;
            }
            $payload[ $key ] = $value;
            if ( is_int( $value ) ) {
                $formats[] = '%d';
            } elseif ( is_float( $value ) ) {
                $formats[] = '%f';
            } else {
                $formats[] = '%s';
            }
        }
        return array( $payload, $formats );
    }

    private function insert_row( $table, $data ) {
        list( $payload, $formats ) = $this->format_payload( $data );
        $result = $this->wpdb->insert( $table, $payload, $formats );
        if ( $result === false ) {
            $this->log_db_error( 'insert_row', array( 'table' => $table ) );
            return false;
        }
        return intval( $this->wpdb->insert_id );
    }

    private function update_row( $table, $data, $where ) {
        list( $payload, $formats ) = $this->format_payload( $data );
        list( $where_payload, $where_formats ) = $this->format_payload( $where );
        $result = $this->wpdb->update( $table, $payload, $where_payload, $formats, $where_formats );
        if ( $result === false ) {
            $this->log_db_error( 'update_row', array( 'table' => $table ) );
            return false;
        }
        return true;
    }

    private function delete_row( $table, $where ) {
        list( $where_payload, $where_formats ) = $this->format_payload( $where );
        $result = $this->wpdb->delete( $table, $where_payload, $where_formats );
        if ( $result === false ) {
            $this->log_db_error( 'delete_row', array( 'table' => $table ) );
            return false;
        }
        return true;
    }

    private function log_db_error( $message, $context = array() ) {
        if ( ! empty( $this->wpdb->last_error ) ) {
            $context['db_error'] = $this->wpdb->last_error;
        }
        if ( function_exists( 'bookpoint_log' ) ) {
            bookpoint_log( $message, $context );
        }
    }

    private function slug_exists( $table, $slug, $exclude_id = 0 ) {
        $sql = "SELECT id FROM {$table} WHERE slug = %s";
        $params = array( $slug );
        if ( $exclude_id ) {
            $sql .= " AND id != %d";
            $params[] = intval( $exclude_id );
        }
        return (bool) $this->wpdb->get_var( $this->prepare( $sql, $params ) );
    }

    private function unique_slug( $table, $name, $exclude_id = 0 ) {
        $base = sanitize_title( $name );
        if ( $base === '' ) {
            $base = 'item';
        }
        $slug = $base;
        $attempt = 2;
        while ( $this->slug_exists( $table, $slug, $exclude_id ) && $attempt < 200 ) {
            $slug = $base . '-' . $attempt;
            $attempt++;
        }
        return $slug;
    }

    private function prepare_json_value( $value ) {
        if ( $value === null ) {
            return null;
        }
        if ( is_string( $value ) ) {
            return $value;
        }
        return wp_json_encode( $value );
    }

    private function decode_value( $value ) {
        if ( $value === null ) {
            return null;
        }
        $decoded = json_decode( $value, true );
        if ( json_last_error() === JSON_ERROR_NONE ) {
            return $decoded;
        }
        return $value;
    }

    private function nullable_int( $value ) {
        if ( $value === null || $value === '' ) {
            return null;
        }
        $int = intval( $value );
        return $int > 0 ? $int : null;
    }

    public function services_create( $data ) {
        $name = sanitize_text_field( $data['name'] ?? '' );
        if ( $name === '' ) {
            return new WP_Error( 'bookpoint_service', 'Missing service name.' );
        }
        $insert = array(
            'name' => $name,
            'slug' => $this->unique_slug( $this->table( 'services' ), $name ),
            'duration' => intval( $data['duration'] ?? 60 ),
            'price' => floatval( $data['price'] ?? 0 ),
            'active' => intval( isset( $data['active'] ) ? $data['active'] : 1 ),
            'image_url' => isset( $data['image_url'] ) && $data['image_url'] ? esc_url_raw( $data['image_url'] ) : null,
            'buffer_before' => intval( $data['buffer_before'] ?? 0 ),
            'buffer_after' => intval( $data['buffer_after'] ?? 0 ),
            'capacity_min' => max( 1, intval( $data['capacity_min'] ?? 1 ) ),
            'capacity_max' => max( 1, intval( $data['capacity_max'] ?? 1 ) ),
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        );
        $id = $this->insert_row( $this->table( 'services' ), $insert );
        if ( $id === false ) {
            return new WP_Error( 'bookpoint_service', 'DB insert failed: ' . $this->wpdb->last_error );
        }
        return $this->services_get( $id );
    }

    public function services_get( $id ) {
        $table = $this->table( 'services' );
        return $this->wpdb->get_row(
            $this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
            ARRAY_A
        );
    }

    public function services_list( $include_inactive = false ) {
        $table = $this->table( 'services' );
        $where = array();
        $params = array();
        if ( ! $include_inactive ) {
            $where[] = 'active = 1';
        }
        $sql = "SELECT * FROM {$table}";
        if ( $where ) {
            $sql .= ' WHERE ' . implode( ' AND ', $where );
        }
        $sql .= ' ORDER BY id DESC';
        return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
    }

    public function services_update( $id, $data ) {
        $id = intval( $id );
        $existing = $this->services_get( $id );
        if ( ! $existing ) {
            return new WP_Error( 'bookpoint_service', 'Service not found.' );
        }
        $update = array();
        if ( array_key_exists( 'name', $data ) ) {
            $name = sanitize_text_field( $data['name'] );
            if ( $name === '' ) {
                return new WP_Error( 'bookpoint_service', 'Service name cannot be empty.' );
            }
            $update['name'] = $name;
            $update['slug'] = $this->unique_slug( $this->table( 'services' ), $name, $id );
        }
        if ( array_key_exists( 'duration', $data ) ) {
            $update['duration'] = intval( $data['duration'] );
        }
        if ( array_key_exists( 'price', $data ) ) {
            $update['price'] = floatval( $data['price'] );
        }
        if ( array_key_exists( 'buffer_before', $data ) ) {
            $update['buffer_before'] = intval( $data['buffer_before'] );
        }
        if ( array_key_exists( 'buffer_after', $data ) ) {
            $update['buffer_after'] = intval( $data['buffer_after'] );
        }
        if ( array_key_exists( 'capacity_min', $data ) ) {
            $update['capacity_min'] = max( 1, intval( $data['capacity_min'] ) );
        }
        if ( array_key_exists( 'capacity_max', $data ) ) {
            $update['capacity_max'] = max( 1, intval( $data['capacity_max'] ) );
        }
        if ( array_key_exists( 'active', $data ) ) {
            $update['active'] = intval( $data['active'] );
        }
        if ( array_key_exists( 'image_url', $data ) ) {
            $update['image_url'] = $data['image_url'] ? esc_url_raw( $data['image_url'] ) : null;
        }
        if ( empty( $update ) ) {
            return $existing;
        }
        $update['updated_at'] = current_time( 'mysql' );
        $ok = $this->update_row( $this->table( 'services' ), $update, array( 'id' => $id ) );
        if ( $ok === false ) {
            return new WP_Error( 'bookpoint_service', 'DB update failed: ' . $this->wpdb->last_error );
        }
        return $this->services_get( $id );
    }

    public function services_delete( $id ) {
        $ok = $this->delete_row( $this->table( 'services' ), array( 'id' => intval( $id ) ) );
        if ( ! $ok ) {
            return new WP_Error( 'bookpoint_service', 'DB delete failed: ' . $this->wpdb->last_error );
        }
        return true;
    }

    public function staff_create( $data ) {
        $name = sanitize_text_field( $data['name'] ?? '' );
        if ( $name === '' ) {
            return new WP_Error( 'bookpoint_staff', 'Missing staff name.' );
        }
        $insert = array(
            'name' => $name,
            'slug' => $this->unique_slug( $this->table( 'staff' ), $name ),
            'title' => isset( $data['title'] ) && $data['title'] ? sanitize_text_field( $data['title'] ) : null,
            'bio' => isset( $data['bio'] ) && $data['bio'] ? sanitize_textarea_field( $data['bio'] ) : null,
            'avatar_url' => isset( $data['avatar_url'] ) && $data['avatar_url'] ? esc_url_raw( $data['avatar_url'] ) : null,
            'active' => intval( $data['active'] ?? 1 ),
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        );
        $id = $this->insert_row( $this->table( 'staff' ), $insert );
        if ( $id === false ) {
            return new WP_Error( 'bookpoint_staff', 'DB insert failed: ' . $this->wpdb->last_error );
        }
        return $this->staff_get( $id );
    }

    public function staff_get( $id ) {
        $table = $this->table( 'staff' );
        return $this->wpdb->get_row(
            $this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
            ARRAY_A
        );
    }

    public function staff_list( $include_inactive = false ) {
        $table = $this->table( 'staff' );
        $where = array();
        $params = array();
        if ( ! $include_inactive ) {
            $where[] = 'active = 1';
        }
        $sql = "SELECT * FROM {$table}";
        if ( $where ) {
            $sql .= ' WHERE ' . implode( ' AND ', $where );
        }
        $sql .= ' ORDER BY id DESC';
        return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
    }

    public function staff_update( $id, $data ) {
        $id = intval( $id );
        $existing = $this->staff_get( $id );
        if ( ! $existing ) {
            return new WP_Error( 'bookpoint_staff', 'Staff record not found.' );
        }
        $update = array();
        if ( array_key_exists( 'name', $data ) ) {
            $name = sanitize_text_field( $data['name'] );
            if ( $name === '' ) {
                return new WP_Error( 'bookpoint_staff', 'Staff name cannot be empty.' );
            }
            $update['name'] = $name;
            $update['slug'] = $this->unique_slug( $this->table( 'staff' ), $name, $id );
        }
        if ( array_key_exists( 'title', $data ) ) {
            $update['title'] = $data['title'] ? sanitize_text_field( $data['title'] ) : null;
        }
        if ( array_key_exists( 'bio', $data ) ) {
            $update['bio'] = $data['bio'] ? sanitize_textarea_field( $data['bio'] ) : null;
        }
        if ( array_key_exists( 'avatar_url', $data ) ) {
            $update['avatar_url'] = $data['avatar_url'] ? esc_url_raw( $data['avatar_url'] ) : null;
        }
        if ( array_key_exists( 'active', $data ) ) {
            $update['active'] = intval( $data['active'] );
        }
        if ( empty( $update ) ) {
            return $existing;
        }
        $update['updated_at'] = current_time( 'mysql' );
        $ok = $this->update_row( $this->table( 'staff' ), $update, array( 'id' => $id ) );
        if ( $ok === false ) {
            return new WP_Error( 'bookpoint_staff', 'DB update failed: ' . $this->wpdb->last_error );
        }
        return $this->staff_get( $id );
    }

    public function staff_delete( $id ) {
        $ok = $this->delete_row( $this->table( 'staff' ), array( 'id' => intval( $id ) ) );
        if ( ! $ok ) {
            return new WP_Error( 'bookpoint_staff', 'DB delete failed: ' . $this->wpdb->last_error );
        }
        return true;
    }

    public function extras_create( $data ) {
        $service_id = intval( $data['service_id'] ?? 0 );
        $name = sanitize_text_field( $data['name'] ?? '' );
        if ( ! $service_id || $name === '' ) {
            return new WP_Error( 'bookpoint_extra', 'Missing extra details.' );
        }
        $insert = array(
            'service_id' => $service_id,
            'name' => $name,
            'duration' => intval( $data['duration'] ?? 0 ),
            'price' => floatval( $data['price'] ?? 0 ),
            'active' => intval( $data['active'] ?? 1 ),
            'image_url' => isset( $data['image_url'] ) && $data['image_url'] ? esc_url_raw( $data['image_url'] ) : null,
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        );
        $id = $this->insert_row( $this->table( 'extras' ), $insert );
        if ( $id === false ) {
            return new WP_Error( 'bookpoint_extra', 'DB insert failed: ' . $this->wpdb->last_error );
        }
        return $this->extras_get( $id );
    }

    public function extras_get( $id ) {
        $table = $this->table( 'extras' );
        return $this->wpdb->get_row(
            $this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
            ARRAY_A
        );
    }

    public function extras_list( $service_id = 0, $include_inactive = false ) {
        $table = $this->table( 'extras' );
        $where = array();
        $params = array();
        if ( $service_id ) {
            $where[] = 'service_id = %d';
            $params[] = intval( $service_id );
        }
        if ( ! $include_inactive ) {
            $where[] = 'active = 1';
        }
        $sql = "SELECT * FROM {$table}";
        if ( $where ) {
            $sql .= ' WHERE ' . implode( ' AND ', $where );
        }
        $sql .= ' ORDER BY created_at DESC';
        return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
    }

    public function extras_update( $id, $data ) {
        $id = intval( $id );
        $existing = $this->extras_get( $id );
        if ( ! $existing ) {
            return new WP_Error( 'bookpoint_extra', 'Extra not found.' );
        }
        $update = array();
        if ( array_key_exists( 'service_id', $data ) ) {
            $update['service_id'] = intval( $data['service_id'] );
        }
        if ( array_key_exists( 'name', $data ) ) {
            $update['name'] = sanitize_text_field( $data['name'] );
        }
        if ( array_key_exists( 'duration', $data ) ) {
            $update['duration'] = intval( $data['duration'] );
        }
        if ( array_key_exists( 'price', $data ) ) {
            $update['price'] = floatval( $data['price'] );
        }
        if ( array_key_exists( 'active', $data ) ) {
            $update['active'] = intval( $data['active'] );
        }
        if ( array_key_exists( 'image_url', $data ) ) {
            $update['image_url'] = $data['image_url'] ? esc_url_raw( $data['image_url'] ) : null;
        }
        if ( empty( $update ) ) {
            return $existing;
        }
        $update['updated_at'] = current_time( 'mysql' );
        $ok = $this->update_row( $this->table( 'extras' ), $update, array( 'id' => $id ) );
        if ( $ok === false ) {
            return new WP_Error( 'bookpoint_extra', 'DB update failed: ' . $this->wpdb->last_error );
        }
        return $this->extras_get( $id );
    }

    public function extras_delete( $id ) {
        $ok = $this->delete_row( $this->table( 'extras' ), array( 'id' => intval( $id ) ) );
        if ( ! $ok ) {
            return new WP_Error( 'bookpoint_extra', 'DB delete failed: ' . $this->wpdb->last_error );
        }
        return true;
    }

    public function settings_get_all() {
        $table = $this->table( 'settings' );
        $rows = $this->wpdb->get_results( "SELECT setting_key, setting_value FROM {$table}", ARRAY_A );
        $result = array();
        foreach ( $rows as $row ) {
            $result[ $row['setting_key'] ] = $this->decode_value( $row['setting_value'] ?? null );
        }
        return $result;
    }

    public function settings_set( $key, $value ) {
        $key = sanitize_key( $key );
        if ( $key === '' ) {
            return new WP_Error( 'bookpoint_settings', 'Invalid setting key.' );
        }
        $payload = $this->prepare_json_value( $value );
        $data = array(
            'setting_key' => $key,
            'setting_value' => $payload,
            'updated_at' => current_time( 'mysql' ),
        );
        $formats = array( '%s', '%s', '%s' );
        $ok = $this->wpdb->replace( $this->table( 'settings' ), $data, $formats );
        if ( $ok === false ) {
            return new WP_Error( 'bookpoint_settings', 'DB update failed: ' . $this->wpdb->last_error );
        }
        return true;
    }

    public function bookings_create( $data ) {
        $service_id = intval( $data['service_id'] ?? 0 );
        $start_at = sanitize_text_field( $data['start_at'] ?? '' );
        $end_at = sanitize_text_field( $data['end_at'] ?? '' );
        if ( ! $service_id || $start_at === '' || $end_at === '' ) {
            return new WP_Error( 'bookpoint_booking', 'Missing booking details.' );
        }
        $booking_code = $this->generate_booking_code();
        if ( $booking_code === '' ) {
            return new WP_Error( 'bookpoint_booking', 'Unable to generate booking code.' );
        }
        $insert = array(
            'booking_code' => $booking_code,
            'status' => sanitize_text_field( $data['status'] ?? 'pending' ),
            'service_id' => $service_id,
            'staff_id' => $this->nullable_int( $data['staff_id'] ?? null ),
            'start_at' => $start_at,
            'end_at' => $end_at,
            'currency' => isset( $data['currency'] ) ? sanitize_text_field( $data['currency'] ) : null,
            'subtotal' => floatval( $data['subtotal'] ?? 0 ),
            'total' => floatval( $data['total'] ?? 0 ),
            'customer_json' => $this->prepare_json_value( $data['customer'] ?? ( $data['customer_json'] ?? null ) ),
            'custom_fields_json' => $this->prepare_json_value( $data['custom_fields'] ?? ( $data['custom_fields_json'] ?? null ) ),
            'notes_customer' => isset( $data['notes_customer'] ) && $data['notes_customer'] ? sanitize_textarea_field( $data['notes_customer'] ) : null,
            'notes_admin' => isset( $data['notes_admin'] ) && $data['notes_admin'] ? sanitize_textarea_field( $data['notes_admin'] ) : null,
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        );
        $id = $this->insert_row( $this->table( 'bookings' ), $insert );
        if ( $id === false ) {
            return new WP_Error( 'bookpoint_booking', 'DB insert failed: ' . $this->wpdb->last_error );
        }
        return $this->bookings_get( $id );
    }

    public function bookings_get( $id ) {
        $table = $this->table( 'bookings' );
        return $this->wpdb->get_row(
            $this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
            ARRAY_A
        );
    }

    public function bookings_list( $args = array() ) {
        $table = $this->table( 'bookings' );
        $where = array();
        $params = array();
        if ( ! empty( $args['status'] ) ) {
            $where[] = 'status = %s';
            $params[] = sanitize_text_field( $args['status'] );
        }
        if ( ! empty( $args['service_id'] ) ) {
            $where[] = 'service_id = %d';
            $params[] = intval( $args['service_id'] );
        }
        $sql = "SELECT * FROM {$table}";
        if ( $where ) {
            $sql .= ' WHERE ' . implode( ' AND ', $where );
        }
        $sql .= ' ORDER BY created_at DESC';
        return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
    }

    public function bookings_delete( $id ) {
        $ok = $this->delete_row( $this->table( 'bookings' ), array( 'id' => intval( $id ) ) );
        if ( ! $ok ) {
            return new WP_Error( 'bookpoint_booking', 'DB delete failed: ' . $this->wpdb->last_error );
        }
        return true;
    }

    public function bookings_update_status( $id, $status ) {
        $id = intval( $id );
        $status = sanitize_text_field( $status );
        if ( $status === '' ) {
            return new WP_Error( 'bookpoint_booking', 'Missing status.' );
        }
        $ok = $this->update_row( $this->table( 'bookings' ), array(
            'status' => $status,
            'updated_at' => current_time( 'mysql' ),
        ), array( 'id' => $id ) );
        if ( $ok === false ) {
            return new WP_Error( 'bookpoint_booking', 'DB update failed: ' . $this->wpdb->last_error );
        }
        return $this->bookings_get( $id );
    }

    private function generate_booking_code() {
        $table = $this->table( 'bookings' );
        for ( $attempt = 0; $attempt < 10; $attempt++ ) {
            $code = 'BP-' . strtoupper( wp_generate_password( 10, false, false ) );
            $exists = $this->wpdb->get_var( $this->prepare( "SELECT id FROM {$table} WHERE booking_code = %s", array( $code ) ) );
            if ( ! $exists ) {
                return $code;
            }
        }
        return '';
    }

    public function get_option_json( $key, $default = array() ) {
        $value = get_option( $key, null );
        if ( $value === null ) return $default;
        $decoded = json_decode( $value, true );
        if ( $decoded === null && $value !== 'null' ) return $default;
        return $decoded;
    }

    public function set_option_json( $key, $value ) {
        $encoded = is_string( $value ) ? $value : wp_json_encode( $value );
        return update_option( $key, $encoded, false );
    }
}

