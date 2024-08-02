import "dotenv/config";
import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import {
  getOrderDetails,
  createOrder,
  capturePayment,
  generateAccessToken,
} from "../server/paypal-api.js"; // Import your PayPal helper functions
let PAYPAL_CLIENT = process.env.PAYPAL_CLIENT;
let PAYPAL_SECRET = process.env.PAYPAL_SECRET;
let FASTLANE_APPROVED_DOMAINS_CSV = process.env.FASTLANE_APPROVED_DOMAINS_CSV;
let PAYPAL_API_BASE_URL = "https://api-m.sandbox.paypal.com";
const baseUrl = {
  sandbox: "https://api.sandbox.paypal.com",
};
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

// Render checkout page with client ID
app.get("/", async (req, res) => {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const tokenId = await generateAccessToken();

  res.render("checkout", {
    clientId,
    tokenId,
  });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { task, saveCard } = req.body;
    const order = await createOrder(task, saveCard);
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

app.post("/webhook", async (req, res) => {
  console.log("Webhook received", JSON.stringify(req.body, null, 2));
  const eventType = req.body.event_type || req.body.eventType;
  const resource = req.body.resource;

  if (eventType === "VAULT.PAYMENT-TOKEN.CREATED") {
    if (resource && resource.id) {
      const vaultID = resource.id;
      console.log("Vault ID received", vaultID);

      // Optionally save vault ID or perform additional processing
    } else {
      console.log("Vault data not found in the response");
    }
  } else {
    console.log("Received webhook event is not related to vault creation");
  }

  res.sendStatus(200).send("Webhook processed");
});

async function fetchAllPaymentTokens(customerId) {
  const accessToken = await generateAccessToken();
  let allTokens = [];
  let page = 1;
  let pageSize = 5;
  let totalPages;

  do {
    const response = await fetch(
      `${baseUrl.sandbox}/v3/vault/payment-tokens?customer_id=${customerId}&page=${page}&page_size=${pageSize}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error fetching payment tokens: ${errorText}`);
    }

    const data = await response.json();
    allTokens = allTokens.concat(data.payment_tokens);
    totalPages = data.total_pages;
    page++;
  } while (page <= totalPages);

  return allTokens;
}

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
    console.error("Error retrieving payment tokens:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pay-with-saved-method", async (req, res) => {
  const paymentToken = req.body.paymentToken;
  const paymentAmount = req.body.amount || "50.00";

  if (!paymentToken) {
    return res.status(400).json({ error: "Payment token is required" });
  }

  try {
    const data = {
      intent: "CAPTURE",
      payment_source: {
        token: {
          type: "PAYMENT_METHOD_TOKEN",
          id: paymentToken,
        },
      },
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: paymentAmount,
          },
          shipping: {
            name: {
              full_name: "Walter White",
            },
            address: {
              address_line_1: "308 Negra Arroyo Lane",
              admin_area_2: "Roma",
              admin_area_1: "RM",
              postal_code: "00100",
              country_code: "IT",
            },
            shipping_type: "SHIPPING",
          },
        },
      ],
    };

    const requestId = `order-${Date.now()}`;

    const response = await fetch(
      "https://api.sandbox.paypal.com/v2/checkout/orders/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await generateAccessToken()}`,
          "PayPal-Request-Id": requestId,
          Prefer: "return=representation",
        },
        body: JSON.stringify(data),
      }
    );

    const orderData = await response.json();
    res.json(orderData);
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: error.message });
  }
});

exports.handler = async (event) => {
  let request_body = JSON.parse(event.body);
  console.log("Received request:", request_body);

  switch (request_body.method) {
    case "fastlane_auth":
      return handle_fastlane_auth();
    case "auth":
      return handle_auth();
    case "card_order":
      return handle_card_order(request_body);
    case "create_order":
      return handle_create_order(request_body);
    case "complete_order":
      return handle_complete_order(request_body);
    default:
      console.error("Invalid method:", request_body.method);
      return {
        statusCode: 400,
        body: "Invalid endpoint",
      };
  }
};

// Handle Authentication
let handle_auth = async () => {
  try {
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    return {
      statusCode: 200,
      body: JSON.stringify({ access_token }),
    };
  } catch (error) {
    console.error("Error in handle_auth:", error);
    return {
      statusCode: 500,
      body: error.toString(),
    };
  }
};

