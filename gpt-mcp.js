"use strict";

/**
 * Bajaj Finance MCP Server — V7
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport 1 : SSE            GET  /sse        ← Claude.ai
 *               SSE messages   POST /messages
 * Transport 2 : Streamable     POST /mcp        ← ChatGPT / Marketplace
 *
 * Tool design — flat auth pattern (mobile + OTP per protected tool)
 * ─────────────────────────────────────────────────────────────────
 * Tested live against the running server. Two tool groups:
 *
 *   PUBLIC  (no auth)
 *     discover_loans          — product discovery by purpose / employment
 *     get_loan_product_info   — full product details + apply URL
 *
 *   AUTHENTICATED  (mobile + OTP, demo OTP = 123456)
 *     send_otp                — trigger OTP to registered mobile
 *     get_customer_profile    — name, active products, relationship summary
 *     get_loan_details        — loan dashboard (amount, EMI, tenure, ROI, status)
 *     raise_service_request   — create SR (NOC / Statement / Foreclosure etc.)
 *     track_service_request   — track SR by ticketId
 *
 * Fixes vs V6
 * ───────────
 * 1. express.json() ENABLED  (was commented out — broke /mcp entirely)
 * 2. StreamableHTTPServerTransport({ sessionIdGenerator: null }) — stateless mode
 * 3. req.body passed explicitly to transport.handleRequest(req, res, req.body)
 * 4. /.well-known/mcp  discovery endpoint  (ChatGPT calls on connect)
 * 5. /.well-known/oauth-authorization-server stub  (marketplace requirement)
 * 6. All tools: title + readOnlyHint / destructiveHint  (Anthropic review req.)
 * 7. CORS headers for browser-based clients
 * 8. Actionable error messages on bad input (reviewer tests this)
 */

const express = require("express");
const crypto  = require("crypto");

const { Server }                        = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport }            = require("@modelcontextprotocol/sdk/server/sse.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const app = express();

// ── FIX 1: body parsing must come before all routes ──────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin",  "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ DEMO CUSTOMER DATA                                                          │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const customers = {
  "9999999999": {
    customerId:        "CUST001",
    customerName:      "Vikas Singh Rathaur",
    loanType:          "Personal Loan",
    loanStatus:        "Active",
    agreementNumber:   "X402P34T9588444",
    loanAmount:        3739000,
    outstandingAmount: 4203,
    roi:               11.25,
    balanceTenure:     83,
    nextEmiAmount:     132,
    nextEmiDate:       "2026-08-02",
    flexiEnabled:      true,
  },
  "8888888888": {
    customerId:        "CUST002",
    customerName:      "Rahul Sharma",
    loanType:          "Home Loan",
    loanStatus:        "Active",
    agreementNumber:   "HL99887766",
    loanAmount:        3500000,
    outstandingAmount: 2450000,
    roi:               8.75,
    balanceTenure:     220,
    nextEmiAmount:     28500,
    nextEmiDate:       "2026-08-05",
    flexiEnabled:      false,
  },
};

