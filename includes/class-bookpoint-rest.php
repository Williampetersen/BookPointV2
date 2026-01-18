<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class BookPoint_REST {
	const NS = 'bookpoint/v1';

	private $db;

	public function __construct( BookPoint_DB $db ) {
		$this->db = $db;
	}

	public function register_routes() {
		register_rest_route( self::NS, '/services', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'services_list' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'POST',
				'callback' => array( $this, 'services_create' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
		register_rest_route( self::NS, '/services/(?P<id>\d+)', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'services_get' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'PUT',
				'callback' => array( $this, 'services_update' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'DELETE',
				'callback' => array( $this, 'services_delete' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/staff', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'staff_list' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'POST',
				'callback' => array( $this, 'staff_create' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
		register_rest_route( self::NS, '/staff/(?P<id>\d+)', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'staff_get' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'PUT',
				'callback' => array( $this, 'staff_update' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'DELETE',
				'callback' => array( $this, 'staff_delete' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/availability', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'availability_list' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'POST',
				'callback' => array( $this, 'availability_create' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
		register_rest_route( self::NS, '/availability/(?P<id>\d+)', array(
			array(
				'methods' => 'DELETE',
				'callback' => array( $this, 'availability_delete' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/extras', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'extras_list' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'POST',
				'callback' => array( $this, 'extras_create' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
		register_rest_route( self::NS, '/extras/(?P<id>\d+)', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'extras_get' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'PUT',
				'callback' => array( $this, 'extras_update' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'DELETE',
				'callback' => array( $this, 'extras_delete' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/settings', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'settings_get' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'PUT',
				'callback' => array( $this, 'settings_update' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/form-fields', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'form_fields_list' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'POST',
				'callback' => array( $this, 'form_fields_create' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
		register_rest_route( self::NS, '/form-fields/(?P<id>\d+)', array(
			array(
				'methods' => 'PUT',
				'callback' => array( $this, 'form_fields_update' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
			array(
				'methods' => 'DELETE',
				'callback' => array( $this, 'form_fields_delete' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/bookings', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'bookings_list' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );
		register_rest_route( self::NS, '/bookings/(?P<id>\d+)', array(
			array(
				'methods' => 'PUT',
				'callback' => array( $this, 'bookings_update_status' ),
				'permission_callback' => array( $this, 'can_manage' ),
			),
		) );

		register_rest_route( self::NS, '/public/services', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'public_services' ),
				'permission_callback' => '__return_true',
			),
		) );
		register_rest_route( self::NS, '/public/staff', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'public_staff' ),
				'permission_callback' => '__return_true',
			),
		) );
		register_rest_route( self::NS, '/public/extras', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'public_extras' ),
				'permission_callback' => '__return_true',
			),
		) );
		register_rest_route( self::NS, '/public/timeslots', array(
			array(
				'methods' => 'GET',
				'callback' => array( $this, 'public_timeslots' ),
				'permission_callback' => '__return_true',
			),
		) );
		register_rest_route( self::NS, '/public/bookings', array(
			array(
				'methods' => 'POST',
				'callback' => array( $this, 'public_booking_create' ),
				'permission_callback' => '__return_true',
			),
		) );
	}

	public function can_manage( WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) return false;
		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( ! $nonce ) $nonce = $request->get_param( 'nonce' );
		return wp_verify_nonce( $nonce, 'wp_rest' );
	}

	private function require_public_nonce( WP_REST_Request $request ) {
		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( ! $nonce ) $nonce = $request->get_param( 'nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'bookpoint_nonce', 'Invalid nonce.', array( 'status' => 403 ) );
		}
		return true;
	}

	private function ok( $data ) {
		return rest_ensure_response( array( 'ok' => true, 'data' => $data ) );
	}

	public function services_list( WP_REST_Request $request ) {
		$rows = $this->db->list_services( array( 'include_inactive' => $request->get_param( 'include_inactive' ) ? true : false ) );
		return $this->ok( $rows );
	}

	public function services_get( WP_REST_Request $request ) {
		$row = $this->db->get_service( intval( $request['id'] ) );
		if ( ! $row ) return new WP_Error( 'bookpoint_service', 'Service not found.', array( 'status' => 404 ) );
		return $this->ok( $row );
	}

	public function services_create( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$created = $this->db->create_service( $data );
		if ( is_wp_error( $created ) ) return $created;
		return $this->ok( $created );
	}

	public function services_update( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$updated = $this->db->update_service( intval( $request['id'] ), $data );
		if ( is_wp_error( $updated ) ) return $updated;
		return $this->ok( $updated );
	}

	public function services_delete( WP_REST_Request $request ) {
		$ok = $this->db->delete_service( intval( $request['id'] ) );
		if ( ! $ok ) return new WP_Error( 'bookpoint_service', 'Delete failed.', array( 'status' => 400 ) );
		return $this->ok( array( 'deleted' => true ) );
	}

	public function staff_list( WP_REST_Request $request ) {
		$rows = $this->db->list_staff( array(
			'include_inactive' => $request->get_param( 'include_inactive' ) ? true : false,
			'service_id' => intval( $request->get_param( 'service_id' ) ),
		) );
		return $this->ok( $rows );
	}

	public function staff_get( WP_REST_Request $request ) {
		$row = $this->db->get_staff( intval( $request['id'] ) );
		if ( ! $row ) return new WP_Error( 'bookpoint_staff', 'Staff not found.', array( 'status' => 404 ) );
		return $this->ok( $row );
	}

	public function staff_create( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$created = $this->db->create_staff( $data );
		if ( is_wp_error( $created ) ) return $created;
		return $this->ok( $created );
	}

	public function staff_update( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$updated = $this->db->update_staff( intval( $request['id'] ), $data );
		if ( is_wp_error( $updated ) ) return $updated;
		return $this->ok( $updated );
	}

	public function staff_delete( WP_REST_Request $request ) {
		$ok = $this->db->delete_staff( intval( $request['id'] ) );
		if ( ! $ok ) return new WP_Error( 'bookpoint_staff', 'Delete failed.', array( 'status' => 400 ) );
		return $this->ok( array( 'deleted' => true ) );
	}

	public function availability_list( WP_REST_Request $request ) {
		$staff_id = intval( $request->get_param( 'staff_id' ) );
		$from = sanitize_text_field( $request->get_param( 'from' ) ?? '' );
		$to = sanitize_text_field( $request->get_param( 'to' ) ?? '' );
		return $this->ok( $this->db->list_availability( $staff_id, $from, $to ) );
	}

	public function availability_create( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$created = $this->db->create_availability_block( $data );
		if ( is_wp_error( $created ) ) return $created;
		return $this->ok( $created );
	}

	public function availability_delete( WP_REST_Request $request ) {
		$ok = $this->db->delete_availability_block( intval( $request['id'] ) );
		if ( ! $ok ) return new WP_Error( 'bookpoint_availability', 'Delete failed.', array( 'status' => 400 ) );
		return $this->ok( array( 'deleted' => true ) );
	}

	public function extras_list( WP_REST_Request $request ) {
		$rows = $this->db->list_extras( array(
			'service_id' => intval( $request->get_param( 'service_id' ) ),
			'include_inactive' => $request->get_param( 'include_inactive' ) ? true : false,
		) );
		return $this->ok( $rows );
	}

	public function extras_get( WP_REST_Request $request ) {
		$row = $this->db->get_extra( intval( $request['id'] ) );
		if ( ! $row ) return new WP_Error( 'bookpoint_extra', 'Extra not found.', array( 'status' => 404 ) );
		return $this->ok( $row );
	}

	public function extras_create( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$created = $this->db->create_extra( $data );
		if ( is_wp_error( $created ) ) return $created;
		return $this->ok( $created );
	}

	public function extras_update( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$updated = $this->db->update_extra( intval( $request['id'] ), $data );
		if ( is_wp_error( $updated ) ) return $updated;
		return $this->ok( $updated );
	}

	public function extras_delete( WP_REST_Request $request ) {
		$ok = $this->db->delete_extra( intval( $request['id'] ) );
		if ( ! $ok ) return new WP_Error( 'bookpoint_extra', 'Delete failed.', array( 'status' => 400 ) );
		return $this->ok( array( 'deleted' => true ) );
	}

	public function settings_get() {
		return $this->ok( array(
			'workspace' => $this->db->get_setting( 'workspace' ) ?: array(),
			'email_settings' => $this->db->get_setting( 'email_settings' ) ?: array(),
			'email_rules' => $this->db->get_setting( 'email_rules' ) ?: array(),
		) );
	}

	public function settings_update( WP_REST_Request $request ) {
		$payload = $request->get_json_params();
		if ( isset( $payload['workspace'] ) ) {
			$ok = $this->db->set_setting( 'workspace', $payload['workspace'] );
			if ( is_wp_error( $ok ) ) return $ok;
		}
		if ( isset( $payload['email_settings'] ) ) {
			$ok = $this->db->set_setting( 'email_settings', $payload['email_settings'] );
			if ( is_wp_error( $ok ) ) return $ok;
		}
		if ( isset( $payload['email_rules'] ) ) {
			$ok = $this->db->set_setting( 'email_rules', $payload['email_rules'] );
			if ( is_wp_error( $ok ) ) return $ok;
		}
		return $this->settings_get();
	}

	public function form_fields_list() {
		$rows = $this->db->list_form_fields();
		$defaults = array();
		$customs = array();
		foreach ( $rows as $row ) {
			if ( intval( $row['is_default'] ) ) $defaults[] = $row;
			else $customs[] = $row;
		}
		return $this->ok( array( 'defaults' => $defaults, 'customs' => $customs ) );
	}

	public function form_fields_create( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$created = $this->db->create_form_field( $data );
		if ( is_wp_error( $created ) ) return $created;
		return $this->ok( $created );
	}

	public function form_fields_update( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$updated = $this->db->update_form_field( intval( $request['id'] ), $data );
		if ( is_wp_error( $updated ) ) return $updated;
		return $this->ok( $updated );
	}

	public function form_fields_delete( WP_REST_Request $request ) {
		$ok = $this->db->delete_form_field( intval( $request['id'] ) );
		if ( ! $ok ) return new WP_Error( 'bookpoint_form_field', 'Delete failed.', array( 'status' => 400 ) );
		return $this->ok( array( 'deleted' => true ) );
	}

	public function bookings_list( WP_REST_Request $request ) {
		$items = $this->db->list_bookings( array(
			'status' => $request->get_param( 'status' ),
			'date_from' => $request->get_param( 'from' ),
			'date_to' => $request->get_param( 'to' ),
		) );
		return $this->ok( array( 'items' => $items ) );
	}

	public function bookings_update_status( WP_REST_Request $request ) {
		$data = $request->get_json_params();
		$status = sanitize_text_field( $data['status'] ?? '' );
		if ( $status === '' ) return new WP_Error( 'bookpoint_booking', 'Missing status.', array( 'status' => 400 ) );
		$updated = $this->db->update_booking_status( intval( $request['id'] ), $status );
		if ( is_wp_error( $updated ) ) return $updated;
		return $this->ok( $updated );
	}

	public function public_services() {
		$rows = $this->db->list_services();
		return $this->ok( $rows );
	}

	public function public_staff( WP_REST_Request $request ) {
		$service_id = intval( $request->get_param( 'service_id' ) );
		$rows = $this->db->list_staff( array( 'service_id' => $service_id ) );
		return $this->ok( $rows );
	}

	public function public_extras( WP_REST_Request $request ) {
		$rows = $this->db->list_extras( array( 'service_id' => intval( $request->get_param( 'service_id' ) ) ) );
		return $this->ok( $rows );
	}

	public function public_timeslots( WP_REST_Request $request ) {
		$service_id = intval( $request->get_param( 'service_id' ) );
		$staff_id = intval( $request->get_param( 'staff_id' ) );
		$date = sanitize_text_field( $request->get_param( 'date' ) ?? '' );
		if ( ! $service_id || ! $staff_id || $date === '' ) {
			return new WP_Error( 'bookpoint_slots', 'Missing required parameters.', array( 'status' => 400 ) );
		}
		$service = $this->db->get_service( $service_id );
		if ( ! $service ) return new WP_Error( 'bookpoint_slots', 'Service not found.', array( 'status' => 404 ) );
		$duration = intval( $service['duration'] ?? 60 );
		$buffer_before = intval( $service['buffer_before'] ?? 0 );
		$buffer_after = intval( $service['buffer_after'] ?? 0 );
		$slot_size = max( 5, $duration + $buffer_before + $buffer_after );

		$blocks = $this->db->list_availability( $staff_id, $date, $date );
		$bookings = $this->db->list_bookings( array( 'date_from' => $date, 'date_to' => $date ) );
		$conflicts = array();
		foreach ( $bookings as $booking ) {
			if ( intval( $booking['staff_id'] ) !== $staff_id ) continue;
			if ( in_array( $booking['status'], array( 'cancelled', 'canceled' ), true ) ) continue;
			$conflicts[] = array( 'start' => $booking['start_time'], 'end' => $booking['end_time'] );
		}
		$slots = array();
		foreach ( $blocks as $block ) {
			if ( ! intval( $block['available'] ) ) continue;
			$start = $this->time_to_minutes( $block['start_time'] );
			$end = $this->time_to_minutes( $block['end_time'] );
			for ( $cursor = $start; $cursor + $slot_size <= $end; $cursor += $slot_size ) {
				$slot_start = $cursor + $buffer_before;
				$slot_end = $slot_start + $duration;
				if ( $this->conflicts_slot( $slot_start, $slot_end, $conflicts ) ) continue;
				$slots[] = array(
					'start_time' => $this->minutes_to_time( $slot_start ),
					'end_time' => $this->minutes_to_time( $slot_end ),
				);
			}
		}
		return $this->ok( $slots );
	}

	public function public_booking_create( WP_REST_Request $request ) {
		$nonce = $this->require_public_nonce( $request );
		if ( is_wp_error( $nonce ) ) return $nonce;
		$data = $request->get_json_params();
		$created = $this->db->create_booking( $data );
		if ( is_wp_error( $created ) ) return $created;
		return $this->ok( $created );
	}

	private function time_to_minutes( $time ) {
		if ( ! $time ) return 0;
		$parts = explode( ':', $time );
		return intval( $parts[0] ?? 0 ) * 60 + intval( $parts[1] ?? 0 );
	}

	private function minutes_to_time( $minutes ) {
		$hours = floor( $minutes / 60 );
		$mins = $minutes % 60;
		return sprintf( '%02d:%02d', $hours, $mins );
	}

	private function conflicts_slot( $start, $end, $conflicts ) {
		foreach ( $conflicts as $conflict ) {
			$c_start = $this->time_to_minutes( $conflict['start'] );
			$c_end = $this->time_to_minutes( $conflict['end'] );
			if ( $start < $c_end && $end > $c_start ) return true;
		}
		return false;
	}
}
