require('dotenv').config()
const express = require("express");
const braintree = require("braintree");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

const user_vaults = []
let id = 1;

// Ganti ini dengan kredensial sandbox dari akun Braintree-mu
const gateway = new braintree.BraintreeGateway({
    environment: braintree.Environment.Sandbox,
    merchantId: process.env.MERCHANT_ID,
    publicKey: process.env.PUBLIC_KEY,
    privateKey: process.env.PRIVATE_KEY
});

// Endpoint: Generate Client Token
app.get("/client_token", async (req, res) => {
    try {
      const response = await gateway.clientToken.generate({});
      res.send({ clientToken: response.clientToken });
    } catch (err) {
      console.error("Error generating client token:", err);
      res.status(500).send({ error: err.message });
    }
});

app.post("/vault-card", async (req, res) => {
  const { paymentMethodNonce, email } = req.body;

  try {
    // Buat customer baru
    const customerResult = await gateway.customer.create({
      email
    });
    
    if (!customerResult.success) {
      return res.status(500).send({ message: "Failed to create customer" });
    }
    
    const customerId = customerResult.customer.id;
    
    // Simpan kartu (vault)
    const result = await gateway.paymentMethod.create({
      customerId,
      paymentMethodNonce,
      options: {
        makeDefault: true,
        verifyCard: true
      }
    });
    
    if (result.success) {
      const data = {
        id,
        customerId: customerId,
        token: result.paymentMethod.token,
        email,
        last4: result.paymentMethod.last4,
        cardType: result.paymentMethod.cardType,
        expMonth: result.paymentMethod.expirationMonth,
        expYear: result.paymentMethod.expirationYear
      }
      user_vaults.push(data);
      id++;
      return res.send({message: 'Success vaulting data'});
    } else {
      return res.status(500).send({ message: result.message });
    }
    
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
});

app.post("/checkout", async (req, res) => {
  const {amount} = req.body;
  const vault = user_vaults.find(v => v.id === 1);
  const paymentMethodToken = vault.token;

  try {
    const result = await gateway.transaction.sale({
      amount,
      paymentMethodToken,
      options: {
        submitForSettlement: true // langsung settle
      }
    });

    if (result.success) {
      res.send({
        success: true,
        transactionId: result.transaction.id,
        message: "Pembayaran berhasil"
      });
    } else {
      res.status(400).send({
        success: false,
        message: result.message
      });
    }
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});