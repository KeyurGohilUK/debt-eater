# Finance Tracker

Finance Tracker is a fast, visual-first application for personal and business finances. Debt Eater is its debt-management feature; Investments & Savings tracks contributions and manually entered valuations.

The goal is to make a financial position understandable at a glance: what is owed, what has been invested, how balances are changing, and what repayment scenarios may mean.

## Product principles

- Financial correctness first
- Personal and business records in reusable domain models
- Multi-currency values remain separate unless an exchange rate is explicitly provided
- Visual-first UX with minimal wording
- Fast, responsive, mobile-first experience
- Secure handling of sensitive financial data
- Accessible interactions and visualisations
- Strict reuse and no duplicated business logic

## Product scope

The app currently includes Debt Eater and an Investments & Savings ledger. Investment contributions and current values are stored separately, totals are grouped by GBP, EUR and INR, and current values are entered manually. See [FEATURES.md](FEATURES.md) for the evolving product roadmap.

## Engineering

Development follows an inspect-first workflow and clean feature-oriented architecture. Financial calculations are centralised, deterministic and independently testable. Shared behaviour should be reused rather than copied.

Coding agents must follow [AGENTS.md](AGENTS.md) before making changes.

## Status

Early development.

## Licence

This project is proprietary software and is not open source. See [LICENSE](LICENSE) for the full terms.