// ── Product catalogue (public, no auth) ──────────────────────────────────────
const loanProducts = {
  personal_loan: {
    name:        "Personal Loan",
    minAmount:   100000,
    maxAmount:   4000000,
    roiFrom:     11.0,
    tenureMonths:"12–84",
    applyUrl:    "https://www.bajajfinserv.in/personal-loan",
    highlights:  ["No collateral", "Disbursal in 24 hrs", "Flexi EMI option"],
  },
  home_loan: {
    name:        "Home Loan",
    minAmount:   500000,
    maxAmount:   50000000,
    roiFrom:     8.5,
    tenureMonths:"12–360",
    applyUrl:    "https://www.bajajfinserv.in/home-loan",
    highlights:  ["Up to 90% financing", "Balance transfer option", "Long tenure"],
  },
  gold_loan: {
    name:        "Gold Loan",
    minAmount:   5000,
    maxAmount:   5000000,
    roiFrom:     9.5,
    tenureMonths:"3–24",
    applyUrl:    "https://www.bajajfinserv.in/gold-loan",
    highlights:  ["Instant disbursal", "No income proof", "High LTV"],
  },
  business_loan: {
    name:        "Business Loan",
    minAmount:   200000,
    maxAmount:   8000000,
    roiFrom:     14.0,
    tenureMonths:"12–96",
    applyUrl:    "https://www.bajajfinserv.in/business-loan",
    highlights:  ["No collateral up to 80L", "Overdraft option", "Flexi repayment"],
  },
  two_wheeler_loan: {
    name:        "Two Wheeler Loan",
    minAmount:   10000,
    maxAmount:   200000,
    roiFrom:     6.99,
    tenureMonths:"12–48",
    applyUrl:    "https://www.bajajfinserv.in/two-wheeler-loan",
    highlights:  ["Zero down payment offers", "Quick approval", "Wide dealer network"],
  },
};

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ IN-MEMORY STORES  (replace with Redis in production)                        │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const otpStore        = {}; // mobile → { otp, createdAt }
const serviceRequests = {}; // ticketId → SR object
const sseTransports   = {}; // sessionId → SSEServerTransport

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ RESPONSE HELPERS                                                            │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const success = (data) => ({
  content: [{ type: "text", text: JSON.stringify({ success: true, data }, null, 2) }],
});

