import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const evidenceRoot =
  process.env.CW_API_EVIDENCE_ROOT ?? path.resolve(repositoryRoot, "../cw-api-evidence");
const specPath = path.join(
  evidenceRoot,
  "cwmApi/data/cwmApi_2025.1.json",
);
const sdkPath = path.join(
  evidenceRoot,
  "connectwise-manage-sdk/src/api/api.ts",
);
const phpMapPath = path.join(
  evidenceRoot,
  "connectwise-php-client/src/Models/v2019_5/map.json",
);
const docsDir = path.join(repositoryRoot, "docs");
const csvOutput = path.join(docsDir, "connectwise-psa-api-inventory.csv");
const markdownOutput = path.join(docsDir, "connectwise-psa-api-inventory.md");

const methods = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
const topFinanceGaps = [
  {
    path: "/finance/accounting/unpostedprocurement",
    tool: "cw_search_unposted_procurements",
    useCase: "Trace vendor costs before GL posting.",
    liveStatus: 403,
  },
  {
    path: "/finance/accounting/unpostedinvoices",
    tool: "cw_search_unposted_invoices",
    useCase: "Review invoice posting readiness and accounting exceptions.",
  },
  {
    path: "/finance/accounting/unpostedexpenses",
    tool: "cw_search_unposted_expenses",
    useCase: "Review expense posting readiness and coding exceptions.",
  },
  {
    path: "/finance/accounting/unpostedpayments",
    tool: "cw_search_unposted_payments",
    useCase: "Reconcile payment records before accounting export.",
  },
  {
    path: "/finance/accounting/batches",
    tool: "cw_search_accounting_batches",
    useCase: "Trace posted accounting batches and their entries.",
  },
  {
    path: "/finance/invoices/{parentId}/glEntries/",
    tool: "cw_get_invoice_gl_entries",
    useCase: "Inspect invoice GL distribution and account coding.",
  },
  {
    path: "/finance/invoices/{parentId}/payments",
    tool: "cw_get_invoice_payments",
    useCase: "Reconcile invoice payment status and cash application.",
  },
  {
    path: "/finance/invoices/{parentId}/commissions",
    tool: "cw_get_invoice_commissions",
    useCase: "Support commission reporting and invoice attribution.",
  },
  {
    path: "/procurement/products/{parentId}/pickingShippingDetails",
    tool: "cw_get_product_shipping_details",
    useCase: "Trace fulfillment, shipment, and receiving evidence.",
  },
  {
    path: "/procurement/products/{parentId}/components",
    tool: "cw_get_product_components",
    useCase: "Reconcile bundles and component-level cost or billing.",
  },
  {
    path: "/procurement/warehouses",
    tool: "cw_search_warehouses",
    useCase: "Add warehouse context to inventory and procurement reports.",
  },
  {
    path: "/procurement/warehouseBins",
    tool: "cw_search_warehouse_bins",
    useCase: "Trace inventory location and on-hand records.",
  },
  {
    path: "/system/audittrail",
    tool: "cw_search_audit_trail",
    useCase: "Support finance-control evidence and change tracing.",
  },
  {
    path: "/expense/entries",
    tool: "cw_search_expense_entries",
    useCase: "Reconcile billable and reimbursable expense activity.",
  },
  {
    path: "/sales/commissions",
    tool: "cw_search_sales_commissions",
    useCase: "Support commission accrual and payout review.",
  },
];

