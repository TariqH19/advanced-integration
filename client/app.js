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

          // Extract vault ID and customer ID if present
          const vaultId =
            orderData?.payment_source?.paypal?.attributes?.vault?.id;
          const customerId =
            orderData?.payment_source?.paypal?.attributes?.vault?.customer?.id;

          if (vaultId && customerId) {
            console.log("Vault ID:", vaultId);
            console.log("Customer ID:", customerId);

            // Save the vault ID and customer ID to local storage
            localStorage.setItem("vaultId", vaultId);
            localStorage.setItem("customerId", customerId);
            console.log("Vault ID and Customer ID saved to local storage");
          } else {
            console.log("No vault or customer ID found in payment source.");
          }
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
  onApprove: async function (data, actions) {
    console.log("Card payment approved for order:", data.orderID);

    try {
      // Fetch the order details to check for additional data
      const result = await fetch(`/api/orders/${data.orderID}`, {
        method: "GET",
      });
      const challenge = await result.json();
      console.log("Challenge data:", JSON.stringify(challenge, null, 2));

      const authenticationStatus =
        challenge.payment_source.card.authentication_result.three_d_secure
          .authentication_status;
      const enrollmentStatus =
        challenge.payment_source.card.authentication_result.three_d_secure
          .enrollment_status;

      // Check if the liability shift is possible and the authentication and enrollment statuses are successful
      if (
        data.liabilityShift === "POSSIBLE" &&
        enrollmentStatus === "Y" &&
        authenticationStatus === "Y"
      ) {
        // Capture the payment
        const captureResult = await fetch(
          `/api/orders/${data.orderID}/capture`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const captureData = await captureResult.json();
        console.log("Captured payment:", captureData);

        // Extract vault ID and customer ID from the capture data
        const vaultId =
          captureData?.payment_source?.card?.attributes?.vault?.id;
        const customerId =
          captureData?.payment_source?.card?.attributes?.vault?.customer?.id;

        if (vaultId && customerId) {
          console.log("Vault ID:", vaultId);
          console.log("Customer ID:", customerId);

          // Save the vault ID and customer ID to local storage
          localStorage.setItem("vaultId", vaultId);
          localStorage.setItem("customerId", customerId);
          console.log("Vault ID and Customer ID saved to local storage");
        } else {
          console.log("No vault or customer ID found in payment source.");
        }

        // Log capture status and transaction ID
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

async function listSavedPaymentMethods() {
  const customerId = localStorage.getItem("customerId");
  if (!customerId) {
    console.log("No Customer ID found in local storage");
    return;
  }

  try {
    const response = await fetch(
      `/api/payment-tokens?customerId=${customerId}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error fetching payment tokens: ${errorText}`);
    }

    const paymentTokens = await response.json();
    console.log("Payment tokens:", paymentTokens);
    displayPaymentMethods(paymentTokens);
  } catch (error) {
    console.error("Error retrieving payment tokens:", error);
  }
}

function displayPaymentMethods(paymentTokens) {
  const paymentMethodsContainer = document.getElementById(
    "saved-payment-methods"
  );
  paymentMethodsContainer.innerHTML = "";

  paymentTokens.forEach((token) => {
    // Create a container for each payment token
    const paymentMethodElement = document.createElement("div");
    paymentMethodElement.classList.add("payment-method");

    // Extract card details
    const cardBrand = token.payment_source.card.brand;
    const cardLastDigits = token.payment_source.card.last_digits;
    const cardExpiry = token.payment_source.card.expiry;
    const billingAddress = token.payment_source.card.billing_address;

    // Format billing address
    const address = `
      ${billingAddress.address_line_1} ${
      billingAddress.address_line_2 ? `, ${billingAddress.address_line_2}` : ""
    }
      ${billingAddress.admin_area_2}, ${billingAddress.admin_area_1}
      ${billingAddress.postal_code}, ${billingAddress.country_code}
    `;

    // Set inner HTML of the payment method element
    paymentMethodElement.innerHTML = `
      <div><strong>Card Brand:</strong> ${cardBrand}</div>
      <div><strong>Card Ending:</strong> ${cardLastDigits}</div>
      <div><strong>Expiry Date:</strong> ${cardExpiry}</div>
      <div><strong>Billing Address:</strong> ${address}</div>
    `;

    // Append the payment method element to the container
    paymentMethodsContainer.appendChild(paymentMethodElement);
  });
}

// Call this function on page load
document.addEventListener("DOMContentLoaded", listSavedPaymentMethods);

document.addEventListener("DOMContentLoaded", async () => {
  const customerId = localStorage.getItem("customerId");
  if (!customerId) {
    console.error("No Customer ID found in local storage");
    return;
  }

  try {
    const response = await fetch(
      `/api/payment-tokens?customerId=${customerId}`
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error fetching payment tokens: ${errorText}`);
    }

    const paymentMethods = await response.json();
    const table = document.getElementById("payment-methods-table");

    paymentMethods.forEach((payment) => {
      const row = document.createElement("tr");
      row.innerHTML = `
                        <td><input type="radio" name="method" value="${
                          payment.id
                        }" required></td>
                        <td><img src="images/${payment.payment_source.card.brand.toLowerCase()}.png" alt="${
        payment.payment_source.card.brand
      }"></td>
                        <td>**** **** **** ${
                          payment.payment_source.card.last_digits
                        }</td>

                    `;
      table.appendChild(row);
    });
  } catch (error) {
    console.error("Error retrieving payment tokens:", error);
  }
});

document
  .getElementById("payment-form")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const selectedMethod = document.querySelector(
      'input[name="method"]:checked'
    );
    if (!selectedMethod) {
      alert("Please select a saved payment method.");
      return;
    }

    const paymentToken = selectedMethod.value;
    const paymentAmount = "50.00"; // Example amount, replace with your logic

    try {
      const response = await fetch("/api/pay-with-saved-method", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentToken, amount: paymentAmount }),
      });

      const orderData = await response.json();
      alert("Transaction successfully completed.");
      console.log("Transaction completed:", orderData);
    } catch (error) {
      console.error("Error processing transaction:", error);
      alert("Error processing transaction.");
    }
  });
