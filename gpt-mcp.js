import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = process.env.PORT || 8080;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const VERSION = "1.0.0";

// ─── Demo data ────────────────────────────────────────────────────────────────

const customers = {
  "9999999999": {
    customerId: "CUS-001",
    customerName: "Vikas Singh Rathaur",
    mobile: "9999999999",
    email: "vikas@example.com",
    relationshipStatus: "Premium",
    loans: [
      {
        agreementId: "X402P34T9588444",
        productType: "Personal Loan",
        loanStatus: "Active",
        loanAmount: 3739000,
        outstandingAmount: 4203,
        roi: 11.25,
        tenureMonths: 83,
        nextEmiAmount: 132,
        nextEmiDate: "2026-08-02",
        disbursementDate: "2019-09-01",
        emiDay: 2,
        flexiEnabled: true,
        flexiLimit: 100000,
        flexiAvailable: 95800,
      },
    ],
  },
  "8888888888": {
    customerId: "CUS-002",
    customerName: "Rahul Sharma",
    mobile: "8888888888",
    email: "rahul@example.com",
    relationshipStatus: "Standard",
    loans: [
      {
        agreementId: "HL99887766",
        productType: "Home Loan",
        loanStatus: "Active",
        loanAmount: 3500000,
        outstandingAmount: 2450000,
        roi: 8.75,
        tenureMonths: 220,
        nextEmiAmount: 28500,
        nextEmiDate: "2026-08-05",
        disbursementDate: "2018-04-01",
        emiDay: 5,
        flexiEnabled: false,
        flexiLimit: 0,
        flexiAvailable: 0,
      },
    ],
  },
};

