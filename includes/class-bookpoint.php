<?php
if ( ! defined( 'ABSPATH' ) ) exit;

final class BookPoint {
	private static $instance = null;

	public $db;
	public $rest;
	public $admin;
	public $public;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->init();
		}
		return self::$instance;
	}

	private function __construct() {}

	public function init() {
		$this->db = new BookPoint_DB();

		add_action( 'plugins_loaded', array( $this->db, 'maybe_upgrade' ), 5 );

		$this->rest = new BookPoint_REST( $this->db );
		add_action( 'rest_api_init', array( $this->rest, 'register_routes' ) );

		if ( is_admin() ) {
			$this->admin = new BookPoint_Admin( $this->db );
		}
		$this->public = new BookPoint_Public( $this->db );
	}

	public static function log( $message, $context = array() ) {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			if ( is_array( $message ) || is_object( $message ) ) $message = wp_json_encode( $message );
			if ( ! empty( $context ) ) $message .= ' | ' . wp_json_encode( $context );
			error_log( '[BookPoint] ' . $message );
		}
	}
}
