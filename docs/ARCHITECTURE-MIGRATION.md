# Rcentz Platform Architecture Migration

## Status

Migration baseline: `700d503`  
Source repository: `devkiddz/rcentz`  
API repository: `devkiddz/rcentz-api`

The migration is intentionally progressive. The current Rcentz system remains the reference implementation while each responsibility is separated and proven locally before deployment.

---

## Target Applications

### `rcentz.cc`
Corporate Rcentz website.

Primary responsibilities:
- Who Rcentz is
- Company identity
- Featured systems
- Featured products
- Selected portfolio
- Company information
- Navigation into the wider Rcentz ecosystem

It should not own product, systems, billing, or operational backend logic long term.

### `systems.rcentz.cc`
Rcentz services and business systems website.

Primary responsibilities:
- Services
- Service categories
- Service detail pages
- Portfolio / engineering proof
- Service discovery
- Service requests
- Related systems-facing content

### `products.rcentz.cc`
Rcentz-owned product discovery website.

Primary responsibilities:
- Rcentz-owned software products
- Product status
- Product progress
- Coming Soon products
- Product launch state
- Product discovery and marketing
- Links into deployed products

The existing commerce `Product` model is not the canonical model for Rcentz-owned software products. A distinct ecosystem product model will be introduced.

### `api.rcentz.cc`
Shared backend contract and platform authority.

Primary responsibilities:
- API contracts
- Authentication authority
- Authorization
- Domain services
- Validation
- Database access
- Shared business rules
- Cross-application contracts
- Controlled public data delivery
- Internal application communication

---

## Migration Method

Each new application begins as a clone of the proven Rcentz codebase.

```text
Current Rcentz
     ↓ clone
Dedicated local working copy
     ↓
Remove responsibilities that do not belong
     ↓
Specialize remaining code
     ↓
Test locally
     ↓
Push dedicated repository
     ↓
Deploy only after acceptance
```

The migration does not begin with a blank project.

The goal is to preserve proven architecture and progressively subtract unrelated responsibilities.

---

## Migration Order

1. Seal current `rcentz.cc`.
2. Clone it into `rcentz-api`.
3. Remove presentation and website UI from the API clone.
4. Preserve Prisma, server logic, domain logic, validation, and authentication foundations.
5. Establish stable API contracts.
6. Update local `rcentz.cc` to consume the API.
7. Test locally.
8. Update live `rcentz.cc`.
9. Clone and specialize `systems.rcentz.cc`.
10. Connect Systems to the same API contract.
11. Clone and specialize `products.rcentz.cc`.
12. Connect Products to the same API contract.
13. Progressively assign final database ownership by domain.
14. Remove obsolete duplicated implementation only after replacements are proven.

---

## Clone Rule

Clones may temporarily contain duplicated code and duplicated local databases.

This duplication is migration infrastructure.

It must not become accidental long-term competing authority.

During migration:

```text
original system = reference
local clone     = isolated migration workspace
```

After migration:

```text
one domain = one operational authority
other applications = API consumers
```

---

## Database Strategy

Each clone may initially use its own local database/schema copy.

This allows:
- migrations without touching production
- model deletion
- schema reshaping
- endpoint testing
- data-contract testing
- domain extraction

The API clone must not use the live production database during destructive migration work.

Future database ownership may become:

```text
api.rcentz.cc
   ├── Rcentz Core / Identity DB
   ├── Systems DB
   ├── Products / Catalog DB
   ├── Rcentz Pay DB
   └── future domain databases
```

Physical database separation must not change the external API contract unnecessarily.

Applications should depend on contracts, not database topology.

---

## API Contract Principle

Applications do not receive raw Prisma models by default.

The API exposes deliberate response contracts.

Example:

```ts
type PublicProduct = {
  name: string
  slug: string
  shortDescription: string
  status: string
  progress: number | null
  productUrl: string | null
}
```

Do not expose internal fields simply because they exist in the database.

---

## API Security Model

`api.rcentz.cc` may be reachable from the public internet.

Reachability does not equal authorization.

Every endpoint belongs to an explicit security class.

### 1. Public

No login required.

Only deliberately publishable data is returned.

Examples:

