const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const base = "https://api-m.sandbox.paypal.com";

export const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error);
  }
};

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
export const createOrder = async (cart) => {
  // use the cart information passed from the front-end to calculate the purchase unit details
  console.log(
    "shopping cart information passed from the frontend createOrder() callback:",
    cart
  );

  const accessToken = await generateAccessToken();
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
};

// Obtain detals from the order
export const getOrderDetails = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

/**
 * Captura el pago para la orden creada y luego obtiene los detalles del pedido.
 */
export const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const captureResult = await handleResponse(response);

  // Después de capturar, obtén los detalles del pedido
  if (captureResult.httpStatusCode === 201) {
    const orderDetails = await getOrderDetails(orderID);
    return { ...captureResult, orderDetails: orderDetails.jsonResponse };
  }

  return captureResult;
};

export const addTrackingInfo = async (trackers) => {
  try {
    const accessToken = await generateAccessToken(); // Obtén el token de acceso

    const url = `${base}/v1/shipping/trackers-batch`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trackers: trackers, // Pasar los trackers dinámicamente desde el frontend o la lógica de negocio
      }),
    });

    // Manejo de la respuesta
    const data = await response.json();
    if (response.ok) {
      console.log("Tracking added successfully:", data);
    } else {
      console.error("Failed to add tracking:", data);
    }

    return data;
  } catch (error) {
    console.error("Error in addTrackingInfo:", error);
    throw new Error("TRACKING_API_ERROR");
  }
};

export const fetchTrackingInfo = async (transactionId, trackingNumber) => {
  try {
    const accessToken = await generateAccessToken(); // Usa la función que ya tienes para obtener el Access Token

    // Account ID fijo
    const accountId = "J36FP579FJ6NW"; // Reemplaza este valor con tu Account ID fijo

    // Construimos la URL de forma dinámica usando transactionId y trackingNumber
    const url = `https://api-m.sandbox.paypal.com/v1/shipping/trackers/${transactionId}-${trackingNumber}?account_id=${accountId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Tracking information retrieved successfully:", data);
      return data; // Devuelve los datos de tracking al cliente
    } else {
      console.error("Failed to retrieve tracking information:", data);
      throw new Error(data);
    }
  } catch (error) {
    console.error("Error in fetchTrackingInfo:", error);
    throw new Error("TRACKING_INFO_API_ERROR");
  }
};

export async function handleResponse(response) {
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