const loanProducts = {
  personal_loan: {
    name: "Personal Loan",
    interest_rate: "11% - 31% p.a.",
    max_amount: "₹40 Lakh",
    tenure: "12 - 84 months",
    processing_fee: "Up to 3.93% + GST",
    eligibility: "Salaried / Self-Employed, Age 21-80, Min income ₹25,000/month",
    key_features: ["No collateral needed", "Quick disbursal in 24 hrs", "Flexible EMI options", "Top-up facility available"],
    apply_now: "https://www.bajajfinserv.in/personal-loan",
  },
  insta_personal_loan: {
    name: "Insta Personal Loan",
    interest_rate: "10% - 28% p.a.",
    max_amount: "₹10 Lakh",
    tenure: "3 - 60 months",
    processing_fee: "Up to 2% + GST",
    eligibility: "Pre-approved customers only, existing Bajaj customers",
    key_features: ["Instant approval", "Disbursal in minutes", "No documentation required", "Available via app"],
    apply_now: "https://www.bajajfinserv.in/insta-personal-loan",
  },
  home_loan: {
    name: "Home Loan",
    interest_rate: "8.50% - 15% p.a.",
    max_amount: "₹5 Crore",
    tenure: "Up to 30 years (360 months)",
    processing_fee: "Up to 0.50% + GST",
    eligibility: "Salaried / Self-Employed, Age 23-70, Property as collateral",
    key_features: ["Low interest rates", "Long repayment tenure", "Tax benefits u/s 80C & 24(b)", "Part-prepayment allowed"],
    apply_now: "https://www.bajajfinserv.in/home-loan",
  },
  home_loan_balance_transfer: {
    name: "Home Loan Balance Transfer",
    interest_rate: "8.50% - 14% p.a.",
    max_amount: "₹5 Crore",
    tenure: "Up to 30 years",
    processing_fee: "Up to 0.50% + GST",
    eligibility: "Existing home loan holders with other banks/NBFCs",
    key_features: ["Lower EMI", "Top-up loan available", "Minimal documentation", "Online process"],
    apply_now: "https://www.bajajfinserv.in/home-loan-balance-transfer",
  },
  loan_against_property: {
    name: "Loan Against Property",
    interest_rate: "9% - 18% p.a.",
    max_amount: "₹5 Crore",
    tenure: "Up to 15 years (180 months)",
    processing_fee: "Up to 1% + GST",
    eligibility: "Property owner, Salaried / Self-Employed, Age 25-70",
    key_features: ["High loan amount", "Residential / commercial property accepted", "Flexible end use", "Part-prepayment allowed"],
    apply_now: "https://www.bajajfinserv.in/loan-against-property",
  },
  business_loan: {
    name: "Business Loan",
    interest_rate: "14% - 30% p.a.",
    max_amount: "₹80 Lakh",
    tenure: "12 - 96 months",
    processing_fee: "Up to 3.54% + GST",
    eligibility: "Business vintage min 3 years, Turnover ₹20 Lakh+, Age 24-70",
    key_features: ["No collateral", "Quick disbursal", "Dropline overdraft option", "Business expansion / working capital"],
    apply_now: "https://www.bajajfinserv.in/business-loan",
  },
  loan_for_doctors: {
    name: "Loan for Doctors",
    interest_rate: "11% - 22% p.a.",
    max_amount: "₹2 Crore",
    tenure: "12 - 84 months",
    processing_fee: "Up to 2.95% + GST",
    eligibility: "MBBS / BDS / MD / MS qualified practicing doctors",
    key_features: ["Clinic setup / equipment purchase", "No collateral up to ₹50 Lakh", "Doorstep service", "Quick approval"],
    apply_now: "https://www.bajajfinserv.in/doctor-loan",
  },
  loan_for_ca: {
    name: "Loan for CA",
    interest_rate: "11% - 22% p.a.",
    max_amount: "₹50 Lakh",
    tenure: "12 - 84 months",
    processing_fee: "Up to 2.95% + GST",
    eligibility: "Practicing CA with valid ICAI certificate, min 2 years practice",
    key_features: ["Office expansion", "Working capital needs", "No collateral", "Online process"],
    apply_now: "https://www.bajajfinserv.in/ca-loan",
  },
  gold_loan: {
    name: "Gold Loan",
    interest_rate: "9.50% - 28% p.a.",
    max_amount: "₹2 Crore",
    tenure: "1 - 12 months",
    processing_fee: "Up to 1% + GST",
    eligibility: "Gold ornaments / jewellery as collateral, Age 18+",
    key_features: ["Instant disbursal", "Gold safely stored in vault", "Interest-only EMI option", "Auction-free 7-day notice"],
    apply_now: "https://www.bajajfinserv.in/gold-loan",
  },
  loan_against_fd: {
    name: "Loan Against FD",
    interest_rate: "FD rate + 1-2% p.a.",
    max_amount: "Up to 90% of FD value",
    tenure: "Up to FD tenure",
    processing_fee: "Nil",
    eligibility: "Existing Bajaj Finance FD holder",
    key_features: ["No credit check required", "FD continues to earn interest", "Overdraft facility", "Instant processing"],
    apply_now: "https://www.bajajfinserv.in/loan-against-fd",
  },
  loan_against_shares: {
    name: "Loan Against Shares / Securities",
    interest_rate: "10.5% - 18% p.a.",
    max_amount: "₹10 Crore",
    tenure: "12 months (renewable)",
    processing_fee: "Up to 0.5% + GST",
    eligibility: "Demat account holder with approved securities",
    key_features: ["Overdraft limit against portfolio", "Shares continue to grow", "Pay interest only on utilized amount", "Online management"],
    apply_now: "https://www.bajajfinserv.in/loan-against-securities",
  },
  two_wheeler_loan: {
    name: "Two Wheeler Loan",
    interest_rate: "9.99% - 29% p.a.",
    max_amount: "100% of bike on-road price",
    tenure: "12 - 48 months",
    processing_fee: "Up to 2% + GST",
    eligibility: "Age 18-65, Salaried / Self-Employed, Min income ₹12,000/month",
    key_features: ["0% down payment offers", "Quick approval at dealership", "Covers new and used bikes", "Doorstep delivery"],
    apply_now: "https://www.bajajfinserv.in/two-wheeler-loan",
  },
  used_car_loan: {
    name: "Used Car Loan",
    interest_rate: "12% - 26% p.a.",
    max_amount: "₹50 Lakh",
    tenure: "12 - 60 months",
    processing_fee: "Up to 3.93% + GST",
    eligibility: "Car age max 10 years, Salaried / Self-Employed, Age 21-65",
    key_features: ["Up to 100% of car value financed", "Quick loan disbursal", "Doorstep inspection", "Flexible EMIs"],
    apply_now: "https://www.bajajfinserv.in/used-car-loan",
  },
};

