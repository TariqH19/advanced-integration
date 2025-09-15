// PayPal Vault During Purchase - Client-side JavaScript

let currentCustomer = null;
let selectedVaultType = null;
let userIdToken = null;
let paypalSDKLoaded = false;

// Helper function to safely parse API responses
async function safeApiCall(response) {
  try {
    const text = await response.text();

    if (!text.trim()) {
      throw new Error("Empty response from server");
    }

    const data = JSON.parse(text);
    return data;
  } catch (error) {
    console.error("API Response Error:", error);
    console.error("Response status:", response.status);
    console.error("Response headers:", response.headers);

    throw new Error(`Server response error: ${error.message}`);
  }
}

// Initialize page
document.addEventListener("DOMContentLoaded", function () {
  // Add debug info to help troubleshoot
  console.log("PayPal Vault Demo - Client initialized");
  console.log("Current URL:", window.location.href);

  loadCustomers();
  initializeEventListeners();
  checkUrlParameters();

  // Test server connectivity
  testServerConnection();
});

// Test server connection
async function testServerConnection() {
  try {
    const response = await fetch("/vault-during/api/health-check");

    if (response.ok) {
      const text = await response.text();
      console.log("Server connection: OK", text);
    } else {
      console.warn(
        "Server connection issue:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("Server connection failed:", error);
    showResultMessage(
      "Warning: Server connection issue detected. Some features may not work properly.",
      "error"
    );
  }
}

// Check URL parameters for success/cancel redirects
function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const success = urlParams.get("success");
  const cancelled = urlParams.get("cancelled");
  const customer = urlParams.get("customer");

  if (success === "true") {
    showResultMessage(
      "Payment completed successfully! Checking vault status...",
      "success"
    );
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
  } else if (cancelled === "true") {
    showResultMessage("Payment was cancelled by user.", "error");
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname);
  }
}

// Initialize event listeners
function initializeEventListeners() {
  // Customer selection
  document
    .getElementById("customer-select")
    .addEventListener("change", handleCustomerSelection);
  document
    .getElementById("create-customer-btn")
    .addEventListener("click", showNewCustomerForm);
  document
    .getElementById("save-customer-btn")
    .addEventListener("click", createNewCustomer);
  document
    .getElementById("cancel-customer-btn")
    .addEventListener("click", hideNewCustomerForm);
  document
    .getElementById("proceed-to-vault-btn")
    .addEventListener("click", proceedToVaultOptions);

  // Saved payment methods
  document.addEventListener("click", handlePaymentChoiceSelection);
  document
    .getElementById("pay-with-saved-btn")
    .addEventListener("click", payWithSavedMethod);

  // Vault options
  document.querySelectorAll(".vault-option").forEach((option) => {
    option.addEventListener("click", selectVaultOption);
  });
  document
    .getElementById("initialize-payment-btn")
    .addEventListener("click", initializePayment);
}

// Load customers from server
async function loadCustomers() {
  try {
    const response = await fetch("/vault-during/api/customers");
    const data = await safeApiCall(response);

    if (data.success) {
      populateCustomerSelect(data.customers);
    } else {
      console.error("Failed to load customers:", data.error);
      showResultMessage("Failed to load customers: " + data.error, "error");
    }
  } catch (error) {
    console.error("Error loading customers:", error);
    showResultMessage(
      "Error loading customers: " +
        error.message +
        ". Please refresh the page.",
      "error"
    );
  }
}

// Populate customer dropdown
function populateCustomerSelect(customers) {
  const select = document.getElementById("customer-select");
  select.innerHTML = '<option value="">Select a customer...</option>';

  Object.values(customers).forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.id;
    option.textContent = `${customer.name} (${customer.email})`;
    select.appendChild(option);
  });
}

// Handle customer selection
function handleCustomerSelection(event) {
  const customerId = event.target.value;

  if (customerId) {
    // Load customer details
    loadCustomerDetails(customerId);
  } else {
    hideCustomerInfo();
  }
}

// Load customer details
async function loadCustomerDetails(customerId) {
  try {
    const response = await fetch(
      `/vault-during/api/customer/${customerId}/vault-info`
    );
    const data = await safeApiCall(response);

    if (data.success) {
      currentCustomer = data.customer;
      showCustomerInfo(data.customer);

      // Check if customer has saved payment methods
      if (
        data.customer.payment_tokens &&
        data.customer.payment_tokens.length > 0
      ) {
        // Customer has saved methods - show different experience
        setTimeout(() => {
          showSavedMethodsSection(data.customer.payment_tokens);
        }, 500);
      }
    } else {
      console.error("Failed to load customer details:", data.error);
      showResultMessage(
        "Failed to load customer details: " + data.error,
        "error"
      );
    }
  } catch (error) {
    console.error("Error loading customer details:", error);
    showResultMessage(
      "Error loading customer details: " + error.message,
      "error"
    );
  }
}

