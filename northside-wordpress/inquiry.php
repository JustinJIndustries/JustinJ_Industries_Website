<?php
/** Heating-specific, local-only demonstration. No delivery endpoint or data storage. */
if ( ! defined( 'ABSPATH' ) ) { exit; }
function northside_inquiry_defaults() {
    static $defaults;
    if ( ! isset( $defaults ) ) { $defaults = json_decode( file_get_contents( __DIR__ . '/inquiry-defaults.json' ), true ); }
    return $defaults;
}
function northside_inquiry_copy() {
    $defaults = northside_inquiry_defaults(); $saved = get_option( 'northside_inquiry_copy', array() );
    return array_merge( $defaults, is_array( $saved ) ? array_intersect_key( $saved, $defaults ) : array() );
}
function northside_sanitize_inquiry_copy( $raw ) {
    $clean = array(); $raw = is_array( $raw ) ? $raw : array();
    foreach ( northside_inquiry_defaults() as $key => $default ) {
        if ( is_array( $default ) ) {
            $lines = is_string( $raw[ $key ] ?? null ) ? preg_split( '/\R/', $raw[ $key ] ) : ( is_array( $raw[ $key ] ?? null ) ? $raw[ $key ] : array() );
            $values = array(); foreach ( $lines as $line ) { if ( is_string( $line ) ) { $value = trim( sanitize_text_field( $line ) ); if ( $value ) { $values[] = mb_substr( $value, 0, 80 ); } } }
            $clean[ $key ] = $values ? array_slice( array_values( array_unique( $values ) ), 0, 12 ) : $default;
        } else {
            $value = is_string( $raw[ $key ] ?? null ) ? trim( sanitize_textarea_field( $raw[ $key ] ) ) : '';
            $clean[ $key ] = $value ? mb_substr( $value, 0, 600 ) : $default;
        }
    }
    return $clean;
}
add_action( 'admin_init', function () { register_setting( 'northside_inquiry', 'northside_inquiry_copy', array( 'type' => 'array', 'sanitize_callback' => 'northside_sanitize_inquiry_copy' ) ); } );
add_action( 'admin_menu', function () { add_options_page( 'Northside inquiry copy', 'Northside inquiry', 'manage_options', 'northside-inquiry', 'northside_inquiry_settings' ); } );
function northside_inquiry_settings() {
    if ( ! current_user_can( 'manage_options' ) ) { return; }
    $copy = northside_inquiry_copy();
    echo '<div class="wrap"><h1>Northside inquiry copy</h1><p>Edit the demonstration form labels, options, help and feedback here. List options one per line. Keep Not sure choices available. These settings do not enable message delivery, storage or appointment booking.</p><form method="post" action="options.php">'; settings_fields( 'northside_inquiry' );
    $groups = array(
        'Form introduction' => array( 'title', 'note', 'requiredLabel', 'optionalLabel' ),
        'Service and system' => array( 'serviceLegend', 'serviceLabel', 'servicePrompt', 'serviceOptions', 'systemLabel', 'systemPrompt', 'systemOptions', 'areaLabel', 'areaHelp', 'timingLabel', 'timingPrompt', 'timingOptions', 'timingHelp' ),
        'Issue details' => array( 'issueLegend', 'issueLabel', 'issuePlaceholder', 'issueHelp', 'equipmentLabel', 'equipmentHelp' ),
        'Contact details' => array( 'contactLegend', 'nameLabel', 'contactLabel', 'contactPrompt', 'emailOption', 'phoneOption', 'eitherOption', 'emailLabel', 'phoneLabel', 'contactHelp' ),
        'Buttons and feedback' => array( 'button', 'reset', 'summaryTitle', 'success', 'cleared', 'requiredError', 'choiceError', 'emailError', 'phoneError', 'eitherError', 'issueError', 'areaError' ),
    );
    foreach ( $groups as $heading => $keys ) {
        echo '<h2>' . esc_html( $heading ) . '</h2><table class="form-table" role="presentation">';
        foreach ( $keys as $key ) {
            $label = ucwords( preg_replace( '/([a-z])([A-Z])/', '$1 $2', $key ) );
            $value = is_array( $copy[ $key ] ) ? implode( "\n", $copy[ $key ] ) : $copy[ $key ];
            echo '<tr><th scope="row"><label for="ns-copy-' . esc_attr( $key ) . '">' . esc_html( $label ) . '</label></th><td><textarea class="large-text" rows="' . ( is_array( $copy[ $key ] ) ? '5' : '2' ) . '" id="ns-copy-' . esc_attr( $key ) . '" name="northside_inquiry_copy[' . esc_attr( $key ) . ']">' . esc_textarea( $value ) . '</textarea></td></tr>';
        } echo '</table>';
    }
    submit_button( 'Save inquiry copy' ); echo '</form></div>';
}
function northside_demo_inquiry() {
    static $instance = 0; $prefix = ++$instance === 1 ? 'ns-' : 'ns' . $instance . '-'; $c = northside_inquiry_copy();
    $esc = function ( $key ) use ( $c ) { return esc_html( $c[ $key ] ); };
    $id = function ( $key ) use ( $prefix ) { return esc_attr( $prefix . $key ); };
    $field = function ( $key, $label, $type, $required, $help = '', $options = array(), $prompt = '' ) use ( $c, $prefix ) {
        $name = $prefix . $key; $label_text = $c[ $label ]; $description = array( $name . '-error' ); if ( $help ) { array_unshift( $description, $name . '-help' ); }
        echo '<div class="ns-form-field"><label for="' . esc_attr( $name ) . '">' . esc_html( $label_text ) . ' <span data-ns-requirement="' . esc_attr( $key ) . '">(' . esc_html( $c[ $required ? 'requiredLabel' : 'optionalLabel' ] ) . ')</span></label>';
        $attrs = ' id="' . esc_attr( $name ) . '" data-ns-field="' . esc_attr( $key ) . '" aria-describedby="' . esc_attr( implode( ' ', $description ) ) . '" autocomplete="off"' . ( $required ? ' required' : '' );
        if ( 'select' === $type ) {
            echo '<select' . $attrs . '><option value="">' . esc_html( $c[ $prompt ] ) . '</option>';
            foreach ( $options as $value => $text ) { echo '<option value="' . esc_attr( $value ) . '">' . esc_html( $text ) . '</option>'; } echo '</select>';
        } elseif ( 'textarea' === $type ) { echo '<textarea' . $attrs . ' rows="5" minlength="10" maxlength="1500" placeholder="' . esc_attr( $c['issuePlaceholder'] ) . '"></textarea>'; }
        else { echo '<input' . $attrs . ' type="' . esc_attr( $type ) . '" maxlength="' . ( 'email' === $type ? '160' : ( 'tel' === $type ? '40' : '100' ) ) . '">'; }
        if ( $help ) { echo '<p class="ns-field-help" id="' . esc_attr( $name . '-help' ) . '">' . esc_html( $c[ $help ] ) . '</p>'; }
        echo '<p class="ns-field-error" id="' . esc_attr( $name . '-error' ) . '" hidden></p></div>';
    };
    ob_start(); ?>
<form class="ns-enquiry" data-northside-form novalidate aria-labelledby="<?php echo $id( 'form-title' ); ?>" aria-describedby="<?php echo $id( 'form-note' ); ?>"
<?php foreach ( array( 'requiredError', 'choiceError', 'emailError', 'phoneError', 'eitherError', 'issueError', 'areaError', 'success', 'cleared', 'requiredLabel', 'optionalLabel' ) as $key ) { echo ' data-ns-' . esc_attr( strtolower( preg_replace( '/([a-z])([A-Z])/', '$1-$2', $key ) ) ) . '="' . esc_attr( $c[ $key ] ) . '"'; } ?>>
  <h2 class="wp-block-heading" id="<?php echo $id( 'form-title' ); ?>"><?php echo $esc( 'title' ); ?></h2>
  <p class="ns-form-note" id="<?php echo $id( 'form-note' ); ?>"><?php echo $esc( 'note' ); ?></p>
  <div class="ns-form-errors" data-ns-errors tabindex="-1" hidden aria-labelledby="<?php echo $id( 'error-title' ); ?>"><h3 id="<?php echo $id( 'error-title' ); ?>"><?php echo $esc( 'summaryTitle' ); ?></h3><ul></ul></div>
  <fieldset><legend><?php echo $esc( 'serviceLegend' ); ?></legend>
    <div class="ns-form-grid"><?php $options = array_combine( $c['serviceOptions'], $c['serviceOptions'] ); $field( 'service', 'serviceLabel', 'select', true, '', $options, 'servicePrompt' ); $options = array_combine( $c['systemOptions'], $c['systemOptions'] ); $field( 'system', 'systemLabel', 'select', true, '', $options, 'systemPrompt' ); ?></div>
    <div class="ns-form-grid"><?php $field( 'area', 'areaLabel', 'text', true, 'areaHelp' ); $options = array_combine( $c['timingOptions'], $c['timingOptions'] ); $field( 'timing', 'timingLabel', 'select', true, 'timingHelp', $options, 'timingPrompt' ); ?></div>
  </fieldset>
  <fieldset><legend><?php echo $esc( 'issueLegend' ); ?></legend><?php $field( 'message', 'issueLabel', 'textarea', true, 'issueHelp' ); $field( 'equipment', 'equipmentLabel', 'text', false, 'equipmentHelp' ); ?></fieldset>
  <fieldset><legend><?php echo $esc( 'contactLegend' ); ?></legend>
    <div class="ns-form-grid"><?php $field( 'name', 'nameLabel', 'text', true ); $field( 'preference', 'contactLabel', 'select', true, 'contactHelp', array( 'email' => $c['emailOption'], 'phone' => $c['phoneOption'], 'either' => $c['eitherOption'] ), 'contactPrompt' ); ?></div>
    <div class="ns-form-grid"><?php $field( 'email', 'emailLabel', 'email', false ); $field( 'phone', 'phoneLabel', 'tel', false ); ?></div>
  </fieldset>
  <div class="ns-form-actions"><button class="ns-button" type="button" data-northside-submit disabled><?php echo $esc( 'button' ); ?></button><button class="ns-form-reset" type="reset"><?php echo $esc( 'reset' ); ?></button></div>
  <noscript><p class="ns-small">JavaScript enables this local demo check. Nothing can be sent from this form.</p></noscript>
  <p class="ns-form-status" role="status" aria-live="polite" tabindex="-1"></p>
</form>
<?php return ob_get_clean();
}
add_shortcode( 'northside_demo_enquiry', 'northside_demo_inquiry' );
add_action( 'init', function () { register_block_pattern_category( 'northside', array( 'label' => 'Northside' ) ); register_block_pattern( 'northside/heating-enquiry', array( 'title' => 'Northside heating inquiry (non-sending demo)', 'description' => 'A grouped heating inquiry demonstration. Edit labels/options/help in Settings → Northside inquiry. No message delivery.', 'categories' => array( 'northside' ), 'content' => '<!-- wp:shortcode -->[northside_demo_enquiry]<!-- /wp:shortcode -->' ) ); } );
add_action( 'wp_enqueue_scripts', function () { wp_enqueue_style( 'northside-inquiry', get_template_directory_uri() . '/assets/inquiry.css', array( 'northside-style' ), wp_get_theme()->get( 'Version' ) ); } );
