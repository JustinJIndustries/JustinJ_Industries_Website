<?php
require_once __DIR__ . '/inquiry.php';
add_action('after_setup_theme', function () {
    add_theme_support('wp-block-styles');
    add_theme_support('editor-styles');
    add_editor_style('style.css');
    register_nav_menus(['primary' => 'Primary navigation', 'footer' => 'Footer navigation']);
});
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('northside-style', get_stylesheet_uri(), [], wp_get_theme()->get('Version'));
    wp_enqueue_script('northside-demo', get_template_directory_uri() . '/demo.js', [], wp_get_theme()->get('Version'), true);
    wp_enqueue_style('northside-navigation', get_template_directory_uri() . '/assets/navigation.css', ['northside-style'], wp_get_theme()->get('Version'));
    wp_enqueue_script('northside-navigation', get_template_directory_uri() . '/assets/navigation.js', [], wp_get_theme()->get('Version'), true);
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

// Portfolio chrome is opt-in and is never enabled in a client theme by default.
function northside_jji_demo_enabled() {
    return defined('JJI_PORTFOLIO_DEMO') && JJI_PORTFOLIO_DEMO === true;
}
add_action('wp_enqueue_scripts', function () {
    if (!northside_jji_demo_enabled()) {
        return;
    }
    $assets = get_template_directory_uri() . '/assets/';
    $directory = get_template_directory() . '/assets/';
    wp_enqueue_style('northside-jji-return', $assets . 'demo-return.css', ['northside-style'], filemtime($directory . 'demo-return.css'));
    wp_enqueue_script('northside-jji-return', $assets . 'demo-return.js', [], filemtime($directory . 'demo-return.js'), false);
});
add_filter('render_block', function ($content, $block) {
    if (!northside_jji_demo_enabled() || $block['blockName'] !== 'core/paragraph') {
        return $content;
    }
    $classes = preg_split('/\s+/', $block['attrs']['className'] ?? '');
    if (!in_array('ns-demo', $classes, true)) {
        return $content;
    }
    return '<nav class="ns-demo jji-demo-bar" aria-label="Demo return"><a class="jji-demo-bar__back" href="https://www.justinjindustries.com/design/?design=northside"><svg class="jji-demo-bar__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 12H4m7-7-7 7 7 7"></path></svg><span>Back to JJI</span></a><span class="jji-demo-bar__label">Demo</span></nav>';
}, 20, 2);

// Brand-specific fallback icon; an owner-selected WordPress Site Icon takes precedence.
add_action('wp_head', function () {
    if (has_site_icon()) { return; }
    foreach (['favicon-32.png' => ['image/png', '32x32'], 'favicon.svg' => ['image/svg+xml', 'any']] as $file => $details) {
        $relative = 'assets/' . $file;
        $hash = substr(hash_file('sha256', get_theme_file_path($relative)), 0, 10);
        echo '<link rel="icon" href="' . esc_url(get_theme_file_uri($relative) . '?v=' . $hash) . '" type="' . esc_attr($details[0]) . '" sizes="' . esc_attr($details[1]) . '">' . "\n";
    }
}, 5);
