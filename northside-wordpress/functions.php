<?php
add_action('after_setup_theme', function () {
    add_theme_support('wp-block-styles');
    add_theme_support('editor-styles');
    add_editor_style('style.css');
    register_nav_menus(['primary' => 'Primary navigation', 'footer' => 'Footer navigation']);
});
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('northside-style', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
    wp_enqueue_script('northside-demo', get_template_directory_uri() . '/demo.js', [], wp_get_theme()->get('Version'), true);
});

// Preserve the configured home path on subdirectory and browser-local installs.
add_filter('render_block', function ($content) {
    $markup = new WP_HTML_Tag_Processor($content);
    while ($markup->next_tag()) {
        $href = $markup->get_attribute('href');
        if (is_string($href) && preg_match('#^/(?!/)#', $href)) {
            $markup->set_attribute('href', home_url($href));
        }
    }
    return $markup->get_updated_html();
});
