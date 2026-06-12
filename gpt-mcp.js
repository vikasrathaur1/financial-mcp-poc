const express = require("express");
const crypto = require("crypto");

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");

const {
  SSEServerTransport,
} = require("@modelcontextprotocol/sdk/server/sse.js");

const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const app = express();

app.use(express.json());

/*
|--------------------------------------------------------------------------
| DEMO CUSTOMER DATA
|--------------------------------------------------------------------------
*/

const customers = {
  "9999999999": {
    customerId: "CUST001",
    customerName: "Vikas Singh Rathaur",
    loanType: "Personal Loan",
    loanStatus: "Active",
    agreementNumber: "X402P34T9588444",
    loanAmount: 3739000,
    outstandingAmount: 4203,
    roi: 11.25,
    balanceTenure: 83,
    nextEmiAmount: 132,
    nextEmiDate: "2026-08-02",
    flexiEnabled: true,
  },

  "8888888888": {
    customerId: "CUST002",
    customerName: "Rahul Sharma",
    loanType: "Home Loan",
    loanStatus: "Active",
    agreementNumber: "HL99887766",
    loanAmount: 3500000,
    outstandingAmount: 2450000,
    roi: 8.75,
    balanceTenure: 220,
    nextEmiAmount: 28500,
    nextEmiDate: "2026-08-05",
    flexiEnabled: false,
  },
};

/*
|--------------------------------------------------------------------------
| SESSION STORE
|--------------------------------------------------------------------------
*/

const otpStore = {};
const sessions = {};
const serviceRequests = {};
const sseTransports = {};

/*
|--------------------------------------------------------------------------
| RESPONSE HELPERS
|--------------------------------------------------------------------------
*/

function success(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            data,
          },
          null,
          2
        ),
      },
    ],
  };
}

function failure(message) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: false,
            error: message,
          },
          null,
          2
        ),
      },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| AUTH HELPER
|--------------------------------------------------------------------------
*/

function validateToken(authToken) {
  const session = sessions[authToken];

  if (!session) {
    throw new Error("Authentication required");
  }

  const customer =
    customers[session.mobileNumber];

  if (!customer) {
    throw new Error("Customer not found");
  }

  return customer;
}

/*
|--------------------------------------------------------------------------
| MCP SERVER
|--------------------------------------------------------------------------
*/

