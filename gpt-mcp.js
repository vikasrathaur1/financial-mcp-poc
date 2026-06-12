"use strict";

/**
 * Bajaj Finance MCP Server — V7
 * ─────────────────────────────────────────────────────────────────────────────
 * Transport 1: SSE        GET  /sse       ← Claude.ai connector (legacy)
 *              SSE POST  POST /messages   ← SSE message endpoint
 * Transport 2: Streamable POST /mcp       ← ChatGPT / MCP Marketplace
 *
 * Fixes applied vs V6
 * ───────────────────
 * 1. express.json() middleware is ENABLED (was commented out — broke /mcp entirely)
 * 2. StreamableHTTPServerTransport created with { sessionIdGenerator: null }
 *    (stateless mode — required for GPT and marketplace)
 * 3. req.body passed explicitly to transport.handleRequest(req, res, req.body)
 * 4. /.well-known/mcp  discovery endpoint added (ChatGPT calls this on connect)
 * 5. /.well-known/oauth-authorization-server stub added (marketplace requirement)
 * 6. All tools now have:
 *      - title field               (Anthropic review requirement)
 *      - readOnlyHint annotation   (read tools)
 *      - destructiveHint annotation (write tools)
 *      - richer descriptions       (reviewer tests descriptions vs behaviour)
 * 7. Proper CORS headers added so browser-based MCP clients can connect
 * 8. Request body size limit raised to 1mb
 * 9. Port fallback corrected
 */

const express = require("express");
const crypto  = require("crypto");

const { Server }                       = require("@modelcontextprotocol/sdk/server/index.js");
const { SSEServerTransport }           = require("@modelcontextprotocol/sdk/server/sse.js");
const { StreamableHTTPServerTransport} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { ListToolsRequestSchema, CallToolRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const app = express();

// ─── FIX 1: body parsing MUST be enabled before any route handler ─────────────
app.use(express.json({ limit: "1mb" }));

// ─── CORS — allow any origin for the POC ─────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Request logger (useful on Render logs) ──────────────────────────────────
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
    customerId:       "CUST001",
    customerName:     "Vikas Singh Rathaur",
    loanType:         "Personal Loan",
    loanStatus:       "Active",
    agreementNumber:  "X402P34T9588444",
    loanAmount:       3739000,
    outstandingAmount:4203,
    roi:              11.25,
    balanceTenure:    83,
    nextEmiAmount:    132,
    nextEmiDate:      "2026-08-02",
    flexiEnabled:     true,
  },
  "8888888888": {
    customerId:       "CUST002",
    customerName:     "Rahul Sharma",
    loanType:         "Home Loan",
    loanStatus:       "Active",
    agreementNumber:  "HL99887766",
    loanAmount:       3500000,
    outstandingAmount:2450000,
    roi:              8.75,
    balanceTenure:    220,
    nextEmiAmount:    28500,
    nextEmiDate:      "2026-08-05",
    flexiEnabled:     false,
  },
};

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ SESSION STORE (in-memory for POC — replace with Redis in production)        │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const otpStore       = {};   // verificationId → { mobileNumber, otp, createdAt }
const sessions       = {};   // authToken      → { mobileNumber, createdAt }
const serviceRequests= {};   // ticketId       → serviceRequest object
const sseTransports  = {};   // sessionId      → SSEServerTransport

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ RESPONSE HELPERS                                                            │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
function success(data) {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, data }, null, 2) }],
  };
}

function failure(message) {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error: message }, null, 2) }],
    isError: true,
  };
}

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ AUTH HELPER                                                                 │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
function validateToken(authToken) {
  if (!authToken) throw new Error("authToken is required");
  const session = sessions[authToken];
  if (!session)  throw new Error("Invalid or expired session. Please authenticate again.");

  // OTP sessions expire after 30 minutes
  if (Date.now() - session.createdAt > 30 * 60 * 1000) {
    delete sessions[authToken];
    throw new Error("Session expired. Please authenticate again.");
  }

  const customer = customers[session.mobileNumber];
  if (!customer) throw new Error("Customer not found.");
  return customer;
}

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ MCP SERVER FACTORY                                                          │
 │ Called once per connection (SSE) or once per request (Streamable HTTP)     │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
