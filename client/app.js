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
        .then(function (order) {
          return order.id;
        });
    },
    onApprove: function (data, actions) {
      return fetch(`/api/orders/${data.orderID}/capture`, {
        method: "POST",
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (orderData) {
          // Handle successful payment response
          console.log("Payment was successful:", orderData);
        });
    },
    onError: function (err) {
      console.error("Error with PayPal button:", err);
      // Handle error, e.g., show user a generic error message
    },
  })
  .render("#paypal-button-container");

const cardField = paypal.CardFields({
  createOrder: async (data) => {
    const saveCard = document.getElementById("save").checked;
    const result = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cart: [
          {
            id: "Abbz7vGw_5c8_cdyGzrRM_ZmP8YISHGRbN0SeR1aWPF4XesBlhwds2M9bsMwHpeEaSyfqOrJKTvRuPkD",
            quantity: "2",
          },
        ],
        task: "advancedCC",
        saveCard,
      }),
    });
    const { id } = await result.json();
    return id;
  },
  onApprove: async (data) => {
    try {
      const { orderID } = data;
      const result = await fetch(`/api/orders/${orderID}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const res = await result.json();
      console.log("Capture Response:", res);

      if (res.status === "COMPLETED") {
        // console.log("res", res);
        const paymentSource = res.payment_source;
        // console.log("paymentSource", paymentSource);

        if (paymentSource && paymentSource.card) {
          if (paymentSource.card.attributes.vault) {
            console.log(
              "Card status:",
              paymentSource.card.attributes.vault.status
            );
          } else {
            console.log("Card not saved.");
          }
        } else {
          console.log("Card information is missing.");
        }
      } else {
        console.error("Capture was not successful:", res);
      }
      return res;
    } catch (error) {
      console.error("Error with credit card form submission:", error);
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
