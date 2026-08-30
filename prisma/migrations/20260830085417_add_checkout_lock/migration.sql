-- CreateTable
CREATE TABLE "CheckoutLock" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "CheckoutLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLock_userId_key" ON "CheckoutLock"("userId");

-- AddForeignKey
ALTER TABLE "CheckoutLock" ADD CONSTRAINT "CheckoutLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
