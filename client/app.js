paypal
  .Buttons({
    createOrder: function (data, actions) {
      return fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task: "button" }),
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (orderData) {
          return orderData.id;
        });
    },
    onApprove: function (data, actions) {
      return fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
      })
        .then((res) => res.json())
        .then((orderData) => {
          console.log("Payment was successful:", orderData);
        })
        .catch((err) => {
          console.error("Error capturing payment:", err);
        });
    },
    onError: function (err) {
      console.error("Error with PayPal button:", err);
    },
  })
  .render("#paypal-button-container");

const cardField = paypal.CardFields({
  createOrder: async (data) => {
    const saveCard = document.getElementById("save")?.checked || false;
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        card: {
          attributes: {
            verification: {
              method: "SCA_ALWAYS",
            },
          },
          experience_context: {
            shipping_preference: "NO_SHIPPING",
            return_url: "https://example.com/returnUrl",
            cancel_url: "https://example.com/cancelUrl",
          },
        },
        task: "advancedCC",
        saveCard: saveCard,
      }),
    });
    const orderData = await response.json();
    return orderData.id;
  },
  onApprove: async function (orderData) {
    console.log("Card payment approved for order:", orderData.orderID);

    try {
      const result = await fetch(`/api/orders/${orderData.orderID}`, {
        method: "GET",
      });
      const challenge = await result.json();
      console.log("Challenge data:", JSON.stringify(challenge, null, 2));

      const vault = orderData?.paymentSource?.card?.attributes?.vault;
      console.log("Capture successful, vault info:", vault);

      const authenticationStatus =
        challenge.payment_source.card.authentication_result.three_d_secure
          .authentication_status;
      const enrollmentStatus =
        challenge.payment_source.card.authentication_result.three_d_secure
          .enrollment_status;

      if (
        orderData.liabilityShift === "POSSIBLE" &&
        enrollmentStatus === "Y" &&
        authenticationStatus === "Y"
      ) {
        const captureResult = await fetch(
          `/api/orders/${orderData.orderID}/capture`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const captureData = await captureResult.json();
        console.log("Captured payment", captureData);
        const captureStatus =
          captureData.purchase_units[0].payments.captures[0].status;
        const transactionID = captureData.id;
        console.log("Capture Status:", captureStatus);
        console.log("Transaction ID:", transactionID);
      } else {
        console.log("Capture conditions not met, payment not captured.");
      }
    } catch (error) {
      console.error("Error during order fetch or capture:", error);
    }
  },
  onError: (error) => console.error("Something went wrong:", error),
});

// Render Card Fields
if (cardField.isEligible()) {
  const nameField = cardField.NameField();
  nameField.render("#card-name-field-container");

  const numberField = cardField.NumberField();
  numberField.render("#card-number-field-container");

  const cvvField = cardField.CVVField();
  cvvField.render("#card-cvv-field-container");

  const expiryField = cardField.ExpiryField();
  expiryField.render("#card-expiry-field-container");

  document
    .getElementById("card-field-submit-button")
    .addEventListener("click", function () {
      cardField
        .submit({
          billingAddress: {
            address_line_1: "123 Billing St",
            address_line_2: "Apartment 5",
            admin_area_2: "San Jose",
            admin_area_1: "CA",
            postal_code: "SW1A 0AA",
            country_code: "GB",
          },
        })
        .then(function (details) {
          console.log("Credit card form submitted successfully:");
        })
        .catch(function (err) {
          console.error("Error with credit card form submission:", err);
          // Handle error, e.g., show user a generic error message
        });
    });
}
