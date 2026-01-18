<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class BookPoint_DB {
	const DB_VERSION = '2.0.0';

	private $wpdb;
	private $prefix;

	public function __construct() {
		global $wpdb;
		$this->wpdb = $wpdb;
		$this->prefix = $wpdb->prefix . 'bookpoint_';
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
		return $this->prefix . $name;
	}

	private function install_tables() {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $this->wpdb->get_charset_collate();

		$services = "CREATE TABLE {$this->table( 'services' )} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			slug VARCHAR(190) NOT NULL,
			duration INT NOT NULL DEFAULT 60,
			price DECIMAL(10,2) NOT NULL DEFAULT 0,
			image_url TEXT NULL,
			buffer_before INT NOT NULL DEFAULT 0,
			buffer_after INT NOT NULL DEFAULT 0,
			capacity_min INT NOT NULL DEFAULT 1,
			capacity_max INT NOT NULL DEFAULT 1,
			active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY slug (slug)
		) $charset;";
		dbDelta( $services );

		$staff = "CREATE TABLE {$this->table( 'staff' )} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			name VARCHAR(190) NOT NULL,
			title VARCHAR(190) NULL,
			bio TEXT NULL,
			avatar_url TEXT NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			use_custom_schedule TINYINT(1) NOT NULL DEFAULT 0,
			days_off_json LONGTEXT NULL,
			services_json LONGTEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id)
		) $charset;";
		dbDelta( $staff );

		$availability = "CREATE TABLE {$this->table( 'availability' )} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			staff_id BIGINT UNSIGNED NOT NULL,
			date DATE NOT NULL,
			start_time TIME NOT NULL,
			end_time TIME NOT NULL,
			available TINYINT(1) NOT NULL DEFAULT 1,
			note TEXT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY staff_date (staff_id, date)
		) $charset;";
		dbDelta( $availability );

		$extras = "CREATE TABLE {$this->table( 'extras' )} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			service_id BIGINT UNSIGNED NOT NULL,
			name VARCHAR(190) NOT NULL,
			price DECIMAL(10,2) NOT NULL DEFAULT 0,
			duration INT NOT NULL DEFAULT 0,
			image_url TEXT NULL,
			active TINYINT(1) NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			KEY service_id (service_id)
		) $charset;";
		dbDelta( $extras );

		$bookings = "CREATE TABLE {$this->table( 'bookings' )} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			booking_code VARCHAR(32) NOT NULL,
			service_id BIGINT UNSIGNED NOT NULL,
			staff_id BIGINT UNSIGNED NOT NULL,
			booking_date DATE NOT NULL,
			start_time TIME NOT NULL,
			end_time TIME NOT NULL,
			customer_first_name VARCHAR(190) NULL,
			customer_last_name VARCHAR(190) NULL,
			customer_email VARCHAR(190) NULL,
			customer_phone VARCHAR(50) NULL,
			customer_note TEXT NULL,
			extras_json LONGTEXT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'pending',
			total DECIMAL(10,2) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY booking_code (booking_code)
		) $charset;";
		dbDelta( $bookings );

		$settings = "CREATE TABLE {$this->table( 'settings' )} (
			option_key VARCHAR(190) NOT NULL,
			option_value LONGTEXT NULL,
			PRIMARY KEY (option_key)
		) $charset;";
		dbDelta( $settings );

		$form_fields = "CREATE TABLE {$this->table( 'form_fields' )} (
			id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
			field_key VARCHAR(190) NOT NULL,
			label VARCHAR(190) NOT NULL,
			type VARCHAR(50) NOT NULL,
			placeholder VARCHAR(190) NULL,
			required TINYINT(1) NOT NULL DEFAULT 0,
			enabled TINYINT(1) NOT NULL DEFAULT 1,
			sort_order INT NOT NULL DEFAULT 0,
			is_default TINYINT(1) NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id),
			UNIQUE KEY field_key (field_key)
		) $charset;";
		dbDelta( $form_fields );

		update_option( 'bookpoint_db_version', self::DB_VERSION );
	}

	private function prepare( $sql, $params = array() ) {
		return $this->wpdb->prepare( $sql, $params );
	}

	private function run_insert( $table, $data ) {
		$columns = array_keys( $data );
		$values = array_values( $data );
		$placeholders = array();
		foreach ( $values as $val ) {
			$placeholders[] = is_int( $val ) ? '%d' : ( is_float( $val ) ? '%f' : '%s' );
		}
		$sql = "INSERT INTO {$table} (" . implode( ',', $columns ) . ") VALUES (" . implode( ',', $placeholders ) . ")";
		return $this->wpdb->query( $this->prepare( $sql, $values ) );
	}

	private function run_update( $table, $data, $where ) {
		$set_parts = array();
		$values = array();
		foreach ( $data as $col => $val ) {
			$set_parts[] = $col . '=' . ( is_int( $val ) ? '%d' : ( is_float( $val ) ? '%f' : '%s' ) );
			$values[] = $val;
		}
		$where_parts = array();
		foreach ( $where as $col => $val ) {
			$where_parts[] = $col . '=' . ( is_int( $val ) ? '%d' : '%s' );
			$values[] = $val;
		}
		$sql = "UPDATE {$table} SET " . implode( ',', $set_parts ) . " WHERE " . implode( ' AND ', $where_parts );
		return $this->wpdb->query( $this->prepare( $sql, $values ) );
	}

	private function run_delete( $table, $where ) {
		$where_parts = array();
		$values = array();
		foreach ( $where as $col => $val ) {
			$where_parts[] = $col . '=' . ( is_int( $val ) ? '%d' : '%s' );
			$values[] = $val;
		}
		$sql = "DELETE FROM {$table} WHERE " . implode( ' AND ', $where_parts );
		return $this->wpdb->query( $this->prepare( $sql, $values ) );
	}

	private function decode_json_field( $value ) {
		if ( $value === null || $value === '' ) return array();
		if ( is_array( $value ) ) return $value;
		$decoded = json_decode( $value, true );
		return is_array( $decoded ) ? $decoded : array();
	}

	private function log_db_error( $message, $context = array() ) {
		if ( ! empty( $this->wpdb->last_error ) ) {
			$context['db_error'] = $this->wpdb->last_error;
		}
		if ( function_exists( 'bookpoint_log' ) ) {
			bookpoint_log( $message, $context );
		}
	}

	private function unique_slug( $name, $exclude_id = null ) {
		$base = sanitize_title( $name );
		if ( $base === '' ) $base = 'service';
		$slug = $base;
		$i = 2;
		while ( $this->slug_exists( $slug, $exclude_id ) && $i < 200 ) {
			$slug = $base . '-' . $i;
			$i++;
		}
		return $slug;
	}

	private function slug_exists( $slug, $exclude_id = null ) {
		$table = $this->table( 'services' );
		$sql = "SELECT id FROM {$table} WHERE slug = %s";
		$params = array( $slug );
		if ( $exclude_id ) {
			$sql .= " AND id != %d";
			$params[] = intval( $exclude_id );
		}
		return (bool) $this->wpdb->get_var( $this->prepare( $sql, $params ) );
	}

	public function create_service( $data ) {
		$table = $this->table( 'services' );
		$name = sanitize_text_field( $data['name'] ?? '' );
		if ( $name === '' ) return new WP_Error( 'bookpoint_service', 'Missing service name.' );

		$slug = $this->unique_slug( $name );
		$insert = array(
			'name' => $name,
			'slug' => $slug,
			'duration' => intval( $data['duration'] ?? 60 ),
			'price' => floatval( $data['price'] ?? 0 ),
			'image_url' => isset( $data['image_url'] ) ? esc_url_raw( $data['image_url'] ) : null,
			'buffer_before' => intval( $data['buffer_before'] ?? 0 ),
			'buffer_after' => intval( $data['buffer_after'] ?? 0 ),
			'capacity_min' => intval( $data['capacity_min'] ?? 1 ),
			'capacity_max' => intval( $data['capacity_max'] ?? 1 ),
			'active' => intval( $data['active'] ?? 1 ),
			'created_at' => current_time( 'mysql' ),
			'updated_at' => current_time( 'mysql' ),
		);
		$ok = $this->run_insert( $table, $insert );
		if ( ! $ok ) {
			$this->log_db_error( 'Create service failed', array( 'name' => $name ) );
			return new WP_Error( 'bookpoint_service', 'DB insert failed: ' . $this->wpdb->last_error );
		}
		return $this->get_service( intval( $this->wpdb->insert_id ) );
	}

	public function update_service( $id, $data ) {
		$table = $this->table( 'services' );
		$id = intval( $id );
		$update = array();
		foreach ( array( 'name', 'duration', 'price', 'image_url', 'buffer_before', 'buffer_after', 'capacity_min', 'capacity_max', 'active' ) as $key ) {
			if ( array_key_exists( $key, $data ) ) $update[ $key ] = $data[ $key ];
		}
		if ( isset( $update['name'] ) ) {
			$update['name'] = sanitize_text_field( $update['name'] );
			$update['slug'] = $this->unique_slug( $update['name'], $id );
		}
		if ( array_key_exists( 'duration', $update ) ) $update['duration'] = intval( $update['duration'] );
		if ( array_key_exists( 'price', $update ) ) $update['price'] = floatval( $update['price'] );
		if ( array_key_exists( 'image_url', $update ) ) $update['image_url'] = $update['image_url'] ? esc_url_raw( $update['image_url'] ) : null;
		foreach ( array( 'buffer_before', 'buffer_after', 'capacity_min', 'capacity_max', 'active' ) as $int_key ) {
			if ( array_key_exists( $int_key, $update ) ) $update[ $int_key ] = intval( $update[ $int_key ] );
		}
		if ( empty( $update ) ) return $this->get_service( $id );
		$update['updated_at'] = current_time( 'mysql' );

		$ok = $this->run_update( $table, $update, array( 'id' => $id ) );
		if ( $ok === false ) {
			$this->log_db_error( 'Update service failed', array( 'id' => $id ) );
			return new WP_Error( 'bookpoint_service', 'DB update failed: ' . $this->wpdb->last_error );
		}
		return $this->get_service( $id );
	}

	public function delete_service( $id ) {
		$ok = $this->run_delete( $this->table( 'services' ), array( 'id' => intval( $id ) ) );
		if ( ! $ok ) {
			$this->log_db_error( 'Delete service failed', array( 'id' => $id ) );
			return false;
		}
		return true;
	}

	public function get_service( $id ) {
		$table = $this->table( 'services' );
		return $this->wpdb->get_row(
			$this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
			ARRAY_A
		);
	}

	public function list_services( $args = array() ) {
		$table = $this->table( 'services' );
		$where = array();
		$params = array();
		if ( empty( $args['include_inactive'] ) ) {
			$where[] = 'active = 1';
		}
		$sql = "SELECT * FROM {$table}";
		if ( $where ) {
			$sql .= ' WHERE ' . implode( ' AND ', $where );
		}
		$sql .= ' ORDER BY id DESC';
		return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
	}

	public function create_staff( $data ) {
		$table = $this->table( 'staff' );
		$name = sanitize_text_field( $data['name'] ?? '' );
		if ( $name === '' ) return new WP_Error( 'bookpoint_staff', 'Missing staff name.' );

		$insert = array(
			'name' => $name,
			'title' => sanitize_text_field( $data['title'] ?? '' ),
			'bio' => wp_kses_post( $data['bio'] ?? '' ),
			'avatar_url' => isset( $data['avatar_url'] ) ? esc_url_raw( $data['avatar_url'] ) : null,
			'active' => intval( $data['active'] ?? 1 ),
			'use_custom_schedule' => intval( $data['use_custom_schedule'] ?? 0 ),
			'days_off_json' => isset( $data['days_off_json'] ) ? wp_json_encode( $data['days_off_json'] ) : null,
			'services_json' => isset( $data['services_json'] ) ? wp_json_encode( $data['services_json'] ) : null,
			'created_at' => current_time( 'mysql' ),
			'updated_at' => current_time( 'mysql' ),
		);
		$ok = $this->run_insert( $table, $insert );
		if ( ! $ok ) {
			$this->log_db_error( 'Create staff failed', array( 'name' => $name ) );
			return new WP_Error( 'bookpoint_staff', 'DB insert failed: ' . $this->wpdb->last_error );
		}
		return $this->get_staff( intval( $this->wpdb->insert_id ) );
	}

	public function update_staff( $id, $data ) {
		$table = $this->table( 'staff' );
		$id = intval( $id );
		$update = array();
		foreach ( array( 'name', 'title', 'bio', 'avatar_url', 'active', 'use_custom_schedule', 'days_off_json', 'services_json' ) as $key ) {
			if ( array_key_exists( $key, $data ) ) $update[ $key ] = $data[ $key ];
		}
		if ( isset( $update['name'] ) ) $update['name'] = sanitize_text_field( $update['name'] );
		if ( isset( $update['title'] ) ) $update['title'] = sanitize_text_field( $update['title'] );
		if ( isset( $update['bio'] ) ) $update['bio'] = wp_kses_post( $update['bio'] );
		if ( array_key_exists( 'avatar_url', $update ) ) $update['avatar_url'] = $update['avatar_url'] ? esc_url_raw( $update['avatar_url'] ) : null;
		foreach ( array( 'active', 'use_custom_schedule' ) as $int_key ) {
			if ( array_key_exists( $int_key, $update ) ) $update[ $int_key ] = intval( $update[ $int_key ] );
		}
		if ( array_key_exists( 'days_off_json', $update ) ) {
			$update['days_off_json'] = $update['days_off_json'] === null ? null : wp_json_encode( $update['days_off_json'] );
		}
		if ( array_key_exists( 'services_json', $update ) ) {
			$update['services_json'] = $update['services_json'] === null ? null : wp_json_encode( $update['services_json'] );
		}
		if ( empty( $update ) ) return $this->get_staff( $id );
		$update['updated_at'] = current_time( 'mysql' );

		$ok = $this->run_update( $table, $update, array( 'id' => $id ) );
		if ( $ok === false ) {
			$this->log_db_error( 'Update staff failed', array( 'id' => $id ) );
			return new WP_Error( 'bookpoint_staff', 'DB update failed: ' . $this->wpdb->last_error );
		}
		return $this->get_staff( $id );
	}

	public function delete_staff( $id ) {
		$ok = $this->run_delete( $this->table( 'staff' ), array( 'id' => intval( $id ) ) );
		if ( ! $ok ) {
			$this->log_db_error( 'Delete staff failed', array( 'id' => $id ) );
			return false;
		}
		return true;
	}

	public function get_staff( $id ) {
		$table = $this->table( 'staff' );
		$row = $this->wpdb->get_row(
			$this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
			ARRAY_A
		);
		if ( $row ) {
			$row['days_off_json'] = $this->decode_json_field( $row['days_off_json'] ?? null );
			$row['services_json'] = $this->decode_json_field( $row['services_json'] ?? null );
		}
		return $row;
	}

	public function list_staff( $args = array() ) {
		$table = $this->table( 'staff' );
		$where = array();
		$params = array();
		if ( empty( $args['include_inactive'] ) ) {
			$where[] = 'active = 1';
		}
		$sql = "SELECT * FROM {$table}";
		if ( $where ) {
			$sql .= ' WHERE ' . implode( ' AND ', $where );
		}
		$sql .= ' ORDER BY id DESC';
		$rows = $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
		foreach ( $rows as &$row ) {
			$row['days_off_json'] = $this->decode_json_field( $row['days_off_json'] ?? null );
			$row['services_json'] = $this->decode_json_field( $row['services_json'] ?? null );
		}
		if ( ! empty( $args['service_id'] ) ) {
			$service_id = intval( $args['service_id'] );
			$rows = array_values( array_filter( $rows, function( $row ) use ( $service_id ) {
				$services = is_array( $row['services_json'] ?? null ) ? $row['services_json'] : array();
				return in_array( $service_id, array_map( 'intval', $services ), true );
			} ) );
		}
		return $rows;
	}

	public function create_availability_block( $data ) {
		$table = $this->table( 'availability' );
		$insert = array(
			'staff_id' => intval( $data['staff_id'] ?? 0 ),
			'date' => sanitize_text_field( $data['date'] ?? '' ),
			'start_time' => sanitize_text_field( $data['start_time'] ?? '' ),
			'end_time' => sanitize_text_field( $data['end_time'] ?? '' ),
			'available' => intval( $data['available'] ?? 1 ),
			'note' => sanitize_text_field( $data['note'] ?? '' ),
			'created_at' => current_time( 'mysql' ),
			'updated_at' => current_time( 'mysql' ),
		);
		if ( ! $insert['staff_id'] || $insert['date'] === '' ) return new WP_Error( 'bookpoint_availability', 'Missing availability data.' );
		$ok = $this->run_insert( $table, $insert );
		if ( ! $ok ) {
			$this->log_db_error( 'Create availability failed', array( 'staff_id' => $insert['staff_id'] ) );
			return new WP_Error( 'bookpoint_availability', 'DB insert failed: ' . $this->wpdb->last_error );
		}
		$insert['id'] = intval( $this->wpdb->insert_id );
		return $insert;
	}

	public function list_availability( $staff_id = 0, $from = '', $to = '' ) {
		$table = $this->table( 'availability' );
		$where = array();
		$params = array();
		if ( $staff_id ) {
			$where[] = 'staff_id = %d';
			$params[] = intval( $staff_id );
		}
		if ( $from ) {
			$where[] = 'date >= %s';
			$params[] = sanitize_text_field( $from );
		}
		if ( $to ) {
			$where[] = 'date <= %s';
			$params[] = sanitize_text_field( $to );
		}
		$sql = "SELECT * FROM {$table}";
		if ( $where ) {
			$sql .= ' WHERE ' . implode( ' AND ', $where );
		}
		$sql .= ' ORDER BY date ASC, start_time ASC';
		return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
	}

	public function delete_availability_block( $id ) {
		$ok = $this->run_delete( $this->table( 'availability' ), array( 'id' => intval( $id ) ) );
		if ( ! $ok ) {
			$this->log_db_error( 'Delete availability failed', array( 'id' => $id ) );
			return false;
		}
		return true;
	}

	public function create_extra( $data ) {
		$table = $this->table( 'extras' );
		$insert = array(
			'service_id' => intval( $data['service_id'] ?? 0 ),
			'name' => sanitize_text_field( $data['name'] ?? '' ),
			'price' => floatval( $data['price'] ?? 0 ),
			'duration' => intval( $data['duration'] ?? 0 ),
			'image_url' => isset( $data['image_url'] ) ? esc_url_raw( $data['image_url'] ) : null,
			'active' => intval( $data['active'] ?? 1 ),
			'created_at' => current_time( 'mysql' ),
			'updated_at' => current_time( 'mysql' ),
		);
		if ( ! $insert['service_id'] || $insert['name'] === '' ) return new WP_Error( 'bookpoint_extra', 'Missing extra name.' );
		$ok = $this->run_insert( $table, $insert );
		if ( ! $ok ) {
			$this->log_db_error( 'Create extra failed', array( 'service_id' => $insert['service_id'] ) );
			return new WP_Error( 'bookpoint_extra', 'DB insert failed: ' . $this->wpdb->last_error );
		}
		$insert['id'] = intval( $this->wpdb->insert_id );
		return $insert;
	}

	public function update_extra( $id, $data ) {
		$table = $this->table( 'extras' );
		$id = intval( $id );
		$update = array();
		foreach ( array( 'service_id', 'name', 'price', 'duration', 'image_url', 'active' ) as $key ) {
			if ( array_key_exists( $key, $data ) ) $update[ $key ] = $data[ $key ];
		}
		if ( isset( $update['service_id'] ) ) $update['service_id'] = intval( $update['service_id'] );
		if ( isset( $update['name'] ) ) $update['name'] = sanitize_text_field( $update['name'] );
		if ( array_key_exists( 'price', $update ) ) $update['price'] = floatval( $update['price'] );
		if ( array_key_exists( 'duration', $update ) ) $update['duration'] = intval( $update['duration'] );
		if ( array_key_exists( 'image_url', $update ) ) $update['image_url'] = $update['image_url'] ? esc_url_raw( $update['image_url'] ) : null;
		if ( array_key_exists( 'active', $update ) ) $update['active'] = intval( $update['active'] );
		if ( empty( $update ) ) return $this->get_extra( $id );
		$update['updated_at'] = current_time( 'mysql' );

		$ok = $this->run_update( $table, $update, array( 'id' => $id ) );
		if ( $ok === false ) {
			$this->log_db_error( 'Update extra failed', array( 'id' => $id ) );
			return new WP_Error( 'bookpoint_extra', 'DB update failed: ' . $this->wpdb->last_error );
		}
		return $this->get_extra( $id );
	}

	public function get_extra( $id ) {
		$table = $this->table( 'extras' );
		return $this->wpdb->get_row(
			$this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
			ARRAY_A
		);
	}

	public function list_extras( $args = array() ) {
		$table = $this->table( 'extras' );
		$args = wp_parse_args( $args, array(
			'service_id' => 0,
			'include_inactive' => false,
		) );
		$where = array();
		$params = array();
		if ( $args['service_id'] ) {
			$where[] = 'service_id = %d';
			$params[] = intval( $args['service_id'] );
		}
		if ( empty( $args['include_inactive'] ) ) {
			$where[] = 'active = 1';
		}
		$sql = "SELECT * FROM {$table}";
		if ( $where ) {
			$sql .= ' WHERE ' . implode( ' AND ', $where );
		}
		$sql .= ' ORDER BY created_at DESC';
		return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
	}

	public function delete_extra( $id ) {
		$ok = $this->run_delete( $this->table( 'extras' ), array( 'id' => intval( $id ) ) );
		if ( ! $ok ) {
			$this->log_db_error( 'Delete extra failed', array( 'id' => $id ) );
			return false;
		}
		return true;
	}

	public function create_booking( $data ) {
		$table = $this->table( 'bookings' );

		$service_id = intval( $data['service_id'] ?? 0 );
		$staff_id = intval( $data['staff_id'] ?? 0 );
		$booking_date = sanitize_text_field( $data['booking_date'] ?? '' );
		$start_time = sanitize_text_field( $data['start_time'] ?? '' );
		$end_time = sanitize_text_field( $data['end_time'] ?? '' );

		if ( ! $service_id || ! $staff_id || $booking_date === '' || $start_time === '' || $end_time === '' ) {
			return new WP_Error( 'bookpoint_booking', 'Missing booking details.' );
		}

		$extras = $data['extras_json'] ?? array();
		if ( ! is_array( $extras ) ) $extras = array();

		$booking_code = '';
		for ( $i = 0; $i < 5; $i++ ) {
			$booking_code = bin2hex( random_bytes( 8 ) );
			$exists = $this->wpdb->get_var(
				$this->prepare( "SELECT id FROM {$table} WHERE booking_code = %s", array( $booking_code ) )
			);
			if ( ! $exists ) break;
		}
		if ( $booking_code === '' ) return new WP_Error( 'bookpoint_booking', 'Unable to generate booking code.' );

		$insert = array(
			'booking_code' => $booking_code,
			'service_id' => $service_id,
			'staff_id' => $staff_id,
			'booking_date' => $booking_date,
			'start_time' => $start_time,
			'end_time' => $end_time,
			'customer_first_name' => sanitize_text_field( $data['customer_first_name'] ?? '' ),
			'customer_last_name' => sanitize_text_field( $data['customer_last_name'] ?? '' ),
			'customer_email' => sanitize_email( $data['customer_email'] ?? '' ),
			'customer_phone' => sanitize_text_field( $data['customer_phone'] ?? '' ),
			'customer_note' => sanitize_textarea_field( $data['customer_note'] ?? '' ),
			'extras_json' => wp_json_encode( $extras ),
			'status' => sanitize_text_field( $data['status'] ?? 'pending' ),
			'total' => floatval( $data['total'] ?? 0 ),
			'created_at' => current_time( 'mysql' ),
			'updated_at' => current_time( 'mysql' ),
		);

		$ok = $this->run_insert( $table, $insert );
		if ( ! $ok ) {
			$this->log_db_error( 'Create booking failed', array( 'service_id' => $service_id, 'staff_id' => $staff_id ) );
			return new WP_Error( 'bookpoint_booking', 'DB insert failed: ' . $this->wpdb->last_error );
		}
		$insert['id'] = intval( $this->wpdb->insert_id );
		return $insert;
	}

	public function list_bookings( $args = array() ) {
		$table = $this->table( 'bookings' );
		$where = array();
		$params = array();
		if ( ! empty( $args['status'] ) ) {
			$where[] = 'status = %s';
			$params[] = sanitize_text_field( $args['status'] );
		}
		if ( ! empty( $args['date_from'] ) ) {
			$where[] = 'booking_date >= %s';
			$params[] = sanitize_text_field( $args['date_from'] );
		}
		if ( ! empty( $args['date_to'] ) ) {
			$where[] = 'booking_date <= %s';
			$params[] = sanitize_text_field( $args['date_to'] );
		}
		$sql = "SELECT * FROM {$table}";
		if ( $where ) {
			$sql .= ' WHERE ' . implode( ' AND ', $where );
		}
		$sql .= ' ORDER BY created_at DESC';
		return $this->wpdb->get_results( $this->prepare( $sql, $params ), ARRAY_A );
	}

	public function update_booking_status( $id, $status ) {
		$table = $this->table( 'bookings' );
		$update = array(
			'status' => sanitize_text_field( $status ),
			'updated_at' => current_time( 'mysql' ),
		);
		$ok = $this->run_update( $table, $update, array( 'id' => intval( $id ) ) );
		if ( $ok === false ) {
			$this->log_db_error( 'Update booking status failed', array( 'id' => $id ) );
			return new WP_Error( 'bookpoint_booking', 'DB update failed: ' . $this->wpdb->last_error );
		}
		return $this->wpdb->get_row(
			$this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
			ARRAY_A
		);
	}

	public function get_setting( $key ) {
		$table = $this->table( 'settings' );
		$value = $this->wpdb->get_var(
			$this->prepare( "SELECT option_value FROM {$table} WHERE option_key = %s", array( sanitize_key( $key ) ) )
		);
		if ( $value === null ) return null;
		$decoded = json_decode( $value, true );
		return ( $decoded === null && $value !== 'null' ) ? $value : $decoded;
	}

	public function set_setting( $key, $value ) {
		$table = $this->table( 'settings' );
		$key = sanitize_key( $key );
		$encoded = is_string( $value ) ? $value : wp_json_encode( $value );
		$exists = $this->wpdb->get_var(
			$this->prepare( "SELECT option_key FROM {$table} WHERE option_key = %s", array( $key ) )
		);
		$data = array(
			'option_key' => $key,
			'option_value' => $encoded,
		);
		$ok = $exists ? $this->run_update( $table, $data, array( 'option_key' => $key ) ) : $this->run_insert( $table, $data );
		if ( ! $ok ) {
			$this->log_db_error( 'Set setting failed', array( 'key' => $key ) );
			return new WP_Error( 'bookpoint_setting', 'DB update failed: ' . $this->wpdb->last_error );
		}
		return true;
	}

	public function list_form_fields() {
		$table = $this->table( 'form_fields' );
		$sql = "SELECT * FROM {$table} ORDER BY sort_order ASC, id ASC";
		return $this->wpdb->get_results( $sql, ARRAY_A );
	}

	public function create_form_field( $data ) {
		$table = $this->table( 'form_fields' );
		$field_key = sanitize_key( $data['field_key'] ?? '' );
		$label = sanitize_text_field( $data['label'] ?? '' );
		if ( $field_key === '' || $label === '' ) return new WP_Error( 'bookpoint_form_field', 'Missing field key or label.' );

		$insert = array(
			'field_key' => $field_key,
			'label' => $label,
			'type' => sanitize_text_field( $data['type'] ?? 'text' ),
			'placeholder' => sanitize_text_field( $data['placeholder'] ?? '' ),
			'required' => intval( $data['required'] ?? 0 ),
			'enabled' => intval( $data['enabled'] ?? 1 ),
			'sort_order' => intval( $data['sort_order'] ?? 0 ),
			'is_default' => intval( $data['is_default'] ?? 0 ),
			'created_at' => current_time( 'mysql' ),
			'updated_at' => current_time( 'mysql' ),
		);
		$ok = $this->run_insert( $table, $insert );
		if ( ! $ok ) {
			$this->log_db_error( 'Create form field failed', array( 'field_key' => $field_key ) );
			return new WP_Error( 'bookpoint_form_field', 'DB insert failed: ' . $this->wpdb->last_error );
		}
		$insert['id'] = intval( $this->wpdb->insert_id );
		return $insert;
	}

	public function update_form_field( $id, $data ) {
		$table = $this->table( 'form_fields' );
		$id = intval( $id );
		$update = array();
		foreach ( array( 'label', 'type', 'placeholder', 'required', 'enabled', 'sort_order', 'is_default' ) as $key ) {
			if ( array_key_exists( $key, $data ) ) $update[ $key ] = $data[ $key ];
		}
		if ( isset( $update['label'] ) ) $update['label'] = sanitize_text_field( $update['label'] );
		if ( isset( $update['type'] ) ) $update['type'] = sanitize_text_field( $update['type'] );
		if ( array_key_exists( 'placeholder', $update ) ) $update['placeholder'] = sanitize_text_field( $update['placeholder'] );
		foreach ( array( 'required', 'enabled', 'sort_order', 'is_default' ) as $int_key ) {
			if ( array_key_exists( $int_key, $update ) ) $update[ $int_key ] = intval( $update[ $int_key ] );
		}
		if ( empty( $update ) ) return $this->get_form_field( $id );
		$update['updated_at'] = current_time( 'mysql' );
		$ok = $this->run_update( $table, $update, array( 'id' => $id ) );
		if ( $ok === false ) {
			$this->log_db_error( 'Update form field failed', array( 'id' => $id ) );
			return new WP_Error( 'bookpoint_form_field', 'DB update failed: ' . $this->wpdb->last_error );
		}
		return $this->get_form_field( $id );
	}

	public function delete_form_field( $id ) {
		$ok = $this->run_delete( $this->table( 'form_fields' ), array( 'id' => intval( $id ) ) );
		if ( ! $ok ) {
			$this->log_db_error( 'Delete form field failed', array( 'id' => $id ) );
			return false;
		}
		return true;
	}

	public function get_form_field( $id ) {
		$table = $this->table( 'form_fields' );
		return $this->wpdb->get_row(
			$this->prepare( "SELECT * FROM {$table} WHERE id = %d", array( intval( $id ) ) ),
			ARRAY_A
		);
	}
}