// ─── In-memory service request store (session-scoped) ─────────────────────────

const serviceRequests = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function success(data) {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: true, data }, null, 2) }],
  };
}

function failure(msg) {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error: msg }, null, 2) }],
    isError: true,
  };
}

function validateOtp(mobileNumber, otp) {
  if (!customers[mobileNumber]) throw new Error("Mobile number not found.");
  if (otp !== "123456") throw new Error("Invalid OTP. Use 123456 for demo.");
  return customers[mobileNumber];
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "discover_loans",
    title: "Discover Loan Products",
    description:
      "Recommends Bajaj Finance loan products based on the customer's purpose, employment type, and whether they have collateral. Returns a list of matching product names with brief descriptions and key eligibility criteria.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          description:
            "The reason for taking a loan. Examples: home purchase, business expansion, medical emergency, vehicle purchase, education, personal expenses.",
        },
        employment_type: {
          type: "string",
          enum: ["salaried", "self_employed", "business_owner", "professional", "any"],
          description: "The applicant's employment or business type.",
        },
        has_collateral: {
          type: "string",
          enum: ["yes_property", "yes_gold", "yes_shares", "yes_fd", "no"],
          description:
            "Whether the applicant has collateral to offer. Use 'no' for unsecured loans.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_loan_product_info",
    title: "Get Loan Product Details",
    description:
      "Returns complete details for a specific Bajaj Finance loan product including interest rate range, maximum loan amount, repayment tenure, processing fee, eligibility criteria, key features, and the apply_now URL.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        product: {
          type: "string",
          enum: Object.keys(loanProducts),
          description:
            "The loan product identifier. Use discover_loans first if unsure which product the customer needs.",
        },
      },
      required: ["product"],
    },
  },
  {
    name: "send_otp",
    title: "Send OTP to Customer",
    description:
      "Initiates OTP verification for a registered mobile number. Confirms the number is registered with Bajaj Finance and returns otpSent: true. In demo mode, the OTP is always '123456'. Does not modify any data.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        mobileNumber: {
          type: "string",
          description: "10-digit Indian mobile number registered with Bajaj Finance.",
        },
      },
      required: ["mobileNumber"],
    },
  },
  {
    name: "get_customer_profile",
    title: "Get Customer Profile",
    description:
      "Returns authenticated customer profile: customerId, customerName, list of active loan products, count of active loans, and relationship status (Standard / Premium). Requires valid mobileNumber and OTP.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        mobileNumber: {
          type: "string",
          description: "10-digit registered mobile number.",
        },
        otp: {
          type: "string",
          description: "6-digit OTP received on the mobile number. Demo OTP is '123456'.",
        },
      },
      required: ["mobileNumber", "otp"],
    },
  },
  {
    name: "get_loan_details",
    title: "Get Loan Details",
    description:
      "Returns the full loan dashboard for an authenticated customer: agreementId, productType, loanStatus, loanAmount, outstandingAmount, interest rate (ROI), tenureMonths, nextEmiAmount, nextEmiDate, disbursementDate, and emiDay.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        mobileNumber: {
          type: "string",
          description: "10-digit registered mobile number.",
        },
        otp: {
          type: "string",
          description: "6-digit OTP. Demo OTP is '123456'.",
        },
      },
      required: ["mobileNumber", "otp"],
    },
  },
  {
    name: "get_flexi_details",
    title: "Get Flexi Loan Details",
    description:
      "Returns Flexi Loan status for the customer's loan. If flexiEnabled is true, returns flexiLimit and flexiAvailable amounts. If false, explains the Flexi Loan feature and how to enroll. Requires valid mobileNumber and OTP.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        mobileNumber: {
          type: "string",
          description: "10-digit registered mobile number.",
        },
        otp: {
          type: "string",
          description: "6-digit OTP. Demo OTP is '123456'.",
        },
      },
      required: ["mobileNumber", "otp"],
    },
  },
  {
    name: "raise_service_request",
    title: "Raise a Service Request",
    description:
      "Creates a service request on the customer's account for the specified request type. Returns a ticketId (format SR-<timestamp>), requestType, status ('OPEN'), and estimated resolution time in business days.",
    annotations: { destructiveHint: true },
    inputSchema: {
      type: "object",
      properties: {
        mobileNumber: {
          type: "string",
          description: "10-digit registered mobile number.",
        },
        otp: {
          type: "string",
          description: "6-digit OTP. Demo OTP is '123456'.",
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
          description:
            "Type of service request. NOC = No Objection Certificate after loan closure.",
        },
      },
      required: ["mobileNumber", "otp", "requestType"],
    },
  },
];

