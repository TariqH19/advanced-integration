var submitButton = document.getElementById("submit-button");
const setAmount = "10.00";
const amount = "179.98";
let lineItems = [
  {
    quantity: "1",
    unitAmount: "129.99",
    name: "Premium Software License",
    description: "1-year subscription with support",
    productCode: "PREM-001",
    kind: "debit",
    totalAmount: "129.99",
  },
  {
    quantity: "1",
    unitAmount: "19.99",
    name: "Cloud Storage",
    description: "500GB additional storage",
    productCode: "CLOUD-500",
    kind: "debit",
    totalAmount: "19.99",
  },
  {
    quantity: "1",
    unitAmount: "30.00",
    name: "Tax",
    description: "VAT 20%",
    productCode: "TAX-VAT",
    kind: "debit",
    totalAmount: "30.00",
  },
];

let billingAddress = {
  givenName: "John",
  surname: "Doe",
  email: "john.doe@example.com",
  phoneNumber: "02012345678",
  streetAddress: "123 Business Street",
  extendedAddress: "Suite 100",
  locality: "London",
  region: "England",
  postalCode: "EC1A 1BB",
  countryCodeAlpha2: "GB",
};

let customer = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
};

let shippingAddress = {
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@example.com",
};

var threeDSecureParameters = {
  amount: amount,
  email: customer.email,
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
          version: 2,
        },
        googlePay: {
          googlePayVersion: 2,
          transactionInfo: {
            totalPriceStatus: "FINAL",
            totalPrice: amount,
            currencyCode: "EUR",
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
          flow: "checkout",
          amount: amount,
          commit: true,
          currency: "EUR",
          enableShippingAddress: true,
          shippingAddressEditable: false,
          shippingAddressOverride: {
            recipientName: "John Doe",
            line1: "123 Business Street",
            line2: "Suite 100",
            city: "London",
            countryCode: "GB",
            postalCode: "EC1A 1BB",
            state: "England",
            phone: "02012345678",
          },
        },
        paypalCredit: {
          intent: "capture",
          flow: "checkout",
          amount: amount,
          offerCredit: true,
          currency: "EUR",
        },
      },
      (createErr, instance) => {
        if (createErr) {
          console.error("Braintree Drop-in creation error:", createErr);
          if (window.showMessage) {
            window.showMessage(
              `Error creating payment interface: ${createErr.message}`,
              "error"
            );
          } else {
            document.getElementById("checkout-message").innerHTML =
              "Error creating payment interface: " + createErr.message;
          }
          return;
        }

        // Successfully created Drop-in
        if (window.showMessage) {
          window.showMessage(
            "Payment interface ready. Choose your payment method below.",
            "success"
          );
        }

        submitButton.addEventListener("click", (clickEvent) => {
          clickEvent.preventDefault();

          // Show loading state
          if (window.showLoading) {
            window.showLoading(true);
          }

          instance
            .requestPaymentMethod({
              amount: amount,
              threeDSecure: threeDSecureParameters,
              challengeRequested: true,
              collectDeviceData: true,
            })
            .then((payload) => {
              if (window.showMessage) {
                window.showMessage(
                  "Payment method obtained, processing...",
                  "info"
                );
              } else {
                document.getElementById("checkout-message").innerHTML =
                  "Payment method obtained: " + payload.nonce;
              }

              fetch("/dropincreate", {
                method: "POST",
                body: JSON.stringify({
                  paymentMethodNonce: payload.nonce,
                  deviceData: payload.deviceData,
                  lineItems: lineItems,
                  amount: amount,
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              })
                .then((response) => response.json())
                .then((result) => {
                  document.getElementById("checkout-message").style.visibility =
                    "visible";

                  if (result.success) {
                    // Show success message using the UI function
                    if (window.showSuccessMessage) {
                      window.showSuccessMessage(result);
                    } else {
                      document.getElementById("checkout-message").innerHTML =
                        "Payment successful! Transaction ID: " +
                        (result.transactionId || result.id) +
                        "<br><pre>" +
                        JSON.stringify(result, null, 2) +
                        "</pre>";
                    }

                    // Teardown the Drop-in instance after successful payment
                    setTimeout(() => {
                      instance.teardown((teardownErr) => {
                        if (teardownErr) {
                          console.error("Drop-in teardown error:", teardownErr);
                        }
                        // No need to log success - it's normal behavior
                      });
                    }, 1000);
                  } else {
                    if (window.showMessage) {
                      window.showMessage(
                        `Payment failed: ${result.message || result.error}`,
                        "error"
                      );
                    } else {
                      document.getElementById("checkout-message").innerHTML =
                        "Payment failed: " +
                        (result.message || result.error) +
                        "<br><pre>" +
                        JSON.stringify(result, null, 2) +
                        "</pre>";
                    }
                  }
                })
                .catch((error) => {
                  console.error("Payment processing error:", error);
                  if (window.showLoading) {
                    window.showLoading(false);
                  }
                  if (window.showMessage) {
                    window.showMessage(
                      `Error processing payment: ${error.message}`,
                      "error"
                    );
                  } else {
                    document.getElementById("checkout-message").innerHTML =
                      "Error processing payment: " + error.message;
                  }
                });
            })
            .catch((error) => {
              console.error("Payment method error:", error);
              if (window.showLoading) {
                window.showLoading(false);
              }
              if (window.showMessage) {
                window.showMessage(
                  `Error getting payment method: ${error.message}`,
                  "error"
                );
              } else {
                document.getElementById("checkout-message").innerHTML =
                  "Error getting payment method: " + error.message;
              }
            });
        });
      }
    );
  })
  .catch((error) => {
    console.error("Error fetching client token:", error);
    if (window.showMessage) {
      window.showMessage(
        `Error loading payment interface: ${error.message}`,
        "error"
      );
    } else {
      document.getElementById("checkout-message").innerHTML =
        "Error loading payment interface: " + error.message;
    }
  });
