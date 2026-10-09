# Finance Tracker

Finance Tracker is a fast, visual-first application for personal and business finances. Debt Eater is its debt-management feature; Investments & Savings tracks contributions, manual valuations and automatic spot-based gold and silver estimates.

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

The app currently includes Debt Eater and an Investments & Savings ledger. Investment contributions and current values are stored separately and totals remain grouped by GBP, EUR and INR. Gold and silver holdings can use automatically cached spot prices and daily reference exchange rates; the result is an estimated metal value that excludes premiums, fees, VAT and resale spreads. Other assets continue to use optional manual valuations. See [FEATURES.md](FEATURES.md) for the evolving product roadmap.

## Engineering

Development follows an inspect-first workflow and clean feature-oriented architecture. Financial calculations are centralised, deterministic and independently testable. Shared behaviour should be reused rather than copied.

Coding agents must follow [AGENTS.md](AGENTS.md) before making changes.

## Status

Early development.

## Licence

This project is proprietary software and is not open source. See [LICENSE](LICENSE) for the full terms.
