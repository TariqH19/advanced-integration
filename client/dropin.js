var submitButton = document.getElementById("submit-button");
const setAmount = "10.00";
const amount = "500.00";
let lineItems = [
  {
    quantity: "1",
    unitAmount: "250.00",
    name: "Product A",
    description: "Eds magic product.",
    productCode: "123ABC",
    kind: "debit",
    totalAmount: "250.00",
  },
  {
    quantity: "1",
    unitAmount: "250",
    name: "Product B",
    description: "Playstation 7",
    productCode: "XYZ567",
    kind: "debit",
    totalAmount: "250",
  },
];
let billingAddress = {
  givenName: "Tony",
  surname: "Stark",
  email: "tony@avengers.com",
  phoneNumber: "8101234567",
  streetAddress: "555 Smith St.",
  extendedAddress: "#5",
  locality: "Oakland",
  region: "CA",
  postalCode: "12345",
  countryCodeAlpha2: "US",
};
let customer = {
  firstName: "Tony",
  lastName: "Stark",
  email: "tony@avengers.com",
};
let shippingAddress = {
  firstName: "Tony",
  lastName: "Stark",
  email: "tony@avengers.com",
};
var threeDSecureParameters = {
  amount: amount,
  email: "test@example.com",
  customer: customer,
  billingAddress: billingAddress,
  shippingAddress: shippingAddress,
};

//this fetch request retrieves the a client token from the server /checkout endpoint
fetch("/dropinn")
  .then((response) => {
    return response.text();
  })
  .then(function (client_token) {
    braintree.dropin.create(
      {
        dataCollector: true,
        authorization: client_token,
        amount: amount,
        container: "#dropin-container",
        card: {
          overrides: {
            fields: {
              number: {
                prefill: "",
              },
              expirationDate: {
                prefill: "",
              },
            },
          },
        },
        threeDSecure: {
          authorization: client_token,
          version: 2.2,
        },
        googlePay: {
          googlePayVersion: 2,
          //googleMerchantId: 'merchant-id-from-google',
          transactionInfo: {
            totalPriceStatus: "FINAL",
            totalPrice: amount,
            currencyCode: "GBP",
          },
          allowedPaymentMethods: [
            {
              type: "CARD",
              parameters: {
                billingAddressRequired: true,
                billingAddressParameters: {
                  format: "FULL",
                },
              },
            },
          ],
        },
        paypal: {
          buttonStyle: {
            color: "gold",
            shape: "rect",
            label: "paypal",
            size: "large",
          },
          flow: "checkout", // checkout or vault
          amount: amount,
          commit: true, // true = Pay Now, false = Continue
          currency: "GBP",
          enableShippingAddress: true,
          shippingAddressEditable: false,
          shippingAddressOverride: {
            recipientName: "Scruff McGruff",
            line1: "Paraspar Ltd",
            line2: 'quity House, 128-136"',
            city: "Edgware",
            countryCode: "GB",
            postalCode: "HA8 7EL",
            state: "middlesex",
            phone: "123.456.7890",
          },
          // lineItems: lineItems
        },
        paypalCredit: {
          intent: "capture",
          flow: "checkout",
          amount: amount,
          offerCredit: true,
          currency: "GBP",
        },
      },
      (createErr, instance) => {
        submitButton.addEventListener("click", (clickEvent) => {
          //   submitButton.style.visibility = "hidden";
          clickEvent.preventDefault();
          instance
            .requestPaymentMethod({
              amount: amount,
              threeDSecure: threeDSecureParameters,
              challengeRequested: true,
              collectDeviceData: true, //Not Not the same as device data collector
            })
            .then((payload) => {
              alert(payload.nonce);
              document.getElementById("checkout-message").innerHTML =
                "Payload nonce: <pre>" + payload.nonce + "</pre>";

              fetch("/dropincreate", {
                method: "POST",
                body: JSON.stringify({
                  paymentMethodNonce: payload.nonce,
                  deviceData: payload.deviceData, // Device data collected for fraud protection
                  lineItems: lineItems,
                  amount: amount,
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              })
                .then((response) => response.json())
                .then((result) => {
                  instance.teardown((teardownErr) => {
                    if (teardownErr) {
                      console.error("Could not tear down Drop-in UI!");
                    } else {
                      console.info("Drop-in UI has been torn down!");
                    }
                  });

                  //   submitButton.style.visibility = "hidden";
                  document.getElementById("checkout-message").style.visibility =
                    "visible";
                  if (result.success) {
                    document.getElementById("checkout-message").innerHTML =
                      "<pretty-json>" +
                      JSON.stringify(result, null, 3) +
                      "</pretty-json>";
                  } else {
                    document.getElementById("checkout-message").innerHTML =
                      "<pretty-json>" +
                      JSON.stringify(result, null, 3) +
                      "</pretty-json>";
                  }
                });
            });
        });
      }
    );
  });
