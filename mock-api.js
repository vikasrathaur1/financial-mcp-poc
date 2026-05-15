const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

const customerData = {
  customerId: "CUST001",
  customerName: "Rahul Sharma",
  loanNumber: "LN2026001",
  emiAmount: 14520,
  nextEmiDate: "5 June 2026",
  dueAmount: 0,
  nocStatus: "Available"
};

app.get('/emi-details', (req, res) => {

  res.json({
    success: true,
    data: customerData
  });

});

app.listen(3000, () => {

  console.log('Mock Financial API running on port 3000');

});