// Show customer info
function showCustomerInfo(customer) {
  const infoDiv = document.getElementById("selected-customer-info");
  const detailsDiv = document.getElementById("customer-details");

  let tokensInfo = "";
  if (customer.payment_tokens && customer.payment_tokens.length > 0) {
    const tokenCount = customer.payment_tokens.length;
    const tokenText = tokenCount === 1 ? "saved payment method" : "saved payment methods";
    tokensInfo = `
      <div class="mt-2">
        <span class="badge bg-success-subtle text-success border border-success-subtle">
          <i class="fas fa-shield-alt me-1"></i>
          ${tokenCount} ${tokenText}
        </span>
      </div>
    `;
  } else {
    tokensInfo = `
      <div class="mt-2">
        <span class="badge bg-light text-muted border">
          <i class="fas fa-info-circle me-1"></i>
          No saved payment methods
        </span>
      </div>
    `;
  }

  detailsDiv.innerHTML = `
    <div>
      <strong class="d-block mb-1">${customer.name}</strong>
      <small class="text-muted d-block">${customer.email}</small>
      ${tokensInfo}
    </div>
  `;

  infoDiv.style.display = "block";
}

// Hide customer info
function hideCustomerInfo() {
  document.getElementById("selected-customer-info").style.display = "none";
  currentCustomer = null;
}

// Show new customer form
function showNewCustomerForm() {
  document.getElementById("new-customer-form").style.display = "block";
  document.getElementById("customer-name").focus();
}

// Hide new customer form
function hideNewCustomerForm() {
  document.getElementById("new-customer-form").style.display = "none";
  document.getElementById("customer-name").value = "";
  document.getElementById("customer-email").value = "";
}