// ─── Tool handlers ─────────────────────────────────────────────────────────────

function handleDiscoverLoans({ purpose = "", employment_type = "any", has_collateral = "no" }) {
  const recommendations = [];

  const purposeLower = purpose.toLowerCase();
  const isHome = purposeLower.includes("home") || purposeLower.includes("house") || purposeLower.includes("property") || purposeLower.includes("flat");
  const isBusiness = purposeLower.includes("business") || purposeLower.includes("startup") || purposeLower.includes("expansion") || purposeLower.includes("working capital");
  const isVehicle = purposeLower.includes("bike") || purposeLower.includes("motorcycle") || purposeLower.includes("scooter") || purposeLower.includes("two wheeler");
  const isCar = purposeLower.includes("car") || purposeLower.includes("vehicle") || purposeLower.includes("used car");
  const isEducation = purposeLower.includes("education") || purposeLower.includes("study") || purposeLower.includes("college");
  const isDoctor = purposeLower.includes("clinic") || purposeLower.includes("hospital") || purposeLower.includes("medical practice");
  const hasProperty = has_collateral === "yes_property";
  const hasGold = has_collateral === "yes_gold";
  const hasFd = has_collateral === "yes_fd";
  const hasShares = has_collateral === "yes_shares";

  if (isHome) {
    if (hasProperty) {
      recommendations.push({ product: "home_loan", reason: "Best fit for home purchase with property as security." });
      recommendations.push({ product: "home_loan_balance_transfer", reason: "If you have an existing home loan, transfer it for lower rates." });
      recommendations.push({ product: "loan_against_property", reason: "Use existing property as collateral for large loan amounts." });
    } else {
      recommendations.push({ product: "home_loan", reason: "Home purchase with competitive rates and long tenure." });
    }
  }

  if (isBusiness || employment_type === "business_owner") {
    recommendations.push({ product: "business_loan", reason: "Collateral-free business funding up to ₹80 Lakh." });
    if (hasProperty) recommendations.push({ product: "loan_against_property", reason: "Higher loan amount using commercial/residential property." });
  }

  if (employment_type === "professional") {
    recommendations.push({ product: "loan_for_doctors", reason: "Tailored for medical professionals — clinic setup, equipment." });
    recommendations.push({ product: "loan_for_ca", reason: "Tailored for CAs — practice expansion, working capital." });
  }

  if (isDoctor) {
    recommendations.push({ product: "loan_for_doctors", reason: "Specifically designed for doctors setting up or expanding clinics." });
  }

  if (isVehicle) {
    recommendations.push({ product: "two_wheeler_loan", reason: "Two-wheeler purchase with 0% down payment offers available." });
  }

  if (isCar) {
    recommendations.push({ product: "used_car_loan", reason: "Finance a used car up to ₹50 Lakh with flexible EMIs." });
  }

  if (hasGold) {
    recommendations.push({ product: "gold_loan", reason: "Instant cash against gold jewellery with gold safely vaulted." });
  }

  if (hasFd) {
    recommendations.push({ product: "loan_against_fd", reason: "Borrow against your FD without breaking it — FD keeps earning." });
  }

  if (hasShares) {
    recommendations.push({ product: "loan_against_shares", reason: "Overdraft against your share/securities portfolio." });
  }

  // Always add personal loan as a flexible fallback
  if (!recommendations.length || (!isHome && !isBusiness && !isVehicle && !isCar && !isDoctor)) {
    recommendations.push({ product: "personal_loan", reason: "No collateral needed, quick disbursal, flexible end use." });
  }

  // Deduplicate
  const seen = new Set();
  const unique = recommendations.filter((r) => {
    if (seen.has(r.product)) return false;
    seen.add(r.product);
    return true;
  });

  return success({
    recommendations: unique.map((r) => ({
      ...r,
      productName: loanProducts[r.product].name,
      interestRate: loanProducts[r.product].interest_rate,
      maxAmount: loanProducts[r.product].max_amount,
    })),
    totalRecommendations: unique.length,
    tip: "Use get_loan_product_info with a product key to get full details and the apply link.",
  });
}

