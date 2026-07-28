-- WallView API — core auth + multi-tenant schema (ARCH-004 slice 1).
-- Clean rebuild of the legacy php_mysql_stack schema with the db-audit rules applied:
--   * InnoDB + FKs + ON DELETE CASCADE on every ownership / tenant relation
--   * tenant_workspace_id is a real UNIQUE key that children reference (structural isolation)
--   * NULLability is explicit and intentional
--   * no plaintext password anywhere (dropped tenants.password_hash)
--   * legacy .NET cruft dropped (schema_mismatches, user_claims/role_claims/logins/tokens)
--
-- Target: local dev database `wallview_dev` (utf8mb4). Idempotent-ish: drops then recreates.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `manage_user_role_details`;
DROP TABLE IF EXISTS `manage_user_roles`;
DROP TABLE IF EXISTS `refresh_tokens`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `tenant_config`;
DROP TABLE IF EXISTS `companies`;
DROP TABLE IF EXISTS `invite_codes`;
DROP TABLE IF EXISTS `verification_tokens`;
DROP TABLE IF EXISTS `contacts`;
DROP TABLE IF EXISTS `tenants`;

SET FOREIGN_KEY_CHECKS = 1;

-- ─────────────────────────── Tenant (the isolation root) ───────────────────────────
CREATE TABLE `tenants` (
  `id`                   VARCHAR(36)  NOT NULL,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,           -- logical tenant key referenced everywhere
  `business_name`        VARCHAR(255) NOT NULL,
  `subdomain`            VARCHAR(255) NOT NULL,            -- URL slug (checked assertion, never authz)
  `region`               VARCHAR(100) NULL,
  `country`              VARCHAR(100) NULL,
  `is_business`          TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenants_workspace` (`tenant_workspace_id`),
  UNIQUE KEY `uq_tenants_subdomain` (`subdomain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────── Company (per tenant) ───────────────────────────
CREATE TABLE `companies` (
  `id`                   VARCHAR(36)  NOT NULL,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  `name`                 VARCHAR(255) NOT NULL,
  `logo`                 VARCHAR(255) NULL,
  `website`              VARCHAR(255) NULL,
  `country`              VARCHAR(100) NULL,
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_companies_tenant` (`tenant_workspace_id`),
  CONSTRAINT `fk_companies_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────── Onboarding funnel (pre-tenant, global) ───────────────────────────
CREATE TABLE `contacts` (
  `id`         VARCHAR(36)  NOT NULL,
  `email`      VARCHAR(255) NOT NULL,
  `mobile`     VARCHAR(50)  NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_contacts_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `verification_tokens` (
  `id`           VARCHAR(36)  NOT NULL,
  `reference_id` VARCHAR(128) NULL,
  `code`         VARCHAR(64)  NOT NULL,
  `email`        VARCHAR(255) NOT NULL,
  `is_used`      TINYINT(1)   NOT NULL DEFAULT 0,
  `expires_at`   DATETIME     NOT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_vtok_email` (`email`),
  KEY `ix_vtok_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `invite_codes` (
  `id`         VARCHAR(36)  NOT NULL,
  `code`       VARCHAR(64)  NOT NULL,
  `email`      VARCHAR(255) NULL,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `expires_at` DATETIME     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invite_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────── Identity (per tenant) ───────────────────────────
CREATE TABLE `users` (
  `id`                    VARCHAR(36)  NOT NULL,
  `tenant_workspace_id`   VARCHAR(100) NOT NULL,
  `user_name`             VARCHAR(256) NOT NULL,
  `normalized_user_name`  VARCHAR(256) NOT NULL,
  `email`                 VARCHAR(256) NOT NULL,
  `normalized_email`      VARCHAR(256) NOT NULL,
  `email_confirmed`       TINYINT(1)   NOT NULL DEFAULT 0,
  `password_hash`         VARCHAR(255) NOT NULL,          -- argon2id only; never plaintext
  `security_stamp`        VARCHAR(64)  NULL,
  `phone_number`          VARCHAR(50)  NULL,
  `is_business_user`      TINYINT(1)   NOT NULL DEFAULT 0,
  `is_external`           TINYINT(1)   NOT NULL DEFAULT 0,
  `subdomain`             VARCHAR(255) NOT NULL,
  `is_verified`           TINYINT(1)   NOT NULL DEFAULT 0,
  `verified_at`           DATETIME     NULL,
  `lockout_end`           DATETIME     NULL,
  `access_failed_count`   INT          NOT NULL DEFAULT 0,
  `created_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_tenant_email` (`tenant_workspace_id`, `normalized_email`),
  KEY `ix_users_tenant` (`tenant_workspace_id`),
  KEY `ix_users_norm_email` (`normalized_email`),
  CONSTRAINT `fk_users_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `roles` (
  `id`                   VARCHAR(36)  NOT NULL,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  `name`                 VARCHAR(256) NOT NULL,
  `normalized_name`      VARCHAR(256) NOT NULL,
  `is_business_role`     TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_tenant_name` (`tenant_workspace_id`, `normalized_name`),
  KEY `ix_roles_tenant` (`tenant_workspace_id`),
  CONSTRAINT `fk_roles_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user_roles` (
  `user_id`              VARCHAR(36)  NOT NULL,
  `role_id`              VARCHAR(36)  NOT NULL,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `ix_user_roles_role` (`role_id`),
  KEY `ix_user_roles_tenant` (`tenant_workspace_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_user_roles_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────── Refresh tokens (per user; stored hashed) ───────────────────────────
CREATE TABLE `refresh_tokens` (
  `token_hash` CHAR(64)     NOT NULL,                     -- sha256 of the opaque token
  `user_id`    VARCHAR(36)  NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked`    TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`token_hash`),
  KEY `ix_refresh_user` (`user_id`),
  CONSTRAINT `fk_refresh_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────── RBAC matrix (per tenant) ───────────────────────────
CREATE TABLE `manage_user_roles` (
  `id`                   INT          NOT NULL AUTO_INCREMENT,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  `name`                 VARCHAR(255) NOT NULL,
  `description`          VARCHAR(500) NULL,
  `cancelled`            TINYINT(1)   NOT NULL DEFAULT 0,
  `created_date`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_date`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by`           VARCHAR(255) NULL,
  `modified_by`          VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_mur_tenant` (`tenant_workspace_id`),
  CONSTRAINT `fk_mur_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `manage_user_role_details` (
  `id`                   INT          NOT NULL AUTO_INCREMENT,
  `manage_role_id`       INT          NOT NULL,
  `role_id`              VARCHAR(36)  NULL,
  `role_name`            VARCHAR(255) NULL,
  `is_allowed`           TINYINT(1)   NOT NULL DEFAULT 0,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  `cancelled`            TINYINT(1)   NOT NULL DEFAULT 0,
  `created_date`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_date`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_murd_role` (`manage_role_id`),
  KEY `ix_murd_tenant` (`tenant_workspace_id`),
  CONSTRAINT `fk_murd_parent` FOREIGN KEY (`manage_role_id`)
    REFERENCES `manage_user_roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_murd_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────── Tenant config / branding + entitlements ───────────────────────────
CREATE TABLE `tenant_config` (
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  `brand`                JSON         NULL,               -- {name, logoUrl, iconUrl, accent, poweredBy?}
  `features`             JSON         NULL,               -- {maxModules, pricingEnabled, ...} entitlements
  `units`                VARCHAR(8)   NOT NULL DEFAULT 'mm',
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_workspace_id`),
  CONSTRAINT `fk_config_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
