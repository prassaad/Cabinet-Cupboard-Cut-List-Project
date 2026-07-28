<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

// Load .env so tests hit the same local wallview_dev the app uses.
Dotenv\Dotenv::createImmutable(dirname(__DIR__))->safeLoad();
