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
      version: '2.0.0',
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

  const customerData = {
    loan: [
      {
        prodDesc: 'PERSONAL LOAN',

        customer_Name: 'Vikas Singh Rathaur',

        roi: 11.25,

        agreementNo: 'X402P34T9588444',

        disbDate: '27/03/2025',

        partnerName: null,

        flexiFlag: 'Y',

        totalOverDue: 0,

        pos: 4203,

        prodCategory: 'PERSONAL LOAN',

        relStatus: 'Active',

        prodId: 'PSPFL',

        missedEmi: 0,

        netTenure: 96,

        isMilesFlag: 'N',

        crmDealId: 'B2C000117643003',

        primaryCustomerId: null,

        relAmount: 3739000,

        opportunityId: null,

        nextEMIAmount: 132,

        amcCharges: '0',

        amountDrawnLimit: 3734797,

        sourceSysId: '2',

        applId: '1015709507',

        listofAgreementNos: null,

        closureDate: null,

        grossTenure: 96,

        balanceTenure: 83,

        nextEmiDate:
          '2026-08-02T00:00:00.0000000Z',

        loanExpiryDate: '02/04/2033',
      },
    ],
  };

  const loan = customerData.loan[0];

  /*
  |--------------------------------------------------------------------------
  | TOOL LIST
  |--------------------------------------------------------------------------
  */

  const tools = [

    {
      name: 'get_loan_details',
      description: 'Fetch complete loan details',
    },

    {
      name: 'get_emi_details',
      description: 'Fetch EMI details',
    },

    {
      name: 'get_due_amount',
      description: 'Fetch due amount',
    },

    {
      name: 'get_noc_status',
      description: 'Fetch NOC status',
    },

    {
      name: 'get_interest_rate',
      description: 'Fetch current interest rate',
    },

    {
      name: 'get_loan_status',
      description: 'Fetch loan relationship status',
    },

    {
      name: 'get_balance_tenure',
      description: 'Fetch remaining loan tenure',
    },

    {
      name: 'get_loan_amount',
      description: 'Fetch total sanctioned loan amount',
    },

    {
      name: 'get_pos_amount',
      description: 'Fetch principal outstanding amount',
    },

    {
      name: 'get_disbursement_details',
      description: 'Fetch disbursement information',
    },

    {
      name: 'get_loan_expiry',
      description: 'Fetch loan expiry date',
    },

    {
      name: 'get_flexi_details',
      description: 'Fetch flexi loan details',
    },

    {
      name: 'get_overdue_details',
      description: 'Fetch overdue information',
    },

    {
      name: 'get_customer_profile',
      description: 'Fetch customer profile',
    },

    {
      name: 'get_agreement_details',
      description: 'Fetch agreement details',
    },

    {
      name: 'get_product_details',
      description: 'Fetch product details',
    },

    {
      name: 'get_loan_summary',
      description: 'Fetch summarized loan information',
    },

    {
      name: 'check_loan_closure_eligibility',
      description: 'Check whether loan is eligible for closure',
    },

    {
      name: 'get_foreclosure_status',
      description: 'Fetch foreclosure eligibility',
    },

    {
      name: 'get_amc_charges',
      description: 'Fetch AMC charges',
    },

  ];

  /*
  |--------------------------------------------------------------------------
  | LIST TOOLS HANDLER
  |--------------------------------------------------------------------------
  */

  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => {

      return {
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,

          inputSchema: {
            type: 'object',
            properties: {},
          },
        })),
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

      const tool = request.params.name;

      /*
      ----------------------------------------------------------------------
      LOAN DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Customer Name: ${loan.customer_Name}

Product: ${loan.prodDesc}

Agreement Number: ${loan.agreementNo}

Loan Amount: ₹${loan.relAmount}

Interest Rate: ${loan.roi}%

Loan Status: ${loan.relStatus}

Balance Tenure: ${loan.balanceTenure} months`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      EMI DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_emi_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Next EMI Amount: ₹${loan.nextEMIAmount}

Next EMI Date: ${loan.nextEmiDate}

Missed EMI Count: ${loan.missedEmi}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      DUE AMOUNT
      ----------------------------------------------------------------------
      */

      if (tool === 'get_due_amount') {

        return {
          content: [
            {
              type: 'text',
              text:
`Current Due Amount: ₹${loan.totalOverDue}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      NOC STATUS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_noc_status') {

        return {
          content: [
            {
              type: 'text',
              text:
loan.relStatus === 'Closed'
  ? 'NOC Available'
  : 'Loan is Active. NOC not available yet.',
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      INTEREST RATE
      ----------------------------------------------------------------------
      */

      if (tool === 'get_interest_rate') {

        return {
          content: [
            {
              type: 'text',
              text:
`Current ROI for your loan is ${loan.roi}%`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      LOAN STATUS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_status') {

        return {
          content: [
            {
              type: 'text',
              text:
`Your loan status is ${loan.relStatus}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      BALANCE TENURE
      ----------------------------------------------------------------------
      */

      if (tool === 'get_balance_tenure') {

        return {
          content: [
            {
              type: 'text',
              text:
`Remaining tenure is ${loan.balanceTenure} months`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      LOAN AMOUNT
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_amount') {

        return {
          content: [
            {
              type: 'text',
              text:
`Total sanctioned amount is ₹${loan.relAmount}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      POS AMOUNT
      ----------------------------------------------------------------------
      */

      if (tool === 'get_pos_amount') {

        return {
          content: [
            {
              type: 'text',
              text:
`Principal Outstanding Amount is ₹${loan.pos}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      DISBURSEMENT DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_disbursement_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Loan was disbursed on ${loan.disbDate}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      LOAN EXPIRY
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_expiry') {

        return {
          content: [
            {
              type: 'text',
              text:
`Loan expiry date is ${loan.loanExpiryDate}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      FLEXI DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_flexi_details') {

        return {
          content: [
            {
              type: 'text',
              text:
loan.flexiFlag === 'Y'
  ? 'Flexi facility is enabled'
  : 'Flexi facility is not enabled',
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      OVERDUE DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_overdue_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Total overdue amount is ₹${loan.totalOverDue}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      CUSTOMER PROFILE
      ----------------------------------------------------------------------
      */

      if (tool === 'get_customer_profile') {

        return {
          content: [
            {
              type: 'text',
              text:
`Customer Name: ${loan.customer_Name}

CRM Deal ID: ${loan.crmDealId}

Application ID: ${loan.applId}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      AGREEMENT DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_agreement_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Agreement Number: ${loan.agreementNo}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      PRODUCT DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_product_details') {

        return {
          content: [
            {
              type: 'text',
              text:
`Product Category: ${loan.prodCategory}

Product ID: ${loan.prodId}`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      LOAN SUMMARY
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_summary') {

        return {
          content: [
            {
              type: 'text',
              text:
`Loan Summary

Customer: ${loan.customer_Name}
Loan Type: ${loan.prodDesc}
Status: ${loan.relStatus}
ROI: ${loan.roi}%
Balance Tenure: ${loan.balanceTenure} months`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      LOAN CLOSURE ELIGIBILITY
      ----------------------------------------------------------------------
      */

      if (
        tool ===
        'check_loan_closure_eligibility'
      ) {

        return {
          content: [
            {
              type: 'text',
              text:
loan.totalOverDue === 0
  ? 'Loan is eligible for closure request'
  : 'Please clear overdue amount before closure',
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      FORECLOSURE STATUS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_foreclosure_status') {

        return {
          content: [
            {
              type: 'text',
              text:
`Foreclosure is available for this loan`,
            },
          ],
        };

      }

      /*
      ----------------------------------------------------------------------
      AMC CHARGES
      ----------------------------------------------------------------------
      */

      if (tool === 'get_amc_charges') {

        return {
          content: [
            {
              type: 'text',
              text:
`AMC Charges: ₹${loan.amcCharges}`,
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

    sseTransports[transport.sessionId] =
      transport;

    res.on('close', () => {

      delete sseTransports[
        transport.sessionId
      ];

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

    const transport =
      sseTransports[sessionId];

    if (!transport) {

      return res
        .status(400)
        .send('No transport found');

    }

    await transport.handlePostMessage(
      req,
      res
    );

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

    res
      .status(500)
      .send('Streamable HTTP Error');

  }

});

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {

  res.send(
    'Financial Remote MCP Running'
  );

});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT =
  process.env.PORT || 8080;

app.listen(PORT, () => {

  console.log(
    `Financial Remote MCP running on port ${PORT}`
  );

});