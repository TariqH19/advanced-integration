/**
 * PayPal Vault Recurring Payments - Client-Side Implementation
 * Advanced integration for creating and managing recurring subscriptions
 */

class VaultRecurringPayments {
  constructor() {
    this.state = {
      currentStep: 1,
      selectedCustomer: null,
      selectedPlan: null,
      paymentMethodToken: null,
      setupToken: null,
      subscriptionId: null,
      cardFields: {},
      isProcessing: false,
    };

    this.plans = {
      basic: {
        id: "basic",
        name: "Basic Plan",
        price: 9.99,
        interval: "month",
        description: "Perfect for individuals",
      },
      premium: {
        id: "premium",
        name: "Premium Plan",
        price: 19.99,
        interval: "month",
        description: "Best for growing teams",
      },
      enterprise: {
        id: "enterprise",
        name: "Enterprise Plan",
        price: 49.99,
        interval: "month",
        description: "Advanced business features",
      },
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadSubscriptions();
    this.animateStepSections();

    // Initialize UI state
    this.switchPaymentMethod("card"); // Set default to card method
  }

  setupEventListeners() {
    // Customer selection
    document.querySelectorAll(".customer-card").forEach((card) => {
      card.addEventListener("click", () =>
        this.selectCustomer(card.dataset.customerId)
      );
    });

    // Payment method toggle - using arrow functions to preserve 'this' context
    document
      .getElementById("cardMethodBtn")
      .addEventListener("click", () => this.switchPaymentMethod("card"));
    document
      .getElementById("paypalMethodBtn")
      .addEventListener("click", () => this.switchPaymentMethod("paypal"));

    // Subscription management buttons
    document
      .getElementById("pauseSubscriptionBtn")
      .addEventListener("click", () => this.pauseSubscription());
    document
      .getElementById("resumeSubscriptionBtn")
      .addEventListener("click", () => this.resumeSubscription());
    document
      .getElementById("cancelSubscriptionBtn")
      .addEventListener("click", () => this.cancelSubscription());
  }

  setupPaymentMethodToggle() {
    const cardBtn = document.getElementById("cardMethodBtn");
    const paypalBtn = document.getElementById("paypalMethodBtn");
    const cardContainer = document.getElementById("cardFieldsContainer");
    const paypalContainer = document.getElementById("paypalButtonContainer");

    // These are handled in setupEventListeners now
  }

  switchPaymentMethod(method) {
    const cardBtn = document.getElementById("cardMethodBtn");
    const paypalBtn = document.getElementById("paypalMethodBtn");
    const cardContainer = document.getElementById("cardFieldsContainer");
    const paypalContainer = document.getElementById("paypalButtonContainer");

    if (method === "card") {
      cardBtn.classList.add("active");
      paypalBtn.classList.remove("active");
      cardContainer.style.display = "block";
      paypalContainer.style.display = "none";
    } else if (method === "paypal") {
      paypalBtn.classList.add("active");
      cardBtn.classList.remove("active");
      cardContainer.style.display = "none";
      paypalContainer.style.display = "block";
      this.setupPayPalRecurringButton();
    }
  }

  selectCustomer(customerId) {
    // Remove previous selection
    document.querySelectorAll(".customer-card").forEach((card) => {
      card.classList.remove("selected");
    });

    // Add selection to clicked card
    const selectedCard = document.querySelector(
      `[data-customer-id="${customerId}"]`
    );
    selectedCard.classList.add("selected");

    this.state.selectedCustomer = customerId;

    this.showAlert("success", `Customer selected: ${customerId}`);
    this.moveToStep(2);
  }

  selectPlan(planId) {
    // Remove previous selection
    document.querySelectorAll(".plan-card").forEach((card) => {
      card.classList.remove("selected");
    });

    // Add selection to clicked card
    const selectedCard = document.querySelector(`[data-plan-id="${planId}"]`);
    selectedCard.classList.add("selected");

    this.state.selectedPlan = this.plans[planId];

    this.showAlert(
      "success",
      `Plan selected: ${this.state.selectedPlan.name} - $${this.state.selectedPlan.price}/month`
    );
    this.moveToStep(3);
    this.setupPaymentMethods();
  }

  moveToStep(stepNumber) {
    // Update progress indicators
    for (let i = 1; i <= 4; i++) {
      const stepElement = document.getElementById(`step${i}`);
      if (i < stepNumber) {
        stepElement.classList.add("completed");
        stepElement.classList.remove("active");
      } else if (i === stepNumber) {
        stepElement.classList.add("active");
        stepElement.classList.remove("completed");
      } else {
        stepElement.classList.remove("active", "completed");
      }
    }

    // Show/hide sections
    const sections = [
      "customerSelectionSection",
      "planSelectionSection",
      "paymentSetupSection",
      "subscriptionManagementSection",
    ];

    sections.forEach((sectionId, index) => {
      const section = document.getElementById(sectionId);
      if (index + 1 <= stepNumber) {
        section.style.display = "block";
        setTimeout(() => section.classList.add("fade-in"), 100);
      }
    });

    this.state.currentStep = stepNumber;
  }

  async setupPaymentMethods() {
    if (!window.paypal) {
      this.showAlert(
        "error",
        "PayPal SDK not loaded. Please refresh the page."
      );
      return;
    }

    try {
      // Setup card fields for recurring payments
      await this.setupCardFields();

      // PayPal button will be setup when user switches to PayPal method
      this.showAlert("success", "Payment methods ready for setup.");
    } catch (error) {
      console.error("Error setting up payment methods:", error);
      this.showAlert(
        "error",
        "Failed to setup payment methods. Please try again."
      );
    }
  }

  async setupCardFields() {
    try {
      const cardFields = window.paypal.CardFields({
        createVaultSetupToken: async () => {
          // Create setup token specifically for card vaulting
          const response = await fetch(
            "/api/vault-recurring-payments/create-setup-token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customer_id: this.state.selectedCustomer,
                currency: "USD",
                payment_source: "card",
              }),
            }
          );

          const data = await response.json();
          if (!data.success) {
            throw new Error(data.error || "Failed to create setup token");
          }

          console.log("Setup token created for card fields:", data.setup_token);
          this.state.setupToken = data.setup_token;
          return data.setup_token;
        },
        onApprove: async (data) => {
          try {
            this.setProcessingState(true);

            console.log("Card fields approved with data:", data);

            // Confirm setup token and get payment method token
            const response = await fetch(
              "/api/vault-recurring-payments/confirm-setup-token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  setup_token: data.vaultSetupToken || data.orderID,
                  customer_id: this.state.selectedCustomer,
                }),
              }
            );

            const result = await response.json();
            if (!result.success) {
              throw new Error(result.error || "Failed to confirm setup token");
            }

            this.state.paymentMethodToken = result.payment_method_token;

            this.showAlert(
              "success",
              `Card payment method saved successfully! Token: ${result.payment_method_token}`
            );

            // Create subscription
            await this.createSubscription();
          } catch (error) {
            console.error("Error confirming setup token:", error);
            this.showAlert("error", `Error: ${error.message}`);
          } finally {
            this.setProcessingState(false);
          }
        },
        onError: (err) => {
          console.error("Card fields error:", err);
          this.showAlert("error", "Payment setup failed. Please try again.");
          this.setProcessingState(false);
        },
      });

      // Check if CardFields is eligible
      if (cardFields.isEligible()) {
        // Render card fields
        const cardNumberField = cardFields.NumberField({
          placeholder: "Card Number",
        });
        cardNumberField.render("#card-number");

        const expiryField = cardFields.ExpiryField({
          placeholder: "MM/YY",
        });
        expiryField.render("#expiration-date");

        const cvvField = cardFields.CVVField({
          placeholder: "CVV",
        });
        cvvField.render("#cvv");

        const nameField = cardFields.NameField({
          placeholder: "Cardholder Name",
        });
        nameField.render("#card-holder-name");

        this.state.cardFields = {
          cardFields,
          numberField: cardNumberField,
          expiryField: expiryField,
          cvvField: cvvField,
          nameField: nameField,
        };

        // Setup card button click handler
        document
          .getElementById("setupCardRecurringBtn")
          .addEventListener("click", async () => {
            if (this.state.isProcessing) return;

            try {
              this.setProcessingState(true);
              await cardFields.submit();
            } catch (error) {
              console.error("Error submitting card fields:", error);
              this.showAlert(
                "error",
                "Failed to process card. Please check your details and try again."
              );
              this.setProcessingState(false);
            }
          });

        this.showAlert(
          "success",
          "Card payment method ready for recurring payments setup."
        );
      } else {
        this.showAlert(
          "warning",
          "Card fields not available. Using PayPal only."
        );
        // Switch to PayPal method
        document.getElementById("paypalMethodBtn").click();
      }
    } catch (error) {
      console.error("Error setting up card fields:", error);
      this.showAlert("error", "Failed to setup card payment method.");
    }
  }

  setupPayPalRecurringButton() {
    const container = document.getElementById(
      "paypal-recurring-button-container"
    );
    container.innerHTML = ""; // Clear existing buttons

    window.paypal
      .Buttons({
        style: {
          layout: "vertical",
          color: "blue",
          shape: "rect",
          label: "paypal",
        },
        createOrder: async () => {
          try {
            // Create a PayPal vault order
            const response = await fetch(
              "/api/vault-recurring-payments/create-paypal-vault-order",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  customer_id: this.state.selectedCustomer,
                  currency: "USD",
                }),
              }
            );

            const data = await response.json();
            if (!data.success) {
              throw new Error(
                data.error || "Failed to create PayPal vault order"
              );
            }

            return data.order_id;
          } catch (error) {
            console.error("Error creating PayPal vault order:", error);
            this.showAlert("error", `Error: ${error.message}`);
            throw error;
          }
        },
        onApprove: async (data) => {
          try {
            this.setProcessingState(true);

            // Process the PayPal vault order
            const response = await fetch(
              "/api/vault-recurring-payments/process-paypal-vault-order",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  order_id: data.orderID,
                  customer_id: this.state.selectedCustomer,
                }),
              }
            );

            const result = await response.json();
            if (!result.success) {
              throw new Error(
                result.error || "Failed to process PayPal vault order"
              );
            }

            this.state.paymentMethodToken = result.payment_method_token;

            // Create subscription
            await this.createSubscription();
          } catch (error) {
            console.error("Error processing PayPal vault order:", error);
            this.showAlert("error", `Error: ${error.message}`);
          } finally {
            this.setProcessingState(false);
          }
        },
        onError: (err) => {
          console.error("PayPal button error:", err);
          this.showAlert("error", "PayPal setup failed. Please try again.");
          this.setProcessingState(false);
        },
      })
      .render("#paypal-recurring-button-container");
  }

  async createSubscription() {
    try {
      if (
        !this.state.selectedCustomer ||
        !this.state.paymentMethodToken ||
        !this.state.selectedPlan
      ) {
        throw new Error(
          "Missing required information for subscription creation"
        );
      }

      const response = await fetch(
        "/api/vault-recurring-payments/create-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_id: this.state.selectedCustomer,
            payment_method_token: this.state.paymentMethodToken,
            plan: this.state.selectedPlan,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to create subscription");
      }

      this.state.subscriptionId = result.subscription_id;

      this.showAlert(
        "success",
        `Subscription created successfully! Subscription ID: ${result.subscription_id}`
      );
      this.moveToStep(4);
      this.loadSubscriptions();
    } catch (error) {
      console.error("Error creating subscription:", error);
      this.showAlert(
        "error",
        `Failed to create subscription: ${error.message}`
      );
    }
  }

  async loadSubscriptions() {
    if (!this.state.selectedCustomer) return;

    try {
      const response = await fetch(
        `/api/vault-recurring-payments/subscriptions/${this.state.selectedCustomer}`
      );
      const data = await response.json();

      if (data.success) {
        // Store subscriptions for button state management
        localStorage.setItem(
          "currentSubscriptions",
          JSON.stringify(data.subscriptions)
        );
        this.renderSubscriptions(data.subscriptions);
      } else {
        console.error("Failed to load subscriptions:", data.error);
      }
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    }
  }

  renderSubscriptions(subscriptions) {
    const container = document.getElementById("subscriptionsList");

    if (!subscriptions || subscriptions.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-sync-alt"></i>
                    <h5>No Active Subscriptions</h5>
                    <p>Create your first recurring subscription using the steps above.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = subscriptions
      .map(
        (sub) => `
            <div class="subscription-card" data-subscription-id="${
              sub.subscription_id
            }" onclick="window.vaultRecurringPayments.selectSubscription('${
          sub.subscription_id
        }')" 
                 style="cursor: pointer; ${
                   this.state.subscriptionId === sub.subscription_id
                     ? "border-color: #667eea; background: linear-gradient(145deg, #f8f9ff, #e8ebff);"
                     : ""
                 }">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-2">
                            <i class="fas fa-sync-alt me-2"></i>
                            ${sub.plan_name}
                            ${
                              this.state.subscriptionId === sub.subscription_id
                                ? '<i class="fas fa-check-circle text-primary ms-2"></i>'
                                : ""
                            }
                        </h6>
                        <p class="text-muted mb-2">
                            <strong>$${sub.amount}/month</strong> - 
                            Next payment: ${new Date(
                              sub.next_payment_date
                            ).toLocaleDateString()}
                        </p>
                        <div class="d-flex align-items-center">
                            <span class="status-badge status-${sub.status.toLowerCase()}">${
          sub.status
        }</span>
                            <small class="text-secondary ms-3">ID: ${
                              sub.subscription_id
                            }</small>
                        </div>
                    </div>
                    <div class="text-end">
                        <small class="text-muted">Created: ${new Date(
                          sub.created_date
                        ).toLocaleDateString()}</small>
                        <br>
                        <small class="text-muted">Payments: ${
                          sub.payment_count || 0
                        }</small>
                    </div>
                </div>
                
                ${
                  sub.last_payment_date
                    ? `
                    <div class="mt-3 pt-3 border-top">
                        <small class="text-success">
                            <i class="fas fa-check-circle me-1"></i>
                            Last payment: ${new Date(
                              sub.last_payment_date
                            ).toLocaleDateString()} 
                            (${sub.last_payment_status})
                        </small>
                    </div>
                `
                    : ""
                }
            </div>
        `
      )
      .join("");

    // Update button visibility based on selected subscription
    this.updateSubscriptionButtons();
  }

  selectSubscription(subscriptionId) {
    this.state.subscriptionId = subscriptionId;
    this.loadSubscriptions(); // Refresh to show selection
    this.showAlert("info", `Selected subscription: ${subscriptionId}`);
  }

  updateSubscriptionButtons() {
    const pauseBtn = document.getElementById("pauseSubscriptionBtn");
    const resumeBtn = document.getElementById("resumeSubscriptionBtn");
    const cancelBtn = document.getElementById("cancelSubscriptionBtn");

    if (!this.state.subscriptionId) {
      // No subscription selected - disable all buttons
      [pauseBtn, resumeBtn, cancelBtn].forEach((btn) => {
        if (btn) btn.disabled = true;
      });
      return;
    }

    // Find the selected subscription to check its status
    const subscriptions = JSON.parse(
      localStorage.getItem("currentSubscriptions") || "[]"
    );
    const selectedSub = subscriptions.find(
      (sub) => sub.subscription_id === this.state.subscriptionId
    );

    if (selectedSub) {
      // Enable buttons based on subscription status
      if (pauseBtn) pauseBtn.disabled = selectedSub.status !== "ACTIVE";
      if (resumeBtn) resumeBtn.disabled = selectedSub.status !== "PAUSED";
      if (cancelBtn) cancelBtn.disabled = selectedSub.status === "CANCELLED";
    } else {
      // Enable all buttons if we can't determine status
      [pauseBtn, resumeBtn, cancelBtn].forEach((btn) => {
        if (btn) btn.disabled = false;
      });
    }
  }

  async pauseSubscription() {
    if (!this.state.subscriptionId) {
      this.showAlert("warning", "No active subscription to pause.");
      return;
    }

    if (!confirm("Are you sure you want to pause this subscription?")) {
      return;
    }

    try {
      this.setProcessingState(true, "pauseSubscriptionBtn");

      const response = await fetch(
        "/api/vault-recurring-payments/pause-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription_id: this.state.subscriptionId,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to pause subscription");
      }

      this.showAlert("success", "Subscription paused successfully.");
      this.loadSubscriptions();
    } catch (error) {
      console.error("Error pausing subscription:", error);
      this.showAlert("error", `Failed to pause subscription: ${error.message}`);
    } finally {
      this.setProcessingState(false, "pauseSubscriptionBtn");
    }
  }

  async resumeSubscription() {
    if (!this.state.subscriptionId) {
      this.showAlert("warning", "No subscription selected to resume.");
      return;
    }

    if (!confirm("Are you sure you want to resume this subscription?")) {
      return;
    }

    try {
      this.setProcessingState(true, "resumeSubscriptionBtn");

      const response = await fetch(
        "/api/vault-recurring-payments/resume-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription_id: this.state.subscriptionId,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to resume subscription");
      }

      this.showAlert("success", "Subscription resumed successfully.");
      this.loadSubscriptions();
    } catch (error) {
      console.error("Error resuming subscription:", error);
      this.showAlert(
        "error",
        `Failed to resume subscription: ${error.message}`
      );
    } finally {
      this.setProcessingState(false, "resumeSubscriptionBtn");
    }
  }

  async cancelSubscription() {
    if (!this.state.subscriptionId) {
      this.showAlert("warning", "No active subscription to cancel.");
      return;
    }

    if (
      !confirm(
        "Are you sure you want to cancel this subscription? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      this.setProcessingState(true, "cancelSubscriptionBtn");

      const response = await fetch(
        "/api/vault-recurring-payments/cancel-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription_id: this.state.subscriptionId,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to cancel subscription");
      }

      this.showAlert("success", "Subscription cancelled successfully.");
      this.loadSubscriptions();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      this.showAlert(
        "error",
        `Failed to cancel subscription: ${error.message}`
      );
    } finally {
      this.setProcessingState(false, "cancelSubscriptionBtn");
    }
  }

  setProcessingState(isProcessing, buttonId = "setupCardRecurringBtn") {
    this.state.isProcessing = isProcessing;

    const button = document.getElementById(buttonId);
    if (!button) {
      console.warn(`Button with ID ${buttonId} not found`);
      return;
    }

    const spinner = button.querySelector(".loading-spinner");
    const buttonText = button.querySelector("span:not(.loading-spinner)");

    if (isProcessing) {
      button.disabled = true;
      if (spinner) spinner.style.display = "inline-block";
      if (buttonText) buttonText.textContent = "Processing...";
    } else {
      button.disabled = false;
      if (spinner) spinner.style.display = "none";
      if (buttonText) {
        switch (buttonId) {
          case "setupCardRecurringBtn":
            buttonText.textContent = "Setup Recurring Payments";
            break;
          case "pauseSubscriptionBtn":
            buttonText.textContent = "Pause Subscription";
            break;
          case "resumeSubscriptionBtn":
            buttonText.textContent = "Resume Subscription";
            break;
          case "cancelSubscriptionBtn":
            buttonText.textContent = "Cancel Subscription";
            break;
          default:
            buttonText.textContent = "Ready";
        }
      }
    }
  }

  showAlert(type, message) {
    const alertContainer = document.getElementById("alertContainer");
    const alertId = "alert-" + Date.now();

    const alertHTML = `
            <div id="${alertId}" class="alert alert-${
      type === "error" ? "danger" : type
    } fade-in">
                <div class="d-flex align-items-center">
                    <i class="fas fa-${this.getAlertIcon(type)} me-3"></i>
                    <div class="flex-grow-1">${message}</div>
                    <button type="button" class="btn-close" onclick="document.getElementById('${alertId}').remove()"></button>
                </div>
            </div>
        `;

    alertContainer.innerHTML = alertHTML + alertContainer.innerHTML;

    // Auto-remove after 5 seconds
    setTimeout(() => {
      const alert = document.getElementById(alertId);
      if (alert) alert.remove();
    }, 5000);
  }

  getAlertIcon(type) {
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "exclamation-circle";
      case "warning":
        return "exclamation-triangle";
      case "info":
        return "info-circle";
      default:
        return "info-circle";
    }
  }

  animateStepSections() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("fade-in");
        }
      });
    });

    document.querySelectorAll(".section").forEach((section) => {
      observer.observe(section);
    });
  }
}

// Global functions for HTML onclick handlers
function selectPlan(planId) {
  if (window.vaultRecurringPayments) {
    window.vaultRecurringPayments.selectPlan(planId);
  }
}

function selectSubscription(subscriptionId) {
  if (window.vaultRecurringPayments) {
    window.vaultRecurringPayments.selectSubscription(subscriptionId);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.vaultRecurringPayments = new VaultRecurringPayments();
});

// Export for module usage if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = VaultRecurringPayments;
}
