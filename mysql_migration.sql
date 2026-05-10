-- AtoZ Restaurant MySQL Migration Script

-- 1. Outlets
CREATE TABLE IF NOT EXISTS `outlets` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `slug` varchar(255) NOT NULL UNIQUE,
  `name` varchar(255) NOT NULL,
  `tagline` varchar(255),
  `description` text,
  `address` text,
  `phone` varchar(50),
  `hours` varchar(255),
  `cuisine` varchar(100),
  `accent_color` varchar(20),
  `cover_image_path` text,
  `card_image_path` text,
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Banners
CREATE TABLE IF NOT EXISTS `banners` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `title` varchar(255),
  `subtitle` text,
  `image_path` text NOT NULL,
  `cta_label` varchar(100),
  `cta_href` text,
  `sort_order` int NOT NULL DEFAULT 0,
  `active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Menu Items
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `outlet_id` int NOT NULL,
  `category` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` varchar(50),
  `image_path` text,
  `tags` text,
  `sort_order` int NOT NULL DEFAULT 0,
  `featured` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `menu_items_outlet_id_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `outlets` (`id`) ON DELETE CASCADE
);

-- 4. Gallery Images
CREATE TABLE IF NOT EXISTS `gallery_images` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `outlet_id` int,
  `image_path` text NOT NULL,
  `caption` varchar(255),
  `sort_order` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `gallery_images_outlet_id_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `outlets` (`id`) ON DELETE SET NULL
);

-- 5. Site Info
CREATE TABLE IF NOT EXISTS `site_info` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `brand_name` varchar(255) NOT NULL,
  `tagline` varchar(255),
  `about` text,
  `contact_email` varchar(255),
  `contact_phone` varchar(50),
  `instagram_url` text,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Promotions
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `outlet_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `image_path` text,
  `cta_label` varchar(100),
  `cta_href` text,
  `badge` varchar(100),
  `sort_order` int NOT NULL DEFAULT 0,
  `active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `promotions_outlet_id_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `outlets` (`id`) ON DELETE CASCADE
);

-- 7. Beverages
CREATE TABLE IF NOT EXISTS `beverages` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `outlet_id` int NOT NULL,
  `category` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` varchar(50),
  `sort_order` int NOT NULL DEFAULT 0,
  `featured` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `beverages_outlet_id_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `outlets` (`id`) ON DELETE CASCADE
);
