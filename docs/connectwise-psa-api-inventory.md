# ConnectWise PSA API Endpoint Inventory

This reference inventories the complete ConnectWise PSA 2025.1 OpenAPI contract for future MCP tool expansion. The human-readable document summarizes coverage, priorities, provenance, and known Tekscape access. The companion [CSV inventory](connectwise-psa-api-inventory.csv) contains every path and operation with its exact contract details.

## Scope and counts

- OpenAPI version: `3.0.1`
- ConnectWise contract version: `2025.1`
- Paths: **1813**
- Operations: **3053**
- GET operations: **1712**
- Mutation operations: **1341**
- Current MCP tools with configured credentials: **59**
- Distinct OpenAPI operations covered by current tools: **59**
- Uncovered GET operations: **1665**

The current tool count is 59: the upstream 51-tool set plus eight read-only finance and procurement tools. Diagnostic-only startup without credentials exposes only `cw_test_connection`.

## How to use the complete inventory

The CSV file is the canonical exhaustive inventory. Each operation records:

- domain, HTTP method, exact path, and operation ID;
- path, query, header, and cookie parameters;
- request-body and response schema names;
- GET/read availability and mutation risk;
- current MCP coverage and covering tool names;
- a deterministic suggested MCP tool name for uncovered operations;
- finance relevance and implementation priority;
- public-source corroboration and version caveats;
- known live Tekscape permission results where available.

Regenerate both documents from the local evidence workspace with:

```bash
npm run docs:api-inventory
```

The generator is deterministic and does not use credentials, network access, or live business records. By default it reads the sibling `../cw-api-evidence` workspace. Set `CW_API_EVIDENCE_ROOT` when the evidence workspace is stored elsewhere.

## Operations by HTTP method

| Method | Operations | Risk |
| --- | --- | --- |
| DELETE | 307 | critical-destructive |
| GET | 1712 | none-read-only |
| PATCH | 325 | high-update |
| POST | 386 | medium-create-or-action |
| PUT | 323 | high-replacement |

## Operations by ConnectWise domain

| Domain | Paths | Operations | GET | Mutations | Covered operations | Covered tools |
| --- | --- | --- | --- | --- | --- | --- |
| company | 285 | 493 | 272 | 221 | 9 | 9 |
| configurations | 8 | 8 | 8 | 0 | 0 | 0 |
| expense | 32 | 44 | 28 | 16 | 0 | 0 |
| finance | 237 | 401 | 227 | 174 | 5 | 5 |
| marketing | 48 | 92 | 48 | 44 | 0 | 0 |
| procurement | 197 | 346 | 185 | 161 | 11 | 13 |
| project | 107 | 188 | 100 | 88 | 8 | 7 |
| sales | 116 | 211 | 109 | 102 | 10 | 10 |
| schedule | 57 | 87 | 52 | 35 | 0 | 0 |
| service | 213 | 355 | 203 | 152 | 10 | 9 |
| system | 440 | 706 | 413 | 293 | 3 | 3 |
| time | 73 | 122 | 67 | 55 | 3 | 3 |

## Current MCP coverage: 59 tools

Multiple tools can intentionally cover the same API operation. For example, `cw_search_procurement_products` and `cw_get_order_products` both call `GET /procurement/products`, with the latter enforcing a sales Order filter. Ticket-note tools also contain a compatibility fallback across two note endpoints.

