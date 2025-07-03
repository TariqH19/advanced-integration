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
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;
const { PAYPAL_CLIENT_ID_US, PAYPAL_CLIENT_SECRET_US } = process.env;

const client = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});

const newClient = new Client({
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
const newOrdersController = new OrdersController(newClient);
const paymentsController = new PaymentsController(client);

export async function createOrder(cart) {
  const payload = {
    body: {
      intent: "CAPTURE",
      purchaseUnits: [
        {
          amount: {
            currencyCode: "GBP",
            value: "100",
          },
        },
      ],
      paymentSource: {
        card: {
          attributes: {
            verification: {
              method: "SCA_ALWAYS",
            },
          },
        },
      },
    },
    prefer: "return=minimal",
  };

  try {
    const { body, ...httpResponse } = await ordersController.ordersCreate(
      payload
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

export async function newCreateOrder(cart) {
  const collect = {
    body: {
      intent: "CAPTURE",
      purchaseUnits: [
        {
          amount: {
            currencyCode: "USD",
            value: "100",
            breakdown: {
              itemTotal: {
                currencyCode: "USD",
                value: "100",
              },
            },
          },
          // lookup item details in `cart` from database
          items: [
            {
              name: "T-Shirt",
              unitAmount: {
                currencyCode: "USD",
                value: "100",
              },
              quantity: "1",
              description: "Super Fresh Shirt",
              sku: "sku01",
            },
          ],
          shipping: {
            email_address: "buyer_shipping_email@example.com",
            phone_number: {
              country_code: "1",
              national_number: "4081111111",
            },
          },
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            userAction: PaypalExperienceUserAction.PayNow,
            landingPage: PaypalExperienceLandingPage.Login,
            shippingPreference: ShippingPreference.GetFromFile,
            orderUpdateCallbackConfig: {
              callbackEvents: ["SHIPPING_ADDRESS", "SHIPPING_OPTIONS"],
              callbackUrl:
                "https://advanced-integration.vercel.app/paypal/shipping-options",
            },
            contactPreference: "UPDATE_CONTACT_INFO",
          },
        },
      },
    },
    prefer: "return=minimal",
  };

  try {
    const { body, ...httpResponse } = await newOrdersController.createOrder(
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
