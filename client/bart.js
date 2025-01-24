// Dev docs: https://developer.paypal.com/api/limited-release/reference-transactions/v1/
//Sandbox account will need to have reference transactions enabled
let accessToken;
let baToken;
let redirectURL;
let baId;
let consentButton = document.getElementById("buyerLinkBtn");
let orderResponse;

const liAccessToken = document.querySelector("ol li:first-child");
const liBillToken = document.querySelector("ol li:nth-child(2)");
const liConsentButton = document.querySelector("ol li:nth-child(3)");
const liBillAgreeId = document.querySelector("ol li:nth-child(4)");
const liOrderResponse = document.querySelector("ol li:nth-child(5)");
const characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateString(length) {
  let result = " ";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function getAccessToken() {
  fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Language": "en_GB",
      //The below btoa function encode the client id and secret into base64
      Authorization:
        "Basic " +
        btoa(
          "AXakS410la2fYSpiyC7A1nNsv_45cgH-_Cih7Gn1ggy_NUvIBZ_MSdWReMU9AqeupbTuo3lUkw5G-HsH" +
            ":EFzfHiNWctBdxGgVTyx6oYfJIanFccRu6RhLw2iJe-BR7Nk8jAx1_FdhvG3L2fOdoYSpqU7i4s6i4j30"
        ),
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      accessToken = data.access_token;
      liAccessToken.innerHTML +=
        "<span>✔</span><br><span>" +
        "<b>Access Token: </b> " +
        accessToken +
        "</span>";
    });
}

function getBaToken() {
  fetch(
    "https://api-m.sandbox.paypal.com/v1/billing-agreements/agreement-tokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + accessToken,
      },
      body: JSON.stringify({
        shipping_address: {
          line1: "1350 North First Street",
          city: "San Jose",
          state: "CA",
          postal_code: "95112",
          country_code: "GB",
          recipient_name: "John Doe",
        },
        payer: {
          payment_method: "PAYPAL",
        },
        plan: {
          type: "MERCHANT_INITIATED_BILLING",
          merchant_preferences: {
            return_url: "https://example.com/return",
            cancel_url: "https://example.com/cancel",
            notify_url: "https://example.com/notify",
            accepted_pymt_type: "INSTANT",
            skip_shipping_address: false,
            immutable_shipping_address: true,
          },
        },
      }),
    }
  )
    .then((response) => response.json())
    .then((data) => {
      console.log(JSON.stringify(data));
      baToken = data.token_id;
      redirectURL = data.links[0].href;
      liBillToken.innerHTML +=
        "<span>✔</span><br><span>" +
        "<b>Billing Agreement Token:</b><br>" +
        baToken +
        "</span>";
    });
}

consentButton.onclick = function () {
  window.open(redirectURL, "popup");
  liConsentButton.innerHTML += "<span>✔</span>";
};

function getBillingAgreement() {
  fetch("https://api-m.sandbox.paypal.com/v1/billing-agreements/agreements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({
      token_id: baToken,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      baId = data.id;
      liBillAgreeId.innerHTML +=
        "<span>✔</span><br><span>" +
        "<b>Billing Agreement ID:</b><br>" +
        baId +
        "</span>";
    });
}

function getRefTrans() {
  fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PayPal-Request-Id": generateString(9),
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "GBP",
            value: "50.00",
          },
        },
      ],
      payment_source: {
        token: {
          id: baId,
          type: "BILLING_AGREEMENT",
        },
      },
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      orderResponse = JSON.stringify(data, null, 3);
      liOrderResponse.innerHTML +=
        "<span>✔</span><br><span>" +
        "<b>API response:</b><br>" +
        "<pre>" +
        orderResponse +
        "</pre></span>";
    });
}