| Tool | Source | Endpoints |
| --- | --- | --- |
| `cw_search_activities` | `src/tools/activities.ts` | `GET /sales/activities` |
| `cw_get_activity` | `src/tools/activities.ts` | `GET /sales/activities/{id}` |
| `cw_create_activity` | `src/tools/activities.ts` | `POST /sales/activities` |
| `cw_search_agreements` | `src/tools/agreements.ts` | `GET /finance/agreements` |
| `cw_get_agreement` | `src/tools/agreements.ts` | `GET /finance/agreements/{id}` |
| `cw_get_agreement_additions` | `src/tools/agreements.ts` | `GET /finance/agreements/{agreementId}/additions` |
| `cw_search_invoices` | `src/tools/agreements.ts` | `GET /finance/invoices` |
| `cw_get_invoice` | `src/tools/agreements.ts` | `GET /finance/invoices/{id}` |
| `cw_search_catalog_items` | `src/tools/catalog.ts` | `GET /procurement/catalog` |
| `cw_get_catalog_item` | `src/tools/catalog.ts` | `GET /procurement/catalog/{id}` |
| `cw_create_catalog_item` | `src/tools/catalog.ts` | `POST /procurement/catalog` |
| `cw_update_catalog_item` | `src/tools/catalog.ts` | `PATCH /procurement/catalog/{id}` |
| `cw_list_catalog_categories` | `src/tools/catalog.ts` | `GET /procurement/categories` |
| `cw_list_catalog_subcategories` | `src/tools/catalog.ts` | `GET /procurement/subCategories` |
| `cw_list_manufacturers` | `src/tools/catalog.ts` | `GET /procurement/manufacturers` |
| `cw_search_companies` | `src/tools/companies.ts` | `GET /company/companies` |
| `cw_get_company` | `src/tools/companies.ts` | `GET /company/companies/{id}` |
| `cw_create_company` | `src/tools/companies.ts` | `POST /company/companies` |
| `cw_update_company` | `src/tools/companies.ts` | `PATCH /company/companies/{id}` |
| `cw_search_configurations` | `src/tools/configurations.ts` | `GET /company/configurations` |
| `cw_get_configuration` | `src/tools/configurations.ts` | `GET /company/configurations/{id}` |
| `cw_search_contacts` | `src/tools/contacts.ts` | `GET /company/contacts` |
| `cw_get_contact` | `src/tools/contacts.ts` | `GET /company/contacts/{id}` |
| `cw_create_contact` | `src/tools/contacts.ts` | `POST /company/contacts` |
| `cw_search_purchase_orders` | `src/tools/finance-procurement.ts` | `GET /procurement/purchaseorders` |
| `cw_get_purchase_order` | `src/tools/finance-procurement.ts` | `GET /procurement/purchaseorders/{id}` |
| `cw_get_purchase_order_items` | `src/tools/finance-procurement.ts` | `GET /procurement/purchaseorders/{parentId}/lineitems` |
| `cw_search_procurement_products` | `src/tools/finance-procurement.ts` | `GET /procurement/products` |
| `cw_get_procurement_product` | `src/tools/finance-procurement.ts` | `GET /procurement/products/{id}` |
| `cw_search_orders` | `src/tools/finance-procurement.ts` | `GET /sales/orders` |
| `cw_get_order` | `src/tools/finance-procurement.ts` | `GET /sales/orders/{id}` |
| `cw_get_order_products` | `src/tools/finance-procurement.ts` | `GET /procurement/products` |
| `cw_test_connection` | `src/tools/health.ts` | `GET /system/info` |
| `cw_search_members` | `src/tools/members.ts` | `GET /system/members` |
| `cw_get_member` | `src/tools/members.ts` | `GET /system/members/{id}` |
| `cw_search_opportunities` | `src/tools/opportunities.ts` | `GET /sales/opportunities` |
| `cw_get_opportunity` | `src/tools/opportunities.ts` | `GET /sales/opportunities/{id}` |
| `cw_search_opportunity_forecasts` | `src/tools/opportunities.ts` | `GET /sales/opportunities/{opportunityId}/forecast` |
| `cw_search_opportunity_notes` | `src/tools/opportunities.ts` | `GET /sales/opportunities/{opportunityId}/notes` |
| `cw_search_sales_stages` | `src/tools/opportunities.ts` | `GET /sales/stages` |
| `cw_search_projects` | `src/tools/projects.ts` | `GET /project/projects` |
| `cw_get_project` | `src/tools/projects.ts` | `GET /project/projects/{id}` |
| `cw_search_project_tickets` | `src/tools/projects.ts` | `GET /project/tickets` |
| `cw_get_project_ticket` | `src/tools/projects.ts` | `GET /project/tickets/{id}` |
| `cw_get_project_ticket_notes` | `src/tools/projects.ts` | `GET /project/tickets/{id}/allNotes`<br>`GET /project/tickets/{id}/notes` |
| `cw_add_project_ticket_note` | `src/tools/projects.ts` | `POST /project/tickets/{id}/notes` |
| `cw_create_project` | `src/tools/projects.ts` | `POST /project/projects` |
| `cw_list_boards` | `src/tools/service.ts` | `GET /service/boards` |
| `cw_list_priorities` | `src/tools/service.ts` | `GET /service/priorities` |
| `cw_list_statuses` | `src/tools/service.ts` | `GET /service/boards/{boardId}/statuses` |
| `cw_search_tickets` | `src/tools/tickets.ts` | `GET /service/tickets` |
| `cw_get_ticket` | `src/tools/tickets.ts` | `GET /service/tickets/{id}` |
| `cw_create_ticket` | `src/tools/tickets.ts` | `POST /service/tickets` |
| `cw_update_ticket` | `src/tools/tickets.ts` | `PATCH /service/tickets/{id}` |
| `cw_get_ticket_notes` | `src/tools/tickets.ts` | `GET /service/tickets/{id}/allNotes`<br>`GET /service/tickets/{id}/notes` |
| `cw_add_ticket_note` | `src/tools/tickets.ts` | `POST /service/tickets/{id}/notes` |
| `cw_search_time_entries` | `src/tools/time-entries.ts` | `GET /time/entries` |
| `cw_get_time_entry` | `src/tools/time-entries.ts` | `GET /time/entries/{id}` |
| `cw_create_time_entry` | `src/tools/time-entries.ts` | `POST /time/entries` |

## Top finance expansion gaps

These are prioritized read-only candidates, not authorization to implement or invoke them. Live access must be verified with minimal GET probes before implementation.