const failure = (message) => ({
  content: [{ type: "text", text: JSON.stringify({ success: false, error: message }, null, 2) }],
  isError: true,
});

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ AUTH HELPER  — validates mobile + OTP per request (flat pattern)            │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
function validateOtp(mobileNumber, otp) {
  if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
    throw new Error("mobileNumber must be a 10-digit number.");
  }
  if (!otp || !/^[0-9]{6}$/.test(otp)) {
    throw new Error("otp must be a 6-digit number.");
  }

  const customer = customers[mobileNumber];
  if (!customer) {
    throw new Error("Mobile number not found in Bajaj Finance records.");
  }

  const record = otpStore[mobileNumber];
  if (!record) {
    throw new Error("No OTP found for this number. Please call send_otp first.");
  }
  if (Date.now() - record.createdAt > 10 * 60 * 1000) {
    delete otpStore[mobileNumber];
    throw new Error("OTP expired. Please call send_otp again.");
  }
  if (record.otp !== otp) {
    throw new Error("Invalid OTP. Please check and try again.");
  }

  return customer;
}

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ MCP SERVER FACTORY                                                          │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
function createServer() {
  const server = new Server(
    { name: "bajaj-finance-mcp-v7", version: "7.0.0" },
    { capabilities: { tools: {} } }
  );

  // ── TOOL REGISTRATION ──────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [

      /* ── PUBLIC TOOLS ─────────────────────────────────────────────────── */

      {
        name: "discover_loans",
        title: "Discover loan products",
        description:
          "Helps a prospective customer discover the right Bajaj Finance loan product " +
          "based on their purpose, employment type, and whether they have collateral. " +
          "Returns matching products with interest rates, amounts, and apply URLs. " +
          "No OTP or mobile number required — this is public product information.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            purpose: {
              type: "string",
              description:
                "Why does the customer need a loan? " +
                "e.g. personal need, home purchase, home renovation, business, " +
                "two-wheeler, gold, medical emergency, education, wedding",
            },
            employment_type: {
              type: "string",
              enum: ["salaried", "self_employed", "business_owner", "doctor", "ca", "unknown"],
              description: "Customer employment or profession type",
            },
            has_collateral: {
              type: "string",
              enum: ["yes_property", "yes_gold", "yes_fd", "yes_shares", "no", "unknown"],
              description: "Does the customer have any collateral to offer?",
            },
          },
        },
      },

      {
        name: "get_loan_product_info",
        title: "View loan product details",
        description:
          "Returns full details and the official Bajaj Finserv apply URL for a specific " +
          "loan product: interest rate, loan amount range, tenure, and key highlights. " +
          "Use when the customer has chosen a product and wants to know more or apply. " +
          "No OTP or mobile number required.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            product: {
              type: "string",
              enum: Object.keys(loanProducts),
              description: "Loan product key",
            },
          },
          required: ["product"],
        },
      },

      /* ── AUTHENTICATED TOOLS ──────────────────────────────────────────── */

      {
        name: "send_otp",
        title: "Send OTP for verification",
        description:
          "Sends a 6-digit one-time password (OTP) to the customer's registered mobile " +
          "number. The OTP is required by all customer-data tools. " +
          "Call this first, then ask the customer for the OTP. " +
          "OTP expires in 10 minutes. Demo OTP is 123456.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            mobileNumber: {
              type: "string",
              description: "10-digit mobile number registered with Bajaj Finance",
              pattern: "^[0-9]{10}$",
            },
          },
          required: ["mobileNumber"],
        },
      },

      {
        name: "get_customer_profile",
        title: "View customer profile",
        description:
          "Returns the authenticated customer's profile: customerId, full name, " +
          "count of active loans, list of active product types, and relationship status. " +
          "Requires mobileNumber and the OTP sent by send_otp.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            mobileNumber: {
              type: "string",
              description: "10-digit registered mobile number",
            },
            otp: {
              type: "string",
              description: "6-digit OTP received by the customer",
            },
          },
          required: ["mobileNumber", "otp"],
        },
      },

      {
        name: "get_loan_details",
        title: "View loan details",
        description:
          "Returns the full loan dashboard for the authenticated customer: loan type, " +
          "status, agreement number, sanctioned amount (₹), outstanding principal (₹), " +
          "rate of interest (%), balance tenure (months), next EMI amount (₹) and date, " +
          "and Flexi loan status. Requires mobileNumber and the OTP sent by send_otp.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            mobileNumber: {
              type: "string",
              description: "10-digit registered mobile number",
            },
            otp: {
              type: "string",
              description: "6-digit OTP received by the customer",
            },
          },
          required: ["mobileNumber", "otp"],
        },
      },

      {
        name: "raise_service_request",
        title: "Raise a service request",
        description:
          "Creates a new customer servicing request and returns a ticketId for tracking. " +
          "Supported requestType values: NOC, Account Statement, Foreclosure Quote, " +
          "EMI Dispute, Interest Certificate, Repayment Schedule. " +
          "Requires mobileNumber and the OTP sent by send_otp.",
        annotations: { destructiveHint: true },
        inputSchema: {
          type: "object",
          properties: {
            mobileNumber: {
              type: "string",
              description: "10-digit registered mobile number",
            },
            otp: {
              type: "string",
              description: "6-digit OTP received by the customer",
            },
            requestType: {
              type: "string",
              enum: [
                "NOC",
                "Account Statement",
                "Foreclosure Quote",
                "EMI Dispute",
                "Interest Certificate",
                "Repayment Schedule",
              ],
              description: "Type of service request",
            },
          },
          required: ["mobileNumber", "otp", "requestType"],
        },
      },

      {
        name: "track_service_request",
        title: "Track a service request",
        description:
          "Returns the current status of a previously raised service request. " +
          "Status values: OPEN, IN_PROGRESS, RESOLVED, CLOSED. " +
          "Requires the ticketId returned by raise_service_request. No OTP needed.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            ticketId: {
              type: "string",
              description: "ticketId returned by raise_service_request (e.g. SR-1234567890)",
            },
          },
          required: ["ticketId"],
        },
      },

    ],
  }));

  // ── TOOL EXECUTION ─────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = request.params.name;
    const args = request.params.arguments || {};

    try {

      /* ── discover_loans ─────────────────────────────────────────────────── */
      if (tool === "discover_loans") {
        const { purpose = "", employment_type = "unknown", has_collateral = "unknown" } = args;

        const purposeLower = purpose.toLowerCase();
        let matches = [];

        if (purposeLower.includes("home") || purposeLower.includes("house") || purposeLower.includes("flat")) {
          matches.push(loanProducts.home_loan);
        }
        if (purposeLower.includes("bike") || purposeLower.includes("two") || purposeLower.includes("scooter")) {
          matches.push(loanProducts.two_wheeler_loan);
        }
        if (purposeLower.includes("business") || employment_type === "business_owner") {
          matches.push(loanProducts.business_loan);
        }
        if (has_collateral === "yes_gold" || purposeLower.includes("gold")) {
          matches.push(loanProducts.gold_loan);
        }
        // default — personal loan always relevant
        if (matches.length === 0 || purposeLower.includes("personal") || purposeLower.includes("medical") || purposeLower.includes("wedding")) {
          matches.push(loanProducts.personal_loan);
        }

        return success({ recommendedProducts: matches });
      }

      /* ── get_loan_product_info ──────────────────────────────────────────── */
      if (tool === "get_loan_product_info") {
        const product = loanProducts[args.product];
        if (!product) return failure(`Unknown product: '${args.product}'.`);
        return success(product);
      }

      /* ── send_otp ───────────────────────────────────────────────────────── */
      if (tool === "send_otp") {
        const { mobileNumber } = args;
        if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
          return failure("mobileNumber must be a 10-digit number.");
        }
        if (!customers[mobileNumber]) {
          return failure("Mobile number not found in Bajaj Finance records.");
        }

        otpStore[mobileNumber] = { otp: "123456", createdAt: Date.now() };

        return success({
          otpSent:            true,
          maskedMobile:       mobileNumber.replace(/^(\d{2})\d{6}(\d{2})$/, "$1XXXXXX$2"),
          message:            "OTP sent to registered mobile number.",
          demoOtp:            "123456",   // sandbox only — remove in production
          expiresInMinutes:   10,
        });
      }

      /* ── get_customer_profile ───────────────────────────────────────────── */
      if (tool === "get_customer_profile") {
        const customer = validateOtp(args.mobileNumber, args.otp);
        return success({
          customerId:         customer.customerId,
          customerName:       customer.customerName,
          activeLoans:        1,
          activeProducts:     [customer.loanType],
          relationshipStatus: "ACTIVE",
        });
      }

      /* ── get_loan_details ───────────────────────────────────────────────── */
      if (tool === "get_loan_details") {
        const customer = validateOtp(args.mobileNumber, args.otp);
        return success({
          customerName:        customer.customerName,
          product:             customer.loanType.toUpperCase(),
          loanStatus:          customer.loanStatus,
          agreementNumber:     customer.agreementNumber,
          loanAmountINR:       customer.loanAmount,
          outstandingINR:      customer.outstandingAmount,
          interestRatePct:     customer.roi,
          balanceTenureMonths: customer.balanceTenure,
          nextEmiAmountINR:    customer.nextEmiAmount,
          nextEmiDate:         customer.nextEmiDate,
          flexiEnabled:        customer.flexiEnabled,
        });
      }

      /* ── raise_service_request ──────────────────────────────────────────── */
      if (tool === "raise_service_request") {
        const customer = validateOtp(args.mobileNumber, args.otp);
        if (!args.requestType) return failure("requestType is required.");

        const ticketId = "SR-" + Date.now();
        serviceRequests[ticketId] = {
          ticketId,
          customerId:   customer.customerId,
          customerName: customer.customerName,
          requestType:  args.requestType,
          status:       "OPEN",
          createdAt:    new Date().toISOString(),
        };

        return success({
          ticketId,
          requestType: args.requestType,
          status:      "OPEN",
          message:     `Service request '${args.requestType}' created. Use ticketId to track.`,
        });
      }

      /* ── track_service_request ──────────────────────────────────────────── */
      if (tool === "track_service_request") {
        if (!args.ticketId) return failure("ticketId is required.");
        const sr = serviceRequests[args.ticketId];
        if (!sr) return failure(`Ticket '${args.ticketId}' not found. Check the ticketId.`);
        return success(sr);
      }

      return failure(`Unknown tool: '${tool}'.`);

    } catch (err) {
      console.error(`[TOOL ERROR] ${tool}:`, err.message);
      return failure(err.message);
    }
  });

  return server;
}

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ TRANSPORT 1 — SSE  (Claude.ai)                                              │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
app.get("/sse", async (req, res) => {
  try {
    const server    = createServer();
    const transport = new SSEServerTransport("/messages", res);
    sseTransports[transport.sessionId] = transport;
    res.on("close", () => delete sseTransports[transport.sessionId]);
    await server.connect(transport);
  } catch (err) {
    console.error("[SSE ERROR]", err);
    if (!res.headersSent) res.status(500).send("SSE connection failed.");
  }
});

