-- Faz 8: proje bazlı üretim bütçesi (USD). NULL → sınırsız.
ALTER TABLE "Project" ADD COLUMN "budgetUsd" DOUBLE PRECISION;
