const PAYPAL_CLIENT_ID =
  "ARocB5vASgIfpjzqB1o2VqWJmjlrwsWEtq03k5m02Bc148BM5HdgJmR9UOUYdG7Cd-96L8UGWy6oNlWg";
const PAYPAL_CLIENT_SECRET =
  "EKBr7bo6d_kHDan3vk9w3VU5mc8HcJ_SlBkHpdm1zH8-Z2EF-aRgXm_JryLCuIX2awucMyPaGY5zQGer";
const BASE_URL = "https://api-m.sandbox.paypal.com";
const BN_CODE = "FLAVORsb-owgkx33159963_MP"; // Add BN Code
const base = `${BASE_URL}`;

const SELLER_PAYER_ID = "3LTVQ6ETBNNM2"; //Add Seller Payer ID

/**
 * Generate an OAuth 2.0 access token for authenticating with PayPal REST APIs.
 * @see https://developer.paypal.com/api/rest/authentication/
 */
const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");
    //const bn_code = BN_CODE;
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
        "PayPal-Partner-Attribution-Id": BN_CODE,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
};

const authassertion = async () => {
  function encodeObjectToBase64(object) {
    const objectString = JSON.stringify(object);
    return Buffer.from(objectString).toString("base64");
  }

  const clientId = PAYPAL_CLIENT_ID;
  const sellerPayerId = SELLER_PAYER_ID; // preferred
  // const sellerEmail = "SELLER-ACCOUNT-EMAIL"; // use instead if payer-id unknown

  const header = {
    alg: "none",
  };
  const encodedHeader = encodeObjectToBase64(header);

  const payload = {
    iss: clientId,
    payer_id: sellerPayerId,
    // email: sellerEmail
  };
  const encodedPayload = encodeObjectToBase64(payload);

  const jwt = `${encodedHeader}.${encodedPayload}.`; // json web token
  //console.log(`Paypal-Auth-Assertion=${jwt}`);

  return jwt;
};

/**
 * Generate a client token for rendering the hosted card fields.
 * @see https://developer.paypal.com/docs/checkout/advanced/integrate/#link-integratebackend
 */
export async function generateClientToken() {
  const accessToken = await generateAccessToken();
  const url = `${base}/v1/identity/generate-token`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept-Language": "en_US",
      "Content-Type": "application/json",
      "PayPal-Partner-Attribution-Id": BN_CODE,
    },
  });

  return handleResponse(response);
}

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
export async function createOrder(cart) {
  // Use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "shopping cart information passed from the frontend createOrder() callback:",
    cart
  );

  const accessToken = await generateAccessToken();
  const auth_assertion = await authassertion();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "GBP",
          value: "100.00",
        },
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "PayPal-Partner-Attribution-Id": BN_CODE,
      "PayPal-Auth-Assertion": `${auth_assertion}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "MISSING_REQUIRED_PARAMETER"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "PERMISSION_DENIED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
}

/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
export async function captureOrder(orderID) {
  const accessToken = await generateAccessToken();
  const auth_assertion = await authassertion();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "PayPal-Partner-Attribution-Id": BN_CODE,
      "PayPal-Auth-Assertion": `${auth_assertion}`,
      // Uncomment one of these to force an error for negative testing (in sandbox mode only). Documentation:
      // https://developer.paypal.com/tools/sandbox/negative-testing/request-headers/
      // "PayPal-Mock-Response": '{"mock_application_codes": "INSTRUMENT_DECLINED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "TRANSACTION_REFUSED"}'
      // "PayPal-Mock-Response": '{"mock_application_codes": "INTERNAL_SERVER_ERROR"}'
    },
  });

  return handleResponse(response);
}

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}
