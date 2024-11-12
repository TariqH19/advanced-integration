import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  getOrderDetails,
  createOrder,
  capturePayment,
  generateAccessToken,
  deletePaymentToken,
  fetchAllPaymentTokens,
} from "./paypal-api.js"; // Import your PayPal helper functions
import * as serversdk from "./serversdk-api.js";
import * as applepay from "./apple-api.js";
import * as googlepay from "./googlepay-api.js";
import * as subs from "./subs-api.js";
import * as authcap from "./authcap-api.js";
import * as standard from "./standard-api.js";
import * as braintreeAPI from "./braintree-api.js";
import * as old from "./old-api.js";
import * as shipping from "./shipping-api.js";
import * as invoice from "./invoice-api.js";
import * as payout from "./payout-api.js";
import braintree from "braintree";
const {
  PAYPAL_CLIENT_ID,
  PAYPAL_MERCHANT_ID,
  BRAINTREE_MERCHANT_ID,
  BRAINTREE_API_KEY,
  BRAINTREE_API_SECRET,
  BRAINTREE_CURRENCY,
} = process.env;
const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment.Sandbox,
  merchantId: BRAINTREE_MERCHANT_ID,
  publicKey: BRAINTREE_API_KEY,
  privateKey: BRAINTREE_API_SECRET,
});
const base = "https://api-m.sandbox.paypal.com";
// Convert file URL to file path
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", "./views");

// Host static files
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));

// Middleware to parse JSON requests
app.use(express.json());

// Render checkout page with client ID
app.get("/acdc", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("checkout", {
    clientId,
  });
});

app.get("/shipping", (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("shipping", {
    clientId,
  });
});

app.get("/old", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("oldintegration", {
    clientId,
  });
});

app.get("/donate", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("donate", {
    clientId,
  });
});

app.get("/invoice", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("invoice", {
    clientId,
  });
});

app.get("/payout", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("payout", {
    clientId,
  });
});

