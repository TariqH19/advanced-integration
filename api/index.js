import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import axios from "axios";
import path from "path";
import {
  getOrderDetails,
  createOrder,
  capturePayment,
  generateAccessToken,
  deletePaymentToken,
  fetchAllPaymentTokens,
} from "../server/paypal-api.js"; // Import your PayPal helper functions
import * as googlepay from "../server/googlepay-api.js";
import * as applepay from "../server/apple-api.js";
import * as subs from "../server/subs-api.js";
import * as authcap from "../server/authcap-api.js";
import * as standard from "../server/standard-api.js";
import * as braintreeAPI from "../server/braintree-api.js";
import * as old from "../server/old-api.js";
import * as shipping from "../server/shipping-api.js";
import * as invoiceAPI from "../server/invoice-api.js";
import * as tracking from "../server/tracking-api.js";
import * as multi from "../server/multi-api.js";
import * as multiacdc from "../server/multiacdc-api.js";
import * as serversdk from "../server/serversdk-api.js";
import * as payout from "../server/payout-api.js";
import braintree from "braintree";
import * as ideal from "../server/oauth.js";
import * as pui from "../server/pui-api.js";
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
// const { PAYPAL_CLIENT_ID, PAYPAL_MERCHANT_ID } = process.env;

const base = "https://api-m.sandbox.paypal.com";
// Convert file URL to file path
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Host static files
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));
app.set("view engine", "ejs");
const viewsPath = path.join(__dirname, "../server/views");
app.set("views", viewsPath);

// Middleware to parse JSON requests
app.use(express.json());

app.post("/paypal/shipping-options", async (req, res) => {
  try {
    const shippingAddress = req.body.shipping_address; // your example sends shipping_address
    console.log("Incoming shipping address from PayPal:", shippingAddress);

    const response = {
      id: "2EP3GYF8I7T4",
      purchase_units: [
        {
          reference_id: null,
          amount: {
            currency_code: "USD",
            value: "0.0",
            breakdown: {
              shipping: {
                currency_code: "USD",
                value: "0.00",
              },
            },
          },
          shipping: {
            amount: {
              currency_code: "USD",
              value: "0.00",
            },
          },
          shipping_options: [
            {
              id: "1",
              label: "Free Shipping",
              type: "SHIPPING",
              selected: true,
              amount: {
                currency_code: "USD",
                value: "0.00",
              },
            },
            {
              id: "2",
              label: "USPS Priority Shipping",
              type: "SHIPPING",
              selected: false,
              amount: {
                currency_code: "USD",
                value: "7.00",
              },
            },
            {
              id: "3",
              label: "1-Day Shipping",
              type: "SHIPPING",
              selected: false,
              amount: {
                currency_code: "USD",
                value: "10.00",
              },
            },
          ],
        },
      ],
    };

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.json(response);
  } catch (error) {
    console.error("Shipping Options Error:", error);
    res.status(500).json({ error: "Failed to return shipping options" });
  }
});

// Render checkout page with client ID
app.get("/acdc", async (req, res) => {
  const clientId = PAYPAL_CLIENT_ID;

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

app.get("/multiacdc", async (req, res) => {
  try {
    const { jsonResponse } = await multiacdc.generateClientToken();
    res.render("multiacdc", {
      clientId:
        "ARocB5vASgIfpjzqB1o2VqWJmjlrwsWEtq03k5m02Bc148BM5HdgJmR9UOUYdG7Cd-96L8UGWy6oNlWg",
      clientToken: jsonResponse.client_token,
      BN_CODE: "FLAVORsb-owgkx33159963_MP",
      merchantId: "3LTVQ6ETBNNM2",
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/multi/api/orders", async (req, res) => {
  try {
    // Use the cart information passed from the front-end to calculate the order amount details
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await multiacdc.createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({
      error: "Failed to create order.",
    });
  }
});

app.post("/multi/api/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode } = await multiacdc.captureOrder(
      orderID
    );
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({
      error: "Failed to capture order.",
    });
  }
});

app.get("/multi", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("multi", {
    clientId,
  });
});

app.post("/start-onboarding", async (req, res) => {
  try {
    const approvalUrl = await multi.createPartnerReferral();
    res.json({ approvalUrl });
  } catch (error) {
    console.error("Error starting onboarding:", error.message);
    res.status(500).json({ error: "Failed to initiate onboarding." });
  }
});

// Endpoint to handle PayPal redirect after onboarding completion
app.get("/onboarding-complete", (req, res) => {
  const queryParams = req.query;
  console.log("Onboarding completed with query params:", queryParams);

  // Show a success page or handle the merchant details here
  res.send(
    "Onboarding process completed! You can now use the merchant details."
  );
});

app.get("/old", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("oldintegration", {
    clientId,
  });
});

