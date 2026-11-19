-- P23: A1-prime advance-deposit automation config (0 = off).
ALTER TABLE "properties" ADD COLUMN "autoDepositDays" INTEGER NOT NULL DEFAULT 0;
