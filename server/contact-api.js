import express from "express";
import "dotenv/config";
import {
  ApiError,
  Client,
  Environment,
  LogLevel,
  OrdersController,
  PaymentsController,
  PaypalExperienceLandingPage,
  PaypalExperienceUserAction,
  ShippingPreference,
} from "@paypal/paypal-server-sdk";
import bodyParser from "body-parser";
const app = express();
app.use(bodyParser.json());
const { PAYPAL_CLIENT_ID_US, PAYPAL_CLIENT_SECRET_US } = process.env;

const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID_US,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET_US,
  },
  timeout: 0,
  environment: Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});

const ordersController = new OrdersController(client);
const paymentsController = new PaymentsController(client);

export async function createOrder(cart) {
  const collect = {
    body: {
      intent: "CAPTURE",
      purchaseUnits: [
        {
          amount: {
            currencyCode: "USD",
            value: "100.00",
            breakdown: {
              itemTotal: {
                currencyCode: "USD",
                value: "100.00",
              },
            },
          },
          items: [
            {
              name: "T-Shirt",
              unitAmount: {
                currencyCode: "USD",
                value: "100.00",
              },
              quantity: "1",
              description: "Super Fresh Shirt",
              sku: "sku01",
            },
          ],
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            userAction: PaypalExperienceUserAction.PayNow,
            landingPage: PaypalExperienceLandingPage.Login,
            shippingPreference: ShippingPreference.GetFromFile,

            contactPreference: "UPDATE_CONTACT_INFO",
          },
        },
      },
    },
    prefer: "return=minimal",
  };

  try {
    const response = await ordersController.createOrder(collect);

    // Make sure `body` is not empty

    return {
      jsonResponse: response.result,
      httpStatusCode: response.statusCode || 200,
    };
  } catch (error) {
    console.error("Error in createOrder:", error);
    throw error; // ensure the function never returns undefined
  }
}

export async function captureOrder(orderID) {
  const collect = {
    id: orderID,
    prefer: "return=minimal",
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersCapture(
      collect
    );
    // Get more response info...
    // const { statusCode, headers } = httpResponse;
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // const { statusCode, headers } = error;
      throw new Error(error.message);
    }
  }
}

export async function newCaptureOrder(orderID) {
  const collect = {
    id: orderID,
    prefer: "return=minimal",
  };

  try {
    const response = await newOrdersController.captureOrder({
      id: orderID,
      prefer: "return=minimal",
    });

    // Get more response info...
    // const { statusCode, headers } = httpResponse;
    return {
      jsonResponse: response.result,
      httpStatusCode: response.statusCode || 200,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // const { statusCode, headers } = error;
      throw new Error(error.message);
    }
  }
}

export async function authorizeOrder(orderID) {
  const collect = {
    id: orderID,
    prefer: "return=minimal",
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersAuthorize(
      collect
    );
    // Get more response info...
    // const { statusCode, headers } = httpResponse;
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // const { statusCode, headers } = error;
      throw new Error(error.message);
    }
  }
}

export async function getOrderDetails(orderId) {
  let collect = {
    id: orderId,
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersGet(collect);
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // const { statusCode, headers } = error;
      throw new Error(error.message);
    }
  }
}

export async function captureAuthorize(authorizationId) {
  const collect = {
    authorizationId: authorizationId,
    prefer: "return=minimal",
    body: {
      finalCapture: false,
    },
  };
  try {
    const { body, ...httpResponse } =
      await paymentsController.authorizationsCapture(collect);
    // Get more response info...
    // const { statusCode, headers } = httpResponse;
    return {
      jsonResponse: JSON.parse(body),
      httpStatusCode: httpResponse.statusCode,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // const { statusCode, headers } = error;
      throw new Error(error.message);
    }
  }
}