app.post("/messages", async (req, res) => {
  try {
    const transport = sseTransports[req.query.sessionId];
    if (!transport) {
      return res.status(400).json({ error: "No SSE session: " + req.query.sessionId });
    }
    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error("[SSE MSG ERROR]", err);
    if (!res.headersSent) res.status(500).send("Message error.");
  }
});

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ TRANSPORT 2 — Streamable HTTP  (ChatGPT / Marketplace)                     │
 │ FIX 2: sessionIdGenerator: null  = stateless mode                          │
 │ FIX 3: req.body passed to handleRequest                                    │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
app.post("/mcp", async (req, res) => {
  try {
    const server    = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: null });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body); // FIX 3
  } catch (err) {
    console.error("[MCP ERROR]", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get("/mcp",    (_req, res) => res.status(405).json({ error: "Use POST /mcp" }));
app.delete("/mcp", (_req, res) => res.status(405).json({ error: "Stateless — no session to delete." }));

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ DISCOVERY ENDPOINTS                                                         │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const BASE_URL = process.env.BASE_URL || "https://financial-mcp-poc.onrender.com";

app.get("/.well-known/mcp", (_req, res) => {
  res.json({
    mcp: {
      version: "2025-03-26",
      name:    "bajaj-finance-mcp-v7",
      transports: [
        { type: "http", url: `${BASE_URL}/mcp` },
        { type: "sse",  url: `${BASE_URL}/sse` },
      ],
    },
  });
});

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer:                                BASE_URL,
    authorization_endpoint:               `${BASE_URL}/oauth/authorize`,
    token_endpoint:                        `${BASE_URL}/oauth/token`,
    token_endpoint_auth_methods_supported: ["none"],
    grant_types_supported:                 ["authorization_code", "refresh_token"],
    code_challenge_methods_supported:      ["S256"],
    scopes_supported:                      ["loans:read", "sr:write", "profile:read"],
    response_types_supported:              ["code"],
  });
});

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ HEALTH + ROOT                                                               │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
app.get("/", (_req, res) =>
  res.send("Bajaj Finance MCP V7 — Dual Transport Ready")
);

app.get("/health", (_req, res) =>
  res.json({
    status:    "UP",
    version:   "7.0.0",
    name:      "bajaj-finance-mcp-v7",
    timestamp: new Date().toISOString(),
    tools: [
      "discover_loans", "get_loan_product_info",
      "send_otp", "get_customer_profile",
      "get_loan_details", "raise_service_request", "track_service_request",
    ],
    transports: {
      sse:            `${BASE_URL}/sse`,
      streamableHttp: `${BASE_URL}/mcp`,
    },
    discovery: {
      mcp:   `${BASE_URL}/.well-known/mcp`,
      oauth: `${BASE_URL}/.well-known/oauth-authorization-server`,
    },
  })
);

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ START                                                                       │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const PORT = process.env.PORT || 8080;
app.listen(PORT, () =>
  console.log(`[${new Date().toISOString()}] Bajaj Finance MCP V7 on port ${PORT}`)
);