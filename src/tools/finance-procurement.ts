import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";

const positiveInteger = z.number().int().positive();
const page = positiveInteger.optional().describe("Page number (default: 1)");
const pageSize = positiveInteger
  .max(1000)
  .optional()
  .describe("Results per page (default: 25, max: 1000)");

const collectionQuerySchema = {
  conditions: z.string().optional().describe("ConnectWise conditions query string"),
  orderBy: z.string().optional().describe("Field to order by"),
  childConditions: z
    .string()
    .optional()
    .describe("ConnectWise childconditions query string"),
  customFieldConditions: z
    .string()
    .optional()
    .describe("ConnectWise customfieldconditions query string"),
  fields: z.string().optional().describe("Comma-separated fields to return"),
  page,
  pageSize,
};

type CollectionQuery = {
  conditions?: string;
  orderBy?: string;
  childConditions?: string;
  customFieldConditions?: string;
  fields?: string;
  page?: number;
  pageSize?: number;
};

function toApiQuery(query: CollectionQuery): Record<string, string | number | undefined> {
  return {
    conditions: query.conditions,
    orderBy: query.orderBy,
    childconditions: query.childConditions,
    customfieldconditions: query.customFieldConditions,
    fields: query.fields,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 25,
  };
}

function textResult(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

/** Read-only Finance and Procurement tools for ConnectWise PSA. */
export function registerFinanceProcurementTools(
  server: McpServer,
  client: CwManageClient,
) {
  server.tool(
    "cw_search_purchase_orders",
    "Search purchase-order headers in ConnectWise PSA. Results preserve fields such as poNumber and poDate when returned by the API. Read-only.",
    collectionQuerySchema,
    async (query) => textResult(await client.get("/procurement/purchaseorders", toApiQuery(query))),
  );

  server.tool(
    "cw_get_purchase_order",
    "Get a purchase-order header by ID. The complete API object is returned without field filtering. Read-only.",
    { id: positiveInteger.describe("Purchase order ID") },
    async ({ id }) => textResult(await client.get(`/procurement/purchaseorders/${id}`)),
  );

  server.tool(
    "cw_get_purchase_order_items",
    "Get purchase-order line items. Returned objects preserve purchaseOrderNumber, unitCost, extCost, dateReceived, receivedStatus, salesOrder, batchedFlag, and other API fields. Read-only.",
    {
      parentId: positiveInteger.describe("Parent purchase order ID"),
      ...collectionQuerySchema,
    },
    async ({ parentId, ...query }) =>
      textResult(
        await client.get(
          `/procurement/purchaseorders/${parentId}/lineitems`,
          toApiQuery(query),
        ),
      ),
  );

  server.tool(
    "cw_search_procurement_products",
    "Search procurement products. Returned objects preserve pricing, cost, margin, sales-order, company, purchasing-state, custom-field, and other API fields. Read-only.",
    collectionQuerySchema,
    async (query) => textResult(await client.get("/procurement/products", toApiQuery(query))),
  );

  server.tool(
    "cw_get_procurement_product",
    "Get a procurement product by ID. The complete API object is returned without field filtering. Read-only.",
    { id: positiveInteger.describe("Procurement product ID") },
    async ({ id }) => textResult(await client.get(`/procurement/products/${id}`)),
  );

  server.tool(
    "cw_search_orders",
    "Search ConnectWise sales Order resources at /sales/orders. Read-only.",
    collectionQuerySchema,
    async (query) => textResult(await client.get("/sales/orders", toApiQuery(query))),
  );

  server.tool(
    "cw_get_order",
    "Get a ConnectWise sales Order resource by ID. The complete API object is returned without field filtering. Read-only.",
    { id: positiveInteger.describe("Order ID") },
    async ({ id }) => textResult(await client.get(`/sales/orders/${id}`)),
  );

  server.tool(
    "cw_get_order_products",
    "Get procurement products for a ConnectWise sales Order. The required salesOrder/id filter is constructed from orderId and cannot be overridden. Read-only.",
    {
      orderId: positiveInteger.describe("Order ID"),
      orderBy: collectionQuerySchema.orderBy,
      childConditions: collectionQuerySchema.childConditions,
      customFieldConditions: collectionQuerySchema.customFieldConditions,
      fields: collectionQuerySchema.fields,
      page,
      pageSize,
    },
    async ({ orderId, ...query }) =>
      textResult(
        await client.get(
          "/procurement/products",
          toApiQuery({ ...query, conditions: `salesOrder/id=${orderId}` }),
        ),
      ),
  );
}