// Create new customer
async function createNewCustomer() {
  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();

  if (!name || !email) {
    showResultMessage("Please enter both name and email.", "error");
    return;
  }

  if (!isValidEmail(email)) {
    showResultMessage("Please enter a valid email address.", "error");
    return;
  }

  try {
    showButtonLoading("save-customer-btn", true);

    const response = await fetch("/vault-during/api/create-customer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    const data = await safeApiCall(response);

    if (data.success) {
      currentCustomer = data.customer;

      // Update customer dropdown
      const select = document.getElementById("customer-select");
      const option = document.createElement("option");
      option.value = data.customer.id;
      option.textContent = `${data.customer.name} (${data.customer.email})`;
      option.selected = true;
      select.appendChild(option);

      hideNewCustomerForm();
      showCustomerInfo(data.customer);
      showResultMessage(`Customer "${name}" created successfully!`, "success");
    } else {
      showResultMessage("Failed to create customer: " + data.error, "error");
    }
  } catch (error) {
    console.error("Error creating customer:", error);
    showResultMessage(
      "Error creating customer: " + error.message + ". Please try again.",
      "error"
    );
  } finally {
    showButtonLoading("save-customer-btn", false);
  }
}

// Proceed to vault options
function proceedToVaultOptions() {
  if (!currentCustomer) {
    showResultMessage("Please select a customer first.", "error");
    return;
  }

  // Check if customer has saved payment methods
  if (
    currentCustomer.payment_tokens &&
    currentCustomer.payment_tokens.length > 0
  ) {
    // Customer has saved methods - show saved methods section
    showSavedMethodsSection(currentCustomer.payment_tokens);
  } else {
    // New customer or no saved methods - show vault options directly
    showVaultOptionsSection();
  }
}

// Select vault option
function selectVaultOption(event) {
  const option = event.currentTarget;
  const vaultType = option.getAttribute("data-vault-type");

  // Remove selection from all options
  document.querySelectorAll(".vault-option").forEach((opt) => {
    opt.classList.remove("selected");
    opt.querySelector(".fa-circle-check").style.display = "none";
  });

  // Select current option
  option.classList.add("selected");
  option.querySelector(".fa-circle-check").style.display = "block";

  selectedVaultType = vaultType;

  // Enable initialize button
  document.getElementById("initialize-payment-btn").disabled = false;

  showResultMessage(
    `Selected: ${
      vaultType === "PAYPAL" ? "PayPal Wallet" : "Credit/Debit Card"
    } vaulting`,
    "info"
  );
}

// Initialize payment
async function initializePayment() {
  if (!currentCustomer || !selectedVaultType) {
    showResultMessage("Please select a customer and vault type.", "error");
    return;
  }

  try {
    showButtonLoading("initialize-payment-btn", true);

    // Update step indicator
    updateStepIndicator(3);

    // Generate user ID token for vaulting
    await generateUserIdToken();

    // Load PayPal SDK if needed
    if (!paypalSDKLoaded) {
      await loadPayPalSDK();
    }

    // Show payment section
    document.getElementById("payment-section").style.display = "block";

    // Initialize PayPal buttons
    initializePayPalButtons();

    // Scroll to payment section
    document.getElementById("payment-section").scrollIntoView({
      behavior: "smooth",
    });

    showResultMessage(
      "Payment initialized! Complete the payment to vault your payment method.",
      "info"
    );
  } catch (error) {
    console.error("Error initializing payment:", error);
    showResultMessage("Error initializing payment: " + error.message, "error");
  } finally {
    showButtonLoading("initialize-payment-btn", false);
  }
}

// Generate user ID token
async function generateUserIdToken() {
  try {
    const response = await fetch("/vault-during/api/generate-user-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await safeApiCall(response);

    if (data.success) {
      userIdToken = data.id_token;
    } else {
      throw new Error(data.error || "Failed to generate user ID token");
    }
  } catch (error) {
    console.error("Error generating user ID token:", error);
    throw error;
  }
}

// Load PayPal SDK
function loadPayPalSDK() {
  return new Promise((resolve, reject) => {
    if (paypalSDKLoaded) {
      resolve();
      return;
    }

    const script = document.createElement("script");

    // Include hosted-fields component for card payments and card-fields for vaulting
    let components = "buttons";
    if (selectedVaultType === "CARD") {
      components = "buttons,hosted-fields,card-fields";
    }

    script.src = `https://www.paypal.com/sdk/js?client-id=AYKEHhMOHxkycKjSnN548FOs6qDSY-FT_97BIziC-GvhPIbXgb5pdunsni91NhaBvD590azAxRqkZntY&currency=USD&components=${components}&enable-funding=paylater,card,venmo`;

    if (userIdToken) {
      script.setAttribute("data-user-id-token", userIdToken);
    }

    script.onload = () => {
      paypalSDKLoaded = true;
      resolve();
    };

    script.onerror = () => {
      reject(new Error("Failed to load PayPal SDK"));
    };

    document.head.appendChild(script);
  });
}

// Initialize PayPal buttons
function initializePayPalButtons() {
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = ""; // Clear any existing buttons

  if (selectedVaultType === "CARD") {
    // Initialize Card Fields for card vaulting
    initializeCardFields();
  } else {
    // Initialize PayPal Buttons for PayPal wallet vaulting
    initializePayPalWallet();
  }
}

// Initialize PayPal Wallet buttons
function initializePayPalWallet() {
  const container = document.getElementById("paypal-button-container");

  window.paypal
    .Buttons({
      style: {
        shape: "pill",
        layout: "vertical",
        color: "blue",
        label: "paypal",
      },

      async createOrder() {
        try {
          showPaymentLoading(true);

          const response = await fetch("/vault-during/api/create-vault-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerId: currentCustomer.id,
              amount: "100.00",
              currency: "USD",
              vaultType: selectedVaultType,
            }),
          });

          const data = await safeApiCall(response);

          if (data.success) {
            return data.id;
          } else {
            throw new Error(data.error || "Failed to create order");
          }
        } catch (error) {
          console.error("Error creating order:", error);
          showResultMessage("Error creating order: " + error.message, "error");
          showPaymentLoading(false);
          throw error;
        }
      },

      async onApprove(data, actions) {
        try {
          showPaymentLoading(true);
          updateStepIndicator(4);

          const response = await fetch(
            `/vault-during/api/capture-vault-order/${data.orderID}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customerId: currentCustomer.id,
              }),
            }
          );

          const captureData = await safeApiCall(response);

          if (captureData.success) {
            showVaultResults(captureData);
            showResultMessage(
              "Payment completed and PayPal account saved successfully!",
              "success"
            );
          } else {
            throw new Error(captureData.error || "Failed to capture payment");
          }
        } catch (error) {
          console.error("Error capturing payment:", error);
          showResultMessage(
            "Error completing payment: " + error.message,
            "error"
          );
        } finally {
          showPaymentLoading(false);
        }
      },

      onCancel(data) {
        console.log("Payment cancelled:", data);
        showResultMessage("Payment was cancelled.", "error");
        showPaymentLoading(false);
      },

      onError(err) {
        console.error("PayPal error:", err);
        showResultMessage("PayPal error occurred. Please try again.", "error");
        showPaymentLoading(false);
      },
    })
    .render("#paypal-button-container");
}

// Initialize Card Fields for card vaulting
function initializeCardFields() {
  const container = document.getElementById("paypal-button-container");

  // Create card fields container
  container.innerHTML = `
        <div class="card-fields-container">
            <h6 class="mb-3">
                <i class="fas fa-credit-card me-2"></i>
                Enter Card Details to Save & Pay
            </h6>
            <p class="text-muted mb-3">
                Your card details will be securely saved for future payments.
            </p>
            
            <div class="card_container">
                <div id="card-name-field-container" class="card-field-container">
                    <label class="form-label small text-muted">Cardholder Name</label>
                </div>
                <div id="card-number-field-container" class="card-field-container">
                    <label class="form-label small text-muted">Card Number</label>
                </div>
                <div id="card-expiry-field-container" class="card-field-container">
                    <label class="form-label small text-muted">MM/YY</label>
                </div>
                <div id="card-cvv-field-container" class="card-field-container">
                    <label class="form-label small text-muted">CVV</label>
                </div>
            </div>
            
            <button id="card-field-submit-button" type="button" class="card-submit-button">
                <i class="fas fa-shield-alt me-2"></i>Pay $100.00 & Save Card
            </button>
        </div>
    `;

  // Initialize PayPal Card Fields
  try {
    const cardField = window.paypal.CardFields({
      createOrder: async (data) => {
        try {
          showCardPaymentLoading(true);

          const response = await fetch("/vault-during/api/create-vault-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerId: currentCustomer.id,
              amount: "100.00",
              currency: "USD",
              vaultType: selectedVaultType,
              card: {
                attributes: {
                  verification: {
                    method: "SCA_WHEN_REQUIRED",
                  },
                  vault: {
                    store_in_vault: "ON_SUCCESS",
                  },
                },
                experience_context: {
                  shipping_preference: "NO_SHIPPING",
                  return_url: window.location.origin + "/vault-during-purchase?success=true",
                  cancel_url: window.location.origin + "/vault-during-purchase?cancelled=true",
                },
              },
            }),
          });

          const orderData = await safeApiCall(response);

          if (orderData.success) {
            return orderData.id;
          } else {
            throw new Error(orderData.error || "Failed to create order");
          }
        } catch (error) {
          console.error("Error creating card order:", error);
          showResultMessage("Error creating order: " + error.message, "error");
          showCardPaymentLoading(false);
          throw error;
        }
      },

      onApprove: async function (orderData) {
        try {
          console.log("Card payment approved for order:", orderData.orderID);
          updateStepIndicator(4);

          // Capture the payment with vault
          const response = await fetch(
            `/vault-during/api/capture-vault-order/${orderData.orderID}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customerId: currentCustomer.id,
              }),
            }
          );

          const captureData = await safeApiCall(response);

          if (captureData.success) {
            showVaultResults(captureData);
            showResultMessage(
              "Payment completed and card saved successfully!",
              "success"
            );
          } else {
            throw new Error(captureData.error || "Failed to capture payment");
          }
        } catch (error) {
          console.error("Error capturing card payment:", error);
          showResultMessage(
            "Error completing payment: " + error.message,
            "error"
          );
        } finally {
          // Always stop the loading spinner
          showCardPaymentLoading(false);
        }
      },

      onCancel: function (data) {
        console.log("Card payment cancelled:", data);
        showResultMessage("Payment was cancelled.", "error");
        showCardPaymentLoading(false);
      },

      onError: function (error) {
        console.error("Card field error:", error);
        showResultMessage("Card payment error occurred. Please try again.", "error");
        showCardPaymentLoading(false);
      },

      style: {
        input: {
          "font-size": "14px",
          "font-family": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: "#333",
          "font-weight": "400",
        },
        ":focus": {
          color: "#0052cc",
        },
        ".invalid": {
          color: "#dc3545",
        },
      },
    });

    // Check if card fields are eligible
    if (cardField.isEligible()) {
      // Render individual card fields
      const nameField = cardField.NameField({
        style: {
          input: {
            "font-size": "14px",
            "font-family": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            color: "#333",
          },
        },
      });
      nameField.render("#card-name-field-container");

      const numberField = cardField.NumberField({
        style: {
          input: {
            "font-size": "14px",
            "font-family": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            color: "#333",
          },
        },
      });
      numberField.render("#card-number-field-container");

      const cvvField = cardField.CVVField({
        style: {
          input: {
            "font-size": "14px",
            "font-family": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            color: "#333",
          },
        },
      });
      cvvField.render("#card-cvv-field-container");

      const expiryField = cardField.ExpiryField({
        style: {
          input: {
            "font-size": "14px",
            "font-family": "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            color: "#333",
          },
        },
      });
      expiryField.render("#card-expiry-field-container");

      // Add submit button event listener
      document
        .getElementById("card-field-submit-button")
        .addEventListener("click", function () {
          console.log("Card field submit button clicked");
          
          // Use the centralized loading function
          showCardPaymentLoading(true);

          cardField
            .submit({})
            .then(function (details) {
              console.log("Card form submitted successfully:", details);
              // Keep processing state - will be reset in onApprove or onError
            })
            .catch(function (err) {
              console.error("Error submitting card form:", err);
              showResultMessage("Error submitting card details. Please try again.", "error");
              
              // Reset loading state on error
              showCardPaymentLoading(false);
            });
        });
    } else {
      console.log("Card fields not eligible");
      container.innerHTML = `
                <div class="alert alert-warning">
                    <h6><i class="fas fa-exclamation-triangle me-2"></i>Card Fields Not Available</h6>
                    <p class="mb-0">
                        PayPal hosted card fields are not eligible for your current setup. 
                        Please try PayPal wallet vaulting instead.
                    </p>
                </div>
            `;
    }
  } catch (error) {
    console.error("Error initializing card fields:", error);
    showResultMessage("Error initializing card fields: " + error.message, "error");
    
    // Fallback to demo mode
    container.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="fas fa-exclamation-circle me-2"></i>Card Fields Error</h6>
                <p class="mb-0">
                    Unable to initialize PayPal card fields. Error: ${error.message}
                </p>
            </div>
        `;
  }
}

// Show card payment loading
function showCardPaymentLoading(show) {
  // Look for the actual card field submit button
  const button = 
    document.getElementById("card-field-submit-button") ||
    document.getElementById("demo-card-pay-button") ||
    document.getElementById("card-pay-button");

  if (show && button) {
    button.disabled = true;
    button.innerHTML = `
      <div class="spinner-border spinner-border-sm me-2" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      Processing...
    `;
  } else if (button) {
    button.disabled = false;
    // Reset to the original card field button text
    if (button.id === "card-field-submit-button") {
      button.innerHTML = '<i class="fas fa-shield-alt me-2"></i>Pay $100.00 & Save Card';
    } else if (button.id === "demo-card-pay-button") {
      button.innerHTML = '<i class="fas fa-shield-alt me-2"></i>Demo: Pay $100.00 & Save Card';
    } else {
      button.innerHTML = '<i class="fas fa-shield-alt me-2"></i>Pay $100.00 & Save Card';
    }
  }

  // Also call the regular loading function for consistency
  showPaymentLoading(show);
}

// Show vault results
function showVaultResults(captureData) {
  const resultsDiv = document.getElementById("vault-results");
  const detailsDiv = document.getElementById("vault-details");

  let vaultInfo = "";
  if (captureData.vault_info) {
    const vault = captureData.vault_info;
    vaultInfo = `
            <div class="alert alert-success">
                <h6><i class="fas fa-shield-alt me-2"></i>Vault Information</h6>
                <ul class="mb-0">
                    <li><strong>Vault ID:</strong> ${vault.id || "N/A"}</li>
                    <li><strong>Status:</strong> ${vault.status || "N/A"}</li>
                    <li><strong>Customer ID:</strong> ${
                      vault.customer?.id || "N/A"
                    }</li>
                </ul>
            </div>
        `;
  }

  const transaction =
    captureData.capture?.purchase_units?.[0]?.payments?.captures?.[0];
  let transactionInfo = "";
  if (transaction) {
    transactionInfo = `
            <div class="alert alert-info">
                <h6><i class="fas fa-receipt me-2"></i>Transaction Details</h6>
                <ul class="mb-0">
                    <li><strong>Transaction ID:</strong> ${transaction.id}</li>
                    <li><strong>Status:</strong> ${transaction.status}</li>
                    <li><strong>Amount:</strong> ${transaction.amount?.value} ${transaction.amount?.currency_code}</li>
                </ul>
            </div>
        `;
  }

  detailsDiv.innerHTML = vaultInfo + transactionInfo;
  resultsDiv.style.display = "block";

  // Scroll to results
  resultsDiv.scrollIntoView({ behavior: "smooth" });
}

// Update step indicator
function updateStepIndicator(activeStep) {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step-${i}`);
    step.classList.remove("active", "completed");

    if (i < activeStep) {
      step.classList.add("completed");
    } else if (i === activeStep) {
      step.classList.add("active");
    }
  }
}