```text
GET /v1/services
GET /v1/services/:slug
GET /v1/portfolio
GET /v1/portfolio/:slug
GET /v1/products
GET /v1/products/:slug
```

Public endpoints must:
- return safe DTOs
- exclude internal fields
- expose only published records
- validate query parameters
- support rate limiting where needed

### 2. Authenticated

Requires a valid Rcentz user identity/session/token.

Examples:

```text
/v1/account/*
/v1/projects/*
/v1/subscriptions/*
/v1/billing/*
/v1/notifications/*
```

Authentication proves identity.

Authorization still decides whether the identified user may access the requested resource.

### 3. Staff / Administrative

Requires:
- authenticated identity
- staff/admin status
- explicit permission for the operation

Examples:

```text
/v1/admin/projects/*
/v1/admin/services/*
/v1/admin/products/*
/v1/admin/billing/*
```

A logged-in user must never gain administrative access merely because authentication succeeded.

### 4. Internal Service

Intended for server-to-server communication only.

Examples:

```text
/v1/internal/*
```

Internal routes require dedicated service credentials or equivalent trusted server authentication.

Normal browser sessions are not sufficient.

---

## Authorization Rules

Authorization is enforced server-side.

Never rely on:
- hidden buttons
- frontend route guards alone
- CORS
- obscured endpoint names
- client-side role checks

These can improve UX but they are not security boundaries.

Every protected server operation must independently verify authority.

---

## CORS

CORS controls which browsers may call the API from frontend JavaScript.

CORS is not authentication.

A malicious client can bypass browser CORS restrictions by calling the API directly.

Therefore:

```text
CORS + Authentication + Authorization
```

not:

```text
CORS = Security
```

Allowed origins should eventually be restricted to approved Rcentz properties where appropriate.

---

## Database Protection

Database credentials:
- remain server-only
- never appear in browser bundles
- never appear in public API responses
- never get committed to Git

Prisma runs only in trusted server environments.

Frontend applications communicate through the API contract instead of receiving direct database credentials.

---

## Input Protection

All mutation endpoints must validate:
- body
- path parameters
- query parameters
- identifiers
- enum values
- uploaded metadata
- pagination limits

Validation occurs before business logic and database mutation.

---

## Rate Limiting and Abuse Protection

Apply rate limits based on endpoint sensitivity.

Higher attention areas include:
- authentication
- password/reset flows
- public search
- contact/service request submission
- expensive analytics queries
- billing
- internal webhook endpoints

---

## Auditability

Sensitive actions should be traceable.

Examples:
- administrative project mutations
- billing changes
- role/permission changes
- product publication
- service publication
- client approval actions

Existing audit infrastructure should be preserved and expanded rather than removed during extraction.

---

## API Versioning

Initial public contract:

```text
/v1/*
```

Breaking changes should not silently replace established client contracts.

New incompatible behavior should use an intentional versioning or migration strategy.

---

## Current API Extraction Rule

During the first API cleanup:

### Keep
- `app/api`
- `server`
- Prisma schema and migrations
- feature `server` directories
- domain types needed by backend contracts
- auth server foundations
- billing server logic
- analytics server logic
- notification server logic
- localization server logic
- service server logic
- portfolio server logic

### Remove
- public website pages
- admin presentation pages
- client presentation pages
- dashboard presentation
- UI components
- visual shell
- presentation hooks
- marketing components

### Review Before Removal
- global layout
- global CSS
- public assets
- i18n runtime
- message files
- frontend-only dependencies
- legacy documentation
- browser-only libraries

---

## Product Domain Rule

The existing `Product` model represents commerce-oriented sellable/consumable products.

It should not be overloaded to represent all Rcentz-owned software applications.

A separate ecosystem product domain should support fields such as:
- name
- slug
- description
- status
- progress
- launch date
- product URL
- featured state
- visibility
- beta availability
- waitlist state
- media
- SEO

Possible statuses:

```text
DRAFT
DEVELOPMENT
COMING_SOON
BETA
PUBLISHED
PAUSED
RETIRED
```

---

## Core Architectural Rule

```text
Rcentz introduces.
Systems sells services.
Products showcases Rcentz-owned products.
API provides the shared contract.
```

---

## Governing Principle

**One ecosystem. Separate responsibilities. Shared contracts. Progressive migration.**
