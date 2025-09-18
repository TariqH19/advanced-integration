// PayPal Vault Save-for-Later Integration
console.log("🚀 PayPal Vault Save-for-Later script loaded");

// Application state
let selectedCustomer = null;
let cardFields = null;
let paypalButtons = null;
let selectedPaymentToken = null;

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  console.log("📱 Initializing Save-for-Later vault flow");

  initializeCustomerSelection();
  initializePaymentTypeSelection();
  loadSavedPaymentMethods();
});

// Customer Selection Management
function initializeCustomerSelection() {
  const customerCards = document.querySelectorAll(".customer-card");

  customerCards.forEach((card) => {
    card.addEventListener("click", function () {
      const customerId = this.dataset.customerId;
      selectCustomer(customerId);
    });
  });

  updateTokenCounts();
}

function selectCustomer(customerId) {
  console.log(`👤 Customer selected: ${customerId}`);
  selectedCustomer = customerId;

  // Update UI with animations
  document.querySelectorAll(".customer-card").forEach((card) => {
    card.classList.remove("selected");
    card.style.transform = "translateY(0)";
  });

  const selectedCard = document.querySelector(
    `[data-customer-id="${customerId}"]`
  );
  selectedCard.classList.add("selected");
  selectedCard.style.transform = "translateY(-2px)";

  // Show payment section with fade-in animation
  const paymentSection = document.getElementById("savePaymentSection");
  paymentSection.style.display = "block";
  setTimeout(() => {
    paymentSection.classList.add("fade-in");
  }, 50);

  const savedSection = document.getElementById("savedMethodsSection");
  savedSection.style.display = "block";
  setTimeout(() => {
    savedSection.classList.add("fade-in");
  }, 100);

  // Load saved methods for selected customer
  loadSavedPaymentMethods();

  // Initialize PayPal components for selected customer
  initializePayPalComponents();
}

// Payment Type Selection
function initializePaymentTypeSelection() {
  const paymentTypeRadios = document.querySelectorAll(
    'input[name="paymentType"]'
  );

  paymentTypeRadios.forEach((radio) => {
    radio.addEventListener("change", function () {
      const paymentType = this.value;
      togglePaymentMethod(paymentType);
    });
  });
}

function togglePaymentMethod(paymentType) {
  console.log(`💳 Payment method selected: ${paymentType}`);

  const cardContainer = document.getElementById("cardFieldsContainer");
  const paypalContainer = document.getElementById("paypalButtonContainer");

  if (paymentType === "card") {
    cardContainer.style.display = "block";
    paypalContainer.style.display = "none";
  } else {
    cardContainer.style.display = "none";
    paypalContainer.style.display = "block";
  }
}

// PayPal Components Initialization
function initializePayPalComponents() {
  if (!selectedCustomer) {
    console.warn("⚠️ No customer selected for PayPal components");
    return;
  }

  initializeCardFields();
  initializePayPalButtons();
}

