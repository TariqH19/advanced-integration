function addCustomerId(customerId) {
  try {
    // Retrieve existing IDs from local storage or initialize as an empty array if not present
    let customerIds = JSON.parse(localStorage.getItem("customerIds")) || [];

    // Log the current state for debugging
    console.log("Existing customer IDs:", customerIds);

    // Check if the new ID is already in the list to prevent duplicates
    if (!customerIds.includes(customerId)) {
      customerIds.push(customerId); // Add the new ID to the list
      localStorage.setItem("customerIds", JSON.stringify(customerIds)); // Save updated list back to local storage

      // Log the updated state for debugging
      console.log("Updated customer IDs:", customerIds);
    } else {
      console.log("Customer ID already exists in storage.");
    }
  } catch (error) {
    console.error("Error adding customer ID:", error);
  }
}

// Add a vault ID to local storage
function addVaultId(vaultId) {
  let vaultIds = JSON.parse(localStorage.getItem("vaultIds")) || [];
  if (!vaultIds.includes(vaultId)) {
    vaultIds.push(vaultId);
    localStorage.setItem("vaultIds", JSON.stringify(vaultIds));
  }
}

// Retrieve all customer IDs
function getCustomerIds() {
  return JSON.parse(localStorage.getItem("customerIds")) || [];
}

// Retrieve all vault IDs
function getVaultIds() {
  return JSON.parse(localStorage.getItem("vaultIds")) || [];
}

async function fetchTokensAndLoadPayPalSDK() {
  try {
    const response = await fetch(`/api/getTokens`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const tokens = await response.json();
    console.log("Access Token: ", tokens.accessToken);
    console.log("ID Token: ", tokens.tokenId);

    let existingScript = document.getElementById("paypal-sdk");
    if (existingScript) {
      existingScript.remove();
    }

    const paypalScript = document.createElement("script");
    paypalScript.id = "paypal-sdk";
    paypalScript.src =
      "https://www.paypal.com/sdk/js?components=messages,buttons,card-fields&enable-funding=paylater&buyer-country=GB&currency=GBP&client-id=AXakS410la2fYSpiyC7A1nNsv_45cgH-_Cih7Gn1ggy_NUvIBZ_MSdWReMU9AqeupbTuo3lUkw5G-HsH";
    paypalScript.setAttribute("data-user-id-token", tokens.tokenId);
    paypalScript.onload = () => {
      initializePayPalComponents();
    };
    document.body.appendChild(paypalScript);
  } catch (error) {
    console.error("Error loading PayPal SDK:", error);
  }
}

function initializePayPalComponents() {
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
          .then((res) => res.json())
          .then((orderData) => orderData.id);
      },
      onApprove: function (data, actions) {
        return fetch(`/api/orders/${data.orderID}/capture`, {
          method: "POST",
        })
          .then((res) => res.json())
          .then((orderData) => {
            console.log("Payment was successful:", orderData);
            const vaultId =
              orderData?.payment_source?.paypal?.attributes?.vault?.id;
            const customerId =
              orderData?.payment_source?.paypal?.attributes?.vault?.customer
                ?.id;

            if (vaultId && customerId) {
              addVaultId(vaultId); // Add vault ID to local storage
              addCustomerId(customerId); // Add customer ID to local storage
            }
          });
      },
    })
    .render("#paypal-button-container");

  const cardField = paypal.CardFields({
    createOrder: async (data) => {
      const saveCard = document.getElementById("save")?.checked || false;
      try {
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

        if (!response.ok) {
          throw new Error(`Failed to create order: ${response.statusText}`);
        }

        const orderData = await response.json();
        console.log("Order data from createOrder:", orderData);

        return orderData.id;
      } catch (error) {
        console.error("Error in createOrder:", error);
      }
    },

    onApprove: async function (data, actions) {
      console.log("Card payment approved for order:", data.orderID);

      try {
        const result = await fetch(`/api/orders/${data.orderID}`, {
          method: "GET",
        });

        if (!result.ok) {
          throw new Error(
            `Failed to fetch order details: ${result.statusText}`
          );
        }

        const challenge = await result.json();
        console.log("Challenge data:", JSON.stringify(challenge, null, 2));

        const authenticationStatus =
          challenge?.payment_source?.card?.authentication_result?.three_d_secure
            ?.authentication_status;
        const enrollmentStatus =
          challenge?.payment_source?.card?.authentication_result?.three_d_secure
            ?.enrollment_status;

        if (
          data.liabilityShift === "POSSIBLE" &&
          enrollmentStatus === "Y" &&
          authenticationStatus === "Y"
        ) {
          const captureResult = await fetch(
            `/api/orders/${data.orderID}/capture`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (!captureResult.ok) {
            throw new Error(
              `Failed to capture payment: ${captureResult.statusText}`
            );
          }

          const captureData = await captureResult.json();
          console.log("Captured payment:", captureData);

          const vaultId =
            captureData?.payment_source?.card?.attributes?.vault?.id;
          const customerId =
            captureData?.payment_source?.card?.attributes?.vault?.customer?.id;

          if (vaultId && customerId) {
            // Use the addCustomerId function to store the customer ID
            addCustomerId(customerId);
            localStorage.setItem("vaultId", vaultId);
            console.log("Vault ID and Customer ID saved to local storage");
          } else {
            console.log("No vault or customer ID found in payment source.");
          }

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

  if (cardField.isEligible()) {
    cardField.NameField().render("#card-name-field-container");
    cardField.NumberField().render("#card-number-field-container");
    cardField.CVVField().render("#card-cvv-field-container");
    cardField.ExpiryField().render("#card-expiry-field-container");

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
          });
      });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const customerIds = getCustomerIds(); // Retrieve all customer IDs from local storage

  const table = document.getElementById("payment-methods-table");

  // Loop through each customer ID to fetch payment tokens
  for (const customerId of customerIds) {
    try {
      const response = await fetch(
        `/api/payment-tokens?customerId=${customerId}`
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Error fetching payment tokens for Customer ID ${customerId}: ${errorText}`
        );
      }

      const paymentMethods = await response.json();

      if (paymentMethods.length === 0) {
        const noMethodsMessage = document.createElement("p");
        noMethodsMessage.textContent = `No payment methods found for Customer ID ${customerId}`;
        table.parentNode.insertBefore(noMethodsMessage, table);
      }

      paymentMethods.forEach((payment) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><input type="radio" name="method" value="${
            payment.id
          }" required></td>
          <td><img src="https://fitx-image-bucket.s3.eu-west-1.amazonaws.com/${payment.payment_source.card.brand.toLowerCase()}.jpg" alt="${
          payment.payment_source.card.brand
        }" style="width:120px;"></td>
          <td>**** **** **** ${payment.payment_source.card.last_digits}</td>
        `;
        table.appendChild(row);
      });
    } catch (error) {
      console.error("Error retrieving payment tokens:", error);
    }
  }
});

async function handlePayment() {
  const selectedMethod = document.querySelector('input[name="method"]:checked');
  if (!selectedMethod) {
    alert("Please select a payment method.");
    return;
  }

  const paymentToken = selectedMethod.value;

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "useToken",
        paymentToken: paymentToken,
      }),
    });

    const orderData = await response.json();
    console.log("Order created successfully:", orderData);
  } catch (error) {
    console.error("Error creating order with payment token:", error);
  }
}

// Function to retrieve all customer IDs from local storage
function getCustomerIds() {
  return JSON.parse(localStorage.getItem("customerIds")) || [];
}

// Initialize everything when the page is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchTokensAndLoadPayPalSDK();
});
