<?php
/**
 * Plugin Name: BookPoint
 * Description: Modern booking system with admin dashboard and frontend wizard.
 * Version: 3.0.0
 * Author: BookPoint
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'BOOKPOINT_VERSION', '3.0.0' );
define( 'BOOKPOINT_DIR', plugin_dir_path( __FILE__ ) );
define( 'BOOKPOINT_URL', plugin_dir_url( __FILE__ ) );

function bookpoint_log( $message, $context = array() ) {
	if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
		if ( is_array( $message ) || is_object( $message ) ) $message = wp_json_encode( $message );
		if ( ! empty( $context ) ) $message .= ' | ' . wp_json_encode( $context );
		error_log( '[BookPoint] ' . $message );
	}
}

require_once BOOKPOINT_DIR . 'includes/class-bookpoint.php';
require_once BOOKPOINT_DIR . 'includes/class-bookpoint-db.php';
require_once BOOKPOINT_DIR . 'includes/class-bookpoint-rest.php';
require_once BOOKPOINT_DIR . 'includes/class-bookpoint-admin.php';
require_once BOOKPOINT_DIR . 'includes/class-bookpoint-public.php';
function bookpoint_run() {
	return BookPoint::instance();
}
bookpoint_run();

register_activation_hook( __FILE__, array( 'BookPoint_DB', 'install' ) );
register_deactivation_hook( __FILE__, array( 'BookPoint_DB', 'deactivate' ) );