function handleGetLoanProductInfo({ product }) {
  const info = loanProducts[product];
  if (!info) return failure(`Unknown product '${product}'. Valid products: ${Object.keys(loanProducts).join(", ")}`);
  return success(info);
}

function handleSendOtp({ mobileNumber }) {
  if (!customers[mobileNumber]) {
    return failure("Mobile number not found. Please check the number and try again.");
  }
  return success({
    otpSent: true,
    mobileNumber,
    message: "OTP sent successfully to the registered mobile number.",
    demoOtp: "123456",
    note: "This is a demo environment. Use OTP '123456' to authenticate.",
  });
}

function handleGetCustomerProfile({ mobileNumber, otp }) {
  let customer;
  try {
    customer = validateOtp(mobileNumber, otp);
  } catch (e) {
    return failure(e.message);
  }

  return success({
    customerId: customer.customerId,
    customerName: customer.customerName,
    mobile: customer.mobile,
    email: customer.email,
    relationshipStatus: customer.relationshipStatus,
    activeLoans: customer.loans.length,
    activeProducts: customer.loans.map((l) => l.productType),
  });
}

function handleGetLoanDetails({ mobileNumber, otp }) {
  let customer;
  try {
    customer = validateOtp(mobileNumber, otp);
  } catch (e) {
    return failure(e.message);
  }

  return success({
    customerName: customer.customerName,
    customerId: customer.customerId,
    loans: customer.loans.map((loan) => ({
      agreementId: loan.agreementId,
      productType: loan.productType,
      loanStatus: loan.loanStatus,
      loanAmount: loan.loanAmount,
      loanAmountFormatted: formatCurrency(loan.loanAmount),
      outstandingAmount: loan.outstandingAmount,
      outstandingAmountFormatted: formatCurrency(loan.outstandingAmount),
      roi: `${loan.roi}% p.a.`,
      tenureMonths: loan.tenureMonths,
      nextEmiAmount: loan.nextEmiAmount,
      nextEmiAmountFormatted: formatCurrency(loan.nextEmiAmount),
      nextEmiDate: loan.nextEmiDate,
      disbursementDate: loan.disbursementDate,
      emiDay: loan.emiDay,
    })),
  });
}

function handleGetFlexiDetails({ mobileNumber, otp }) {
  let customer;
  try {
    customer = validateOtp(mobileNumber, otp);
  } catch (e) {
    return failure(e.message);
  }

  const loan = customer.loans[0];
  if (loan.flexiEnabled) {
    return success({
      customerName: customer.customerName,
      agreementId: loan.agreementId,
      flexiEnabled: true,
      flexiLimit: loan.flexiLimit,
      flexiLimitFormatted: formatCurrency(loan.flexiLimit),
      flexiAvailable: loan.flexiAvailable,
      flexiAvailableFormatted: formatCurrency(loan.flexiAvailable),
      flexiUtilized: loan.flexiLimit - loan.flexiAvailable,
      flexiUtilizedFormatted: formatCurrency(loan.flexiLimit - loan.flexiAvailable),
      message:
        "Your Flexi Loan is active. You can withdraw from your available Flexi limit anytime and pay interest only on the amount utilized. Repayments go back to your Flexi limit.",
    });
  } else {
    return success({
      customerName: customer.customerName,
      agreementId: loan.agreementId,
      flexiEnabled: false,
      message:
        "You are not enrolled in the Flexi Loan facility. Flexi Loan lets you withdraw funds from a pre-approved limit and pay interest only on the amount used. To enroll, visit the Bajaj Finserv app or contact your relationship manager.",
      enrollUrl: "https://www.bajajfinserv.in/flexi-personal-loan",
    });
  }
}

