import { get } from "mongoose";

// PayPal API credentials
const PAYPAL_CLIENT_ID =
  "AZZcaNxzv0bpXBz0qoto4lBToqSM3M_rS6uVMh3GLno5zvG5-EuIkVLDuY0DUYJXh-7G-Rm4fNcir-y5";
const PAYPAL_SECRET =
  "EMqtKbTyiFk3_tc6dYUOYTWg8eclevf2UGvpe7DUa9LOZiQBIki4dfKKdiT9FIko6y6Q_PeTDXRILOc3";
const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com"; // Use sandbox for testing

// Function to generate a unique request ID
function generateRequestId() {
  const randomPart = Math.random().toString(36).substring(2, 15);
  const timestampPart = Date.now().toString(36);
  return `paypal_${randomPart}${timestampPart}`;
}

function generateReferenceId() {
  return `REF_${Math.random().toString(36).substring(2, 10)}${Date.now()}`;
}

// Function to generate an access token
async function getAccessToken() {
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`
      ).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to retrieve access token");
  }

  const data = await response.json();
  return data.access_token;
}

// Function to create an order
export async function createOrder(req, res) {
  try {
    const accessToken = await getAccessToken();

    // Get the FraudNet `f` value from the `PayPal-Client-Metadata-Id` header
    const clientMetadataId = req.headers["paypal-client-metadata-id"];
    // if (!clientMetadataId) {
    //   return res
    //     .status(400)
    //     .json({ error: "Missing PayPal-Client-Metadata-Id" });
    // }

    // Define order data with all required fields
    const orderData = {
      intent: "CAPTURE",
      processing_instruction: "ORDER_COMPLETE_ON_PAYMENT_APPROVAL",
      purchase_units: [
        {
          reference_id: generateReferenceId(),
          amount: {
            currency_code: "EUR",
            value: "100.00",
            breakdown: {
              item_total: { currency_code: "EUR", value: "90.00" },
              tax_total: { currency_code: "EUR", value: "10.00" },
            },
          },
          items: [
            {
              name: "Sample Item",
              description: "Description of the item",
              sku: "12345",
              unit_amount: { currency_code: "EUR", value: "90.00" },
              tax: { currency_code: "EUR", value: "10.00" },
              tax_rate: "11.11",
              quantity: "1",
              category: "PHYSICAL_GOODS",
            },
          ],
          shipping: {
            name: { full_name: "John Doe" },
            address: {
              address_line_1: "123 Main St",
              address_line_2: "Apt 4B",
              admin_area_2: "Berlin",
              postal_code: "10115",
              country_code: "DE",
            },
          },
          invoice_id: generateRequestId(),
          custom_id: generateRequestId(),
        },
      ],
      payment_source: {
        pay_upon_invoice: {
          name: { given_name: "John", surname: "Doe" },
          email: "customer@example.com",
          birth_date: "1985-10-15",
          billing_address: {
            address_line_1: "123 Main St",
            admin_area_2: "Berlin",
            postal_code: "10115",
            country_code: "DE",
          },
          phone: {
            country_code: "49",
            national_number: "1234567890",
          },
          experience_context: {
            locale: "en-DE",
            brand_name: "EXAMPLE INC",
            logo_url: "https://example.com/logoUrl.svg",
            customer_service_instructions: [
              "Customer service phone is +49 6912345678.",
            ],
          },
        },
      },
    };

    // const requestId = generateRequestId();

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "PayPal-Request-Id": generateRequestId(),
        "PayPal-Client-Metadata-Id": clientMetadataId,
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Error creating order:", error.message);
    res.status(500).json({ error: "Failed to create order" });
  }
}
