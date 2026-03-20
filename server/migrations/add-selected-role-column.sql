-- Migration: Add selected_role column to users table
-- Run this SQL script on your MySQL database if you get errors about missing selected_role column

-- Check if column exists before adding (MySQL 5.7+)
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'selected_role';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- Column exists, do nothing
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` VARCHAR(50) NULL AFTER `role`')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Alternative simpler version (if above doesn't work, uncomment this):
-- ALTER TABLE `users` ADD COLUMN `selected_role` VARCHAR(50) NULL AFTER `role`;
