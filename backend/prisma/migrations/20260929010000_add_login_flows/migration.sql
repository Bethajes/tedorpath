-- CreateTable
CREATE TABLE "login_flows" (
    "id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "stateHash" CHAR(64) NOT NULL,
    "codeVerifier" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_flows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "login_flows_stateHash_key" ON "login_flows"("stateHash");

-- CreateIndex
CREATE INDEX "login_flows_expiresAt_idx" ON "login_flows"("expiresAt");
