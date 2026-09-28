# Debt Eater

Debt Eater is a fast, visual-first application for tracking and managing personal and business debt.

The goal is to make a complete debt position understandable at a glance: how much is owed, where it sits, how quickly it is falling, when debts are projected to be cleared, and how additional repayments change the outcome.

## Product principles

- Financial correctness first
- Personal and business debt in one reusable domain model
- Visual-first UX with minimal wording
- Fast, responsive, mobile-first experience
- Secure handling of sensitive financial data
- Accessible interactions and visualisations
- Strict reuse and no duplicated business logic

## Product scope

The initial product will focus on a dashboard, debt management, payments, debt detail, visual repayment progress and repayment simulation. See [FEATURES.md](FEATURES.md) for the evolving product roadmap.

## Engineering

Development follows an inspect-first workflow and clean feature-oriented architecture. Financial calculations are centralised, deterministic and independently testable. Shared behaviour should be reused rather than copied.

Coding agents must follow [AGENTS.md](AGENTS.md) before making changes.

## Status

Early development.

## Licence

This project is proprietary software and is not open source. See [LICENSE](LICENSE) for the full terms.