app.post("/api/create-invoice", async (req, res) => {
  try {
    const accessToken = await invoiceAPI.generateAccessToken();
    const invoiceData = req.body;
    const invoice = await invoiceAPI.createInvoice(accessToken, invoiceData);

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
    const accessToken = await invoiceAPI.generateAccessToken();
    const { invoiceId } = req.body;
    const response = await invoiceAPI.sendInvoice(accessToken, invoiceId);
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send invoice" });
  }
});

app.get("/api/list-invoices", async (req, res) => {
  try {
    const accessToken = await invoiceAPI.generateAccessToken();
    const invoices = await invoiceAPI.listInvoices(accessToken);

    if (invoices.items) {
      res.status(200).json(invoices.items);
    } else {
      res.status(404).json({ error: "No invoices found." });
    }
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices." });
  }
});

app.get("/bart", async (req, res) => {
  const clientId = PAYPAL_CLIENT_ID,
    merchantId = PAYPAL_MERCHANT_ID;
  try {
    const clientToken = await applepay.generateClientToken();
    res.render("bart", { clientId, clientToken, merchantId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/serversdk", async (req, res) => {
  res.render("serversdk");
});

app.get("/newstuff", async (req, res) => {
  res.render("newstuff");
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

app.post("/serversdk/api/neworders", async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await serversdk.newCreateOrder(
      cart
    );
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

// Route to vault a payment method
app.post("/vault-payment-method", async (req, res) => {
  try {
    const accessToken = await old.generateAccessToken();
    const vaultedPaymentMethod = await old.vaultPaymentMethod(accessToken);
    res.json({ success: true, vaultedPaymentMethod });
  } catch (error) {
    console.error("Error vaulting payment method:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to vault payment method" });
  }
});
// Route to create a subscription
app.post("/create-subscription", async (req, res) => {
  try {
    const { vaultedPaymentTokenId } = req.body;
    const accessToken = await old.generateAccessToken();
    const subscription = await old.createSubscription(
      accessToken,
      vaultedPaymentTokenId
    );
    res.json({ success: true, subscription });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create subscription" });
  }
});
app.get("/vaultsub", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  res.render("vaultsub", {
    clientId,
  });
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

app.get("/ideal", (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID_NL;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET_NL;
  if (!clientId || !clientSecret) {
    res.status(500).send("Client ID and/or Client Secret is missing");
  } else {
    res.render("ideal", { clientId });
  }
});

app.post("/ideal/api/orders", async (req, res) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  const { cart } = req.body;

  const { access_token } = await ideal.getAccessToken();
  const { data } = await axios({
    url: `${base}/v2/checkout/orders`,
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${access_token}`,
    },
    data: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "EUR",
            value: "49.99",
          },
        },
      ],
    }),
  });

  console.log(`Order Created!`);
  res.json(data);
});

app.post("/ideal/api/orders/:orderId/capture", async (req, res) => {
  const { orderId } = req.params;

  const { access_token } = await ideal.getAccessToken();

  const { data } = await axios({
    url: `${base}/v2/checkout/orders/${orderId}/capture`,
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${access_token}`,
    },
  });

  console.log(`💰 Payment captured!`);
  res.json(data);
});

app.get("/oldrefund", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("oldrefund", {
    clientId,
  });
});

app.get("/ppcp", async (req, res) => {
  const clientId = PAYPAL_CLIENT_ID,
    merchantId = PAYPAL_MERCHANT_ID;
  try {
    const clientToken = await applepay.generateClientToken();
    res.render("ppcp", { clientId, clientToken, merchantId });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post("/old/api/captures/:captureId/refund", async (req, res) => {
  const { captureId } = req.params;

  try {
    const refundData = await old.refundCapturedPayment(captureId);
    res.json(refundData); // Return the response from PayPal
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ error: "Failed to process refund" });
  }
});

app.post("/add-tracking", async (req, res) => {
  const trackers = req.body.trackers; // Asumiendo que la información de tracking viene en el body del request

  try {
    const trackingResponse = await tracking.addTrackingInfo(trackers);
    res.json({
      message: "Tracking added successfully",
      data: trackingResponse,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding tracking", error: error.message });
  }
});

app.get("/get-tracking/:transactionId/:trackingNumber", async (req, res) => {
  const { transactionId, trackingNumber } = req.params; // Obtenemos los valores de los parámetros dinámicos

  try {
    const trackingInfo = await tracking.fetchTrackingInfo(
      transactionId,
      trackingNumber
    ); // Pasamos los valores a la función
    res.json(trackingInfo); // Enviamos la información de tracking de vuelta al cliente
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving tracking information",
      error: error.message,
    });
  }
});

// Endpoint para actualizar la información de tracking
app.put("/update-tracking", async (req, res) => {
  const { transactionId, trackingNumber, status, carrier } = req.body;

  try {
    const accessToken = await tracking.generateAccessToken(); // Obtener el access token del servidor

    const trackingInfo = {
      transaction_id: transactionId,
      tracking_number: trackingNumber,
      status: status,
      carrier: carrier,
    };

    const response = await fetch(
      `${base}/v1/shipping/trackers/${transactionId}-${trackingNumber}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(trackingInfo),
      }
    );

    if (response.ok) {
      res.status(204).send(); // HTTP 204 No Content
    } else {
      const errorData = await response.json();
      res.status(400).json({ error: errorData });
    }
  } catch (error) {
    console.error("Error updating tracking info:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/tracking/orders", async (req, res) => {
  try {
    // Usar la información del carrito desde el front-end para calcular el monto de la orden
    const { cart } = req.body;
    const { jsonResponse, httpStatusCode } = await tracking.createOrder(cart);
    res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/tracking/orders/:orderID/capture", async (req, res) => {
  try {
    const { orderID } = req.params;
    const { jsonResponse, httpStatusCode, orderDetails } =
      await tracking.captureOrder(orderID);

    if (orderDetails) {
      // Extrae el número de teléfono del pagador
      const phoneNumber =
        orderDetails?.payment_source?.paypal?.phone_number?.national_number ||
        "No phone number provided";

      console.log(`Phone Number: ${phoneNumber}`);

      // Devuelve también los detalles del pedido al cliente
      res.status(httpStatusCode).json({ ...jsonResponse, phoneNumber });
    } else {
      res.status(httpStatusCode).json(jsonResponse);
    }
  } catch (error) {
    console.error("Failed to capture order:", error);
    res.status(500).json({ error: "Failed to capture order." });
  }
});

app.get("/tracking", async (req, res) => {
  res.render("tracking");
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

app.get("/googlepay/api/orders/:orderID", async (req, res) => {
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

app.get("/dropin", async (req, res) => {
  // render paypal view
  res.render("dropin", {
    currency: BRAINTREE_CURRENCY,
    MID: BRAINTREE_MERCHANT_ID,
  });
});

app.get("/dropinn", (req, res) => {
  gateway.clientToken.generate({}, (err, response) => {
    err ? console.log(err) : res.send(response.clientToken);
  });
});
app.post("/dropincreate", (req, res, next) => {
  const nonce = req.body.paymentMethodNonce;
  const setAmount = req.body.amount;
  gateway.transaction.sale(
    {
      paymentMethodNonce: nonce,
      amount: setAmount,
      options: {
        submitForSettlement: true,
      },
    },
    (error, result) => {
      if (result) {
        res.send(result);
      } else {
        res.status(500).send(error);
        console.log(error);
      }
    }
  );
});

app.get("/brain/client_token", async (req, res) => {
  try {
    const response = await gateway.clientToken.generate({});
    res.json({ clientToken: response.clientToken });
  } catch (err) {
    res.status(500).send(err);
  }
});

// Handle Payment
app.post("/brain/process_payment", async (req, res) => {
  const nonce = req.body.paymentMethodNonce;

  try {
    const result = await gateway.transaction.sale({
      amount: "10.00", // Example amount
      paymentMethodNonce: nonce,
      options: {
        submitForSettlement: true,
      },
    });

    if (result.success) {
      res.json({ success: true, transaction: result.transaction });
    } else {
      res.status(500).json({ success: false, error: result.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err });
  }
});

app.get("/brain", async (req, res) => {
  // render paypal view
  res.render("brain", {
    currency: BRAINTREE_CURRENCY,
    MID: BRAINTREE_MERCHANT_ID,
  });
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

app.post("/pui/orders", async (req, res) => {
  try {
    if (!req || !req.headers) {
      throw new Error("Invalid request: Missing headers.");
    }

    const clientMetadataId = req.headers["paypal-client-metadata-id"];
    if (!clientMetadataId) {
      return res
        .status(400)
        .json({ error: "Missing PayPal-Client-Metadata-Id" });
    }

    const order = await pui.createOrder(req, res); // Assuming createOrder is defined elsewhere
    res.json(order);
  } catch (err) {
    console.error("Error creating order:", err.message);
    res.status(500).send(err.message);
  }
});

app.get("/pui", async (req, res) => {
  res.render("pui");
});

app.get("/stc/getTrackingID", (req, res) => {
  const trackingID = `tracking_${Date.now()}`;
  res.send(trackingID);
});

app.post("/stc/setTransactionContext", async (req, res) => {
  const { trackingID } = req.body;

  if (!trackingID) {
    return res.status(400).json({ error: "Tracking ID is required" });
  }

  const accessToken = await getAccessToken();

  const additionalData = {
    additional_data: [
      { key: "sender_account_id", value: "123456789" },
      { key: "sender_first_name", value: "Jack" },
      { key: "sender_last_name", value: "Reacher" },
      { key: "sender_email", value: "jack.reacher@gmail.com" },
      { key: "sender_phone", value: "0830711234" },
      { key: "sender_country_code", value: "FR" },
      { key: "sender_create_date", value: "2012-12-09T19:14:55.277Z" },
    ],
  };

  try {
    const response = await fetch(
      `${PAYPAL_API}/v1/risk/transaction-contexts/X46S3PVBA88NC/${trackingID}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(additionalData),
      }
    );

    // Log the raw response for debugging
    const rawText = await response.text();
    console.log("Raw Response Text:", rawText);

    // Parse JSON only if the response body is not empty
    const responseData = rawText ? JSON.parse(rawText) : {};

    if (!response.ok) {
      console.error("Error setting transaction context:", responseData);
      return res.status(response.status).json(responseData);
    }

    console.log("Set Transaction Context:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error setting transaction context:", error.message);
    res.status(500).json({
      error: "An error occurred while setting the transaction context",
    });
  }
});

// Show Transaction Context Data
app.post("/stc/showTransactionContextData", async (req, res) => {
  const { trackingID } = req.body;

  if (!trackingID) {
    return res.status(400).json({ error: "Tracking ID is required" });
  }

  const accessToken = await getAccessToken();

  try {
    const response = await fetch(
      `${PAYPAL_API}/v1/risk/transaction-contexts/J36FP579FJ6NW/${trackingID}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Error fetching transaction context data:", responseData);
      return res.status(response.status).json(responseData);
    }

    console.log("Transaction Context Data:", responseData);
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching transaction context data:", error.message);
    res.status(500).json({
      error: "An error occurred while fetching the transaction context data",
    });
  }
});

// Endpoint to Create PayPal Order
app.post("/stc/createOrder", async (req, res) => {
  const { trackingID } = req.body;

  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "PayPal-Request-Id": trackingID,
      "PayPal-Client-Metadata-Id": trackingID,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: "240.00",
          },
        },
      ],
    }),
  });

  const order = await response.json();
  res.json(order);
});

// Endpoint to Capture PayPal Order
app.post("/stc/captureOrder", async (req, res) => {
  const { orderID } = req.body;

  const accessToken = await getAccessToken();
  const response = await fetch(
    `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const captureDetails = await response.json();
  res.json(captureDetails);
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

app.get("/stc", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;

  res.render("stc", {
    clientId,
  });
});

app.get("/standard", async (req, res) => {
  res.render("standard");
});

app.get("/", async (req, res) => {
  res.render("index");
});

app.get("/applereact", async (req, res) => {
  res.render("applereact");
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
          "Content-Type": "application/octet-stream",
        },
      }
    );
  }
);

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
