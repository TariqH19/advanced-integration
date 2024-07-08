// PayPal Buttons integration
paypal
  .Buttons({
    createOrder: function (data, actions) {
      return fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task: "button" }), // Pass the correct task parameter
      })
        .then(function (res) {
          return res.json();
        })
        .then(function (order) {
          return order.id; // Assuming order ID is returned correctly
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

// Initialize Card Fields
const cardField = paypal.CardFields({
  createOrder: async (data) => {
    const result = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task: "advancedCC" }), // Pass the correct task parameter
    });
    const { id } = await result.json();
    return id;
  },
  onApprove: async (data) => {
    const { orderID } = data;
    const result = await fetch(`/api/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const res = await result.json();
    // Retrieve vault details from the response and
    // save vault.id and customer.id for the buyer's return experience
    console.log("Capture was successful:", res);
    return res;
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

  // Add click listener to submit button
  document
    .getElementById("card-field-submit-button")
    .addEventListener("click", function () {
      cardField
        .submit({
          // Example billing address, replace with actual data if needed
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
          console.log("Credit card form submitted successfully:", details);
        })
        .catch(function (err) {
          console.error("Error with credit card form submission:", err);
          // Handle error, e.g., show user a generic error message
        });
    });
}
