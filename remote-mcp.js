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
| GLOBAL CUSTOMER DATA
|--------------------------------------------------------------------------
*/

const customers = {

  "9999999999": {
    customer_Name: 'Vikas Singh Rathaur',
    prodDesc: 'PERSONAL LOAN',
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
    nextEmiDate: '2026-08-02T00:00:00.0000000Z',
    loanExpiryDate: '02/04/2033',
  },

  "8888888888": {
    customer_Name: 'Rahul Sharma',
    prodDesc: 'HOME LOAN',
    roi: 8.75,
    agreementNo: 'HL99887766',
    disbDate: '15/01/2024',
    partnerName: null,
    flexiFlag: 'N',
    totalOverDue: 2500,
    pos: 2450000,
    prodCategory: 'HOME LOAN',
    relStatus: 'Active',
    prodId: 'HL001',
    missedEmi: 1,
    netTenure: 240,
    isMilesFlag: 'N',
    crmDealId: 'B2C000117643999',
    primaryCustomerId: null,
    relAmount: 3500000,
    opportunityId: null,
    nextEMIAmount: 28500,
    amcCharges: '999',
    amountDrawnLimit: 3500000,
    sourceSysId: '2',
    applId: '1015709999',
    listofAgreementNos: null,
    closureDate: null,
    grossTenure: 240,
    balanceTenure: 220,
    nextEmiDate: '2026-08-05T00:00:00.0000000Z',
    loanExpiryDate: '15/01/2044',
  },

};

/*
|--------------------------------------------------------------------------
| GLOBAL VERIFIED USERS
|--------------------------------------------------------------------------
*/

const verifiedUsers = {};

/*
|--------------------------------------------------------------------------
| LOAN DISCOVERY CATALOGUE
| Source: https://www.bajajfinserv.in/loans
|--------------------------------------------------------------------------
*/

