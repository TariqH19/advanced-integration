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
    // console.log("Access Token: ", tokens.accessToken);
    // console.log("ID Token: ", tokens. tokenId);

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
        const saveCard = document.getElementById("save")?.checked || false;
        return fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ task: "button", saveCard: saveCard }),
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
            showSuccess(
              "Payment processed successfully! Thank you for your order."
            );

            const vaultId =
              orderData?.payment_source?.paypal?.attributes?.vault?.id;
            const customerId =
              orderData?.payment_source?.paypal?.attributes?.vault?.customer
                ?.id;

            if (vaultId && customerId) {
              localStorage.setItem("vaultId", vaultId); // Save vault ID to local storage
              localStorage.setItem("customerId", customerId); // Save customer ID to local storage
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
        GlorderID = orderData.id;
        // Returning Order ID for the event onApprove
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
          showSuccess(
            "Payment processed successfully! Thank you for your order."
          );

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
  const customerIds = getCustomerIds();
  const tableBody = document.querySelector("#payment-methods-table tbody");
  const messageContainer = document.getElementById("message-container");
  const paymentContainer = document.getElementById("payment-container");

  let hasPaymentMethods = false;

  try {
    // Clear previous content
    tableBody.innerHTML = "";
    messageContainer.textContent = "";

    for (const customerId of customerIds) {
      const hasMethods = await loadPaymentMethods(customerId, tableBody);
      if (hasMethods) {
        hasPaymentMethods = true;
      }
    }

    if (hasPaymentMethods) {
      paymentContainer.style.display = "block";
    } else {
      paymentContainer.style.display = "none";
    }
  } catch (error) {
    console.error("Error loading payment methods:", error);
    messageContainer.textContent =
      "An error occurred while loading payment methods.";
    paymentContainer.style.display = "none";
  }
});

// Fetch and display payment methods for a specific customer
async function loadPaymentMethods(customerId, tableBody) {
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
      tableBody.appendChild(noMethodsMessage);
      return false;
    }

    paymentMethods.forEach((payment) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><input type="radio" name="method" value="${
          payment.id
        }" required></td>
        <td><img src="https://fitx-image-bucket.s3.eu-west-1.amazonaws.com/${payment.payment_source.card.brand.toLowerCase()}.jpg" 
                 alt="${
                   payment.payment_source.card.brand
                 }" style="width:120px;"></td>
        <td>**** **** **** ${payment.payment_source.card.last_digits}</td>
        <td><button class="delete-button" data-id="${
          payment.id
        }">Delete</button></td>
      `;
      tableBody.appendChild(row);
    });

    return true;
  } catch (error) {
    console.error("Error retrieving payment tokens:", error);
    return false;
  }
}

// Handle delete button clicks
document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("delete-button")) {
    const tokenId = event.target.dataset.id;

    if (confirm("Are you sure you want to delete this payment token?")) {
      try {
        const response = await fetch(`/api/payment-tokens/${tokenId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          alert("Payment token deleted successfully");
          // Remove the token from the UI
          event.target.closest("tr").remove();
        } else {
          const errorText = await response.text();
          alert(`Failed to delete payment token: ${errorText}`);
        }
      } catch (error) {
        console.error("Error deleting payment token:", error);
        alert("An error occurred while deleting the payment token.");
      }
    }
  }
});

// Add event listener to the "Pay Now" button
document.getElementById("submit").addEventListener("click", async (event) => {
  event.preventDefault(); // Prevent form submission if inside a form
  await handlePayment();
});

async function handlePayment() {
  const selectedMethod = document.querySelector('input[name="method"]:checked');

  if (!selectedMethod) {
    showError("Please select a payment method.");
    return;
  }

  const vaultID = localStorage.getItem("vaultId");

  try {
    // Create Order
    const orderResponse = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "useToken",
        vaultID, // Ensure the key matches the backend
      }),
    });

    if (!orderResponse.ok) {
      throw new Error(`Failed to create order: ${orderResponse.statusText}`);
    }

    const orderData = await orderResponse.json();
    const orderId = orderData.id;

    // Fetch Order Details
    const orderDetailsResponse = await fetch(`/api/orders/${orderId}`, {
      method: "GET",
    });

    if (!orderDetailsResponse.ok) {
      throw new Error(
        `Failed to fetch order details: ${orderDetailsResponse.statusText}`
      );
    }

    const orderDetails = await orderDetailsResponse.json();

    // Capture Payment
    const captureResponse = await fetch(`/api/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!captureResponse.ok) {
      throw new Error(
        `Failed to capture payment: ${captureResponse.statusText}`
      );
    }

    const captureData = await captureResponse.json();
    console.log("Captured payment:", captureData);

    // Provide success feedback to the user
    showSuccess("Payment processed successfully! Thank you for your order.");
  } catch (error) {
    console.error("Error during payment process:", error);
    showError(
      "An error occurred while processing your payment. Please try again."
    );
  }
}

function showError(message) {
  const statusMessage = document.getElementById("status-message");
  statusMessage.textContent = message;
  statusMessage.className = "status-message error";
}

function showSuccess(message) {
  const statusMessage = document.getElementById("status-message");
  statusMessage.textContent = message;
  statusMessage.className = "status-message success";
}

// Initialize everything when the page is loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchTokensAndLoadPayPalSDK();
});
