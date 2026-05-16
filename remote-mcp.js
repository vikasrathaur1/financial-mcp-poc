const express = require('express');

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');

const {
  SSEServerTransport,
} = require('@modelcontextprotocol/sdk/server/sse.js');

const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const app = express();

app.use(express.json());

/*
|--------------------------------------------------------------------------
| MCP SERVER
|--------------------------------------------------------------------------
*/

const server = new Server(
  {
    name: 'financial-remote-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/*
|--------------------------------------------------------------------------
| MOCK CUSTOMER DATA
|--------------------------------------------------------------------------
*/

const customer = {
  customerName: 'Rahul Sharma',
  customerId: 'CUST001',
  loanNumber: 'LN2026001',
  emiAmount: 14520,
  nextEmiDate: '5 June 2026',
  dueAmount: 0,
  nocStatus: 'Available',
};

/*
|--------------------------------------------------------------------------
| LIST TOOLS
|--------------------------------------------------------------------------
*/

server.setRequestHandler(
  ListToolsRequestSchema,
  async () => {

    return {
      tools: [
        {
          name: 'get_emi_details',
          description: 'Fetch customer EMI details',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },

        {
          name: 'get_due_amount',
          description: 'Fetch pending due amount',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },

        {
          name: 'get_noc_status',
          description: 'Fetch customer NOC status',
          inputSchema: {
            type: 'object',
            properties: {},
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

    /*
    ------------------------------------------------------------------------
    EMI DETAILS
    ------------------------------------------------------------------------
    */

    if (request.params.name === 'get_emi_details') {

      return {
        content: [
          {
            type: 'text',
            text:
`Customer Name: ${customer.customerName}

Customer ID: ${customer.customerId}

Loan Number: ${customer.loanNumber}

EMI Amount: ₹${customer.emiAmount}

Next EMI Date: ${customer.nextEmiDate}`,
          },
        ],
      };

    }

    /*
    ------------------------------------------------------------------------
    DUE AMOUNT
    ------------------------------------------------------------------------
    */

    if (request.params.name === 'get_due_amount') {

      return {
        content: [
          {
            type: 'text',
            text:
`Current Due Amount: ₹${customer.dueAmount}

No pending dues found for your account.`,
          },
        ],
      };

    }

    /*
    ------------------------------------------------------------------------
    NOC STATUS
    ------------------------------------------------------------------------
    */

    if (request.params.name === 'get_noc_status') {

      return {
        content: [
          {
            type: 'text',
            text:
`NOC Status: ${customer.nocStatus}

Your NOC is ready for download after loan closure verification.`,
          },
        ],
      };

    }

    throw new Error('Tool not found');

  }
);

/*
|--------------------------------------------------------------------------
| TRANSPORT STORAGE
|--------------------------------------------------------------------------
*/

const transports = {};

/*
|--------------------------------------------------------------------------
| SSE ENDPOINT
|--------------------------------------------------------------------------
*/

app.get('/sse', async (req, res) => {

  const transport = new SSEServerTransport(
    '/messages',
    res
  );

  transports[transport.sessionId] = transport;

  res.on('close', () => {

    delete transports[transport.sessionId];

  });

  await server.connect(transport);

});

/*
|--------------------------------------------------------------------------
| MESSAGE ENDPOINT
|--------------------------------------------------------------------------
*/

app.post('/messages', async (req, res) => {

  const sessionId = req.query.sessionId;

  const transport = transports[sessionId];

  if (!transport) {

    return res
      .status(400)
      .send('No transport found for session');

  }

  await transport.handlePostMessage(req, res);

});

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {

  res.send('Financial Remote MCP Running');

});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {

  console.log(
    `Financial Remote MCP running on port ${PORT}`
  );

});