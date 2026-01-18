<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class BookPoint_Admin {
	private $db;
	private $screen_id = '';

	public function __construct( BookPoint_DB $db ) {
		$this->db = $db;
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_filter( 'admin_body_class', array( $this, 'admin_body_class' ) );
	}

	public function register_menu() {
		$this->screen_id = add_menu_page(
			'BookPoint',
			'BookPoint',
			'manage_options',
			'bookpoint',
			array( $this, 'render_app' ),
			'dashicons-calendar-alt',
			26
		);
	}

	public function render_app() {
		echo '<div id="bookpoint-admin-app"></div>';
	}

	public function admin_body_class( $classes ) {
		$screen = get_current_screen();
		if ( $screen && $screen->id === $this->screen_id ) {
			$classes .= ' bookpoint-fullscreen';
		}
		return $classes;
	}

	public function enqueue_assets( $hook ) {
		$screen = get_current_screen();
		if ( ! $screen || $screen->id !== $this->screen_id ) return;

		wp_enqueue_style( 'bookpoint-admin', BOOKPOINT_URL . 'admin/admin.css', array(), BOOKPOINT_VERSION );
		wp_enqueue_script( 'bookpoint-admin', BOOKPOINT_URL . 'admin/app.js', array( 'wp-element' ), BOOKPOINT_VERSION, true );
		wp_enqueue_media();

		wp_localize_script( 'bookpoint-admin', 'BookPointAdmin', array(
			'restUrl' => esc_url_raw( rest_url() ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
			'pluginUrl' => esc_url_raw( BOOKPOINT_URL ),
			'adminUrl' => esc_url_raw( admin_url() ),
			'placeholder' => 'Search',
		) );
	}
}