const liveEvidence = [
  {
    method: "get",
    path: "/procurement/purchaseorders",
    status: 200,
    result: "authorized",
    note: "Live Tekscape probe returned an array of purchase-order headers.",
  },
  {
    method: "get",
    path: "/procurement/purchaseorders/{parentId}/lineitems",
    status: 200,
    result: "authorized",
    note: "Live Tekscape probe returned purchase-order line items.",
  },
  {
    method: "get",
    path: "/procurement/products",
    status: 200,
    result: "authorized",
    note: "Live Tekscape probes returned products and accepted a salesOrder/id condition.",
  },
  {
    method: "get",
    path: "/sales/orders",
    status: 200,
    result: "authorized",
    note: "Live Tekscape probe returned sales Order records.",
  },
  {
    method: "get",
    path: "/finance/accounting/unpostedprocurement",
    status: 403,
    result: "forbidden",
    note: "Endpoint exists, but the current Tekscape API Member lacks permission.",
  },
];
const liveEvidenceAsOf = "2026-07-17";

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalPath(value) {
  const normalized = value.replace(/\$\{[^}]+\}/g, "{}").replace(/\{[^}]+\}/g, "{}");
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

function refName(ref) {
  return ref?.split("/").at(-1) ?? null;
}

function resolveRef(document, value) {
  if (!value?.$ref) return value;
  const parts = value.$ref.replace(/^#\//, "").split("/");
  let current = document;
  for (const part of parts) current = current?.[part];
  return current ?? value;
}

function schemaLabel(schema) {
  if (!schema) return null;
  if (schema.$ref) return refName(schema.$ref);
  if (schema.type === "array") return `array<${schemaLabel(schema.items) ?? "unknown"}>`;
  if (schema.oneOf) return `oneOf<${schema.oneOf.map(schemaLabel).join("|")}>`;
  if (schema.anyOf) return `anyOf<${schema.anyOf.map(schemaLabel).join("|")}>`;
  if (schema.allOf) return `allOf<${schema.allOf.map(schemaLabel).join("|")}>`;
  return schema.type ?? null;
}

function parameterRecord(document, parameter) {
  const resolved = resolveRef(document, parameter);
  return {
    name: resolved.name ?? null,
    in: resolved.in ?? null,
    required: Boolean(resolved.required),
    description: resolved.description ?? null,
    schema: schemaLabel(resolved.schema),
    enum: resolved.schema?.enum ?? null,
  };
}

function contentSchemas(content) {
  if (!content) return [];
  return Object.entries(content).map(([contentType, value]) => ({
    contentType,
    schema: schemaLabel(value.schema),
  }));
}

function responseRecords(document, responses = {}) {
  return Object.entries(responses).map(([status, response]) => {
    const resolved = resolveRef(document, response);
    return {
      status,
      description: resolved.description ?? null,
      schemas: contentSchemas(resolved.content),
    };
  });
}

function requestBodyRecord(document, requestBody) {
  if (!requestBody) return null;
  const resolved = resolveRef(document, requestBody);
  return {
    required: Boolean(resolved.required),
    description: resolved.description ?? null,
    schemas: contentSchemas(resolved.content),
  };
}

function extractLiteralPaths(source) {
  const paths = new Set();
  for (const match of source.matchAll(/["'`]((?:\/[A-Za-z0-9_{}-]+)+\/?)["'`]/g)) {
    paths.add(canonicalPath(match[1]));
  }
  return paths;
}

function extractCurrentTools() {
  const toolsDir = path.join(repositoryRoot, "src/tools");
  const files = fs
    .readdirSync(toolsDir)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .sort();
  const tools = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(toolsDir, file), "utf8");
    const starts = [...source.matchAll(/server\.tool\(\s*["'](cw_[^"']+)["']/g)];
    starts.forEach((match, index) => {
      const block = source.slice(match.index, starts[index + 1]?.index ?? source.length);
      const endpoints = [];
      for (const endpoint of block.matchAll(/client\.(get|post|put|patch|delete)\(\s*(["'`])(\/[^"'`]+)\2/g)) {
        endpoints.push({
          method: endpoint[1],
          path: endpoint[3].replace(/\$\{([^}]+)\}/g, "{$1}"),
          canonicalPath: canonicalPath(endpoint[3]),
        });
      }
      tools.push({ name: match[1], sourceFile: `src/tools/${file}`, endpoints });
    });
  }
  return tools;
}

function snakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function suggestedToolName(operationId, method, endpointPath) {
  const base = operationId || `${method}_${endpointPath}`;
  return `cw_${snakeCase(base)}`;
}

function mutationRisk(method) {
  return {
    get: "none-read-only",
    head: "none-read-only",
    options: "none-read-only",
    post: "medium-create-or-action",
    put: "high-replacement",
    patch: "high-update",
    delete: "critical-destructive",
    trace: "review",
  }[method] ?? "review";
}

function financeRelevance(endpointPath) {
  if (
    endpointPath.startsWith("/finance/") ||
    endpointPath.startsWith("/procurement/") ||
    endpointPath.startsWith("/expense/") ||
    endpointPath.startsWith("/sales/orders") ||
    endpointPath.includes("invoice") ||
    endpointPath.includes("agreement") ||
    endpointPath.includes("commission")
  ) return "high";
  if (
    endpointPath.startsWith("/sales/") ||
    endpointPath.startsWith("/time/") ||
    endpointPath.startsWith("/project/") ||
    endpointPath.startsWith("/company/") ||
    /tax|currency|billing|location|department|audit/i.test(endpointPath)
  ) return "medium";
  return "low";
}

function implementationPriority(method, endpointPath, covered) {
  if (covered) return "implemented";
  if (method !== "get") return "defer-mutation";
  const gap = topFinanceGaps.find((candidate) => canonicalPath(candidate.path) === canonicalPath(endpointPath));
  if (gap) return "P0-finance-gap";
  const relevance = financeRelevance(endpointPath);
  if (relevance === "high") return "P1-finance-read";
  if (relevance === "medium") return "P2-supporting-read";
  return "P3-other-read";
}

function corroborationFor(endpointPath, sdkPaths, phpPaths) {
  const canonical = canonicalPath(endpointPath);
  const sources = ["pncit/cwmApi 2025.1 OpenAPI"];
  if (sdkPaths.has(canonical)) sources.push("sowderca/connectwise-manage-sdk path literal");
  if (phpPaths.has(canonical)) sources.push("spinen/connectwise-php-client v2019_5 route map");
  const status =
    sources.length === 3
      ? "current-plus-two-independent-sources"
      : sources.length === 2
        ? "current-plus-one-independent-source"
        : "current-2025.1-contract-only";
  const versionCaveat =
    sources.length === 3
      ? "Path is also present in both legacy public clients; parameters and schemas still follow the 2025.1 contract."
      : sources.some((source) => source.includes("v2019_5"))
        ? "Path is also present in the v2019_5 client; parameters and schemas still follow the 2025.1 contract."
        : sources.some((source) => source.includes("manage-sdk"))
          ? "Path is also present in the legacy generated TypeScript SDK; parameters and schemas still follow the 2025.1 contract."
          : "Path was not found in the two older corroborating clients and may be newer, renamed, or omitted there.";
  return { status, sources, versionCaveat };
}

function countBy(values, selector) {
  const counts = {};
  for (const value of values) {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function markdownTable(rows) {
  if (!rows.length) return "_None._";
  const headers = Object.keys(rows[0]);
  const line = (row) => `| ${headers.map((header) => String(row[header] ?? "").replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`;
  return [line(Object.fromEntries(headers.map((header) => [header, header]))), line(Object.fromEntries(headers.map((header) => [header, "---"]))), ...rows.map(line)].join("\n");
}

function csvValue(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return /[",]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function buildCsv(inventory) {
  const headers = [
    "domain",
    "method",
    "path",
    "operation_id",
    "summary",
    "tags",
    "deprecated",
    "parameters",
    "query_parameters",
    "request_body_schemas",
    "response_schemas",
    "read_available",
    "mutation_risk",
    "current_mcp_covered",
    "current_mcp_tools",
    "recommended_future_mcp_tool",
    "finance_relevance",
    "implementation_priority",
    "corroboration_status",
    "corroboration_sources",
    "version_caveat",
    "live_tekscape_http_status",
    "live_tekscape_result",
    "live_tekscape_note",
  ];
  const parameterText = (parameters) =>
    parameters
      .map((parameter) =>
        [
          parameter.in,
          parameter.name,
          parameter.schema,
          parameter.required ? "required" : "optional",
          parameter.enum?.join("|") ?? "",
        ].join(":"),
      )
      .join(";");
  const schemaText = (schemas) =>
    schemas?.map((schema) => `${schema.contentType}:${schema.schema ?? "unknown"}`).join(";") ?? "";
  const rows = inventory.operations.map((operation) => {
    const live = operation.knownLiveTekscapePermissionResult;
    return [
      operation.domain,
      operation.method,
      operation.path,
      operation.operationId,
      operation.summary,
      operation.tags.join(";"),
      operation.deprecated,
      parameterText(operation.parameters),
      parameterText(operation.queryParameters),
      schemaText(operation.requestBody?.schemas),
      operation.responses
        .flatMap((response) =>
          response.schemas.map(
            (schema) => `${response.status}:${schema.contentType}:${schema.schema ?? "unknown"}`,
          ),
        )
        .join(";"),
      operation.readAvailability,
      operation.mutationRisk,
      operation.currentMcpCoverage.covered,
      operation.currentMcpCoverage.tools.join(";"),
      operation.recommendedFutureMcpToolName,
      operation.financeRelevance,
      operation.implementationPriority,
      operation.corroboration.status,
      operation.corroboration.sources.join(";"),
      operation.corroboration.versionCaveat,
      live?.status,
      live?.result,
      live?.note,
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n") + "\n";
}

function buildMarkdown(inventory) {
  const domainRows = Object.entries(inventory.summary.byDomain).map(([domain, counts]) => ({
    Domain: domain,
    Paths: counts.paths,
    Operations: counts.operations,
    GET: counts.get,
    Mutations: counts.mutations,
    "Covered operations": counts.coveredOperations,
    "Covered tools": counts.coveredTools,
  }));
  const methodRows = Object.entries(inventory.summary.byMethod).map(([method, count]) => ({
    Method: method.toUpperCase(),
    Operations: count,
    Risk: mutationRisk(method),
  }));
  const coverageRows = inventory.currentMcpTools.map((tool) => ({
    Tool: `\`${tool.name}\``,
    Source: `\`${tool.sourceFile}\``,
    Endpoints: tool.endpoints.length
      ? tool.endpoints.map((endpoint) => `\`${endpoint.method.toUpperCase()} ${endpoint.path}\``).join("<br>")
      : "None detected",
  }));
  const gapRows = inventory.topFinanceGaps.map((gap) => ({
    Priority: gap.priority,
    Endpoint: `\`GET ${gap.path}\``,
    "Suggested tool": `\`${gap.tool}\``,
    "Live result": gap.liveStatus ? `HTTP ${gap.liveStatus}` : "Not probed",
    "Finance use": gap.useCase,
  }));
  const liveRows = inventory.liveTekscapePermissionResults.map((result) => ({
    Endpoint: `\`${result.method.toUpperCase()} ${result.path}\``,
    Status: result.status,
    Result: result.result,
    Note: result.note,
  }));

  return `# ConnectWise PSA API Endpoint Inventory

This reference inventories the complete ConnectWise PSA 2025.1 OpenAPI contract for future MCP tool expansion. The human-readable document summarizes coverage, priorities, provenance, and known Tekscape access. The companion [CSV inventory](connectwise-psa-api-inventory.csv) contains every path and operation with its exact contract details.

## Scope and counts

- OpenAPI version: \`${inventory.source.openapiVersion}\`
- ConnectWise contract version: \`${inventory.source.connectWiseVersion}\`
- Paths: **${inventory.summary.paths}**
- Operations: **${inventory.summary.operations}**
- GET operations: **${inventory.summary.getOperations}**
- Mutation operations: **${inventory.summary.mutationOperations}**
- Current MCP tools with configured credentials: **${inventory.summary.currentMcpTools}**
- Distinct OpenAPI operations covered by current tools: **${inventory.summary.coveredOperations}**
- Uncovered GET operations: **${inventory.summary.uncoveredGetOperations}**

The current tool count is 59: the upstream 51-tool set plus eight read-only finance and procurement tools. Diagnostic-only startup without credentials exposes only \`cw_test_connection\`.

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

\`\`\`bash
npm run docs:api-inventory
\`\`\`

The generator is deterministic and does not use credentials, network access, or live business records. By default it reads the sibling \`../cw-api-evidence\` workspace. Set \`CW_API_EVIDENCE_ROOT\` when the evidence workspace is stored elsewhere.

## Operations by HTTP method

${markdownTable(methodRows)}

## Operations by ConnectWise domain

${markdownTable(domainRows)}

## Current MCP coverage: 59 tools

Multiple tools can intentionally cover the same API operation. For example, \`cw_search_procurement_products\` and \`cw_get_order_products\` both call \`GET /procurement/products\`, with the latter enforcing a sales Order filter. Ticket-note tools also contain a compatibility fallback across two note endpoints.

${markdownTable(coverageRows)}

## Top finance expansion gaps

These are prioritized read-only candidates, not authorization to implement or invoke them. Live access must be verified with minimal GET probes before implementation.

${markdownTable(gapRows)}

## Known live Tekscape permission results

These results were observed on ${inventory.liveTekscapePermissionResultsAsOf} and record only endpoint access and response shape. They contain no credentials or business data.

${markdownTable(liveRows)}

## Risk and priority model

- \`none-read-only\`: GET, HEAD, or OPTIONS contract operation. Data sensitivity and scope still require review.
- \`medium-create-or-action\`: POST operation that may create a record or trigger an action.
- \`high-replacement\`: PUT operation that may replace a record.
- \`high-update\`: PATCH operation that may modify a record.
- \`critical-destructive\`: DELETE operation.
- \`P0-finance-gap\`: selected high-value finance read candidate.
- \`P1-finance-read\`: other uncovered finance or procurement GET operation.
- \`P2-supporting-read\`: uncovered supporting operational or reference GET operation.
- \`P3-other-read\`: uncovered GET operation with lower direct finance relevance.
- \`defer-mutation\`: uncovered mutation. Requires a separate use case, controls, validation, and approval.

## Provenance and evidence standard

Primary current contract:

- Repository: \`${inventory.source.primary.repository}\`
- Evidence path: \`${inventory.source.primary.evidenceRelativePath}\`
- OpenAPI \`${inventory.source.openapiVersion}\`, ConnectWise PSA \`${inventory.source.connectWiseVersion}\`

Corroborating public clients:

- \`${inventory.source.corroborating[0].repository}/${inventory.source.corroborating[0].evidenceRelativePath}\`
- \`${inventory.source.corroborating[1].repository}/${inventory.source.corroborating[1].evidenceRelativePath}\`

Corroboration is path-based. \`current-plus-two-independent-sources\` means the canonical path also appears in both older public clients. It does not mean their older parameter or response schemas supersede the 2025.1 OpenAPI contract. \`current-2025.1-contract-only\` may indicate a newer endpoint, a renamed endpoint, or an omission in an older client.

## Version caveats

- The primary contract is 2025.1 and governs operation IDs, parameters, and response schemas in this inventory.
- The TypeScript SDK is a legacy generated contract and is used only for path corroboration.
- The PHP client is pinned to v2019_5 and is used only for path corroboration.
- ConnectWise may preserve endpoint paths while adding fields or changing parameter support. Validate important endpoints against the live tenant before implementing tools.
- A documented endpoint can still return \`403\` when the API Member security role lacks inquiry permission.
- The inventory records contract availability, not a guarantee that every operation is enabled or licensed in Tekscape's tenant.

## Data-handling note

This inventory contains API metadata only. It contains no ConnectWise credentials, API keys, tenant identifiers, customer names, record IDs, or live response values.
`;
}

for (const requiredPath of [specPath, sdkPath, phpMapPath]) {
  if (!fs.existsSync(requiredPath)) fail(`Missing evidence source: ${requiredPath}`);
}

const specification = readJson(specPath);
if (specification.openapi !== "3.0.1") fail(`Unexpected OpenAPI version: ${specification.openapi}`);
if (specification.info?.version !== "2025.1") fail(`Unexpected ConnectWise version: ${specification.info?.version}`);

const sdkPaths = extractLiteralPaths(fs.readFileSync(sdkPath, "utf8"));
const phpPaths = new Set(Object.keys(readJson(phpMapPath)).map(canonicalPath));
const currentMcpTools = extractCurrentTools();
if (currentMcpTools.length !== 59) fail(`Expected 59 MCP tools, found ${currentMcpTools.length}`);

const toolCoverage = new Map();
for (const tool of currentMcpTools) {
  for (const endpoint of tool.endpoints) {
    const key = `${endpoint.method} ${endpoint.canonicalPath}`;
    const names = toolCoverage.get(key) ?? [];
    names.push(tool.name);
    toolCoverage.set(key, names);
  }
}

const operations = [];
for (const [endpointPath, pathItem] of Object.entries(specification.paths)) {
  for (const method of methods) {
    const operation = pathItem[method];
    if (!operation) continue;
    const canonical = canonicalPath(endpointPath);
    const coverageKey = `${method} ${canonical}`;
    const coveredByTools = [...new Set(toolCoverage.get(coverageKey) ?? [])].sort();
    const allParameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map((parameter) => parameterRecord(specification, parameter));
    const corroboration = corroborationFor(endpointPath, sdkPaths, phpPaths);
    const liveResult = liveEvidence.find(
      (result) => result.method === method && canonicalPath(result.path) === canonical,
    ) ?? null;
    operations.push({
      domain: endpointPath.split("/").filter(Boolean)[0] ?? "root",
      method: method.toUpperCase(),
      path: endpointPath,
      operationId: operation.operationId ?? null,
      summary: operation.summary ?? null,
      description: operation.description ?? null,
      tags: operation.tags ?? [],
      deprecated: Boolean(operation.deprecated),
      parameters: allParameters,
      queryParameters: allParameters.filter((parameter) => parameter.in === "query"),
      requestBody: requestBodyRecord(specification, operation.requestBody),
      responses: responseRecords(specification, operation.responses),
      readAvailability: method === "get" || method === "head" || method === "options",
      mutationRisk: mutationRisk(method),
      currentMcpCoverage: {
        covered: coveredByTools.length > 0,
        tools: coveredByTools,
      },
      recommendedFutureMcpToolName:
        coveredByTools.length > 0 ? null : suggestedToolName(operation.operationId, method, endpointPath),
      financeRelevance: financeRelevance(endpointPath),
      implementationPriority: implementationPriority(method, endpointPath, coveredByTools.length > 0),
      corroboration,
      knownLiveTekscapePermissionResult: liveResult,
    });
  }
}

operations.sort((left, right) =>
  left.domain.localeCompare(right.domain) ||
  left.path.localeCompare(right.path) ||
  methods.indexOf(left.method.toLowerCase()) - methods.indexOf(right.method.toLowerCase()),
);

const duplicateOperationIds = Object.entries(countBy(operations.filter((operation) => operation.operationId), (operation) => operation.operationId))
  .filter(([, count]) => count > 1);
if (duplicateOperationIds.length) fail(`Duplicate operation IDs: ${JSON.stringify(duplicateOperationIds)}`);

const pathSet = new Set(operations.map((operation) => operation.path));
const domainNames = [...new Set(operations.map((operation) => operation.domain))].sort();
const byDomain = {};
for (const domain of domainNames) {
  const domainOperations = operations.filter((operation) => operation.domain === domain);
  const domainTools = currentMcpTools.filter((tool) =>
    tool.endpoints.some((endpoint) => endpoint.path.split("/").filter(Boolean)[0] === domain),
  );
  byDomain[domain] = {
    paths: new Set(domainOperations.map((operation) => operation.path)).size,
    operations: domainOperations.length,
    get: domainOperations.filter((operation) => operation.method === "GET").length,
    mutations: domainOperations.filter((operation) => operation.mutationRisk !== "none-read-only").length,
    coveredOperations: domainOperations.filter((operation) => operation.currentMcpCoverage.covered).length,
    coveredTools: domainTools.length,
  };
}

const selectedGaps = topFinanceGaps.map((gap) => {
  const operation = operations.find(
    (candidate) => candidate.method === "GET" && canonicalPath(candidate.path) === canonicalPath(gap.path),
  );
  if (!operation) fail(`Top finance gap is absent from the 2025.1 contract: ${gap.path}`);
  return {
    ...gap,
    path: operation.path,
    operationId: operation.operationId,
    responseSchemas: operation.responses,
    corroboration: operation.corroboration,
    priority: "P0",
  };
});

const inventory = {
  schemaVersion: 1,
  source: {
    openapiVersion: specification.openapi,
    connectWiseVersion: specification.info.version,
    primary: {
      repository: "pncit/cwmApi",
      absolutePath: specPath,
      evidenceRelativePath: "cwmApi/data/cwmApi_2025.1.json",
      role: "Primary 2025.1 OpenAPI contract",
    },
    corroborating: [
      {
        repository: "sowderca/connectwise-manage-sdk",
        absolutePath: sdkPath,
        evidenceRelativePath: "connectwise-manage-sdk/src/api/api.ts",
        role: "Legacy generated TypeScript path corroboration",
      },
      {
        repository: "spinen/connectwise-php-client",
        absolutePath: phpMapPath,
        evidenceRelativePath: "connectwise-php-client/src/Models/v2019_5/map.json",
        role: "v2019_5 route-map corroboration",
      },
    ],
    generator: "scripts/generate-connectwise-api-inventory.mjs",
  },
  summary: {
    paths: pathSet.size,
    operations: operations.length,
    getOperations: operations.filter((operation) => operation.method === "GET").length,
    mutationOperations: operations.filter((operation) => !operation.readAvailability).length,
    currentMcpTools: currentMcpTools.length,
    coveredOperations: operations.filter((operation) => operation.currentMcpCoverage.covered).length,
    uncoveredGetOperations: operations.filter(
      (operation) => operation.method === "GET" && !operation.currentMcpCoverage.covered,
    ).length,
    byMethod: countBy(operations, (operation) => operation.method.toLowerCase()),
    byDomain,
    byCorroboration: countBy(operations, (operation) => operation.corroboration.status),
    byFinanceRelevance: countBy(operations, (operation) => operation.financeRelevance),
    byImplementationPriority: countBy(operations, (operation) => operation.implementationPriority),
  },
  currentMcpTools,
  topFinanceGaps: selectedGaps,
  liveTekscapePermissionResultsAsOf: liveEvidenceAsOf,
  liveTekscapePermissionResults: liveEvidence,
  operations,
};

if (inventory.summary.paths !== 1813) fail(`Expected 1813 paths, found ${inventory.summary.paths}`);
if (inventory.summary.operations !== 3053) fail(`Expected 3053 operations, found ${inventory.summary.operations}`);
if (inventory.summary.getOperations !== 1712) fail(`Expected 1712 GET operations, found ${inventory.summary.getOperations}`);

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(csvOutput, buildCsv(inventory));
fs.writeFileSync(markdownOutput, buildMarkdown(inventory));

console.log(JSON.stringify(inventory.summary, null, 2));
