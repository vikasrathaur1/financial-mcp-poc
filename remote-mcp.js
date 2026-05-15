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
          name: 'get_noc_status',
          description: 'Fetch NOC status',
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
      ],
    };

  }
);

/*
|--------------------------------------------------------------------------
| CALL TOOL
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

      const customer = {
        customerName: 'Rahul Sharma',
        loanNumber: 'LN2026001',
        emiAmount: 14520,
        nextEmiDate: '5 June 2026',
        nocStatus: 'Available',
      };

      return {
        content: [
          {
            type: 'text',
            text:
`Customer Name: ${customer.customerName}
Loan Number: ${customer.loanNumber}
EMI Amount: ₹${customer.emiAmount}
Next EMI Date: ${customer.nextEmiDate}
NOC Status: ${customer.nocStatus}`,
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
`Your NOC status is: AVAILABLE

You can download your NOC after loan closure verification.`,
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
`Your current due amount is ₹0.

No pending dues found for your loan account.`,
          },
        ],
      };

    }

    throw new Error('Tool not found');

  }
);

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

  await server.connect(transport);

});

/*
|--------------------------------------------------------------------------
| MESSAGE ENDPOINT
|--------------------------------------------------------------------------
*/

app.post('/messages', async (req, res) => {

  res.sendStatus(200);

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