// Card Fields Integration
function initializeCardFields() {
  console.log("💳 Initializing PayPal Card Fields for save-for-later");

  if (cardFields) {
    cardFields.close();
  }

  cardFields = paypal.CardFields({
    createVaultSetupToken: async () => {
      console.log("🔐 Creating vault setup token for card");
      try {
        const response = await fetch(
          "/api/vault-save-for-later/setup-token/card",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customer_id: selectedCustomer,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Setup token created:", data.id);
        return data.id;
      } catch (error) {
        console.error("❌ Setup token creation failed:", error);
        showAlert("Failed to create setup token. Please try again.", "danger");
        throw error;
      }
    },

    onApprove: async (data) => {
      console.log("🎉 Card fields approved, creating payment token", data);
      showCardLoading(true);

      try {
        const response = await fetch(
          "/api/vault-save-for-later/payment-token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vault_setup_token: data.vaultSetupToken,
              customer_id: selectedCustomer,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("✅ Payment token created:", result.id);

        showAlert("Payment method saved successfully!", "success");
        loadSavedPaymentMethods();
        updateTokenCounts();
      } catch (error) {
        console.error("❌ Payment token creation failed:", error);
        showAlert("Failed to save payment method. Please try again.", "danger");
      } finally {
        showCardLoading(false);
      }
    },

    onError: (error) => {
      console.error("❌ Card fields error:", error);
      showAlert(
        "An error occurred with the card fields. Please try again.",
        "danger"
      );
      showCardLoading(false);
    },
  });

  // Render card fields
  if (cardFields.isEligible()) {
    cardFields.NameField().render("#card-holder-name");
    cardFields.NumberField().render("#card-number");
    cardFields.ExpiryField().render("#expiration-date");
    cardFields.CVVField().render("#cvv");
  } else {
    console.warn("⚠️ CardFields not eligible");
    showAlert("Card fields are not available at this time.", "warning");
  }

  // Add save button listener
  document.getElementById("saveCardButton").addEventListener("click", () => {
    if (!selectedCustomer) {
      showAlert("Please select a customer first.", "warning");
      return;
    }

    console.log("💾 Submitting card for vault");
    cardFields.submit();
  });
}

// PayPal Buttons Integration
function initializePayPalButtons() {
  console.log("🅿️ Initializing PayPal Buttons for save-for-later");

  // Clear existing buttons
  document.getElementById("paypal-button-container").innerHTML = "";

  if (paypalButtons) {
    paypalButtons.close();
  }

  paypalButtons = paypal.Buttons({
    createVaultSetupToken: async () => {
      console.log("🔐 Creating vault setup token for PayPal");
      try {
        const response = await fetch(
          "/api/vault-save-for-later/setup-token/paypal",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customer_id: selectedCustomer,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ PayPal setup token created:", data.id);
        return data.id;
      } catch (error) {
        console.error("❌ PayPal setup token creation failed:", error);
        showAlert(
          "Failed to create PayPal setup token. Please try again.",
          "danger"
        );
        throw error;
      }
    },

    onApprove: async (data) => {
      console.log("🎉 PayPal approved, creating payment token", data);

      try {
        const response = await fetch(
          "/api/vault-save-for-later/payment-token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              vault_setup_token: data.vaultSetupToken,
              customer_id: selectedCustomer,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log("✅ PayPal payment token created:", result.id);

        showAlert("PayPal Wallet saved successfully!", "success");
        loadSavedPaymentMethods();
        updateTokenCounts();
      } catch (error) {
        console.error("❌ PayPal payment token creation failed:", error);
        showAlert("Failed to save PayPal Wallet. Please try again.", "danger");
      }
    },

    onError: (error) => {
      console.error("❌ PayPal buttons error:", error);
      showAlert("An error occurred with PayPal. Please try again.", "danger");
    },

    onCancel: () => {
      console.log("🚫 PayPal payment cancelled");
      showAlert("PayPal payment was cancelled.", "info");
    },
  });

  paypalButtons.render("#paypal-button-container");
}

// Saved Payment Methods Management
async function loadSavedPaymentMethods() {
  if (!selectedCustomer) return;

  console.log(`📋 Loading saved payment methods for ${selectedCustomer}`);

  try {
    const response = await fetch(
      `/api/vault-save-for-later/payment-tokens/${selectedCustomer}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    displaySavedMethods(data.payment_tokens || []);
  } catch (error) {
    console.error("❌ Failed to load saved payment methods:", error);
    showAlert("Failed to load saved payment methods.", "warning");
  }
}

function displaySavedMethods(tokens) {
  const container = document.getElementById("savedMethodsList");

  if (!tokens || tokens.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-credit-card-2-front"></i>
                <h5 style="color: #6c757d; margin-bottom: 10px;">No Payment Methods Saved</h5>
                <p>Save a payment method above to see it here</p>
                <small style="color: #9ca3af;">Your saved payment methods will appear in this section</small>
            </div>
        `;
    return;
  }

  container.innerHTML = tokens
    .map((token) => {
      if (token.payment_source.card) {
        const card = token.payment_source.card;
        return `
                <div class="saved-method">
                    <div class="card-info">
                        <div class="card-brand">${card.brand}</div>
                        <div>
                            <strong>${card.brand} •••• ${
          card.last_digits
        }</strong>
                            <div class="text-muted small">Expires ${
                              card.expiry
                            }</div>
                            ${
                              card.name
                                ? `<div class="text-muted small">${card.name}</div>`
                                : ""
                            }
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" onclick="showPaymentProcessingSection(${JSON.stringify(
                          token
                        ).replace(/"/g, "&quot;")})">
                            <i class="bi bi-credit-card"></i> Pay Now
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletePaymentToken('${
                          token.id
                        }')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
      } else if (token.payment_source.paypal) {
        const paypal = token.payment_source.paypal;
        return `
                <div class="saved-method">
                    <div class="card-info">
                        <i class="bi bi-paypal text-primary" style="font-size: 24px;"></i>
                        <div>
                            <strong>PayPal Wallet</strong>
                            <div class="text-muted small">${
                              paypal.email_address || "PayPal Account"
                            }</div>
                            ${
                              paypal.name
                                ? `<div class="text-muted small">${paypal.name.given_name} ${paypal.name.surname}</div>`
                                : ""
                            }
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-success btn-sm" onclick="showPaymentProcessingSection(${JSON.stringify(
                          token
                        ).replace(/"/g, "&quot;")})">
                            <i class="bi bi-paypal"></i> Pay Now
                        </button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletePaymentToken('${
                          token.id
                        }')">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
      }
      return "";
    })
    .join("");
}

// Delete Payment Token
async function deletePaymentToken(tokenId) {
  console.log(`🗑️ Deleting payment token: ${tokenId}`);

  if (!confirm("Are you sure you want to delete this saved payment method?")) {
    return;
  }

  try {
    const response = await fetch(
      `/api/vault-save-for-later/payment-tokens/${tokenId}`,
      {
        method: "DELETE",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    showAlert("Payment method deleted successfully.", "success");
    loadSavedPaymentMethods();
    updateTokenCounts();
  } catch (error) {
    console.error("❌ Failed to delete payment token:", error);
    showAlert("Failed to delete payment method. Please try again.", "danger");
  }
}

// Update Token Counts
async function updateTokenCounts() {
  console.log("📊 Updating token counts for all customers");

  const customerIds = ["customer_001", "customer_002", "customer_003"];

  for (const customerId of customerIds) {
    try {
      const response = await fetch(
        `/api/vault-save-for-later/payment-tokens/${customerId}`
      );

      if (response.ok) {
        const data = await response.json();
        const count = data.payment_tokens ? data.payment_tokens.length : 0;

        const badge = document.getElementById(`tokenCount_${customerId}`);
        if (badge) {
          badge.textContent = `${count} saved method${count !== 1 ? "s" : ""}`;
          badge.className = count > 0 ? "badge bg-success" : "badge bg-primary";
        }
      }
    } catch (error) {
      console.error(
        `❌ Failed to update token count for ${customerId}:`,
        error
      );
    }
  }
}

// UI Helpers
function showCardLoading(loading) {
  const spinner = document.getElementById("cardLoadingSpinner");
  const buttonText = document.getElementById("cardButtonText");
  const button = document.getElementById("saveCardButton");

  if (loading) {
    spinner.style.display = "inline-block";
    buttonText.textContent = "Saving...";
    button.disabled = true;
  } else {
    spinner.style.display = "none";
    buttonText.textContent = "Save Card for Later";
    button.disabled = false;
  }
}

function showAlert(message, type) {
  console.log(`📢 Alert (${type}): ${message}`);

  const alertContainer = document.getElementById("alertContainer");
  const alertId = "alert_" + Date.now();

  const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show fade-in" role="alert" style="margin-top: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 12px;">
            <i class="bi bi-${getAlertIcon(
              type
            )}" style="margin-right: 8px;"></i>
            <strong>${getAlertTitle(type)}:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" style="filter: brightness(0.8);"></button>
        </div>
    `;

  alertContainer.insertAdjacentHTML("beforeend", alertHtml);

  // Auto-dismiss after 5 seconds with fade-out animation
  setTimeout(() => {
    const alert = document.getElementById(alertId);
    if (alert) {
      alert.style.transition = "all 0.5s ease";
      alert.style.opacity = "0";
      alert.style.transform = "translateY(-20px)";
      setTimeout(() => {
        const bsAlert = new bootstrap.Alert(alert);
        bsAlert.close();
      }, 500);
    }
  }, 5000);
}

function getAlertTitle(type) {
  const titleMap = {
    success: "Success",
    danger: "Error",
    warning: "Warning",
    info: "Info",
  };
  return titleMap[type] || "Notice";
}

function showLoading(show, buttonElement = null) {
  if (buttonElement) {
    const spinner = buttonElement.querySelector(".loading-spinner");
    const buttonText =
      buttonElement.querySelector(".button-text") || buttonElement;

    if (show) {
      buttonElement.disabled = true;
      buttonElement.style.opacity = "0.8";
      if (spinner) spinner.style.display = "inline-block";
      if (buttonText && !buttonText.classList.contains("loading-spinner")) {
        buttonText.style.opacity = "0.7";
      }
    } else {
      buttonElement.disabled = false;
      buttonElement.style.opacity = "1";
      if (spinner) spinner.style.display = "none";
      if (buttonText && !buttonText.classList.contains("loading-spinner")) {
        buttonText.style.opacity = "1";
      }
    }
  }
}

function getAlertIcon(type) {
  const iconMap = {
    success: "check-circle",
    danger: "exclamation-triangle",
    warning: "exclamation-triangle",
    info: "info-circle",
  };
  return iconMap[type] || "info-circle";
}

// Global function for window scope
window.deletePaymentToken = deletePaymentToken;

// Payment Processing with Saved Tokens
function initializePaymentProcessing() {
  const processPaymentBtn = document.getElementById("processPaymentBtn");
  const cancelPaymentBtn = document.getElementById("cancelPaymentBtn");

  if (processPaymentBtn) {
    processPaymentBtn.addEventListener("click", processPaymentWithSavedToken);
  }

  if (cancelPaymentBtn) {
    cancelPaymentBtn.addEventListener("click", cancelPaymentProcess);
  }
}

function showPaymentProcessingSection(paymentToken) {
  selectedPaymentToken = paymentToken;

  // Display selected payment method info
  displaySelectedPaymentMethod(paymentToken);

  // Show the payment processing section
  const section = document.getElementById("paymentProcessingSection");
  if (section) {
    section.style.display = "block";
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Initialize payment processing if not already done
  initializePaymentProcessing();
}

function displaySelectedPaymentMethod(paymentToken) {
  const displayElement = document.getElementById("selectedMethodDisplay");
  if (!displayElement || !paymentToken) return;

  const { payment_source } = paymentToken;
  let html = "";

  if (payment_source.paypal) {
    const paypal = payment_source.paypal;
    html = `
      <div class="d-flex align-items-center">
        <div class="me-3">
          <i class="fab fa-paypal fa-2x text-primary"></i>
        </div>
        <div>
          <div class="fw-bold">${paypal.name?.given_name || ""} ${
      paypal.name?.surname || ""
    }</div>
          <div class="text-muted">${paypal.email_address || ""}</div>
          <div class="small text-success">PayPal Wallet • Token ID: ${
            paymentToken.id
          }</div>
        </div>
      </div>
    `;
  } else if (payment_source.card) {
    const card = payment_source.card;
    html = `
      <div class="d-flex align-items-center">
        <div class="me-3">
          <i class="fas fa-credit-card fa-2x text-info"></i>
        </div>
        <div>
          <div class="fw-bold">${card.name || "Card Payment"}</div>
          <div class="text-muted">**** **** **** ${
            card.last_4_digits || "****"
          }</div>
          <div class="small text-success">Card • Token ID: ${
            paymentToken.id
          }</div>
        </div>
      </div>
    `;
  } else {
    html = `
      <div class="d-flex align-items-center">
        <div class="me-3">
          <i class="fas fa-wallet fa-2x text-secondary"></i>
        </div>
        <div>
          <div class="fw-bold">Payment Method</div>
          <div class="small text-success">Token ID: ${paymentToken.id}</div>
        </div>
      </div>
    `;
  }

  displayElement.innerHTML = html;
}

async function processPaymentWithSavedToken() {
  if (!selectedPaymentToken) {
    showAlert(
      "danger",
      "No payment method selected",
      "Please select a payment method first."
    );
    return;
  }

  const amount = document.getElementById("paymentAmount")?.value;
  const currency = document.getElementById("paymentCurrency")?.value || "USD";
  const description =
    document.getElementById("paymentDescription")?.value || "Payment";

  if (!amount || parseFloat(amount) <= 0) {
    showAlert(
      "danger",
      "Invalid Amount",
      "Please enter a valid payment amount."
    );
    return;
  }

  showPaymentLoading(true);
  hidePaymentResult();

  try {
    console.log(
      "🚀 Creating order for payment with saved token:",
      selectedPaymentToken.id
    );

    // Step 1: Create order with vault_id
    const orderResponse = await fetch(
      "/api/vault-save-for-later/create-payment-order",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vault_id: selectedPaymentToken.id,
          amount: parseFloat(amount),
          currency: currency,
          description: description,
          customer_id: selectedCustomer,
        }),
      }
    );

    const orderResult = await orderResponse.json();
    console.log("📄 Order creation result:", orderResult);

    if (!orderResponse.ok) {
      throw new Error(orderResult.error || "Failed to create payment order");
    }

    // Check if the payment was auto-captured
    if (orderResult.auto_captured) {
      console.log("🎉 Payment was auto-captured successfully!");
      showPaymentLoading(false);
      showPaymentResult("success", "Payment Successful!", orderResult);
      showAlert(
        "success",
        "Payment Completed",
        `Payment of $${amount} ${currency} was processed successfully (auto-captured).`
      );
      return;
    }

    const orderId = orderResult.order_id;

    // Step 2: Capture the payment (only if not auto-captured)
    console.log("💳 Capturing payment for order:", orderId);

    const captureResponse = await fetch(
      "/api/vault-save-for-later/capture-payment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
        }),
      }
    );

    const captureResult = await captureResponse.json();
    console.log("✅ Payment capture result:", captureResult);

    showPaymentLoading(false);

    if (captureResponse.ok && captureResult.status === "COMPLETED") {
      showPaymentResult("success", "Payment Successful!", captureResult);
      showAlert(
        "success",
        "Payment Completed",
        `Payment of $${amount} ${currency} was processed successfully.`
      );
    } else {
      throw new Error(captureResult.error || "Payment capture failed");
    }
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    showPaymentLoading(false);
    showPaymentResult("error", "Payment Failed", { error: error.message });
    showAlert("danger", "Payment Error", error.message);
  }
}

function showPaymentLoading(show) {
  const loadingElement = document.getElementById("paymentLoading");
  const processBtn = document.getElementById("processPaymentBtn");

  if (loadingElement) {
    loadingElement.style.display = show ? "block" : "none";
  }

  if (processBtn) {
    processBtn.disabled = show;
    if (show) {
      processBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
    } else {
      processBtn.innerHTML =
        '<i class="fas fa-credit-card me-2"></i>Process Payment';
    }
  }
}

function showPaymentResult(type, title, data) {
  const resultElement = document.getElementById("paymentResult");
  if (!resultElement) return;

  let html = "";
  const alertClass = type === "success" ? "alert-success" : "alert-danger";
  const icon = type === "success" ? "check-circle" : "exclamation-triangle";

  if (type === "success") {
    html = `
      <div class="alert ${alertClass} border-0 shadow-sm">
        <div class="d-flex align-items-center mb-3">
          <i class="fas fa-${icon} fa-2x text-success me-3"></i>
          <div>
            <h5 class="alert-heading mb-1">${title}</h5>
            <p class="mb-0">Your payment has been processed successfully.</p>
          </div>
        </div>
        
        <div class="payment-details">
          <div class="row">
            <div class="col-md-6">
              <strong>Transaction ID:</strong><br>
              <code>${data.id || "N/A"}</code>
            </div>
            <div class="col-md-6">
              <strong>Status:</strong><br>
              <span class="badge bg-success">${
                data.status || "COMPLETED"
              }</span>
              ${
                data.auto_captured
                  ? '<span class="badge bg-info ms-1">Auto-Captured</span>'
                  : ""
              }
            </div>
          </div>
          
          <div class="row mt-3">
            <div class="col-md-6">
              <strong>Amount:</strong><br>
              ${
                data.amount?.value ||
                data.purchase_units?.[0]?.payments?.captures?.[0]?.amount
                  ?.value ||
                "N/A"
              } 
              ${
                data.amount?.currency_code ||
                data.purchase_units?.[0]?.payments?.captures?.[0]?.amount
                  ?.currency_code ||
                ""
              }
            </div>
            <div class="col-md-6">
              <strong>Date:</strong><br>
              ${
                data.create_time
                  ? new Date(data.create_time).toLocaleString()
                  : new Date().toLocaleString()
              }
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    html = `
      <div class="alert ${alertClass} border-0 shadow-sm">
        <div class="d-flex align-items-center">
          <i class="fas fa-${icon} fa-2x text-danger me-3"></i>
          <div>
            <h5 class="alert-heading mb-1">${title}</h5>
            <p class="mb-0">${
              data.error || "An error occurred while processing your payment."
            }</p>
          </div>
        </div>
      </div>
    `;
  }

  resultElement.innerHTML = html;
  resultElement.style.display = "block";
}

function hidePaymentResult() {
  const resultElement = document.getElementById("paymentResult");
  if (resultElement) {
    resultElement.style.display = "none";
  }
}

function cancelPaymentProcess() {
  const section = document.getElementById("paymentProcessingSection");
  if (section) {
    section.style.display = "none";
  }

  selectedPaymentToken = null;
  hidePaymentResult();
  showPaymentLoading(false);
}

// Make functions available globally for onclick handlers
window.showPaymentProcessingSection = showPaymentProcessingSection;
