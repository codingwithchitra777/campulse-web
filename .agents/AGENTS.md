# Rules

## Build Verification
- **NEVER** run `npm run build` or start the dev server (`npm run dev`/`npm start`) to manually verify code changes.
- The user will handle running and verifying all builds themselves. Do not hold up progress to perform these verifications.

## Loan Calculation Rules
- When calculating a loan schedule from a target monthly payment, ALWAYS lock in the target payment across the entire term (using ixedMonthlyPayment) rather than recalculating an equalized EMI for a rounded-up term. This ensures the user's requested payment is respected exactly.