| Priority | Endpoint | Suggested tool | Live result | Finance use |
| --- | --- | --- | --- | --- |
| P0 | `GET /finance/accounting/unpostedprocurement` | `cw_search_unposted_procurements` | HTTP 403 | Trace vendor costs before GL posting. |
| P0 | `GET /finance/accounting/unpostedinvoices` | `cw_search_unposted_invoices` | Not probed | Review invoice posting readiness and accounting exceptions. |
| P0 | `GET /finance/accounting/unpostedexpenses` | `cw_search_unposted_expenses` | Not probed | Review expense posting readiness and coding exceptions. |
| P0 | `GET /finance/accounting/unpostedpayments` | `cw_search_unposted_payments` | Not probed | Reconcile payment records before accounting export. |
| P0 | `GET /finance/accounting/batches` | `cw_search_accounting_batches` | Not probed | Trace posted accounting batches and their entries. |
| P0 | `GET /finance/invoices/{parentId}/glEntries/` | `cw_get_invoice_gl_entries` | Not probed | Inspect invoice GL distribution and account coding. |
| P0 | `GET /finance/invoices/{parentId}/payments` | `cw_get_invoice_payments` | Not probed | Reconcile invoice payment status and cash application. |
| P0 | `GET /finance/invoices/{parentId}/commissions` | `cw_get_invoice_commissions` | Not probed | Support commission reporting and invoice attribution. |
| P0 | `GET /procurement/products/{parentId}/pickingShippingDetails` | `cw_get_product_shipping_details` | Not probed | Trace fulfillment, shipment, and receiving evidence. |
| P0 | `GET /procurement/products/{parentId}/components` | `cw_get_product_components` | Not probed | Reconcile bundles and component-level cost or billing. |
| P0 | `GET /procurement/warehouses` | `cw_search_warehouses` | Not probed | Add warehouse context to inventory and procurement reports. |
| P0 | `GET /procurement/warehouseBins` | `cw_search_warehouse_bins` | Not probed | Trace inventory location and on-hand records. |
| P0 | `GET /system/audittrail` | `cw_search_audit_trail` | Not probed | Support finance-control evidence and change tracing. |
| P0 | `GET /expense/entries` | `cw_search_expense_entries` | Not probed | Reconcile billable and reimbursable expense activity. |
| P0 | `GET /sales/commissions` | `cw_search_sales_commissions` | Not probed | Support commission accrual and payout review. |

## Known live Tekscape permission results

These results were observed on 2026-07-17 and record only endpoint access and response shape. They contain no credentials or business data.

| Endpoint | Status | Result | Note |
| --- | --- | --- | --- |
| `GET /procurement/purchaseorders` | 200 | authorized | Live Tekscape probe returned an array of purchase-order headers. |
| `GET /procurement/purchaseorders/{parentId}/lineitems` | 200 | authorized | Live Tekscape probe returned purchase-order line items. |
| `GET /procurement/products` | 200 | authorized | Live Tekscape probes returned products and accepted a salesOrder/id condition. |
| `GET /sales/orders` | 200 | authorized | Live Tekscape probe returned sales Order records. |
| `GET /finance/accounting/unpostedprocurement` | 403 | forbidden | Endpoint exists, but the current Tekscape API Member lacks permission. |

## Risk and priority model

- `none-read-only`: GET, HEAD, or OPTIONS contract operation. Data sensitivity and scope still require review.
- `medium-create-or-action`: POST operation that may create a record or trigger an action.
- `high-replacement`: PUT operation that may replace a record.
- `high-update`: PATCH operation that may modify a record.
- `critical-destructive`: DELETE operation.
- `P0-finance-gap`: selected high-value finance read candidate.
- `P1-finance-read`: other uncovered finance or procurement GET operation.
- `P2-supporting-read`: uncovered supporting operational or reference GET operation.
- `P3-other-read`: uncovered GET operation with lower direct finance relevance.
- `defer-mutation`: uncovered mutation. Requires a separate use case, controls, validation, and approval.

## Provenance and evidence standard

Primary current contract:

- Repository: `pncit/cwmApi`
- Evidence path: `cwmApi/data/cwmApi_2025.1.json`
- OpenAPI `3.0.1`, ConnectWise PSA `2025.1`

Corroborating public clients:

- `sowderca/connectwise-manage-sdk/connectwise-manage-sdk/src/api/api.ts`
- `spinen/connectwise-php-client/connectwise-php-client/src/Models/v2019_5/map.json`

Corroboration is path-based. `current-plus-two-independent-sources` means the canonical path also appears in both older public clients. It does not mean their older parameter or response schemas supersede the 2025.1 OpenAPI contract. `current-2025.1-contract-only` may indicate a newer endpoint, a renamed endpoint, or an omission in an older client.

## Version caveats

- The primary contract is 2025.1 and governs operation IDs, parameters, and response schemas in this inventory.
- The TypeScript SDK is a legacy generated contract and is used only for path corroboration.
- The PHP client is pinned to v2019_5 and is used only for path corroboration.
- ConnectWise may preserve endpoint paths while adding fields or changing parameter support. Validate important endpoints against the live tenant before implementing tools.
- A documented endpoint can still return `403` when the API Member security role lacks inquiry permission.
- The inventory records contract availability, not a guarantee that every operation is enabled or licensed in Tekscape's tenant.

## Data-handling note

This inventory contains API metadata only. It contains no ConnectWise credentials, API keys, tenant identifiers, customer names, record IDs, or live response values.
