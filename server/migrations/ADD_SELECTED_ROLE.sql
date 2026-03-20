-- Fix: "Database schema mismatch. Please run the migration to add selected_role column."
-- Run this in MySQL (e.g. MySQL Workbench, phpMyAdmin, or: mysql -u user -p database_name < ADD_SELECTED_ROLE.sql)

ALTER TABLE `users` ADD COLUMN `selected_role` VARCHAR(50) NULL AFTER `role`;
