# Debt Eater — Agent Instructions

These rules apply to coding agents working in this repository.

## Priorities

1. Financial correctness
2. Data integrity and security
3. Clean architecture
4. Reusability
5. Simplicity
6. Accessibility
7. UX
8. Performance

The UI is visual-first with minimal wording. Prefer charts, KPI cards, progress indicators, timelines, icons and concise metrics over paragraphs.

## Workflow

Before changing code use:

**Inspect → Understand → Plan → Reuse → Implement → Test → Review**

Inspect the repository and relevant documentation first. Search for reusable components, hooks, utilities, services, schemas, types and domain logic. Never assume functionality does not exist without checking.

## Strict DRY rule

Duplicate code is not acceptable.

Before creating a component, hook, utility, service, repository, schema, type, validator, formatter or calculation:

1. Search for an existing implementation.
2. Reuse it where possible.
3. Extend/generalise it where appropriate.
4. Create something new only when necessary.

Never copy an existing implementation and slightly modify it. Prefer configurable/composable shared components over near-identical variants. Do not over-engineer abstractions where behaviours are genuinely different.

Aim for **maximum meaningful reuse with minimum complexity**.

## Architecture

Use clean, feature-oriented architecture with clear separation between presentation/UI, domain/business logic, financial calculations, data access, validation and shared infrastructure.

Feature-specific code belongs with its feature. Genuinely reusable code belongs in shared/domain layers.

Domain logic must not depend on UI. UI components must not contain important financial calculations or direct database logic.

Prefer:

**UI → domain/service → repository/data source**

Maintain a single source of truth for important behaviour.

## Financial logic

Centralise balances, interest, repayments, amortisation, overpayments, remaining terms, payoff dates, projections and financial formatting.

Never duplicate financial formulas. Calculations should be pure, deterministic and independently testable where practical.

Avoid floating-point precision issues for money. Use an appropriate money/decimal representation.

Clearly distinguish stored facts, calculated values, user assumptions and projections. Never present projections as guaranteed outcomes.

## Components and UX

Components should be small, focused, reusable, composable, accessible and testable. Do not build large page components containing rendering, fetching, calculations, validation and persistence together.

Do not create separate personal/business component implementations when one well-designed configurable component can support both.

Use mobile-first responsive design for mobile, tablet and desktop. Prefer visual communication and progressive disclosure. Avoid dense screens, unnecessary wording, excessive confirmations and decorative animation.

## Performance

Avoid unnecessary re-renders, duplicate requests/queries, loading unused data, large unnecessary dependencies, repeated expensive calculations and excessive rendered datasets.

Use caching, lazy loading, memoisation and code splitting where they provide genuine benefit. Do not prematurely optimise trivial operations.

## Accessibility

Accessibility is mandatory. Use semantic HTML, keyboard navigation, visible focus states, accessible labels and sufficient contrast. Do not communicate important information using colour alone. Provide accessible alternatives for visualisations where required.

## Security

Treat financial data as sensitive. Never commit secrets, expose credentials client-side, log sensitive data unnecessarily, trust client-side validation alone, use unsafe database queries or store authentication data insecurely.

Validate data at system boundaries and follow least-privilege principles.

## Coding standards

Follow the repository's configured formatter, linter, type checker, framework conventions and testing conventions.

Use strict typing. Avoid `any` unless technically necessary and justified. Use descriptive naming and small single-purpose functions.

Remove dead code, debug logging, commented-out implementations, unused imports and obsolete TODOs. Never suppress lint/type/test failures simply to make CI pass; fix the root cause.

## Testing

Meaningful changes require appropriate tests. Prioritise unit tests for financial calculations, domain rules, validation, formatting, dates and projections, including relevant edge cases.

Add component tests for important interactions and browser/E2E tests for critical journeys across relevant responsive sizes. Bug fixes should include regression tests where practical.

## Definition of done

Before reporting a task complete:

1. Review implementation and diff.
2. Check for accidental duplication.
3. Run formatting.
4. Run linting.
5. Run type checking.
6. Run relevant unit/component tests.
7. Run relevant browser/E2E tests.
8. Run the production build.
9. Check responsive behaviour.
10. Consider accessibility and security.
11. Verify financial calculations where relevant.

Never claim a check passed unless it was actually executed successfully. Do not report work as ready until required checks are green.

## CI and failures

CI should enforce formatting, linting, type checking, unit tests, production build and relevant browser/E2E tests.

Never bypass failing CI.

When something fails use:

**Read actual error → identify root cause → fix → rerun**

Do not make repeated speculative fixes.

## Pull requests

Keep PRs focused. Review the complete diff and remove unrelated changes before completion.

PR descriptions should briefly cover what changed, why, important architecture/reuse decisions, tests actually executed and manual testing required. Include screenshots for significant visual changes where practical.

## Dependencies

Before adding a dependency, check whether the project or platform already provides the functionality, consider bundle size/maintenance/security, and add it only when it provides meaningful value.

## Refactoring and documentation

If a feature exposes obvious duplication or a poor abstraction, improve it when reasonably within scope. Do not add another workaround on top of bad architecture, but avoid unrelated large refactors that increase risk.

Keep architecture, setup, testing, schema and deployment documentation current when material changes require it.