// Show payment loading
function showPaymentLoading(show) {
  const loading = document.getElementById("payment-loading");
  const container = document.getElementById("paypal-button-container");

  if (show) {
    loading.style.display = "block";
    container.style.opacity = "0.5";
    container.style.pointerEvents = "none";
  } else {
    loading.style.display = "none";
    container.style.opacity = "1";
    container.style.pointerEvents = "auto";
  }
}

// Show button loading state
function showButtonLoading(buttonId, loading) {
  const button = document.getElementById(buttonId);
  const originalText = button.innerHTML;

  if (loading) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Loading...';
    button.setAttribute("data-original-text", originalText);
  } else {
    button.disabled = false;
    button.innerHTML =
      button.getAttribute("data-original-text") || originalText;
  }
}

// Show result message
function showResultMessage(message, type = "info") {
  const messageDiv = document.getElementById("result-message");
  messageDiv.className = `result-message result-${type}`;
  messageDiv.innerHTML = `
        <i class="fas fa-${
          type === "success"
            ? "check-circle"
            : type === "error"
            ? "exclamation-circle"
            : "info-circle"
        } me-2"></i>
        ${message}
    `;
  messageDiv.style.display = "block";

  // Auto-hide after 5 seconds for info messages
  if (type === "info") {
    setTimeout(() => {
      messageDiv.style.display = "none";
    }, 5000);
  }
}

