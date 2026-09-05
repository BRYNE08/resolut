-- Resolut schema (mirrors prisma/schema.prisma). Applied with `bun run scripts/db-push.ts`.

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_PAYMENT','PAID','IN_PRODUCTION','SHIPPED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('CUSTOMER','STUDIO','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "intro" TEXT NOT NULL,
  "badge" TEXT,
  "body" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priceCents" INTEGER,
  "image" TEXT NOT NULL,
  "imageAlt" TEXT NOT NULL,
  "detailImage" TEXT NOT NULL,
  "specs" JSONB NOT NULL,
  "details" JSONB NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "capacity" INTEGER NOT NULL DEFAULT 12,
  "readyStock" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Product_published_idx" ON "Product"("published");

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT,
  "email" TEXT UNIQUE,
  "emailVerified" TIMESTAMP(3),
  "image" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT PRIMARY KEY,
  "reference" TEXT NOT NULL UNIQUE,
  "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "customerName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "addressLine" TEXT NOT NULL,
  "addressLine2" TEXT,
  "suburb" TEXT,
  "city" TEXT NOT NULL,
  "province" TEXT NOT NULL DEFAULT '',
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'South Africa',
  "deliveryNotes" TEXT,
  "subtotalCents" INTEGER NOT NULL,
  "shippingCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL,
  "paymentRef" TEXT,
  "notes" TEXT,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "suburb" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "province" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'South Africa';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryNotes" TEXT;
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status","createdAt");
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "Product"("id"),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");

CREATE TABLE IF NOT EXISTS "Cart" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CartItem" (
  "id" TEXT PRIMARY KEY,
  "cartId" TEXT NOT NULL REFERENCES "Cart"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "Product"("id"),
  "quantity" INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_productId_key" ON "CartItem"("cartId","productId");
CREATE INDEX IF NOT EXISTS "CartItem_cartId_idx" ON "CartItem"("cartId");

CREATE TABLE IF NOT EXISTS "ProductionJob" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "overdue" BOOLEAN NOT NULL DEFAULT false,
  "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL,
  "orderId" TEXT REFERENCES "Order"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "WaitlistSignup" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistSignup_email_label_key" ON "WaitlistSignup"("email","label");

CREATE TABLE IF NOT EXISTS "ContactMessage" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "handled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider","providerAccountId");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expires" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier","token");

CREATE TABLE IF NOT EXISTS "CustomerProfile" (
  "id" TEXT PRIMARY KEY,
  "accountEmail" TEXT NOT NULL UNIQUE,
  "contactEmail" TEXT NOT NULL,
  "phone" TEXT,
  "addressLine" TEXT,
  "addressLine2" TEXT,
  "suburb" TEXT,
  "city" TEXT,
  "province" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'South Africa',
  "deliveryNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
