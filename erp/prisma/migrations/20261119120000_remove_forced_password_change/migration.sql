-- Password changes are voluntary in the free trial: clear the legacy flag for
-- every existing account and stop forcing it on newly created users.
ALTER TABLE "User" ALTER COLUMN "mustChangePassword" SET DEFAULT false;

UPDATE "User" SET "mustChangePassword" = false WHERE "mustChangePassword" = true;