const LOAN_CATALOGUE = {

  personal_loan: {
    name: 'Personal Loan',
    amount: 'Up to ₹40 lakh',
    tenure: '12 to 96 months',
    interest_rate: 'Starting from 11% p.a.',
    processing_fee: 'Up to 3.93% of loan amount',
    collateral_needed: false,
    best_for: ['personal', 'medical', 'wedding', 'education', 'travel', 'renovation', 'emergency'],
    key_features: [
      'No collateral required',
      '100% online process',
      'Instant approval for pre-approved customers',
      'Flexi Loan option – pay interest only on amount used',
      'Part-prepayment allowed',
    ],
    eligibility: 'Salaried individuals aged 21–67 years, min monthly salary ₹25,001',
    apply_url: 'https://www.bajajfinserv.in/personal-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer?category=Personal%20Loan',
    emi_calculator_url: 'https://www.bajajfinserv.in/personal-loan-emi-calculator',
  },

  insta_personal_loan: {
    name: 'Insta Personal Loan (Pre-approved)',
    amount: 'Up to ₹12 lakh',
    tenure: 'Up to 60 months',
    interest_rate: 'Starting from 11% p.a.',
    processing_fee: 'Up to 2% of loan amount',
    collateral_needed: false,
    best_for: ['urgent', 'quick', 'existing customer', 'pre-approved'],
    key_features: [
      'Pre-approved offer – zero fresh documentation',
      'Disbursal within minutes',
      'Only for existing Bajaj Finance customers',
      'End-to-end digital',
    ],
    eligibility: 'Existing Bajaj Finance customers with a pre-approved offer',
    apply_url: 'https://www.bajajfinserv.in/insta-personal-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer?category=Personal%20Loan',
    emi_calculator_url: 'https://www.bajajfinserv.in/insta-personal-loan-emi-calculator',
  },

  home_loan: {
    name: 'Home Loan',
    amount: 'Up to ₹15 crore',
    tenure: 'Up to 32 years',
    interest_rate: 'Starting from 8.50% p.a.',
    processing_fee: 'Up to 0.35% of loan amount (min ₹2,999)',
    collateral_needed: false,
    best_for: ['home purchase', 'home construction', 'buy house', 'ghar'],
    key_features: [
      'Covers purchase, construction, extension, and improvement',
      'Balance transfer facility available',
      'Top-up loan available',
      'Online account management',
    ],
    eligibility: 'Salaried & self-employed individuals aged 23–75 years',
    apply_url: 'https://www.bajajfinserv.in/home-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer?category=Home%20Loan',
    emi_calculator_url: 'https://www.bajajfinserv.in/home-loan-emi-calculator',
  },

  home_loan_balance_transfer: {
    name: 'Home Loan Balance Transfer',
    amount: 'Up to ₹15 crore',
    tenure: 'Up to 32 years',
    interest_rate: 'Starting from 8.50% p.a.',
    processing_fee: 'Up to 0.35% of loan amount',
    collateral_needed: false,
    best_for: ['home loan transfer', 'reduce EMI', 'balance transfer'],
    key_features: [
      'Transfer existing home loan to Bajaj Finance',
      'Lower EMIs with better rates',
      'Top-up loan available on transfer',
    ],
    eligibility: 'Existing home loan borrowers with 12+ EMIs paid',
    apply_url: 'https://www.bajajfinserv.in/home-loan-balance-transfer',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer?category=Home%20Loan',
    emi_calculator_url: 'https://www.bajajfinserv.in/home-loan-emi-calculator',
  },

  loan_against_property: {
    name: 'Loan Against Property',
    amount: 'Up to ₹10.50 crore',
    tenure: 'Up to 15 years',
    interest_rate: 'Starting from 9.75% p.a.',
    processing_fee: 'Up to 1.50% of loan amount',
    collateral_needed: true,
    best_for: ['business', 'large amount', 'property collateral', 'expansion'],
    key_features: [
      'Residential or commercial property accepted',
      'Retain ownership of your property',
      'Balance transfer facility',
      'Flexi Loan facility available',
    ],
    eligibility: 'Salaried & self-employed individuals owning residential or commercial property',
    apply_url: 'https://www.bajajfinserv.in/loan-against-property',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: 'https://www.bajajfinserv.in/loan-against-property-emi-calculator',
  },

  business_loan: {
    name: 'Business Loan',
    amount: 'Up to ₹80 lakh',
    tenure: '12 to 96 months',
    interest_rate: 'Starting from 14% p.a.',
    processing_fee: 'Up to 3.54% of loan amount',
    collateral_needed: false,
    best_for: ['business', 'working capital', 'expansion', 'sme', 'self-employed'],
    key_features: [
      'No collateral required',
      'Quick disbursal for SMEs',
      'Flexi Loan – withdraw as needed',
      'Online application',
    ],
    eligibility: 'Self-employed/business owners aged 24–70 years, business vintage 3+ years',
    apply_url: 'https://www.bajajfinserv.in/business-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: 'https://www.bajajfinserv.in/business-loan-emi-calculator',
  },

  loan_for_doctors: {
    name: 'Loan for Doctors',
    amount: 'Up to ₹55 lakh',
    tenure: 'Up to 96 months',
    interest_rate: 'Starting from 11% p.a.',
    processing_fee: 'Up to 2% of loan amount',
    collateral_needed: false,
    best_for: ['doctor', 'medical professional', 'clinic setup', 'equipment purchase'],
    key_features: [
      'Designed specifically for medical professionals',
      'No collateral needed',
      'Covers clinic setup, equipment purchase, expansion',
    ],
    eligibility: 'MBBS / BDS / MDS / MD / MS qualified doctors in active practice',
    apply_url: 'https://www.bajajfinserv.in/doctor-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: 'https://www.bajajfinserv.in/doctor-loan-emi-calculator',
  },

  loan_for_ca: {
    name: 'Loan for Chartered Accountants',
    amount: 'Up to ₹55 lakh',
    tenure: 'Up to 96 months',
    interest_rate: 'Starting from 11% p.a.',
    processing_fee: 'Up to 2% of loan amount',
    collateral_needed: false,
    best_for: ['ca', 'chartered accountant', 'professional loan', 'office setup'],
    key_features: [
      'Tailored for practising and employed CAs',
      'No collateral required',
      'Office setup, expansion, or personal needs',
    ],
    eligibility: 'Practising or employed Chartered Accountants with ICAI membership',
    apply_url: 'https://www.bajajfinserv.in/ca-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: 'https://www.bajajfinserv.in/ca-loan-emi-calculator',
  },

  gold_loan: {
    name: 'Gold Loan',
    amount: '₹5,000 to ₹2 crore',
    tenure: '1 month to 24 months',
    interest_rate: 'Starting from 9.50% p.a.',
    processing_fee: 'Up to 0.15% of loan amount',
    collateral_needed: true,
    best_for: ['urgent', 'short term', 'gold jewellery', 'sona'],
    key_features: [
      'Loan against gold jewellery / ornaments',
      'Same-day disbursal',
      'Gold stored safely in secure vault',
      'Multiple repayment options',
    ],
    eligibility: 'Indian residents aged 21+ years with gold ornaments (18–22 karat)',
    apply_url: 'https://www.bajajfinserv.in/gold-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: 'https://www.bajajfinserv.in/gold-loan-emi-calculator',
  },

  loan_against_fd: {
    name: 'Loan Against Fixed Deposit',
    amount: 'Up to 75% of FD value',
    tenure: 'Linked to FD maturity',
    interest_rate: '2% above your FD interest rate',
    processing_fee: 'Nil',
    collateral_needed: true,
    best_for: ['fd holder', 'fixed deposit', 'low interest', 'no credit check'],
    key_features: [
      'No credit score check required',
      'FD continues to earn interest',
      'Instant – no fresh documentation',
      'Overdraft facility available',
    ],
    eligibility: 'Bajaj Finance FD holders only',
    apply_url: 'https://www.bajajfinserv.in/loan-against-fd',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: null,
  },

  loan_against_shares: {
    name: 'Loan Against Shares / Securities',
    amount: 'Up to ₹10 crore',
    tenure: '12 months (revolving)',
    interest_rate: 'Starting from 10.50% p.a.',
    processing_fee: 'Up to 0.50% of loan amount',
    collateral_needed: true,
    best_for: ['investor', 'shares', 'mutual funds', 'securities', 'demat'],
    key_features: [
      'Pledge listed shares and mutual funds',
      'Pay interest only on amount used',
      'Shares remain in your demat account',
    ],
    eligibility: 'Resident Indians holding eligible listed securities in demat form',
    apply_url: 'https://www.bajajfinserv.in/loan-against-securities',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: null,
  },

  two_wheeler_loan: {
    name: 'Two-Wheeler Loan',
    amount: 'Up to 100% on-road price',
    tenure: 'Up to 48 months',
    interest_rate: 'Starting from 6.99% p.a.',
    processing_fee: 'Up to ₹2,500',
    collateral_needed: false,
    best_for: ['bike', 'scooter', 'two wheeler', 'motorcycle', 'gaadi'],
    key_features: [
      'Finance for new bikes and scooters',
      'Bajaj, Honda, Hero, TVS, Royal Enfield supported',
      'Instant approval at dealer',
    ],
    eligibility: 'Salaried/self-employed individuals aged 18–65 years',
    apply_url: 'https://www.bajajfinserv.in/two-wheeler-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: 'https://www.bajajfinserv.in/two-wheeler-loan-emi-calculator',
  },

  used_car_loan: {
    name: 'Pre-owned Car Finance',
    amount: 'Up to ₹50 lakh',
    tenure: 'Up to 60 months',
    interest_rate: 'Starting from 13% p.a.',
    processing_fee: 'Up to 3% of loan amount',
    collateral_needed: false,
    best_for: ['used car', 'second hand car', 'purani car', 'pre-owned car'],
    key_features: [
      'Finance for used / pre-owned cars up to 10 years old',
      'Quick approval and disbursal',
      'Minimal documentation',
    ],
    eligibility: 'Salaried/self-employed individuals aged 21–65 years',
    apply_url: 'https://www.bajajfinserv.in/used-car-loan',
    check_offer_url: 'https://www.bajajfinserv.in/webform/v1/offersModulenew/offer',
    emi_calculator_url: null,
  },

};

