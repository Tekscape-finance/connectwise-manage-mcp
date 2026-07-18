import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CwManageClient } from "../api-client.js";
import { registerFinanceProcurementTools } from "./finance-procurement.js";

type ToolSchema = Record<string, z.ZodType>;
type ToolResult = { content: Array<{ type: string; text: string }> };
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;
type RegisteredTool = {
  description: string;
  schema: ToolSchema;
  handler: ToolHandler;
};

const tools = new Map<string, RegisteredTool>();
const get = vi.fn();

function registerTools() {
  const server = {
    tool: vi.fn(
      (
        name: string,
        description: string,
        schema: ToolSchema,
        handler: ToolHandler,
      ) => {
        tools.set(name, { description, schema, handler });
      },
    ),
  } as unknown as McpServer;
  const client = { get } as unknown as CwManageClient;
  registerFinanceProcurementTools(server, client);
}

async function callTool(name: string, args: Record<string, unknown>) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool not registered: ${name}`);
  const parsed = z.object(tool.schema).parse(args);
  return tool.handler(parsed);
}

function parseText(result: ToolResult): unknown {
  return JSON.parse(result.content[0].text);
}

const collectionSchemaFields = [
  "conditions",
  "orderBy",
  "childConditions",
  "customFieldConditions",
  "fields",
  "page",
  "pageSize",
];

describe("Finance and Procurement tools", () => {
  beforeEach(() => {
    tools.clear();
    get.mockReset();
    registerTools();
  });

  it("registers exactly the eight read-only tools", () => {
    expect([...tools.keys()]).toEqual([
      "cw_search_purchase_orders",
      "cw_get_purchase_order",
      "cw_get_purchase_order_items",
      "cw_search_procurement_products",
      "cw_get_procurement_product",
      "cw_search_orders",
      "cw_get_order",
      "cw_get_order_products",
    ]);
    for (const tool of tools.values()) {
      expect(tool.description).toMatch(/read-only/i);
    }
  });

  it("searches purchase orders using the exact endpoint and standard query parameters", async () => {
    get.mockResolvedValueOnce([]);
    await callTool("cw_search_purchase_orders", {
      conditions: "closedFlag=false",
      orderBy: "poDate desc",
      childConditions: "vendorCompany/id=4",
      customFieldConditions: "caption='Region'",
      fields: "id,poNumber,poDate",
      page: 2,
      pageSize: 50,
    });
    expect(get).toHaveBeenCalledWith("/procurement/purchaseorders", {
      conditions: "closedFlag=false",
      orderBy: "poDate desc",
      childconditions: "vendorCompany/id=4",
      customfieldconditions: "caption='Region'",
      fields: "id,poNumber,poDate",
      page: 2,
      pageSize: 50,
    });
  });

  it("gets a purchase order using the exact endpoint", async () => {
    get.mockResolvedValueOnce({ id: 17 });
    await callTool("cw_get_purchase_order", { id: 17 });
    expect(get).toHaveBeenCalledWith("/procurement/purchaseorders/17");
  });

  it("gets purchase-order items using the exact endpoint and query parameters", async () => {
    get.mockResolvedValueOnce([]);
    await callTool("cw_get_purchase_order_items", {
      parentId: 17,
      conditions: "closedFlag=false",
      orderBy: "lineNumber asc",
      childConditions: "product/id=9",
      customFieldConditions: "caption='Source'",
      fields: "id,purchaseOrderNumber,unitCost",
      page: 3,
      pageSize: 100,
    });
    expect(get).toHaveBeenCalledWith(
      "/procurement/purchaseorders/17/lineitems",
      {
        conditions: "closedFlag=false",
        orderBy: "lineNumber asc",
        childconditions: "product/id=9",
        customfieldconditions: "caption='Source'",
        fields: "id,purchaseOrderNumber,unitCost",
        page: 3,
        pageSize: 100,
      },
    );
  });

  it("searches procurement products using the exact endpoint and defaults", async () => {
    get.mockResolvedValueOnce([]);
    await callTool("cw_search_procurement_products", {});
    expect(get).toHaveBeenCalledWith("/procurement/products", {
      conditions: undefined,
      orderBy: undefined,
      childconditions: undefined,
      customfieldconditions: undefined,
      fields: undefined,
      page: 1,
      pageSize: 25,
    });
  });

  it("gets a procurement product using the exact endpoint", async () => {
    get.mockResolvedValueOnce({ id: 29 });
    await callTool("cw_get_procurement_product", { id: 29 });
    expect(get).toHaveBeenCalledWith("/procurement/products/29");
  });

  it("searches Order resources using the exact endpoint and query parameters", async () => {
    get.mockResolvedValueOnce([]);
    await callTool("cw_search_orders", {
      conditions: "status/id=2",
      orderBy: "orderDate desc",
      fields: "id,orderDate,status",
      page: 4,
      pageSize: 10,
    });
    expect(get).toHaveBeenCalledWith("/sales/orders", {
      conditions: "status/id=2",
      orderBy: "orderDate desc",
      childconditions: undefined,
      customfieldconditions: undefined,
      fields: "id,orderDate,status",
      page: 4,
      pageSize: 10,
    });
  });

  it("gets an Order resource using the exact endpoint", async () => {
    get.mockResolvedValueOnce({ id: 31 });
    await callTool("cw_get_order", { id: 31 });
    expect(get).toHaveBeenCalledWith("/sales/orders/31");
  });

  it("gets order products with the required internally constructed condition", async () => {
    get.mockResolvedValueOnce([]);
    await callTool("cw_get_order_products", {
      orderId: 31,
      orderBy: "sequenceNumber asc",
      childConditions: "catalogItem/id=8",
      customFieldConditions: "caption='Class'",
      fields: "id,salesOrder,price",
      page: 2,
      pageSize: 75,
    });
    expect(get).toHaveBeenCalledWith("/procurement/products", {
      conditions: "salesOrder/id=31",
      orderBy: "sequenceNumber asc",
      childconditions: "catalogItem/id=8",
      customfieldconditions: "caption='Class'",
      fields: "id,salesOrder,price",
      page: 2,
      pageSize: 75,
    });
  });

  it("does not expose a conditions argument on cw_get_order_products", () => {
    const schema = tools.get("cw_get_order_products")?.schema;
    expect(schema).toBeDefined();
    expect(schema).not.toHaveProperty("conditions");
  });

  it.each([
    ["cw_get_purchase_order", "id"],
    ["cw_get_purchase_order_items", "parentId"],
    ["cw_get_procurement_product", "id"],
    ["cw_get_order", "id"],
    ["cw_get_order_products", "orderId"],
  ])("validates positive integer IDs for %s", (toolName, idField) => {
    const schema = tools.get(toolName)?.schema;
    expect(schema).toBeDefined();
    const parser = z.object(schema!);
    expect(() => parser.parse({ [idField]: 0 })).toThrow();
    expect(() => parser.parse({ [idField]: -1 })).toThrow();
    expect(() => parser.parse({ [idField]: 1.5 })).toThrow();
    expect(parser.parse({ [idField]: 1 })).toMatchObject({ [idField]: 1 });
  });

  it.each([
    "cw_search_purchase_orders",
    "cw_get_purchase_order_items",
    "cw_search_procurement_products",
    "cw_search_orders",
    "cw_get_order_products",
  ])("enforces page and page-size bounds for %s", (toolName) => {
    const schema = tools.get(toolName)?.schema;
    expect(schema).toBeDefined();
    const base = toolName === "cw_get_purchase_order_items"
      ? { parentId: 1 }
      : toolName === "cw_get_order_products"
        ? { orderId: 1 }
        : {};
    const parser = z.object(schema!);
    expect(() => parser.parse({ ...base, page: 0 })).toThrow();
    expect(() => parser.parse({ ...base, page: 1.5 })).toThrow();
    expect(() => parser.parse({ ...base, pageSize: 0 })).toThrow();
    expect(() => parser.parse({ ...base, pageSize: 1001 })).toThrow();
    expect(parser.parse({ ...base, page: 1, pageSize: 1000 })).toMatchObject({
      page: 1,
      pageSize: 1000,
    });
  });

  it.each([
    "cw_search_purchase_orders",
    "cw_get_purchase_order_items",
    "cw_search_procurement_products",
    "cw_search_orders",
  ])("supports every standard collection query parameter on %s", (toolName) => {
    const schema = tools.get(toolName)?.schema;
    expect(Object.keys(schema ?? {})).toEqual(
      expect.arrayContaining(collectionSchemaFields),
    );
  });

  it("preserves an empty array response", async () => {
    get.mockResolvedValueOnce([]);
    const result = await callTool("cw_search_purchase_orders", {});
    expect(parseText(result)).toEqual([]);
  });

  it("preserves purchase-order header fields and optional relationships", async () => {
    const apiObject = {
      id: 17,
      poNumber: "PO-redacted",
      poDate: "2026-07-17T00:00:00Z",
      vendorCompany: { id: 4, name: "Vendor" },
      futureApiField: { enabled: true },
    };
    get.mockResolvedValueOnce(apiObject);
    const result = await callTool("cw_get_purchase_order", { id: 17 });
    expect(parseText(result)).toEqual(apiObject);
  });

  it("preserves required purchase-order line fields", async () => {
    const apiObject = [{
      id: 18,
      purchaseOrderNumber: "PO-redacted",
      unitCost: 1,
      extCost: 2,
      dateReceived: "2026-07-17T00:00:00Z",
      receivedStatus: "Received",
      salesOrder: { id: 31 },
      batchedFlag: false,
      optionalRelationship: { id: 99 },
    }];
    get.mockResolvedValueOnce(apiObject);
    const result = await callTool("cw_get_purchase_order_items", { parentId: 17 });
    expect(parseText(result)).toEqual(apiObject);
  });

  it("preserves required procurement-product fields", async () => {
    const apiObject = {
      id: 29,
      price: 10,
      cost: 8,
      extPrice: 20,
      extCost: 16,
      margin: 4,
      salesOrder: { id: 31 },
      company: { id: 7 },
      needToPurchaseFlag: true,
      poApprovedFlag: false,
      customFields: [{ id: 3, value: "retained" }],
      futureApiField: "retained",
    };
    get.mockResolvedValueOnce(apiObject);
    const result = await callTool("cw_get_procurement_product", { id: 29 });
    expect(parseText(result)).toEqual(apiObject);
  });

  it.each([
    { toolName: "cw_search_purchase_orders", args: {}, status: 401 },
    { toolName: "cw_get_purchase_order", args: { id: 17 }, status: 403 },
    { toolName: "cw_get_procurement_product", args: { id: 29 }, status: 404 },
    { toolName: "cw_get_order", args: { id: 31 }, status: 500 },
  ])("propagates mocked HTTP $status errors from $toolName", async ({
    toolName,
    args,
    status,
  }) => {
    const error = new Error(`ConnectWise API GET returned ${status}`);
    get.mockRejectedValueOnce(error);
    await expect(callTool(toolName, args)).rejects.toBe(error);
  });
});
