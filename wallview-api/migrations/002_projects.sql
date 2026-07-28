-- WallView API — projects (the per-tenant design document store, ARCH-004 §12).
-- Each row holds one Job design document (JSON) owned by a tenant. FK cascade on
-- tenant delete; creator/updater set-null if the user is removed.

DROP TABLE IF EXISTS `projects`;

CREATE TABLE `projects` (
  `id`                   VARCHAR(36)  NOT NULL,
  `tenant_workspace_id`  VARCHAR(100) NOT NULL,
  `name`                 VARCHAR(255) NOT NULL,
  `design`               JSON         NOT NULL,           -- the Job document
  `schema_version`       INT          NOT NULL DEFAULT 1,
  `created_by`           VARCHAR(36)  NULL,
  `updated_by`           VARCHAR(36)  NULL,
  `created_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_projects_tenant` (`tenant_workspace_id`),
  KEY `ix_projects_updated` (`tenant_workspace_id`, `updated_at`),
  CONSTRAINT `fk_projects_tenant` FOREIGN KEY (`tenant_workspace_id`)
    REFERENCES `tenants` (`tenant_workspace_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_projects_creator` FOREIGN KEY (`created_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_projects_updater` FOREIGN KEY (`updated_by`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
