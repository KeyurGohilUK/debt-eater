# Debt Eater — Feature Roadmap

This document defines product scope. Engineering and agent rules live in `AGENTS.md`.

## P1 — Core MVP

### Dashboard

Provide a visual overview of:

- Total outstanding debt
- Personal debt
- Business debt
- Monthly required repayments
- Monthly overpayments
- Debt reduction progress
- Estimated debt-free date
- Overall repayment progress

Prioritise charts, KPI cards, progress indicators and concise metrics over text.

### Debt management

Allow users to add, edit, view and archive debts.

Support extensible debt types including:

- Residential mortgage
- Buy-to-let mortgage
- HMO mortgage
- Business/SPV mortgage
- Personal loan
- Business loan
- Credit card
- Car finance
- Director loan
- Overdraft
- Student loan
- Other

A debt can be personal or business. Business debts can be associated with a business/entity. Personal and business debt must share the same core debt model where their behaviour is genuinely common.

### Debt details

Support relevant information such as lender, original balance, current balance, interest rate and type, contractual payment, overpayment, start date, term, fixed-rate expiry, owner/entity and notes. Fields should adapt to the debt type.

### Payments

Use the monthly direct-debit amount, next collection date and an optional planned monthly overpayment to estimate remaining payments, tenure and payoff date. Routine debits do not require transaction-by-transaction logging. Log only occasional direct-to-principal lump-sum repayments; adjust the schedule inputs if the lender changes the terms. Automatic payment matching is a future integration, not required for projections.

### Debt progress

Show original debt → amount repaid → current balance → £0, including percentage repaid and estimated completion.

### Repayment simulator

Allow users to model changes without altering factual debt data. Support monthly payment/overpayment and lump-sum scenarios. Show projected payoff date, time saved, projected interest, interest saved and repayment trajectory.

## P2 — Visual analytics

- Debt balance over time
- Personal vs business breakdown
- Debt breakdown by type/account/entity
- Principal vs interest visualisation
- Debt-free timeline
- Historical repayment progress

## P3 — Strategy tools

Compare factual outcomes of strategies such as current payments, highest-interest-first, smallest-balance-first and custom priority.

Provide extra-money and lump-sum simulators showing the mathematical effect on balances, payoff dates and projected interest.

## P4 — Businesses and entities

Support multiple businesses/entities with their own debts, mortgages, loans, payments and totals.

Allow dashboard context switching between everything, personal, business and a specific entity without duplicating the application experience.

## P5 — History and milestones

Maintain debt history/snapshots for reliable historical charts and progress tracking.

Surface useful milestones such as percentage cleared, balance thresholds and debts fully repaid without cluttering the interface.

## P6 — Important dates

Track and surface dates such as:

- Fixed-rate expiry
- Loan maturity
- Promotional-rate expiry
- Refinancing date
- Payment date

## P7 — Search and filtering

Filter by personal/business, entity, debt type, lender, active/cleared state and interest-rate type.

## P8 — Export and reporting

Provide useful debt summaries, payment histories, business debt summaries and annual progress exports. Potential formats include PDF, CSV and spreadsheet.

## P9 — Future integrations

Potential later capabilities:

- Open Banking/bank integrations
- Automatic transaction import
- Automatic payment matching
- Balance updates
- Interest-rate updates

These must not unnecessarily complicate the MVP architecture.

## P10 — Future forecasting

Potential advanced visualisations include debt trajectory, monthly cash requirements, projected interest, rate-change scenarios and portfolio forecasts.

Forecasts must always be clearly distinguished from factual historical data.

## Initial navigation

Keep navigation small:

- Dashboard
- Debts
- Simulator
- History
- Settings

Business/entity selection should generally behave as context/filtering rather than a separate duplicate application section.

## MVP success criteria

The first useful release should let a user answer quickly:

- How much do I owe?
- Where is my debt?
- How much am I paying?
- How quickly is it falling?
- When am I projected to become debt-free?
- What happens if I pay more?
