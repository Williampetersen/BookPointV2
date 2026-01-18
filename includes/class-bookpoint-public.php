<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class BookPoint_Public {
	private $db;

	public function __construct( BookPoint_DB $db ) {
		$this->db = $db;
		add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );
		add_shortcode( 'bookpoint_booking', array( $this, 'shortcode_booking' ) );
	}

	public function register_assets() {
		wp_register_style(
			'bookpoint-booking',
			BOOKPOINT_URL . 'public/booking.css',
			array(),
			BOOKPOINT_VERSION
		);

		wp_register_script(
			'bookpoint-booking',
			BOOKPOINT_URL . 'public/booking.js',
			array(),
			BOOKPOINT_VERSION,
			true
		);

		$workspace = $this->db->get_setting( 'workspace' );
		if ( ! is_array( $workspace ) ) $workspace = array();
		$currency_settings = array(
			'currency_symbol_before' => $workspace['currency_symbol_before'] ?? '',
			'currency_symbol_after' => $workspace['currency_symbol_after'] ?? 'Kr',
			'currency_symbol_position' => $workspace['currency_symbol_position'] ?? 'after',
			'decimals' => isset( $workspace['decimals'] ) ? intval( $workspace['decimals'] ) : 2,
			'decimal_separator' => $workspace['decimal_separator'] ?? '.',
			'thousand_separator' => $workspace['thousand_separator'] ?? ',',
		);

		wp_localize_script( 'bookpoint-booking', 'BookPointPublic', array(
			'restUrl' => esc_url_raw( rest_url() ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
			'pluginUrl' => esc_url_raw( BOOKPOINT_URL ),
			'currency' => $currency_settings['currency_symbol_before'],
			'currencySettings' => $currency_settings,
			'i18n' => array(
				'bookNow' => 'Book Now',
				'close' => 'Close',
				'next' => 'Next',
				'back' => 'Back',
				'confirm' => 'Confirm booking',
				'loading' => 'Loading...',
				'noServices' => 'No services available.',
				'noExtras' => 'No extras available.',
				'noStaff' => 'No staff available.',
				'noSlots' => 'No slots available.',
			),
		) );
	}

	public function shortcode_booking() {
		wp_enqueue_style( 'bookpoint-booking' );
		wp_enqueue_script( 'bookpoint-booking' );
		return '<div class="bp-booking-embed"><button class="bp-booking-trigger" type="button">Book Now</button></div>';
	}
}
