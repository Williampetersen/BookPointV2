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

		$currency = $this->db->get_option_json( 'bookpoint_settings_currency', array() );
		if ( ! is_array( $currency ) ) $currency = array();
		$currency_settings = array(
			'currency_symbol_before' => $currency['symbol_before'] ?? ( $currency['currency_symbol_before'] ?? '' ),
			'currency_symbol_after' => $currency['symbol_after'] ?? ( $currency['currency_symbol_after'] ?? 'Kr' ),
			'currency_symbol_position' => $currency['position'] ?? ( $currency['currency_symbol_position'] ?? 'after' ),
			'decimals' => isset( $currency['decimals'] ) ? intval( $currency['decimals'] ) : 2,
			'decimal_separator' => $currency['decimal_separator'] ?? '.',
			'thousand_separator' => $currency['thousand_separator'] ?? ',',
		);

		$form_fields = $this->db->get_option_json( 'bookpoint_settings_form_fields', array() );
		if ( empty( $form_fields['defaults'] ) ) {
			$form_fields['defaults'] = array(
				array( 'field_key' => 'first_name', 'label' => 'First Name', 'placeholder' => '', 'type' => 'text', 'required' => true, 'enabled' => true, 'width' => 'half' ),
				array( 'field_key' => 'last_name', 'label' => 'Last Name', 'placeholder' => '', 'type' => 'text', 'required' => true, 'enabled' => true, 'width' => 'half' ),
				array( 'field_key' => 'email', 'label' => 'Email Address', 'placeholder' => '', 'type' => 'email', 'required' => true, 'enabled' => true, 'width' => 'full' ),
				array( 'field_key' => 'phone', 'label' => 'Phone Number', 'placeholder' => '', 'type' => 'tel', 'required' => false, 'enabled' => true, 'width' => 'full' ),
				array( 'field_key' => 'comments', 'label' => 'Comments', 'placeholder' => '', 'type' => 'textarea', 'required' => false, 'enabled' => true, 'width' => 'full' ),
			);
		}
		if ( empty( $form_fields['customs'] ) ) $form_fields['customs'] = array();

		$workspace = $this->db->get_option_json( 'bookpoint_settings_workspace', array() );
		$help = array(
			'phone' => $workspace['help_phone'] ?? '',
			'email' => $workspace['help_email'] ?? '',
		);

		wp_localize_script( 'bookpoint-booking', 'BookPointPublic', array(
			'restUrl' => esc_url_raw( rest_url() ),
			'nonce' => wp_create_nonce( 'wp_rest' ),
			'pluginUrl' => esc_url_raw( BOOKPOINT_URL ),
			'currency' => $currency_settings['currency_symbol_before'],
			'currencySettings' => $currency_settings,
			'formFields' => $form_fields,
			'settings' => array(
				'help' => $help,
			),
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

	public function shortcode_booking( $atts ) {
		wp_enqueue_style( 'bookpoint-booking' );
		wp_enqueue_script( 'bookpoint-booking' );
		$atts = shortcode_atts( array(
			'label' => __( 'Book Appointment', 'bookpoint' ),
			'theme' => 'light',
		), $atts, 'bookpoint_booking' );
		$label = sanitize_text_field( $atts['label'] );
		$theme_attr = $atts['theme'] ? ' data-bp-theme="' . esc_attr( $atts['theme'] ) . '"' : '';
		$button = sprintf(
			'<button class="bp-booking-trigger" type="button"%s>%s</button>',
			$theme_attr,
			esc_html( $label )
		);
		return '<div class="bp-booking-embed">' . $button . '</div><div id="bookpoint-modal-root"></div>';
	}
}