// Utility function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Show saved payment methods section
function showSavedMethodsSection(paymentTokens) {
  updateStepIndicator(2);

  const section = document.getElementById("saved-methods-section");
  section.style.display = "block";

  // Populate payment tokens
  populatePaymentTokens(paymentTokens);

  // Scroll to section
  section.scrollIntoView({ behavior: "smooth" });

  showResultMessage(
    `Welcome back! You have ${paymentTokens.length} saved payment method(s).`,
    "info"
  );
}

// Handle payment choice selection (existing vs new)
function handlePaymentChoiceSelection(event) {
  const card = event.target.closest(".payment-choice-card");
  if (!card) return;

  const choice = card.getAttribute("data-choice");

  // Remove selection from all cards
  document.querySelectorAll(".payment-choice-card").forEach((c) => {
    c.classList.remove("selected");
  });

  // Select current card
  card.classList.add("selected");

  if (choice === "existing") {
    // Show saved methods list
    document.getElementById("existing-methods-list").style.display = "block";

    // Hide vault options if visible
    document.getElementById("vault-options-section").style.display = "none";

    showResultMessage("Select a saved payment method to proceed.", "info");
  } else if (choice === "new") {
    // Hide saved methods list
    document.getElementById("existing-methods-list").style.display = "none";

    // Show vault options for new payment method
    setTimeout(() => {
      showVaultOptionsSection();
    }, 300);
  }
}