function createServer() {

  const server = new Server(
    { name: "bajaj-finance-mcp-v7", version: "7.0.0" },
    { capabilities: { tools: {} } }
  );

  // ──────────────────────────────────────────────────────────────────────────
  // TOOL REGISTRATION
  // FIX 6: Every tool now has `title` + `annotations` (Anthropic requirement)
  // ──────────────────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [

      /* ── 1. start_customer_verification ─────────────────────────────────── */
      {
        name: "start_customer_verification",
        title: "Send OTP for verification",
        description:
          "Sends a one-time password (OTP) to the customer's registered mobile number " +
          "to begin identity verification. Returns a verificationId that must be passed " +
          "to verify_customer_otp. The OTP expires after 10 minutes.",
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

      /* ── 2. verify_customer_otp ──────────────────────────────────────────── */
      {
        name: "verify_customer_otp",
        title: "Verify OTP and create session",
        description:
          "Validates the OTP provided by the customer against the verificationId returned " +
          "by start_customer_verification. On success returns an authToken (valid 30 min) " +
          "that must be passed to all subsequent data-fetch tools.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            verificationId: {
              type: "string",
              description: "verificationId returned by start_customer_verification",
            },
            otp: {
              type: "string",
              description: "6-digit OTP received by the customer",
              pattern: "^[0-9]{6}$",
            },
          },
          required: ["verificationId", "otp"],
        },
      },

      /* ── 3. get_customer_context ─────────────────────────────────────────── */
      {
        name: "get_customer_context",
        title: "View customer profile",
        description:
          "Returns the authenticated customer's profile summary: customerId, full name, " +
          "count of active loans, list of active product types, and relationship status. " +
          "Requires a valid authToken from verify_customer_otp.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            authToken: {
              type: "string",
              description: "authToken returned by verify_customer_otp",
            },
          },
          required: ["authToken"],
        },
      },

      /* ── 4. get_loan_dashboard ───────────────────────────────────────────── */
      {
        name: "get_loan_dashboard",
        title: "View loan dashboard",
        description:
          "Returns the full loan dashboard for the authenticated customer: loan type, " +
          "status, agreement number, sanctioned amount, outstanding principal, rate of " +
          "interest, balance tenure (months), next EMI amount and date, and Flexi status. " +
          "Requires a valid authToken from verify_customer_otp.",
        annotations: { readOnlyHint: true },
        inputSchema: {
          type: "object",
          properties: {
            authToken: {
              type: "string",
              description: "authToken returned by verify_customer_otp",
            },
          },
          required: ["authToken"],
        },
      },

      /* ── 5. raise_service_request ───────────────────────────────────────── */
      {
        name: "raise_service_request",
        title: "Raise a service request",
        description:
          "Creates a new customer servicing request. Supported requestType values: " +
          "'NOC', 'Account Statement', 'Foreclosure Quote', 'EMI Dispute', " +
          "'Interest Certificate', 'Repayment Schedule'. Returns a ticketId for tracking. " +
          "Requires a valid authToken from verify_customer_otp.",
        annotations: { destructiveHint: true },
        inputSchema: {
          type: "object",
          properties: {
            authToken: {
              type: "string",
              description: "authToken returned by verify_customer_otp",
            },
            requestType: {
              type: "string",
              description:
                "Type of service request. One of: NOC, Account Statement, " +
                "Foreclosure Quote, EMI Dispute, Interest Certificate, Repayment Schedule",
              enum: [
                "NOC",
                "Account Statement",
                "Foreclosure Quote",
                "EMI Dispute",
                "Interest Certificate",
                "Repayment Schedule",
              ],
            },
          },
          required: ["authToken", "requestType"],
        },
      },

      /* ── 6. track_service_request ───────────────────────────────────────── */
      {
        name: "track_service_request",
        title: "Track a service request",
        description:
          "Returns the current status and details of a previously raised service request. " +
          "Requires the ticketId returned by raise_service_request. " +
          "Status values: OPEN, IN_PROGRESS, RESOLVED, CLOSED.",
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

  // ──────────────────────────────────────────────────────────────────────────
  // TOOL EXECUTION
  // ──────────────────────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = request.params.name;
    const args = request.params.arguments || {};

    try {

      /* ── start_customer_verification ─────────────────────────────────────── */
      if (tool === "start_customer_verification") {
        const { mobileNumber } = args;

        if (!mobileNumber || !/^[0-9]{10}$/.test(mobileNumber)) {
          return failure("mobileNumber must be a 10-digit number.");
        }
        if (!customers[mobileNumber]) {
          return failure(
            "Mobile number not found in Bajaj Finance records. " +
            "Please use your registered number."
          );
        }

        const verificationId = "VER-" + Date.now();
        otpStore[verificationId] = {
          mobileNumber,
          otp: "123456",           // demo fixed OTP — replace with real SMS gateway
          createdAt: Date.now(),
        };

        return success({
          verificationId,
          otpSent: true,
          message: "OTP sent to registered mobile number.",
          demoOtp: "123456",       // only for sandbox — remove in production
          expiresInMinutes: 10,
        });
      }

      /* ── verify_customer_otp ─────────────────────────────────────────────── */
      if (tool === "verify_customer_otp") {
        const { verificationId, otp } = args;

        if (!verificationId) return failure("verificationId is required.");
        if (!otp)            return failure("otp is required.");

        const record = otpStore[verificationId];
        if (!record) {
          return failure("Verification session not found or expired. Please request a new OTP.");
        }

        // OTP expires after 10 minutes
        if (Date.now() - record.createdAt > 10 * 60 * 1000) {
          delete otpStore[verificationId];
          return failure("OTP expired. Please request a new OTP.");
        }

        if (record.otp !== otp) {
          return failure("Invalid OTP. Please check and try again.");
        }

        const authToken = crypto.randomUUID();
        sessions[authToken] = {
          mobileNumber: record.mobileNumber,
          createdAt: Date.now(),
        };
        delete otpStore[verificationId];

        return success({
          authenticated: true,
          authToken,
          message: "Authentication successful. authToken valid for 30 minutes.",
          sessionExpiresInMinutes: 30,
        });
      }

      /* ── get_customer_context ────────────────────────────────────────────── */
      if (tool === "get_customer_context") {
        const customer = validateToken(args.authToken);
        return success({
          customerId:         customer.customerId,
          customerName:       customer.customerName,
          activeLoans:        1,
          activeProducts:     [customer.loanType],
          relationshipStatus: "ACTIVE",
        });
      }

      /* ── get_loan_dashboard ──────────────────────────────────────────────── */
      if (tool === "get_loan_dashboard") {
        const customer = validateToken(args.authToken);
        return success({
          customerName:     customer.customerName,
          loanType:         customer.loanType,
          loanStatus:       customer.loanStatus,
          agreementNumber:  customer.agreementNumber,
          loanAmountINR:    customer.loanAmount,
          outstandingINR:   customer.outstandingAmount,
          roiPercent:       customer.roi,
          balanceTenureMonths: customer.balanceTenure,
          nextEmiAmountINR: customer.nextEmiAmount,
          nextEmiDate:      customer.nextEmiDate,
          flexiEnabled:     customer.flexiEnabled,
        });
      }

      /* ── raise_service_request ───────────────────────────────────────────── */
      if (tool === "raise_service_request") {
        const customer = validateToken(args.authToken);
        const { requestType } = args;

        if (!requestType) return failure("requestType is required.");

        const ticketId = "SR-" + Date.now();
        serviceRequests[ticketId] = {
          ticketId,
          customerId:   customer.customerId,
          customerName: customer.customerName,
          requestType,
          status:       "OPEN",
          createdAt:    new Date().toISOString(),
          updatedAt:    new Date().toISOString(),
        };

        return success({
          ticketId,
          requestType,
          status:  "OPEN",
          message: `Service request '${requestType}' created successfully. Track using ticketId.`,
        });
      }

      /* ── track_service_request ───────────────────────────────────────────── */
      if (tool === "track_service_request") {
        const { ticketId } = args;
        if (!ticketId) return failure("ticketId is required.");

        const sr = serviceRequests[ticketId];
        if (!sr) {
          return failure(
            `Service request '${ticketId}' not found. ` +
            "Please check the ticketId and try again."
          );
        }
        return success(sr);
      }

      return failure(`Unknown tool: '${tool}'. Check the tool name and retry.`);

    } catch (error) {
      console.error(`[TOOL ERROR] ${tool}:`, error.message);
      return failure(error.message);
    }
  });

  return server;
}

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ TRANSPORT 1 — SSE  (Claude.ai / legacy clients)                             │
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
    const sessionId = req.query.sessionId;
    const transport = sseTransports[sessionId];

    if (!transport) {
      return res.status(400).json({ error: "No SSE session found for sessionId: " + sessionId });
    }

    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error("[SSE MESSAGE ERROR]", err);
    if (!res.headersSent) res.status(500).send("Message handling failed.");
  }
});

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ TRANSPORT 2 — Streamable HTTP  (ChatGPT / MCP Marketplace)                 │
 │ FIX 2: sessionIdGenerator: null  = stateless mode (required for GPT)       │
 │ FIX 3: req.body passed explicitly to handleRequest                         │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
