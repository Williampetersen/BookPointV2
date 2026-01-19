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
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'services_create' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );
        register_rest_route( self::NS, '/services/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'services_get' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'services_update' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array( $this, 'services_delete' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );

        register_rest_route( self::NS, '/staff', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'staff_list' ),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'staff_create' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );
        register_rest_route( self::NS, '/staff/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'staff_get' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'staff_update' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array( $this, 'staff_delete' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );

        register_rest_route( self::NS, '/extras', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'extras_list' ),
                'permission_callback' => '__return_true',
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'extras_create' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );
        register_rest_route( self::NS, '/extras/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'extras_get' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'extras_update' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array( $this, 'extras_delete' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );

        register_rest_route( self::NS, '/settings', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'settings_get' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'settings_update' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );

        register_rest_route( self::NS, '/bookings', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'bookings_list' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'booking_create' ),
                'permission_callback' => '__return_true',
            ),
        ) );
        register_rest_route( self::NS, '/bookings/(?P<id>\d+)', array(
            array(
                'methods' => 'GET',
                'callback' => array( $this, 'booking_get' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
            array(
                'methods' => 'DELETE',
                'callback' => array( $this, 'booking_delete' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );
        register_rest_route( self::NS, '/bookings/(?P<id>\d+)/status', array(
            array(
                'methods' => 'POST',
                'callback' => array( $this, 'booking_update_status' ),
                'permission_callback' => array( $this, 'permission_admin' ),
            ),
        ) );
    }

    public function permission_admin( WP_REST_Request $request ) {
        if ( ! current_user_can( 'manage_options' ) ) {
            return new WP_Error( 'bookpoint_rest_forbidden', 'Insufficient permissions.', array( 'status' => 403 ) );
        }
        $nonce = $this->get_request_nonce( $request );
        if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
            return new WP_Error( 'bookpoint_rest_nonce', 'Invalid nonce.', array( 'status' => 403 ) );
        }
        return true;
    }

    private function get_request_nonce( WP_REST_Request $request ) {
        $nonce = $request->get_header( 'X-WP-Nonce' );
        if ( ! $nonce ) {
            $nonce = $request->get_param( 'nonce' );
        }
        return $nonce;
    }

    private function success_response( $data, $status = 200 ) {
        $response = rest_ensure_response( array( 'ok' => true, 'data' => $data ) );
        $response->set_status( $status );
        return $response;
    }

    private function error_response( $code, $message, $status = 400 ) {
        $response = rest_ensure_response( array( 'ok' => false, 'error' => array( 'code' => $code, 'message' => $message ) ) );
        $response->set_status( $status );
        return $response;
    }

    public function services_list( WP_REST_Request $request ) {
        $include_inactive = filter_var( $request->get_param( 'include_inactive' ), FILTER_VALIDATE_BOOLEAN );
        if ( $include_inactive && ! current_user_can( 'manage_options' ) ) {
            $include_inactive = false;
        }
        $items = $this->db->services_list( $include_inactive );
        return $this->success_response( $items );
    }

    public function services_get( WP_REST_Request $request ) {
        $item = $this->db->services_get( intval( $request['id'] ) );
        if ( ! $item ) {
            return $this->error_response( 'bookpoint_service_not_found', 'Service not found.', 404 );
        }
        return $this->success_response( $item );
    }

    public function services_create( WP_REST_Request $request ) {
        $created = $this->db->services_create( $request->get_json_params() );
        if ( is_wp_error( $created ) ) {
            return $this->error_response( $created->get_error_code() ?: 'bookpoint_service', $created->get_error_message() );
        }
        return $this->success_response( $created, 201 );
    }

    public function services_update( WP_REST_Request $request ) {
        $updated = $this->db->services_update( intval( $request['id'] ), $request->get_json_params() );
        if ( is_wp_error( $updated ) ) {
            return $this->error_response( $updated->get_error_code() ?: 'bookpoint_service', $updated->get_error_message() );
        }
        return $this->success_response( $updated );
    }

    public function services_delete( WP_REST_Request $request ) {
        $result = $this->db->services_delete( intval( $request['id'] ) );
        if ( is_wp_error( $result ) ) {
            return $this->error_response( $result->get_error_code() ?: 'bookpoint_service', $result->get_error_message() );
        }
        return $this->success_response( array( 'deleted' => true ) );
    }

    public function staff_list( WP_REST_Request $request ) {
        $include_inactive = filter_var( $request->get_param( 'include_inactive' ), FILTER_VALIDATE_BOOLEAN );
        if ( $include_inactive && ! current_user_can( 'manage_options' ) ) {
            $include_inactive = false;
        }
        $items = $this->db->staff_list( $include_inactive );
        return $this->success_response( $items );
    }

    public function staff_get( WP_REST_Request $request ) {
        $item = $this->db->staff_get( intval( $request['id'] ) );
        if ( ! $item ) {
            return $this->error_response( 'bookpoint_staff_not_found', 'Staff not found.', 404 );
        }
        return $this->success_response( $item );
    }

    public function staff_create( WP_REST_Request $request ) {
        $created = $this->db->staff_create( $request->get_json_params() );
        if ( is_wp_error( $created ) ) {
            return $this->error_response( $created->get_error_code() ?: 'bookpoint_staff', $created->get_error_message() );
        }
        return $this->success_response( $created, 201 );
    }

    public function staff_update( WP_REST_Request $request ) {
        $updated = $this->db->staff_update( intval( $request['id'] ), $request->get_json_params() );
        if ( is_wp_error( $updated ) ) {
            return $this->error_response( $updated->get_error_code() ?: 'bookpoint_staff', $updated->get_error_message() );
        }
        return $this->success_response( $updated );
    }

    public function staff_delete( WP_REST_Request $request ) {
        $result = $this->db->staff_delete( intval( $request['id'] ) );
        if ( is_wp_error( $result ) ) {
            return $this->error_response( $result->get_error_code() ?: 'bookpoint_staff', $result->get_error_message() );
        }
        return $this->success_response( array( 'deleted' => true ) );
    }

    public function extras_list( WP_REST_Request $request ) {
        $service_id = intval( $request->get_param( 'service_id' ) );
        $include_inactive = filter_var( $request->get_param( 'include_inactive' ), FILTER_VALIDATE_BOOLEAN );
        if ( $include_inactive && ! current_user_can( 'manage_options' ) ) {
            $include_inactive = false;
        }
        $items = $this->db->extras_list( $service_id, $include_inactive );
        return $this->success_response( $items );
    }

    public function extras_get( WP_REST_Request $request ) {
        $item = $this->db->extras_get( intval( $request['id'] ) );
        if ( ! $item ) {
            return $this->error_response( 'bookpoint_extra_not_found', 'Extra not found.', 404 );
        }
        return $this->success_response( $item );
    }

    public function extras_create( WP_REST_Request $request ) {
        $created = $this->db->extras_create( $request->get_json_params() );
        if ( is_wp_error( $created ) ) {
            return $this->error_response( $created->get_error_code() ?: 'bookpoint_extra', $created->get_error_message() );
        }
        return $this->success_response( $created, 201 );
    }

    public function extras_update( WP_REST_Request $request ) {
        $updated = $this->db->extras_update( intval( $request['id'] ), $request->get_json_params() );
        if ( is_wp_error( $updated ) ) {
            return $this->error_response( $updated->get_error_code() ?: 'bookpoint_extra', $updated->get_error_message() );
        }
        return $this->success_response( $updated );
    }

    public function extras_delete( WP_REST_Request $request ) {
        $result = $this->db->extras_delete( intval( $request['id'] ) );
        if ( is_wp_error( $result ) ) {
            return $this->error_response( $result->get_error_code() ?: 'bookpoint_extra', $result->get_error_message() );
        }
        return $this->success_response( array( 'deleted' => true ) );
    }

    public function settings_get( WP_REST_Request $request ) {
        $settings = $this->db->settings_get_all();
        return $this->success_response( $settings );
    }

    public function settings_update( WP_REST_Request $request ) {
        $payload = $request->get_json_params();
        if ( ! is_array( $payload ) ) {
            return $this->error_response( 'bookpoint_settings', 'Payload must be an object.' );
        }
        foreach ( $payload as $key => $value ) {
            $result = $this->db->settings_set( $key, $value );
            if ( is_wp_error( $result ) ) {
                return $this->error_response( $result->get_error_code() ?: 'bookpoint_settings', $result->get_error_message() );
            }
        }
        return $this->success_response( $payload );
    }

    public function bookings_list( WP_REST_Request $request ) {
        $args = array(
            'status' => $request->get_param( 'status' ),
            'service_id' => $request->get_param( 'service_id' ),
        );
        $items = $this->db->bookings_list( $args );
        return $this->success_response( $items );
    }

    public function booking_get( WP_REST_Request $request ) {
        $item = $this->db->bookings_get( intval( $request['id'] ) );
        if ( ! $item ) {
            return $this->error_response( 'bookpoint_booking_not_found', 'Booking not found.', 404 );
        }
        return $this->success_response( $item );
    }

    public function booking_create( WP_REST_Request $request ) {
        $data = $request->get_json_params();
        foreach ( array( 'service_id', 'start_at', 'end_at' ) as $required ) {
            if ( empty( $data[ $required ] ) ) {
                return $this->error_response( 'bookpoint_booking', 'Missing ' . str_replace( '_', ' ', $required ) . '.' );
            }
        }
        $created = $this->db->bookings_create( $data );
        if ( is_wp_error( $created ) ) {
            return $this->error_response( $created->get_error_code() ?: 'bookpoint_booking', $created->get_error_message(), 400 );
        }
        return $this->success_response( $created, 201 );
    }

    public function booking_delete( WP_REST_Request $request ) {
        $result = $this->db->bookings_delete( intval( $request['id'] ) );
        if ( is_wp_error( $result ) ) {
            return $this->error_response( $result->get_error_code() ?: 'bookpoint_booking', $result->get_error_message() );
        }
        return $this->success_response( array( 'deleted' => true ) );
    }

    public function booking_update_status( WP_REST_Request $request ) {
        $payload = $request->get_json_params();
        $status = sanitize_text_field( $payload['status'] ?? '' );
        if ( $status === '' ) {
            return $this->error_response( 'bookpoint_booking', 'Missing status.' );
        }
        $updated = $this->db->bookings_update_status( intval( $request['id'] ), $status );
        if ( is_wp_error( $updated ) ) {
            return $this->error_response( $updated->get_error_code() ?: 'bookpoint_booking', $updated->get_error_message() );
        }
        return $this->success_response( $updated );
    }
}