// Show vault options section
function showVaultOptionsSection() {
  updateStepIndicator(2);

  const section = document.getElementById("vault-options-section");
  section.style.display = "block";

  // Scroll to section
  section.scrollIntoView({ behavior: "smooth" });

  showResultMessage(
    "Choose how you want to save your new payment method.",
    "info"
  );
}

// Populate payment tokens
function populatePaymentTokens(paymentTokens) {
  const container = document.getElementById("payment-tokens-container");
  container.innerHTML = "";

  paymentTokens.forEach((token) => {
    const tokenElement = document.createElement("div");
    tokenElement.className = "payment-token-card";
    tokenElement.setAttribute("data-token-id", token.id);

    const typeIcon =
      token.type === "PAYPAL" ? "fab fa-paypal" : "fas fa-credit-card";
    const typeColor = token.type === "PAYPAL" ? "text-primary" : "text-info";
    
    // Enhanced type label with card details
    let typeLabel = token.type === "PAYPAL" ? "PayPal Account" : "Credit/Debit Card";
    let cardDetailsHTML = "";
    
    if (token.type === "CARD" && token.card_details) {
      const { last_digits, brand, type } = token.card_details;
      if (last_digits) {
        typeLabel = `${brand || 'Card'} •••• ${last_digits}`;
        cardDetailsHTML = `
          <small class="text-info">
            <i class="fas fa-credit-card me-1"></i>
            ${type || 'Credit'} ${brand || 'Card'} ending in ${last_digits}
          </small>
          <br>
        `;
      }
    }

    const createdDate = new Date(token.created).toLocaleDateString();
    const lastUsedDate = new Date(token.last_used).toLocaleDateString();

    tokenElement.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="${typeIcon} fa-2x ${typeColor} me-3"></i>
                <div class="flex-grow-1">
                    <h6 class="mb-1">${typeLabel}</h6>
                    ${cardDetailsHTML}
                    <small class="text-muted">
                        Saved: ${createdDate} | Last used: ${lastUsedDate}
                    </small>
                    <br>
                    <small class="text-success">
                        <i class="fas fa-shield-alt me-1"></i>
                        Vault ID: ${token.id}
                    </small>
                </div>
                <div class="ms-auto d-flex align-items-center gap-2">
                    <button class="btn btn-outline-danger btn-sm delete-token-btn" 
                            data-token-id="${token.id}" 
                            data-token-type="${token.type}"
                            title="Delete payment method">
                        <i class="fas fa-trash"></i>
                    </button>
                    <i class="fas fa-circle-check text-success" style="display: none;"></i>
                </div>
            </div>
        `;

    tokenElement.addEventListener("click", (event) => {
      // Don't select if clicking delete button
      if (event.target.closest('.delete-token-btn')) {
        return;
      }
      selectPaymentToken(tokenElement, token);
    });

    // Add delete button event listener
    const deleteBtn = tokenElement.querySelector('.delete-token-btn');
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent token selection
      deletePaymentToken(token);
    });

    container.appendChild(tokenElement);
  });
}

// Select payment token
function selectPaymentToken(element, token) {
  // Remove selection from all tokens
  document.querySelectorAll(".payment-token-card").forEach((card) => {
    card.classList.remove("selected");
    card.querySelector(".fa-circle-check").style.display = "none";
  });

  // Select current token
  element.classList.add("selected");
  element.querySelector(".fa-circle-check").style.display = "block";

  // Store selected token
  window.selectedPaymentToken = token;

  // Enable pay button
  document.getElementById("pay-with-saved-btn").disabled = false;

  showResultMessage(
    `Selected: ${
      token.type === "PAYPAL" ? "PayPal Account" : "Credit/Debit Card"
    }`,
    "info"
  );
}

// Pay with saved method
async function payWithSavedMethod() {
  if (!window.selectedPaymentToken) {
    showResultMessage("Please select a payment method.", "error");
    return;
  }

  try {
    showButtonLoading("pay-with-saved-btn", true);
    updateStepIndicator(3);

    // Create order using saved payment token
    const response = await fetch("/vault-during/api/create-token-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerId: currentCustomer.id,
        paymentTokenId: window.selectedPaymentToken.id,
        amount: "100.00",
        currency: "USD",
      }),
    });

    const data = await safeApiCall(response);

    if (data.success) {
      updateStepIndicator(4);
      showResultMessage(
        "Payment completed successfully with saved payment method!",
        "success"
      );

      // Show results
      showTokenPaymentResults(data);
    } else {
      throw new Error(data.error || "Failed to process payment");
    }
  } catch (error) {
    console.error("Error processing saved payment:", error);
    showResultMessage("Error processing payment: " + error.message, "error");
  } finally {
    showButtonLoading("pay-with-saved-btn", false);
  }
}

// Show token payment results
function showTokenPaymentResults(data) {
  const resultsDiv = document.getElementById("vault-results");
  const detailsDiv = document.getElementById("vault-details");

  const transaction = data.capture;
  let transactionInfo = "";
  if (transaction) {
    const isRealPayment = data.vault_payment && !data.demo_mode;
    const statusNote = isRealPayment
      ? '<div class="alert alert-info"><small><i class="fas fa-check-circle me-1"></i>Real PayPal payment processed successfully</small></div>'
      : '<div class="alert alert-warning"><small><i class="fas fa-info-circle me-1"></i>Demo Mode: ' +
        (data.note || "Payment simulated for demonstration") +
        "</small></div>";

    // Extract actual transaction details
    const captureInfo =
      transaction.purchase_units?.[0]?.payments?.captures?.[0] || transaction;

    transactionInfo = `
            ${statusNote}
            <div class="alert alert-success">
                <h6><i class="fas fa-check-circle me-2"></i>Payment Successful</h6>
                <ul class="mb-0">
                    <li><strong>Transaction ID:</strong> ${
                      captureInfo.id || transaction.id || "N/A"
                    }</li>
                    <li><strong>Status:</strong> ${
                      captureInfo.status || transaction.status || "COMPLETED"
                    }</li>
                    <li><strong>Amount:</strong> ${
                      captureInfo.amount?.value ||
                      transaction.amount?.value ||
                      "100.00"
                    } ${
      captureInfo.amount?.currency_code ||
      transaction.amount?.currency_code ||
      "USD"
    }</li>
                    <li><strong>Payment Method:</strong> Saved ${
                      window.selectedPaymentToken.type === "PAYPAL"
                        ? "PayPal Account"
                        : "Credit/Debit Card"
                    }</li>
                    <li><strong>Vault Token:</strong> ${
                      window.selectedPaymentToken.id
                    }</li>
                    ${
                      isRealPayment
                        ? "<li><strong>Processing:</strong> Live PayPal API</li>"
                        : ""
                    }
                </ul>
            </div>
        `;
  }

  detailsDiv.innerHTML = transactionInfo;
  resultsDiv.style.display = "block";

  // Scroll to results
  resultsDiv.scrollIntoView({ behavior: "smooth" });
}

// Delete payment token
async function deletePaymentToken(token) {
  const tokenType = token.type === "PAYPAL" ? "PayPal Account" : "Credit/Debit Card";
  const tokenLabel = token.card_details && token.card_details.last_digits 
    ? `${token.card_details.brand} •••• ${token.card_details.last_digits}`
    : tokenType;

  // Show confirmation dialog
  const confirmed = confirm(
    `Are you sure you want to delete this payment method?\n\n${tokenLabel}\n\nThis action cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    // Show loading state
    const deleteBtn = document.querySelector(`[data-token-id="${token.id}"]`);
    const originalContent = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Ask if user wants to delete from PayPal as well (for non-demo tokens)
    let deleteFromPayPal = false;
    if (!token.demo) {
      deleteFromPayPal = confirm(
        "Do you also want to remove this payment method from your PayPal vault?\n\n" +
        "• Yes: Remove from both local storage and PayPal\n" +
        "• No: Remove only from local storage (PayPal vault will keep it)"
      );
    }

    const response = await fetch(
      `/vault-during/api/customer/${currentCustomer.id}/payment-token/${token.id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteFromPayPal: deleteFromPayPal,
        }),
      }
    );

    const data = await safeApiCall(response);

    if (data.success) {
      // Remove the token element from UI
      const tokenElement = document.querySelector(`[data-token-id="${token.id}"]`).closest('.payment-token-card');
      tokenElement.remove();

      // Update the currentCustomer object
      if (currentCustomer.payment_tokens) {
        currentCustomer.payment_tokens = currentCustomer.payment_tokens.filter(
          (t) => t.id !== token.id
        );
      }

      // Show success message
      let message = `${tokenLabel} has been deleted successfully.`;
      if (deleteFromPayPal) {
        if (data.paypalDeletion === "success") {
          message += " (Also removed from PayPal vault)";
        } else if (data.paypalDeletion === "failed") {
          message += " (Warning: Could not remove from PayPal vault)";
        } else if (data.paypalDeletion === "error") {
          message += " (Error: Failed to contact PayPal for vault deletion)";
        }
      }

      showResultMessage(message, "success");

      // Check if no payment tokens left
      const remainingTokens = document.querySelectorAll('.payment-token-card');
      if (remainingTokens.length === 0) {
        document.getElementById("payment-tokens-container").innerHTML = `
          <div class="text-center py-3">
            <i class="fas fa-info-circle text-muted me-2"></i>
            <span class="text-muted">No saved payment methods</span>
          </div>
        `;
        
        // Hide the existing methods list
        document.getElementById("existing-methods-list").style.display = "none";
        
        // Show vault options for new payment method
        setTimeout(() => {
          showVaultOptionsSection();
        }, 1000);
      }

      // Clear any selected payment token
      if (window.selectedPaymentToken && window.selectedPaymentToken.id === token.id) {
        window.selectedPaymentToken = null;
        document.getElementById("pay-with-saved-btn").disabled = true;
      }

    } else {
      throw new Error(data.error || "Failed to delete payment method");
    }
  } catch (error) {
    console.error("Error deleting payment token:", error);
    showResultMessage("Error deleting payment method: " + error.message, "error");

    // Reset delete button
    const deleteBtn = document.querySelector(`[data-token-id="${token.id}"]`);
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    }
  }
}
