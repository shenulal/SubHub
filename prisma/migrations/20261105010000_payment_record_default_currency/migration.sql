-- SubHub: GCC base currency as the payment record default
ALTER TABLE "payment_records" ALTER COLUMN "currency" SET DEFAULT 'AED';