// Handle Fastlane Authentication
let handle_fastlane_auth = async () => {
  try {
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    let fastlane_auth_response = await fetch(
      `${PAYPAL_API_BASE_URL}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${access_token}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          response_type: "client_token",
          intent: "sdk_init",
          "domains[]": FASTLANE_APPROVED_DOMAINS_CSV,
        }),
      }
    );

    let fastlane_auth_response_json = await fastlane_auth_response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        access_token: fastlane_auth_response_json.access_token,
      }),
    };
  } catch (error) {
    console.error("Error in handle_fastlane_auth:", error);
    return {
      statusCode: 500,
      body: error.toString(),
    };
  }
};

// Handle Card Order
let handle_card_order = async (request_body) => {
  try {
    let { amount, payment_source, single_use_token, shipping_address } =
      request_body;
    let create_order_response = await create_order({
      amount,
      payment_source,
      single_use_token,
      shipping_address,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(create_order_response),
    };
  } catch (error) {
    console.error("Error in handle_card_order:", error);
    return {
      statusCode: 500,
      body: error.toString(),
    };
  }
};

// Handle Create Order
let handle_create_order = async (request_body) => {
  try {
    let { amount, payment_source, shipping_address } = request_body;
    let create_order_request = await create_order({
      amount,
      payment_source,
      shipping_address,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(create_order_request),
    };
  } catch (error) {
    console.error("Error in handle_create_order:", error);
    return {
      statusCode: 500,
      body: error.toString(),
    };
  }
};

// Handle Complete Order
let handle_complete_order = async (request_body) => {
  try {
    let capture_paypal_order_response = await capture_paypal_order(
      request_body.order_id
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(capture_paypal_order_response),
    };
  } catch (error) {
    console.error("Error in handle_complete_order:", error);
    return {
      statusCode: 500,
      body: error.toString(),
    };
  }
};

// Capture PayPal Order
// https://developer.paypal.com/docs/api/orders/v2/#orders_capture
let capture_paypal_order = async (order_id) => {
  try {
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    let url = `${PAYPAL_API_BASE_URL}/v2/checkout/orders/${order_id}/capture`;

    let capture_request = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: "{}",
    });
    let capture_response = await capture_request.json();
    // You always want to sanitize API responses. No need to send the full
    // data dump to the client as to avoid unwanted data exposure
    let sanitized_paypal_capture_response = {
      amount: {
        value:
          capture_response.purchase_units[0].payments.captures[0].amount.value,
        currency:
          capture_response.purchase_units[0].payments.captures[0].amount
            .currency_code,
      },
      payment_method: {},
    };
    // Check for PayPal details and set payment method accordingly
    if (capture_response.payment_source.paypal) {
      sanitized_paypal_capture_response.payment_method.type = "paypal";
      sanitized_paypal_capture_response.payment_method.details = {
        email: capture_response.payment_source.paypal.email_address,
      };
    }
    // Check for Venmo details and set payment method accordingly
    if (capture_response.payment_source.venmo) {
      sanitized_paypal_capture_response.payment_method.type = "venmo";
      sanitized_paypal_capture_response.payment_method.details = {
        email: capture_response.payment_source.venmo.email_address,
      };
    }
    console.log(
      "Capture Order Response:",
      JSON.stringify(capture_response, null, 2)
    );
    return sanitized_paypal_capture_response;
  } catch (error) {
    console.error("Error in capture_paypal_order:", error);
    throw error;
  }
};

// Create Order
// https://developer.paypal.com/docs/api/orders/v2/#orders_create
let create_order = async (request_object) => {
  try {
    let { amount, payment_source, single_use_token, shipping_address } =
      request_object;
    let access_token_response = await get_access_token();
    let access_token = access_token_response.access_token;
    let create_order_endpoint = `${PAYPAL_API_BASE_URL}/v2/checkout/orders`;
    let purchase_unit_object = {
      amount: {
        currency_code: "USD",
        value: amount,
        breakdown: {
          item_total: {
            currency_code: "USD",
            value: amount,
          },
        },
      },
      items: [
        {
          name: "Buy Me",
          quantity: "1",
          category: shipping_address ? "PHYSICAL_GOODS" : "DIGITAL_GOODS",
          unit_amount: {
            currency_code: "USD",
            value: amount,
          },
        },
      ],
    };
    // If using shipping addresses, replace these options
    // with the options from your server
    if (shipping_address) {
      purchase_unit_object.shipping = {
        options: [
          {
            id: "my_custom_shipping_option_1",
            label: "Free Shipping",
            type: "SHIPPING",
            selected: true,
            amount: {
              currency_code: "USD",
              value: "0.00",
            },
          },
          {
            id: "my_custom_shipping_option_2",
            label: "Basic Shipping",
            type: "SHIPPING",
            selected: false,
            amount: {
              currency_code: "USD",
              value: "3.50",
            },
          },
        ],
        name: {
          full_name: "John Doe",
        },
        address: shipping_address,
      };
    }

    let payload = {
      intent: "CAPTURE",
      purchase_units: [purchase_unit_object],
      payment_source: {},
    };
    payload.payment_source[payment_source] = {
      // "experience_context" is optional, but if the payment_source
      // is "card" then "single_use_token" must be passed (Few lines down)
      experience_context: {
        brand_name: "BUY ME",
        shipping_preference: shipping_address ? "GET_FROM_FILE" : "NO_SHIPPING",
        user_action: "PAY_NOW",
        payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
      },
    };
    if (payment_source === "card") {
      // https://developer.paypal.com/docs/api/orders/v2/#orders_create!path=purchase_units/soft_descriptor&t=request
      purchase_unit_object.soft_descriptor = "BIZNAME HERE";
      //If using card, "single_use_token" is not optional
      payload.payment_source.card = {
        single_use_token: single_use_token,
      };
    }
    console.log(
      "Payload before creating Order:",
      JSON.stringify(payload, null, 2)
    );
    let create_order_request = await fetch(create_order_endpoint, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
        // PayPal-Request-Id shouldn't necessarily be random,
        // but if so, store it yourself for referencing. Learn more:
        // https://developer.paypal.com/api/rest/reference/idempotency/
        "PayPal-Request-Id": Math.random().toString(),
      },
      method: "POST",
      body: JSON.stringify(payload),
    });
    let json_response = await create_order_request.json();
    console.log("Order API Response:", JSON.stringify(json_response, null, 2));
    //If fastlane order, then this is final response
    if (payment_source === "card") {
      // You always want to sanitize API responses. No need to send the full
      // data dump to the client as to avoid unwanted data exposure
      let sanitized_card_capture_response = {
        amount: {
          value:
            json_response.purchase_units[0].payments.captures[0].amount.value,
          currency:
            json_response.purchase_units[0].payments.captures[0].amount
              .currency_code,
        },
        payment_method: {
          type: "card",
          details: {
            brand: json_response.payment_source.card.brand,
            last_digits: json_response.payment_source.card.last_digits,
            name: json_response.payment_source.card.name,
          },
        },
      };
      return sanitized_card_capture_response;
    }
    //Otherwise you have just created an Order and not finalized a payment
    else {
      return { id: json_response.id };
    }
  } catch (error) {
    console.error("Error creating order:", error);
    return {
      statusCode: 400,
      body: error.toString(),
    };
  }
};

// Get Access Token
let get_access_token = async () => {
  try {
    let auth = Buffer.from(`${PAYPAL_CLIENT}:${PAYPAL_SECRET}`).toString(
      "base64"
    );
    let request_body = "grant_type=client_credentials";

    let access_token_request = await fetch(
      `${PAYPAL_API_BASE_URL}/v1/oauth2/token`,
      {
        method: "POST",
        body: request_body,
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    let access_token_response = await access_token_request.json();

    if (!access_token_request.ok) {
      throw new Error(
        access_token_response.error_description ||
          "Failed to fetch access token"
      );
    }

    return { access_token: access_token_response.access_token };
  } catch (error) {
    console.error("Error fetching access token:", error);
    return {
      statusCode: 400,
      body: error.toString(),
    };
  }
};

app.listen(8888, () => {
  console.log("Listening on http://localhost:8888/");
});
