const axios = require('axios');

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');

const {
  StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');

const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const server = new Server(
  {
    name: 'financial-service-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

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
      ],
    };

  }
);

server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {

    if (request.params.name === 'get_emi_details') {

      const response = await axios.get(
        'http://localhost:3000/emi-details'
      );

      const customer = response.data.data;

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

    throw new Error('Tool not found');

  }
);

async function main() {

  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error('Financial MCP Server Running');

}

main();