app.post("/mcp", async (req, res) => {
  try {
    const server    = createServer();

    // FIX 2 — stateless mode required by ChatGPT and Anthropic marketplace
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: null,
    });

    await server.connect(transport);

    // FIX 3 — pass parsed body so the transport can read it
    await transport.handleRequest(req, res, req.body);

  } catch (err) {
    console.error("[MCP ERROR]", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ChatGPT also issues GET and DELETE on /mcp — return 405 with a clear message
app.get("/mcp", (_req, res) =>
  res.status(405).json({ error: "Use POST /mcp for MCP Streamable HTTP requests." })
);
app.delete("/mcp", (_req, res) =>
  res.status(405).json({ error: "Stateless mode: no session to delete." })
);

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ FIX 3 — DISCOVERY ENDPOINTS (marketplace requirement)                       │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
const BASE_URL = process.env.BASE_URL || "https://financial-mcp-poc.onrender.com";

// ChatGPT calls this on connect to confirm the MCP endpoint
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

// Anthropic marketplace calls this to discover OAuth endpoints
// (stub — build out the 4 OAuth endpoints for marketplace submission)
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer:                                BASE_URL,
    authorization_endpoint:               `${BASE_URL}/oauth/authorize`,
    token_endpoint:                        `${BASE_URL}/oauth/token`,
    token_endpoint_auth_methods_supported: ["none"],
    grant_types_supported:                 ["authorization_code", "refresh_token"],
    code_challenge_methods_supported:      ["S256"],
    scopes_supported:                      ["loans:read", "accounts:read", "sr:write", "profile:read"],
    response_types_supported:              ["code"],
  });
});

/*
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ HEALTH + ROOT                                                               │
 └─────────────────────────────────────────────────────────────────────────────┘
*/
app.get("/", (_req, res) =>
  res.send("Bajaj Finance MCP V7 — Dual Transport (SSE + Streamable HTTP)")
);

app.get("/health", (_req, res) =>
  res.json({
    status:    "UP",
    version:   "7.0.0",
    name:      "bajaj-finance-mcp-v7",
    timestamp: new Date().toISOString(),
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
  console.log(`[${new Date().toISOString()}] Bajaj Finance MCP V7 running on port ${PORT}`)
);