function createServer() {

  const server = new Server(
    {
      name: "bajaj-finance-mcp-v6",
      version: "6.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /*
  |--------------------------------------------------------------------------
  | TOOL REGISTRATION
  |--------------------------------------------------------------------------
  */

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {

      return {
        tools: [

          {
            name: "start_customer_verification",
            description:
              "Send OTP to customer registered mobile number",

            inputSchema: {
              type: "object",

              properties: {
                mobileNumber: {
                  type: "string",
                  description:
                    "Registered mobile number",
                },
              },

              required: [
                "mobileNumber",
              ],
            },
          },

          {
            name: "verify_customer_otp",

            description:
              "Verify OTP and generate auth token",

            inputSchema: {
              type: "object",

              properties: {
                verificationId: {
                  type: "string",
                },

                otp: {
                  type: "string",
                },
              },

              required: [
                "verificationId",
                "otp",
              ],
            },
          },

          {
            name: "get_customer_context",

            description:
              "Get customer profile, active products and relationship summary",

            inputSchema: {
              type: "object",

              properties: {
                authToken: {
                  type: "string",
                },
              },

              required: [
                "authToken",
              ],
            },
          },

          {
            name: "get_loan_dashboard",

            description:
              "Get complete loan dashboard including status, amount, tenure, ROI and EMI details",

            inputSchema: {
              type: "object",

              properties: {
                authToken: {
                  type: "string",
                },
              },

              required: [
                "authToken",
              ],
            },
          },

          {
            name: "raise_service_request",

            description:
              "Raise customer servicing request like NOC, Statement, Foreclosure, EMI related issue",

            inputSchema: {
              type: "object",

              properties: {

                authToken: {
                  type: "string",
                },

                requestType: {
                  type: "string",
                },

              },

              required: [
                "authToken",
                "requestType",
              ],
            },
          },

          {
            name: "track_service_request",

            description:
              "Track previously raised service request",

            inputSchema: {
              type: "object",

              properties: {

                ticketId: {
                  type: "string",
                },

              },

              required: [
                "ticketId",
              ],
            },
          },

        ],
      };
    }
  );
    /*
  |--------------------------------------------------------------------------
  | TOOL EXECUTION
  |--------------------------------------------------------------------------
  */

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {

      const tool =
        request.params.name;

      const args =
        request.params.arguments || {};

      try {

        /*
        ------------------------------------------------------------
        START VERIFICATION
        ------------------------------------------------------------
        */

        if (
          tool ===
          "start_customer_verification"
        ) {

          const mobileNumber =
            args.mobileNumber;

          if (
            !customers[mobileNumber]
          ) {
            return failure(
              "Customer not found"
            );
          }

          const verificationId =
            "VER-" + Date.now();

          otpStore[
            verificationId
          ] = {
            mobileNumber,
            otp: "123456",
            createdAt:
              Date.now(),
          };

          return success({
            verificationId,
            otpSent: true,

            demoOtp:
              "123456",

            message:
              "OTP sent successfully",
          });
        }

        /*
        ------------------------------------------------------------
        VERIFY OTP
        ------------------------------------------------------------
        */

        if (
          tool ===
          "verify_customer_otp"
        ) {

          const {
            verificationId,
            otp,
          } = args;

          const record =
            otpStore[
              verificationId
            ];

          if (!record) {
            return failure(
              "Verification expired"
            );
          }

          if (
            record.otp !== otp
          ) {
            return failure(
              "Invalid OTP"
            );
          }

          const authToken =
            crypto.randomUUID();

          sessions[
            authToken
          ] = {
            mobileNumber:
              record.mobileNumber,

            createdAt:
              Date.now(),
          };

          delete otpStore[
            verificationId
          ];

          return success({
            authenticated:
              true,

            authToken,

            message:
              "Authentication successful",
          });
        }

        /*
        ------------------------------------------------------------
        CUSTOMER CONTEXT
        ------------------------------------------------------------
        */

        if (
          tool ===
          "get_customer_context"
        ) {

          const customer =
            validateToken(
              args.authToken
            );

          return success({
            customerId:
              customer.customerId,

            customerName:
              customer.customerName,

            activeLoans: 1,

            activeProducts: [
              customer.loanType,
            ],

            relationshipStatus:
              "ACTIVE",
          });
        }

        /*
        ------------------------------------------------------------
        LOAN DASHBOARD
        ------------------------------------------------------------
        */

        if (
          tool ===
          "get_loan_dashboard"
        ) {

          const customer =
            validateToken(
              args.authToken
            );

          return success({

            customerName:
              customer.customerName,

            loanType:
              customer.loanType,

            loanStatus:
              customer.loanStatus,

            agreementNumber:
              customer.agreementNumber,

            loanAmount:
              customer.loanAmount,

            outstandingAmount:
              customer.outstandingAmount,

            roi:
              customer.roi,

            balanceTenure:
              customer.balanceTenure,

            nextEmiAmount:
              customer.nextEmiAmount,

            nextEmiDate:
              customer.nextEmiDate,

            flexiEnabled:
              customer.flexiEnabled,

          });
        }

        /*
        ------------------------------------------------------------
        RAISE SERVICE REQUEST
        ------------------------------------------------------------
        */

        if (
          tool ===
          "raise_service_request"
        ) {

          const customer =
            validateToken(
              args.authToken
            );

          const ticketId =
            "SR-" +
            Date.now();

          serviceRequests[
            ticketId
          ] = {

            ticketId,

            customerId:
              customer.customerId,

            customerName:
              customer.customerName,

            requestType:
              args.requestType,

            status:
              "OPEN",

            createdAt:
              new Date()
                .toISOString(),
          };

          return success({
            ticketId,

            requestType:
              args.requestType,

            status:
              "OPEN",

            message:
              "Service request created successfully",
          });
        }

        /*
        ------------------------------------------------------------
        TRACK SERVICE REQUEST
        ------------------------------------------------------------
        */

        if (
          tool ===
          "track_service_request"
        ) {

          const sr =
            serviceRequests[
              args.ticketId
            ];

          if (!sr) {
            return failure(
              "Service request not found"
            );
          }

          return success(sr);
        }

        /*
        ------------------------------------------------------------
        TOOL NOT FOUND
        ------------------------------------------------------------
        */

        return failure(
          "Tool not found"
        );

      } catch (error) {

        return failure(
          error.message
        );

      }
    }
  );

  return server;

}
/*
|--------------------------------------------------------------------------
| SSE TRANSPORT
|--------------------------------------------------------------------------
*/

app.get("/sse", async (req, res) => {

  try {

    const server = createServer();

    const transport =
      new SSEServerTransport(
        "/messages",
        res
      );

    sseTransports[
      transport.sessionId
    ] = transport;

    res.on(
      "close",
      () => {

        delete sseTransports[
          transport.sessionId
        ];

      }
    );

    await server.connect(
      transport
    );

  } catch (error) {

    console.error(error);

    res
      .status(500)
      .send("SSE Error");

  }

});

/*
|--------------------------------------------------------------------------
| SSE MESSAGE ENDPOINT
|--------------------------------------------------------------------------
*/

app.post(
  "/messages",
  async (req, res) => {

    try {

      const sessionId =
        req.query.sessionId;

      const transport =
        sseTransports[
          sessionId
        ];

      if (!transport) {

        return res
          .status(400)
          .send(
            "No transport found"
          );

      }

      await transport
        .handlePostMessage(
          req,
          res
        );

    } catch (error) {

      console.error(error);

      res
        .status(500)
        .send(
          "Message Error"
        );

    }

  }
);

/*
|--------------------------------------------------------------------------
| STREAMABLE HTTP ENDPOINT
|--------------------------------------------------------------------------
*/

app.post(
  "/mcp",
  async (req, res) => {

    try {

      const server =
        createServer();

      const transport =
        new StreamableHTTPServerTransport();

      await server.connect(
        transport
      );

      await transport
        .handleRequest(
          req,
          res,
          req.body
        );

    } catch (error) {

      console.error(error);

      res
        .status(500)
        .send(
          "MCP Error"
        );

    }

  }
);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get(
  "/",
  (req, res) => {

    res.send(
      "Financial MCP V6 Marketplace Ready"
    );

  }
);

/*
|--------------------------------------------------------------------------
| MCP INFO
|--------------------------------------------------------------------------
*/

app.get(
  "/health",
  (req, res) => {

    res.json({
      status: "UP",
      version: "6.0.0",
      name:
        "bajaj-finance-mcp-v6",
      timestamp:
        new Date()
          .toISOString(),
    });

  }
);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT =
  process.env.PORT ||
  8080;

app.listen(
  PORT,
  () => {

    console.log(
      `Financial MCP V6 running on port ${PORT}`
    );

  }
);