// Route to create payout
app.post("/create-payout", async (req, res) => {
  const { recipients } = req.body;
  try {
    const accessToken = await payout.getAccessToken();

    const items = recipients.map((recipient, index) => ({
      recipient_type: "EMAIL",
      amount: {
        value: recipient.amount,
        currency: "GBP",
      },
      receiver: recipient.email,
      note: "Thanks for your business!",
      sender_item_id: `item_${index}`,
    }));

    const payoutResponse = await fetch(`${base}/v1/payments/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: `batch_${Math.random() * 1e18}`,
          email_subject: "You have a payment",
        },
        items,
      }),
    });

    const payoutResult = await payoutResponse.json();
    if (payoutResponse.ok) {
      res.json({
        message: "Payout created successfully!",
        details: payoutResult,
      });
    } else {
      res.status(400).json({ error: payoutResult });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the payout." });
  }
});

app.get("/payout/:batchId", async (req, res) => {
  const { batchId } = req.params;

  try {
    const accessToken = await payout.getAccessToken();

    const payoutDetailsResponse = await fetch(
      `${base}/v1/payments/payouts/${batchId}?fields=batch_header`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payoutDetails = await payoutDetailsResponse.json();

    if (payoutDetailsResponse.ok) {
      res.json(payoutDetails);
    } else {
      res.status(400).json({ error: payoutDetails });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while retrieving payout details." });
  }
});

app.post("/api/create-invoice", async (req, res) => {
  try {
    const accessToken = await invoice.generateAccessToken();
    const invoiceData = req.body;
    const invoice = await invoice.createInvoice(accessToken, invoiceData);

    if (invoice && invoice.id) {
      res.status(200).json({ id: invoice.id });
    } else {
      console.error("Error retrieving invoice ID:", invoice); // Log the full invoice response
      res.status(500).json({
        error: "Failed to retrieve invoice ID from PayPal.",
        details: invoice,
      });
    }
  } catch (error) {
    console.error("Invoice creation error:", error);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

app.post("/api/send-invoice", async (req, res) => {
  try {
    const accessToken = await invoice.generateAccessToken();
    const { invoiceId } = req.body;
    const response = await invoice.sendInvoice(accessToken, invoiceId);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send invoice" });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { cart } = req.body;
    const order = await shipping.createOrder(cart);
    res.json(order);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const order = await shipping.captureOrder(orderID);
    res.json(order);
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

app.patch("/api/orders/update-shipping", async (req, res) => {
  try {
    const { orderID, selectedShippingOption } = req.body;
    const updatedOrder = await shipping.updateShippingOption(
      orderID,
      selectedShippingOption
    );
    res.json(updatedOrder);
  } catch (error) {
    console.error("Failed to update shipping option:", error);
    res.status(500).json({ error: "Failed to update shipping option." });
  }
});

app.patch("/api/orders/update-address", async (req, res) => {
  try {
    const { orderID, shippingAddress } = req.body;
    const updatedOrder = await shipping.updateShippingAddress(
      orderID,
      shippingAddress
    );
    res.json(updatedOrder);
  } catch (error) {
    console.error("Failed to update shipping address:", error);
    res.status(500).json({ error: "Failed to update shipping address." });
  }
});

app.post("/old/api/orders", async (req, res) => {
  try {
    const { task, saveCard, vaultID } = req.body;
    const order = await old.createOrder(task, saveCard, vaultID);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.get("/old/api/orders/:orderID", async (req, res) => {
  const { orderID } = req.params; // Ensure orderID is defined here
  try {
    const orderDetails = await old.getOrderDetails(orderID);
    res.json(orderDetails);
  } catch (error) {
    console.error(
      `Error fetching order details for ${orderID}:`,
      error.message
    );
    res
      .status(500)
      .json({ error: `Failed to get order details: ${error.message}` });
  }
});

// Capture payment
app.post("/old/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const captureData = await old.capturePayment(orderID);
    res.json(captureData);
  } catch (error) {
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

app.get("/serversdk", async (req, res) => {
  res.render("serversdk");
});

app.post("/serversdk/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await serversdk.createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/serversdk/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await serversdk.captureOrder(
      orderID
    );
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

app.post("/serversdk/api/orders/:orderID/authorize", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await serversdk.authorizeOrder(
      orderID
    );
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to authorize order." });
  }
});

app.post(
  "/serversdk/orders/:authorizationId/captureAuthorize",
  async (req, res) => {
    try {
      const { authorizationId } = req.params;
      const { jsonResponse, httpStatusCode } = await serversdk.captureAuthorize(
        authorizationId
      );
      res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
      console.error("Failed to create order:", error);
      res.status(500).json({ error: "Failed to capture authorize." });
    }
  }
);

app.get("/serversdk/api/orders/:orderID", async (req, res) => {
  const { orderID } = req.params; // Ensure orderID is defined here
  try {
    const orderDetails = await serversdk.getOrderDetails(orderID);
    res.json(orderDetails);
  } catch (error) {
    console.error(
      `Error fetching order details for ${orderID}:`,
      error.message
    );
    res
      .status(500)
      .json({ error: `Failed to get order details: ${error.message}` });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const { task, saveCard, vaultID } = req.body;
    const order = await createOrder(task, saveCard, vaultID);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.get("/api/orders/:orderID", async (req, res) => {
  const { orderID } = req.params; // Ensure orderID is defined here
  try {
    const orderDetails = await getOrderDetails(orderID);
    res.json(orderDetails);
  } catch (error) {
    console.error(
      `Error fetching order details for ${orderID}:`,
      error.message
    );
    res
      .status(500)
      .json({ error: `Failed to get order details: ${error.message}` });
  }
});

// Capture payment
app.post("/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const captureData = await capturePayment(orderID);
    res.json(captureData);
  } catch (error) {
    res.status(500).json({ error: "Failed to capture payment" });
  }
});

// Endpoint to get payment tokens
app.get("/api/payment-tokens", async (req, res) => {
  const customerId = req.query.customerId;
  if (!customerId) {
    return res.status(400).json({ error: "Customer ID is required" });
  }

  try {
    const paymentTokens = await fetchAllPaymentTokens(customerId);
    res.json(paymentTokens);
  } catch (error) {
    console.error("Tokens Check:", error);
    // res.status(500).json({ error: error.message });
  }
});

app.get("/api/getTokens", async (req, res) => {
  try {
    const { accessToken, idToken } = await generateAccessToken();
    // console.log("Tokens:", { accessToken, idToken });
    res.json({
      accessToken: accessToken,
      tokenId: idToken,
    });
  } catch (error) {
    console.error("Error fetching payment tokens:", error);
    res.status(500).json({ error: "Failed to fetch payment tokens" });
  }
});

app.delete("/api/payment-tokens/:tokenId", async (req, res) => {
  const { tokenId } = req.params;

  if (!tokenId) {
    return res.status(400).json({ error: "Payment token ID is required" });
  }

  try {
    await deletePaymentToken(tokenId);
    res.status(204).send(); // Successfully deleted
  } catch (error) {
    console.error("Error handling delete request:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get("/applepay", async (req, res) => {
  const clientId = PAYPAL_CLIENT_ID,
    merchantId = PAYPAL_MERCHANT_ID;
  try {
    const clientToken = await applepay.generateClientToken();
    res.render("applepay", { clientId, clientToken, merchantId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// create order
app.post("/applepay/api/orders", async (req, res) => {
  try {
    const order = await applepay.createOrder();
    console.log("order", order);
    res.json(order);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// capture payment
app.post("/applepay/api/orders/:orderID/capture", async (req, res) => {
  const { orderID } = req.params;
  try {
    const captureData = await applepay.capturePayment(orderID);
    res.json(captureData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/googlepay", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID,
    merchantId = process.env.PAYPAL_MERCHANT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  try {
    if (!clientId || !merchantId || !clientSecret) {
      throw new Error("Client Id or App Secret or Merchant Id is missing.");
    }
    const clientToken = await googlepay.generateClientToken();
    res.render("googlepay", { clientId, clientToken, merchantId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// create order
app.post("/googlepay/api/orders", async (req, res) => {
  try {
    const order = await googlepay.createOrder();
    res.json(order);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get order
app.post("/googlepay/api/orders/:orderID", async (req, res) => {
  const { orderID } = req.params;
  try {
    const order = await googlepay.getOrder(orderID);
    res.json(order);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// capture payment
app.post("/googlepay/api/orders/:orderID/capture", async (req, res) => {
  const { orderID } = req.params;
  try {
    const captureData = await googlepay.capturePayment(orderID);
    res.json(captureData);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/subs/api/create-product-plan", async (req, res) => {
  try {
    const accessToken = await subs.generateAccessToken();
    const productResponse = await fetch(`${base}/v1/catalogs/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Gym Membership",
        description: "A monthly membership for the gym",
        type: "SERVICE",
        category: "EXERCISE_AND_FITNESS",
        image_url: "https://example.com/image.jpg",
        home_url: "https://example.com",
      }),
    });

    if (!productResponse.ok) {
      const error = await productResponse.text();
      console.error("Product creation error:", error);
      return res.status(productResponse.status).send("Error creating product");
    }

    const productData = await productResponse.json();
    const productId = productData.id;

    const planResponse = await fetch(`${base}/v1/billing/plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        name: "Basic Gym Plan",
        description: "Monthly subscription to the gym.",
        billing_cycles: [
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
            total_cycles: 12,
            pricing_scheme: {
              fixed_price: {
                value: "35",
                currency_code: "GBP",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "0",
            currency_code: "GBP",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage: "0",
          inclusive: false,
        },
      }),
    });

    if (!planResponse.ok) {
      const error = await planResponse.text();
      console.error("Plan creation error:", error);
      return res.status(planResponse.status).send("Error creating plan");
    }

    const planData = await planResponse.json();
    res.json({ productId, planId: planData.id });
  } catch (error) {
    console.error("Error creating product or plan:", error);
    res.status(500).send("Error creating product or plan");
  }
});

app.get("/subs", async (req, res) => {
  res.render("subs");
});

app.post("/authcap/api/orders", async (req, res) => {
  try {
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await authcap.createOrder(cart);

    if (httpStatusCode === 201) {
      // HTTP 201 Created
      // Send the order ID back to the client
      const orderID = jsonResponse.id;
      res.status(httpStatusCode).json({ orderID });
    } else {
      res.status(httpStatusCode).json(jsonResponse);
    }
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/authcap/api/orders/:orderID/authorize", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await authcap.authorizeOrder(
      orderID
    );
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to authorize order:", error);
    res.status(500).json({ error: "Failed to authorize order." });
  }
});

app.post("/authcap/api/orders/:authorizationID/capture", async (req, res) => {
  try {
    const { authorizationID } = req.params;
    console.log(
      `Attempting to capture with authorizationID: ${authorizationID}`
    );
    const { jsonResponse, httpStatusCode } = await authcap.captureOrder(
      authorizationID
    );
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

app.get("/authcap", async (req, res) => {
  res.render("authcap");
});

app.post("/standard/api/orders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await standard.createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/standard/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await standard.captureOrder(
      orderID
    );
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

app.post("/clientToken", async (req, res) => {
  try {
    const customerID = req.body.customerID;
    console.log("req.body customerID", req.body.customerID);
    const clientToken = await braintreeAPI.generateAccessToken(customerID);

    return res.json({
      clientToken,
    });
  } catch (error) {
    res.status(500).send("Fail to generate Access Token");
  }
});

app.get("/hostedfields", async (req, res) => {
  // render paypal view
  res.render("hostedfields", {
    currency: BRAINTREE_CURRENCY,
    MID: BRAINTREE_MERCHANT_ID,
  });
});

app.post("/transaction/create", async (req, res) => {
  try {
    const nonceFromTheClient = req.body.payment_method_nonce;
    console.log("req.body", req.body);

    gateway.transaction
      .sale({
        amount: req.body.amount,
        paymentMethodNonce: nonceFromTheClient,
        // deviceData: deviceDataFromTheClient,
        options: {
          submitForSettlement: true,
        },
      })
      .then((result) => {
        console.log(result);
        res.json(result);
      });
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({
      error: "Failed to create order.",
    });
  }
});

app.get("/standard", async (req, res) => {
  res.render("standard");
});

app.get("/", async (req, res) => {
  res.render("index");
});

app.get("/standardview", async (req, res) => {
  res.render("standardview");
});

app.get("/advancedview", async (req, res) => {
  res.render("advancedview");
});

app.get("/cards", async (req, res) => {
  res.render("cards");
});

app.get("/viewstandard", async (req, res) => {
  res.render("viewstandard");
});

app.get("/viewadvanced", async (req, res) => {
  res.render("viewadvanced");
});

app.get("/viewapplepay", async (req, res) => {
  res.render("viewapplepay");
});

app.get("/viewgooglepay", async (req, res) => {
  res.render("viewgooglepay");
});

app.get("/viewsubs", async (req, res) => {
  res.render("viewsubs");
});

app.get("/viewauthcap", async (req, res) => {
  res.render("viewauthcap");
});

app.get(
  "/.well-known/apple-developer-merchantid-domain-association",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "..",

        ".well-known",
        "apple-developer-merchantid-domain-association"
      ),
      {
        headers: {
          "Content-Type": "text/plain",
        },
      }
    );
  }
);

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
