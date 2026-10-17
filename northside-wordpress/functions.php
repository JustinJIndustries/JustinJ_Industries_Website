<?php
add_action('after_setup_theme', function () { add_theme_support('wp-block-styles'); add_theme_support('editor-styles'); add_editor_style('style.css'); register_nav_menus(['primary'=>'Primary navigation','footer'=>'Footer navigation']); });
add_action('wp_enqueue_scripts', function () { wp_enqueue_style('northside-style', get_stylesheet_uri(), [], '1.0.0'); });
