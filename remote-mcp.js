const express = require('express');

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');

const {
  SSEServerTransport,
} = require('@modelcontextprotocol/sdk/server/sse.js');

const {
  StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const app = express();

app.use(express.json());

/*
|--------------------------------------------------------------------------
| CREATE MCP SERVER
|--------------------------------------------------------------------------
*/

function createServer() {

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
  --------------------------------------------------------------------------
  MOCK DATA
  --------------------------------------------------------------------------
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
  --------------------------------------------------------------------------
  LIST TOOLS
  --------------------------------------------------------------------------
  */

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {

      return {
        tools: [
          {
            name: 'get_emi_details',
            description: 'Fetch EMI details',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },

          {
            name: 'get_due_amount',
            description: 'Fetch due amount',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },

          {
            name: 'get_noc_status',
            description: 'Fetch NOC status',
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
  --------------------------------------------------------------------------
  TOOL EXECUTION
  --------------------------------------------------------------------------
  */

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {

      if (request.params.name === 'get_emi_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Customer Name: ${customer.customerName}

Loan Number: ${customer.loanNumber}

EMI Amount: ₹${customer.emiAmount}

Next EMI Date: ${customer.nextEmiDate}`,
            },
          ],
        };

      }

      if (request.params.name === 'get_due_amount') {

        return {
          content: [
            {
              type: 'text',
              text:
`Current Due Amount: ₹${customer.dueAmount}

No pending dues found.`,
            },
          ],
        };

      }

      if (request.params.name === 'get_noc_status') {

        return {
          content: [
            {
              type: 'text',
              text:
`NOC Status: ${customer.nocStatus}`,
            },
          ],
        };

      }

      throw new Error('Tool not found');

    }
  );

  return server;

}

/*
|--------------------------------------------------------------------------
| SSE TRANSPORT
|--------------------------------------------------------------------------
*/

const sseTransports = {};

app.get('/sse', async (req, res) => {

  try {

    const server = createServer();

    const transport = new SSEServerTransport(
      '/messages',
      res
    );

    sseTransports[transport.sessionId] = transport;

    res.on('close', () => {

      delete sseTransports[transport.sessionId];

    });

    await server.connect(transport);

  } catch (error) {

    console.error(error);

    res.status(500).send('SSE Error');

  }

});

/*
|--------------------------------------------------------------------------
| SSE MESSAGE ENDPOINT
|--------------------------------------------------------------------------
*/

app.post('/messages', async (req, res) => {

  try {

    const sessionId = req.query.sessionId;

    const transport = sseTransports[sessionId];

    if (!transport) {

      return res
        .status(400)
        .send('No transport found');

    }

    await transport.handlePostMessage(req, res);

  } catch (error) {

    console.error(error);

    res.status(500).send('Message Error');

  }

});

/*
|--------------------------------------------------------------------------
| STREAMABLE HTTP ENDPOINT
|--------------------------------------------------------------------------
*/

app.post('/sse', async (req, res) => {

  try {

    const server = createServer();

    const transport =
      new StreamableHTTPServerTransport();

    await server.connect(transport);

    await transport.handleRequest(
      req,
      res,
      req.body
    );

  } catch (error) {

    console.error(error);

    res.status(500).send('Streamable HTTP Error');

  }

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