/*
|--------------------------------------------------------------------------
| CREATE MCP SERVER
|--------------------------------------------------------------------------
*/

function createServer() {

  const server = new Server(
    {
      name: 'financial-remote-mcp',
      version: '5.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /*
  |--------------------------------------------------------------------------
  | TOOL LIST
  |--------------------------------------------------------------------------
  */

  const existingTools = [
    { name: 'send_otp',                     description: 'Send OTP to registered mobile number' },
    { name: 'verify_otp',                   description: 'Verify OTP for customer authentication' },
    { name: 'get_loan_details',             description: 'Fetch complete loan details' },
    { name: 'get_emi_details',              description: 'Fetch EMI details' },
    { name: 'get_due_amount',               description: 'Fetch due amount' },
    { name: 'get_noc_status',               description: 'Fetch NOC status' },
    { name: 'get_interest_rate',            description: 'Fetch current interest rate' },
    { name: 'get_loan_status',              description: 'Fetch loan relationship status' },
    { name: 'get_balance_tenure',           description: 'Fetch remaining loan tenure' },
    { name: 'get_loan_amount',              description: 'Fetch total sanctioned loan amount' },
    { name: 'get_pos_amount',               description: 'Fetch principal outstanding amount' },
    { name: 'get_disbursement_details',     description: 'Fetch disbursement information' },
    { name: 'get_loan_expiry',              description: 'Fetch loan expiry date' },
    { name: 'get_flexi_details',            description: 'Fetch flexi loan details' },
    { name: 'get_overdue_details',          description: 'Fetch overdue information' },
    { name: 'get_customer_profile',         description: 'Fetch customer profile' },
    { name: 'get_agreement_details',        description: 'Fetch agreement details' },
    { name: 'get_product_details',          description: 'Fetch product details' },
    { name: 'get_loan_summary',             description: 'Fetch summarized loan information' },
    { name: 'check_loan_closure_eligibility', description: 'Check loan closure eligibility' },
    { name: 'get_foreclosure_status',       description: 'Fetch foreclosure eligibility' },
    { name: 'get_amc_charges',              description: 'Fetch AMC charges' },
  ];

  /*
  |--------------------------------------------------------------------------
  | NEW: LOAN DISCOVERY TOOLS (no OTP needed — public product info)
  |--------------------------------------------------------------------------
  */

  const discoveryTools = [

    {
      name: 'discover_loans',
      description:
        'Help a prospective customer discover the right Bajaj Finance loan product. ' +
        'Accepts purpose, employment type, and collateral. Returns top matching products with apply URLs. ' +
        'NO OTP or mobile number required — this is public product information.',
      inputSchema: {
        type: 'object',
        properties: {
          purpose: {
            type: 'string',
            description:
              'Why does the customer need a loan? e.g. personal need, home purchase, home renovation, ' +
              'business, two-wheeler, gold, medical emergency, education, wedding',
          },
          employment_type: {
            type: 'string',
            enum: ['salaried', 'self_employed', 'business_owner', 'doctor', 'ca', 'unknown'],
            description: "Customer employment or profession type",
          },
          has_collateral: {
            type: 'string',
            enum: ['yes_property', 'yes_gold', 'yes_fd', 'yes_shares', 'no', 'unknown'],
            description: 'Does the customer have any collateral to offer?',
          },
        },
        required: [],
      },
    },

    {
      name: 'get_loan_product_info',
      description:
        'Get full details and the official Bajaj Finserv apply URL for a specific loan product. ' +
        'Use when the customer has chosen a product and wants to know more or proceed to apply. ' +
        'NO OTP or mobile number required.',
      inputSchema: {
        type: 'object',
        properties: {
          product: {
            type: 'string',
            enum: Object.keys(LOAN_CATALOGUE),
            description: 'Loan product key to fetch details for',
          },
        },
        required: ['product'],
      },
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

      // Existing servicing tools — all take mobileNumber + otp
      const servicingToolDefs = existingTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: {
            mobileNumber: {
              type: 'string',
              description: 'Registered mobile number',
            },
            otp: {
              type: 'string',
              description: 'OTP for verification',
            },
          },
        },
      }));

      return {
        tools: [
          ...servicingToolDefs,
          ...discoveryTools,
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

      const tool        = request.params.name;
      const mobileNumber = request.params.arguments?.mobileNumber;
      const otp         = request.params.arguments?.otp;
      const loan        = customers[mobileNumber];

      /*
      ----------------------------------------------------------------------
      SEND OTP
      ----------------------------------------------------------------------
      */

      if (tool === 'send_otp') {

        if (!loan) {
          return { content: [{ type: 'text', text: 'No customer found for this mobile number.' }] };
        }

        verifiedUsers[mobileNumber] = false;

        return {
          content: [{
            type: 'text',
            text: `OTP sent successfully to ${mobileNumber}\n\nFor demo use OTP: 123456`,
          }],
        };

      }

      /*
      ----------------------------------------------------------------------
      VERIFY OTP
      ----------------------------------------------------------------------
      */

      if (tool === 'verify_otp') {

        if (!loan) {
          return { content: [{ type: 'text', text: 'Customer not found.' }] };
        }

        if (otp === '123456') {
          verifiedUsers[mobileNumber] = true;
          return { content: [{ type: 'text', text: 'OTP verification successful.' }] };
        }

        return { content: [{ type: 'text', text: 'Invalid OTP.' }] };

      }

      /*
      ----------------------------------------------------------------------
      PROTECTED TOOLS (require mobile + OTP)
      ----------------------------------------------------------------------
      */

      const protectedTools = [
        'get_loan_details',
        'get_emi_details',
        'get_due_amount',
        'get_noc_status',
        'get_interest_rate',
        'get_loan_status',
        'get_balance_tenure',
        'get_loan_amount',
        'get_pos_amount',
        'get_disbursement_details',
        'get_loan_expiry',
        'get_flexi_details',
        'get_overdue_details',
        'get_customer_profile',
        'get_agreement_details',
        'get_product_details',
        'get_loan_summary',
        'check_loan_closure_eligibility',
        'get_foreclosure_status',
        'get_amc_charges',
      ];

      if (protectedTools.includes(tool)) {

        if (!loan) {
          return { content: [{ type: 'text', text: 'No customer found for this mobile number.' }] };
        }

        if (!verifiedUsers[mobileNumber]) {
          return { content: [{ type: 'text', text: 'Please verify OTP first.' }] };
        }

      }

      /*
      ----------------------------------------------------------------------
      LOAN DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_details') {
        return {
          content: [{
            type: 'text',
            text:
`Customer Name: ${loan.customer_Name}
Product: ${loan.prodDesc}
Agreement Number: ${loan.agreementNo}
Loan Amount: ₹${loan.relAmount}
Interest Rate: ${loan.roi}%
Loan Status: ${loan.relStatus}
Balance Tenure: ${loan.balanceTenure} months`,
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      EMI DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_emi_details') {
        return {
          content: [{
            type: 'text',
            text:
`Next EMI Amount: ₹${loan.nextEMIAmount}
Next EMI Date: ${loan.nextEmiDate}
Missed EMI Count: ${loan.missedEmi}`,
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      DUE AMOUNT
      ----------------------------------------------------------------------
      */

      if (tool === 'get_due_amount') {
        return {
          content: [{ type: 'text', text: `Current Due Amount: ₹${loan.totalOverDue}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      NOC STATUS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_noc_status') {
        return {
          content: [{
            type: 'text',
            text: loan.relStatus === 'Closed'
              ? 'NOC Available'
              : 'Loan is Active. NOC not available yet.',
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      INTEREST RATE
      ----------------------------------------------------------------------
      */

      if (tool === 'get_interest_rate') {
        return {
          content: [{ type: 'text', text: `Current ROI for your loan is ${loan.roi}%` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      LOAN STATUS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_status') {
        return {
          content: [{ type: 'text', text: `Your loan status is ${loan.relStatus}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      BALANCE TENURE
      ----------------------------------------------------------------------
      */

      if (tool === 'get_balance_tenure') {
        return {
          content: [{ type: 'text', text: `Remaining tenure is ${loan.balanceTenure} months` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      LOAN AMOUNT
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_amount') {
        return {
          content: [{ type: 'text', text: `Total sanctioned amount is ₹${loan.relAmount}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      POS AMOUNT
      ----------------------------------------------------------------------
      */

      if (tool === 'get_pos_amount') {
        return {
          content: [{ type: 'text', text: `Principal Outstanding Amount is ₹${loan.pos}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      DISBURSEMENT DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_disbursement_details') {
        return {
          content: [{ type: 'text', text: `Loan was disbursed on ${loan.disbDate}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      LOAN EXPIRY
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_expiry') {
        return {
          content: [{ type: 'text', text: `Loan expiry date is ${loan.loanExpiryDate}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      FLEXI DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_flexi_details') {
        return {
          content: [{
            type: 'text',
            text: loan.flexiFlag === 'Y'
              ? 'Flexi facility is enabled'
              : 'Flexi facility is not enabled',
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      OVERDUE DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_overdue_details') {
        return {
          content: [{ type: 'text', text: `Total overdue amount is ₹${loan.totalOverDue}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      CUSTOMER PROFILE
      ----------------------------------------------------------------------
      */

      if (tool === 'get_customer_profile') {
        return {
          content: [{
            type: 'text',
            text:
`Customer Name: ${loan.customer_Name}
CRM Deal ID: ${loan.crmDealId}
Application ID: ${loan.applId}`,
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      AGREEMENT DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_agreement_details') {
        return {
          content: [{ type: 'text', text: `Agreement Number: ${loan.agreementNo}` }],
        };
      }

      /*
      ----------------------------------------------------------------------
      PRODUCT DETAILS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_product_details') {
        return {
          content: [{
            type: 'text',
            text:
`Product Category: ${loan.prodCategory}
Product ID: ${loan.prodId}`,
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      LOAN SUMMARY
      ----------------------------------------------------------------------
      */

      if (tool === 'get_loan_summary') {
        return {
          content: [{
            type: 'text',
            text:
`Loan Summary

Customer: ${loan.customer_Name}
Loan Type: ${loan.prodDesc}
Status: ${loan.relStatus}
ROI: ${loan.roi}%
Balance Tenure: ${loan.balanceTenure} months`,
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      LOAN CLOSURE ELIGIBILITY
      ----------------------------------------------------------------------
      */

      if (tool === 'check_loan_closure_eligibility') {
        return {
          content: [{
            type: 'text',
            text: loan.totalOverDue === 0
              ? 'Loan is eligible for closure request'
              : 'Please clear overdue amount before closure',
          }],
        };
      }

      /*
      ----------------------------------------------------------------------
      FORECLOSURE STATUS
      ----------------------------------------------------------------------
      */

      if (tool === 'get_foreclosure_status') {
        return {
          content: [{ type: 'text', text: 'Foreclosure is available for this loan' }],
        };
      }

      /*
      ----------------------------------------------------------------------
      AMC CHARGES
      ----------------------------------------------------------------------
      */

      if (tool === 'get_amc_charges') {
        return {
          content: [{ type: 'text', text: `AMC Charges: ₹${loan.amcCharges}` }],
        };
      }

      /*
      ======================================================================
      NEW: DISCOVER LOANS
      No OTP required — public product information only
      ======================================================================
      */

      if (tool === 'discover_loans') {

        const {
          purpose = '',
          employment_type = 'unknown',
          has_collateral = 'unknown',
        } = request.params.arguments || {};

        const p = purpose.toLowerCase();
        let recommendations = [];

        // Priority 1: Profession-specific
        if (employment_type === 'doctor') recommendations.push('loan_for_doctors');
        if (employment_type === 'ca')     recommendations.push('loan_for_ca');

        // Priority 2: Purpose keywords
        if (p.match(/home.*(buy|purchas|construct|ghar kharid)/)) {
          recommendations.push('home_loan');
        } else if (p.match(/balance.transfer|transfer.*home.loan/)) {
          recommendations.push('home_loan_balance_transfer');
        } else if (p.match(/home.*(renovat|repair|improve)/)) {
          recommendations.push('personal_loan');
        } else if (p.match(/business|working.capital|expansion|sme/)) {
          if (has_collateral === 'yes_property') recommendations.push('loan_against_property');
          recommendations.push('business_loan');
        } else if (p.match(/bike|scooter|two.wheel|motorcycle/)) {
          recommendations.push('two_wheeler_loan');
        } else if (p.match(/used.car|purani.car|second.hand.car|pre.owned/)) {
          recommendations.push('used_car_loan');
        }

        // Priority 3: Collateral-driven
        if (has_collateral === 'yes_gold'     && !recommendations.includes('gold_loan'))           recommendations.push('gold_loan');
        if (has_collateral === 'yes_fd'       && !recommendations.includes('loan_against_fd'))     recommendations.push('loan_against_fd');
        if (has_collateral === 'yes_shares'   && !recommendations.includes('loan_against_shares')) recommendations.push('loan_against_shares');
        if (has_collateral === 'yes_property' && !recommendations.includes('loan_against_property')) recommendations.push('loan_against_property');

        // Fallback: personal loan
        if (
          recommendations.length === 0 ||
          p.match(/personal|medical|wedding|education|emergency|urgent|travel|shaadi|padhai/)
        ) {
          if (!recommendations.includes('insta_personal_loan')) recommendations.push('insta_personal_loan');
          if (!recommendations.includes('personal_loan'))       recommendations.push('personal_loan');
        }

        // Deduplicate + cap at 3
        recommendations = [...new Set(recommendations)].slice(0, 3);
        if (recommendations.length === 0) recommendations = ['personal_loan', 'business_loan'];

        const result = {
          message: 'Bajaj Finance ke yeh loan products aapke liye best match hain:',
          recommendations: recommendations.map((key) => {
            const prod = LOAN_CATALOGUE[key];
            return {
              product_key: key,
              name: prod.name,
              amount: prod.amount,
              interest_rate: prod.interest_rate,
              top_feature: prod.key_features[0],
              apply_now: prod.apply_url,
              check_pre_approved_offer: prod.check_offer_url,
            };
          }),
          explore_all_loans: 'https://www.bajajfinserv.in/loans',
          disclaimer: 'Interest rates and eligibility are indicative and subject to Bajaj Finance credit assessment.',
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };

      }

      /*
      ======================================================================
      NEW: GET LOAN PRODUCT INFO
      No OTP required — public product information only
      ======================================================================
      */

      if (tool === 'get_loan_product_info') {

        const { product } = request.params.arguments || {};
        const info = LOAN_CATALOGUE[product];

        if (!info) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Product not found',
                available_products: Object.keys(LOAN_CATALOGUE),
                explore_all: 'https://www.bajajfinserv.in/loans',
              }, null, 2),
            }],
          };
        }

        const result = {
          name: info.name,
          amount: info.amount,
          tenure: info.tenure,
          interest_rate: info.interest_rate,
          processing_fee: info.processing_fee,
          collateral_needed: info.collateral_needed,
          key_features: info.key_features,
          eligibility: info.eligibility,
          apply_now: info.apply_url,
          check_pre_approved_offer: info.check_offer_url,
          ...(info.emi_calculator_url ? { emi_calculator: info.emi_calculator_url } : {}),
          explore_all_loans: 'https://www.bajajfinserv.in/loans',
          disclaimer: "Interest rates, fees, and eligibility are indicative. Final terms are at Bajaj Finance's discretion per credit assessment.",
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
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

    const transport = new SSEServerTransport('/messages', res);

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

    const sessionId  = req.query.sessionId;
    const transport  = sseTransports[sessionId];

    if (!transport) {
      return res.status(400).send('No transport found');
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

    const server    = createServer();
    const transport = new StreamableHTTPServerTransport();

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

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
  res.send('Financial Remote MCP v5.0 Running — Loan Servicing + Discovery');
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Financial Remote MCP running on port ${PORT}`);
});