function handleRaiseServiceRequest({ mobileNumber, otp, requestType }) {
  let customer;
  try {
    customer = validateOtp(mobileNumber, otp);
  } catch (e) {
    return failure(e.message);
  }

  const resolutionDays = {
    NOC: 7,
    "Account Statement": 2,
    "Foreclosure Quote": 3,
    "EMI Dispute": 5,
    "Interest Certificate": 3,
    "Repayment Schedule": 2,
  };

  const ticketId = `SR-${Date.now()}`;
  const ticket = {
    ticketId,
    requestType,
    customerId: customer.customerId,
    customerName: customer.customerName,
    agreementId: customer.loans[0]?.agreementId,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    estimatedResolutionDays: resolutionDays[requestType] || 5,
    message: `Service request '${requestType}' raised successfully. You will receive confirmation on your registered mobile and email within 24 hours.`,
  };

  serviceRequests[ticketId] = ticket;

  return success(ticket);
}

// ─── MCP server factory ───────────────────────────────────────────────────────

function createMcpServer() {
  const server = new Server(
    { name: "bajaj-finance-mcp", version: VERSION },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      switch (name) {
        case "discover_loans":        return handleDiscoverLoans(args);
        case "get_loan_product_info": return handleGetLoanProductInfo(args);
        case "send_otp":              return handleSendOtp(args);
        case "get_customer_profile":  return handleGetCustomerProfile(args);
        case "get_loan_details":      return handleGetLoanDetails(args);
        case "get_flexi_details":     return handleGetFlexiDetails(args);
        case "raise_service_request": return handleRaiseServiceRequest(args);
        default:                      return failure(`Unknown tool: ${name}`);
      }
    } catch (err) {
      return failure(err.message);
    }
  });

  return server;
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// CORS — all origins for POC
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ─── Discovery endpoints ───────────────────────────────────────────────────────

app.get("/.well-known/mcp", (_req, res) => {
  res.json({
    mcp: {
      version: "2024-11-05",
      transports: [
        { type: "streamable-http", url: `${BASE_URL}/mcp` },
        { type: "sse", url: `${BASE_URL}/sse` },
      ],
    },
    server: {
      name: "bajaj-finance-mcp",
      version: VERSION,
      description: "Bajaj Finance MCP Server — loan discovery, account management, service requests",
    },
  });
});

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/oauth/authorize`,
    token_endpoint: `${BASE_URL}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    note: "OTP-based auth is handled directly in tool parameters. This endpoint is a placeholder for ChatGPT discovery.",
  });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "UP",
    version: VERSION,
    timestamp: new Date().toISOString(),
    tools: TOOLS.map((t) => t.name),
    transports: {
      streamableHttp: `${BASE_URL}/mcp`,
      sse: `${BASE_URL}/sse`,
    },
    discovery: {
      mcp: `${BASE_URL}/.well-known/mcp`,
      oauth: `${BASE_URL}/.well-known/oauth-authorization-server`,
    },
  });
});

// ─── Root ─────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.type("text/plain").send(
    `Bajaj Finance MCP Server v${VERSION} is running.\nPOST /mcp for ChatGPT (Streamable HTTP)\nGET  /sse for Claude.ai (SSE)\nGET  /health for status`
  );
});

// ─── Streamable HTTP transport (ChatGPT) ──────────────────────────────────────

app.post("/mcp", async (req, res) => {
  // sessionIdGenerator must be undefined (not null) to enable stateless mode in the SDK
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed. Use POST /mcp for Streamable HTTP transport." });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed. Session management not supported in stateless mode." });
});

// ─── SSE transport (Claude.ai) ────────────────────────────────────────────────

const sseSessions = new Map();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  const server = createMcpServer();
  await server.connect(transport);
  sseSessions.set(transport.sessionId, transport);
  res.on("close", () => sseSessions.delete(transport.sessionId));
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = sseSessions.get(sessionId);
  if (!transport) {
    return res.status(404).json({ error: "SSE session not found. Connect via GET /sse first." });
  }
  await transport.handlePostMessage(req, res, req.body);
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Bajaj Finance MCP Server v${VERSION} listening on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Streamable HTTP: POST ${BASE_URL}/mcp`);
  console.log(`SSE:             GET  ${BASE_URL}/sse`);
  console.log(`Health:          GET  ${BASE_URL}/health`);
});
