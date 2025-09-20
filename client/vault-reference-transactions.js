/**
 * PayPal Vault Reference Transactions - Client-Side Implementation
 * Comprehensive implementation for merchant-initiated transactions with billing agreements
 */

class VaultReferenceTransactions {
  constructor() {
    this.state = {
      // Customer state
      customerId: null,
      customerName: null,
      customerEmail: null,
      billingAgreementId: null,
      paymentMethodToken: null,
      setupToken: null,

      // Admin state
      selectedCustomerId: null,
      selectedCustomerData: null,
      customers: [],

      // UI state
      isProcessing: false,
      cardFields: {},
      currentStep: 1,
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.animateElements();
    this.switchPaymentMethod("card"); // Set default to card method
    this.loadAdminStats();
  }

  setupEventListeners() {
    // Customer interface events
    document
      .getElementById("createAgreementBtn")
      .addEventListener("click", () => this.createBillingAgreement());

    // Payment method toggle
    document
      .getElementById("cardMethodBtn")
      .addEventListener("click", () => this.switchPaymentMethod("card"));
    document
      .getElementById("paypalMethodBtn")
      .addEventListener("click", () => this.switchPaymentMethod("paypal"));

    // Admin interface events
    document
      .getElementById("loadCustomersBtn")
      .addEventListener("click", () => this.loadCustomers());
    document
      .getElementById("processTransactionBtn")
      .addEventListener("click", () => this.processReferenceTransaction());
    document
      .getElementById("createRuleBtn")
      .addEventListener("click", () => this.createAutomationRule());

    // Auto-refresh events
    setInterval(() => this.autoRefreshData(), 30000); // Refresh every 30 seconds
  }

  /**
   * CUSTOMER INTERFACE METHODS
   */

  async createBillingAgreement() {
    try {
      this.setProcessingState(true, "createAgreementBtn");

      // Get customer information
      const customerId = document.getElementById("customerId").value.trim();
      const customerName = document.getElementById("customerName").value.trim();
      const customerEmail = document
        .getElementById("customerEmail")
        .value.trim();
      const agreementDescription = document
        .getElementById("agreementDescription")
        .value.trim();

      if (!customerId || !customerName || !customerEmail) {
        throw new Error("Please fill in all customer information fields");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail)) {
        throw new Error("Please enter a valid email address");
      }

      const response = await fetch(
        "/api/vault-reference-transactions/create-billing-agreement",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_id: customerId,
            customer_name: customerName,
            customer_email: customerEmail,
            agreement_description: agreementDescription,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to create billing agreement");
      }

      // Update state
      this.state.customerId = customerId;
      this.state.customerName = customerName;
      this.state.customerEmail = customerEmail;
      this.state.billingAgreementId = result.billing_agreement_id;

      // Show agreement info
      document.getElementById("displayAgreementId").textContent =
        result.billing_agreement_id;
      document.getElementById("agreementInfo").style.display = "block";

      this.showAlert(
        "success",
        `Billing agreement created successfully! ID: ${result.billing_agreement_id}`
      );
      this.showSection("paymentSetupSection");
      this.setupPaymentMethods();
    } catch (error) {
      console.error("Error creating billing agreement:", error);
      this.showAlert("error", `Error: ${error.message}`);
    } finally {
      this.setProcessingState(false, "createAgreementBtn");
    }
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
      this.setupPayPalReferenceButton();
    }
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
      // Setup card fields for reference transactions
      await this.setupCardFields();
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
          const response = await fetch(
            "/api/vault-reference-transactions/create-setup-token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                customer_id: this.state.customerId,
                payment_source: "card",
                billing_agreement_id: this.state.billingAgreementId,
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
            this.setProcessingState(true, "setupCardBtn");

            const response = await fetch(
              "/api/vault-reference-transactions/confirm-setup-token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  setup_token: data.vaultSetupToken || data.orderID,
                  customer_id: this.state.customerId,
                  billing_agreement_id: this.state.billingAgreementId,
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
              `Payment method vaulted successfully! Token: ${result.payment_method_token}`
            );
            this.showSection("customerHistorySection");
            this.loadCustomerTransactions();
          } catch (error) {
            console.error("Error confirming setup token:", error);
            this.showAlert("error", `Error: ${error.message}`);
          } finally {
            this.setProcessingState(false, "setupCardBtn");
          }
        },
        onError: (err) => {
          console.error("Card fields error:", err);
          this.showAlert("error", "Payment setup failed. Please try again.");
          this.setProcessingState(false, "setupCardBtn");
        },
      });

      // Check if CardFields is eligible
      if (cardFields.isEligible()) {
        // Render card fields
        const cardNumberField = cardFields.NumberField({
          placeholder: "Card Number",
        });
        cardNumberField.render("#card-number");

        const expiryField = cardFields.ExpiryField({ placeholder: "MM/YY" });
        expiryField.render("#expiration-date");

        const cvvField = cardFields.CVVField({ placeholder: "CVV" });
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
          .getElementById("setupCardBtn")
          .addEventListener("click", async () => {
            if (this.state.isProcessing) return;

            try {
              this.setProcessingState(true, "setupCardBtn");
              await cardFields.submit();
            } catch (error) {
              console.error("Error submitting card fields:", error);
              this.showAlert(
                "error",
                "Failed to process card. Please check your details and try again."
              );
              this.setProcessingState(false, "setupCardBtn");
            }
          });

        this.showAlert(
          "success",
          "Card payment method ready for reference transactions setup."
        );
      } else {
        this.showAlert(
          "warning",
          "Card fields not available. Using PayPal only."
        );
        document.getElementById("paypalMethodBtn").click();
      }
    } catch (error) {
      console.error("Error setting up card fields:", error);
      this.showAlert("error", "Failed to setup card payment method.");
    }
  }

  setupPayPalReferenceButton() {
    const container = document.getElementById(
      "paypal-reference-button-container"
    );
    container.innerHTML = "";

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
            const response = await fetch(
              "/api/vault-reference-transactions/create-setup-token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  customer_id: this.state.customerId,
                  payment_source: "paypal",
                  billing_agreement_id: this.state.billingAgreementId,
                }),
              }
            );

            const data = await response.json();
            if (!data.success) {
              throw new Error(
                data.error || "Failed to create PayPal setup token"
              );
            }

            return data.setup_token;
          } catch (error) {
            console.error("Error creating PayPal setup token:", error);
            this.showAlert("error", `Error: ${error.message}`);
            throw error;
          }
        },
        onApprove: async (data) => {
          try {
            this.setProcessingState(true);

            const response = await fetch(
              "/api/vault-reference-transactions/confirm-setup-token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  setup_token: data.orderID,
                  customer_id: this.state.customerId,
                  billing_agreement_id: this.state.billingAgreementId,
                }),
              }
            );

            const result = await response.json();
            if (!result.success) {
              throw new Error(
                result.error || "Failed to confirm PayPal setup token"
              );
            }

            this.state.paymentMethodToken = result.payment_method_token;

            this.showAlert(
              "success",
              `PayPal payment method vaulted successfully! Token: ${result.payment_method_token}`
            );
            this.showSection("customerHistorySection");
            this.loadCustomerTransactions();
          } catch (error) {
            console.error("Error processing PayPal setup token:", error);
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
      .render("#paypal-reference-button-container");
  }

  async loadCustomerTransactions() {
    if (!this.state.customerId) return;

    try {
      const response = await fetch(
        `/api/vault-reference-transactions/transactions/${this.state.customerId}`
      );
      const data = await response.json();

      if (data.success) {
        this.renderCustomerTransactions(data.transactions);
      } else {
        console.error("Failed to load customer transactions:", data.error);
      }
    } catch (error) {
      console.error("Error loading customer transactions:", error);
    }
  }

  renderCustomerTransactions(transactions) {
    const container = document.getElementById("customerTransactionsList");

    if (!transactions || transactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-receipt"></i>
          <h6>No Transactions Yet</h6>
          <p>Your transaction history will appear here once the merchant processes payments.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = transactions
      .map(
        (transaction) => `
      <div class="transaction-card">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <h6 class="mb-2">
              <i class="fas fa-credit-card me-2"></i>
              ${transaction.description || "Reference Transaction"}
            </h6>
            <p class="text-muted mb-2">
              <strong>$${transaction.amount}</strong> ${transaction.currency}
            </p>
            <div class="d-flex align-items-center">
              <span class="status-badge status-${transaction.status.toLowerCase()}">${
          transaction.status
        }</span>
              <small class="text-secondary ms-3">ID: ${transaction.id}</small>
            </div>
          </div>
          <div class="text-end">
            <small class="text-muted">${new Date(
              transaction.created_time
            ).toLocaleDateString()}</small>
            <br>
            <small class="text-muted">${new Date(
              transaction.created_time
            ).toLocaleTimeString()}</small>
          </div>
        </div>
      </div>
    `
      )
      .join("");
  }

  /**
   * ADMIN INTERFACE METHODS
   */

  async loadAdminStats() {
    try {
      const response = await fetch(
        "/api/vault-reference-transactions/customers"
      );
      const data = await response.json();

      if (data.success) {
        const totalCustomers = data.customers.length;
        const totalTransactions = data.customers.reduce(
          (sum, c) => sum + c.transactions_count,
          0
        );
        const totalRevenue = data.customers.reduce(
          (sum, c) => sum + c.total_transaction_amount,
          0
        );

        document.getElementById("totalCustomers").textContent = totalCustomers;
        document.getElementById("totalTransactions").textContent =
          totalTransactions;
        document.getElementById(
          "totalRevenue"
        ).textContent = `$${totalRevenue.toFixed(2)}`;
      }
    } catch (error) {
      console.error("Error loading admin stats:", error);
    }
  }

  async loadCustomers() {
    try {
      this.setProcessingState(true, "loadCustomersBtn");

      const response = await fetch(
        "/api/vault-reference-transactions/customers"
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load customers");
      }

      this.state.customers = data.customers;
      this.renderCustomers(data.customers);
      this.loadAdminStats(); // Refresh stats
    } catch (error) {
      console.error("Error loading customers:", error);
      this.showAlert("error", `Error: ${error.message}`);
    } finally {
      this.setProcessingState(false, "loadCustomersBtn");
    }
  }

  renderCustomers(customers) {
    const container = document.getElementById("customersList");

    if (!customers || customers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <h6>No Customers Found</h6>
          <p>Customers with billing agreements will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = customers
      .map(
        (customer) => `
      <div class="customer-card" onclick="window.vaultReferenceTransactions.selectCustomer('${
        customer.customer_id
      }')" 
           data-customer-id="${customer.customer_id}">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <h6 class="mb-2">
              <i class="fas fa-user me-2"></i>
              ${customer.customer_name}
            </h6>
            <p class="text-muted mb-2">${customer.customer_email}</p>
            <div class="d-flex align-items-center">
              <small class="text-secondary me-3">
                <i class="fas fa-file-contract me-1"></i>
                ${customer.agreements_count} agreements
              </small>
              <small class="text-secondary me-3">
                <i class="fas fa-credit-card me-1"></i>
                ${customer.tokens_count} payment methods
              </small>
            </div>
          </div>
          <div class="text-end">
            <small class="text-success">
              <i class="fas fa-dollar-sign me-1"></i>
              $${customer.total_transaction_amount.toFixed(2)}
            </small>
            <br>
            <small class="text-muted">${
              customer.transactions_count
            } transactions</small>
          </div>
        </div>
      </div>
    `
      )
      .join("");
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
    if (selectedCard) {
      selectedCard.classList.add("selected");
    }

    // Update state
    this.state.selectedCustomerId = customerId;
    this.state.selectedCustomerData = this.state.customers.find(
      (c) => c.customer_id === customerId
    );

    this.showAlert(
      "info",
      `Selected customer: ${
        this.state.selectedCustomerData?.customer_name || customerId
      }`
    );

    // Show admin sections
    this.showSection("adminTransactionSection");
    this.showSection("automationRulesSection");
    this.showSection("adminHistorySection");

    // Load admin transaction history for selected customer
    this.loadAdminTransactionHistory();
  }

  async processReferenceTransaction() {
    if (!this.state.selectedCustomerId) {
      this.showAlert("warning", "Please select a customer first.");
      return;
    }

    try {
      this.setProcessingState(true, "processTransactionBtn");

      const amount = parseFloat(
        document.getElementById("transactionAmount").value
      );
      const description = document
        .getElementById("transactionDescription")
        .value.trim();
      const referenceId = document.getElementById("referenceId").value.trim();

      if (!amount || amount <= 0) {
        throw new Error("Please enter a valid transaction amount");
      }

      if (!description) {
        throw new Error("Please enter a transaction description");
      }

      // Get customer's payment method token (simplified - using first available token)
      const customerData = this.state.selectedCustomerData;
      if (!customerData || customerData.tokens_count === 0) {
        throw new Error("Customer has no vaulted payment methods");
      }

      // Get customer's billing agreement
      if (!customerData.latest_agreement) {
        throw new Error("Customer has no billing agreement");
      }

      const response = await fetch(
        "/api/vault-reference-transactions/process-transaction",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_id: this.state.selectedCustomerId,
            payment_method_token: "demo_token_placeholder", // In real implementation, you'd select from available tokens
            amount: amount,
            currency: "USD",
            description: description,
            billing_agreement_id: customerData.latest_agreement.id,
            reference_id: referenceId || undefined,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(
          result.error || "Failed to process reference transaction"
        );
      }

      this.showAlert(
        "success",
        `Reference transaction processed successfully! Transaction ID: ${result.transaction_id}`
      );

      // Clear form
      document.getElementById("transactionAmount").value = "";
      document.getElementById("transactionDescription").value = "";
      document.getElementById("referenceId").value = "";

      // Refresh data
      this.loadAdminTransactionHistory();
      this.loadAdminStats();
    } catch (error) {
      console.error("Error processing reference transaction:", error);
      this.showAlert("error", `Error: ${error.message}`);
    } finally {
      this.setProcessingState(false, "processTransactionBtn");
    }
  }

  async createAutomationRule() {
    if (!this.state.selectedCustomerId) {
      this.showAlert("warning", "Please select a customer first.");
      return;
    }

    try {
      this.setProcessingState(true, "createRuleBtn");

      const ruleName = document.getElementById("ruleName").value.trim();
      const triggerType = document.getElementById("triggerType").value;
      const amount = parseFloat(document.getElementById("ruleAmount").value);

      if (!ruleName) {
        throw new Error("Please enter a rule name");
      }

      if (!amount || amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const response = await fetch(
        "/api/vault-reference-transactions/create-automation-rule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_id: this.state.selectedCustomerId,
            rule_name: ruleName,
            trigger_type: triggerType,
            trigger_condition:
              triggerType === "schedule" ? "0 0 1 * *" : "event_trigger", // Monthly schedule or event
            amount: amount,
            currency: "USD",
            description: `${ruleName} - ${triggerType} automation rule`,
            enabled: true,
          }),
        }
      );

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to create automation rule");
      }

      this.showAlert(
        "success",
        `Automation rule created successfully! Rule ID: ${result.rule_id}`
      );

      // Clear form
      document.getElementById("ruleName").value = "";
      document.getElementById("ruleAmount").value = "";
    } catch (error) {
      console.error("Error creating automation rule:", error);
      this.showAlert("error", `Error: ${error.message}`);
    } finally {
      this.setProcessingState(false, "createRuleBtn");
    }
  }

  async loadAdminTransactionHistory() {
    if (!this.state.selectedCustomerId) return;

    try {
      const response = await fetch(
        `/api/vault-reference-transactions/transactions/${this.state.selectedCustomerId}`
      );
      const data = await response.json();

      if (data.success) {
        this.renderAdminTransactionHistory(data.transactions);
      } else {
        console.error("Failed to load admin transaction history:", data.error);
      }
    } catch (error) {
      console.error("Error loading admin transaction history:", error);
    }
  }

  renderAdminTransactionHistory(transactions) {
    const container = document.getElementById("adminTransactionsList");

    if (!transactions || transactions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-chart-line"></i>
          <h6>No Transactions</h6>
          <p>Reference transactions for this customer will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = transactions
      .map(
        (transaction) => `
      <div class="transaction-card">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <h6 class="mb-2">
              <i class="fas fa-handshake me-2"></i>
              ${transaction.description || "Reference Transaction"}
            </h6>
            <p class="text-muted mb-2">
              <strong>$${transaction.amount}</strong> ${transaction.currency}
              ${
                transaction.reference_id
                  ? `<br><small>Ref: ${transaction.reference_id}</small>`
                  : ""
              }
            </p>
            <div class="d-flex align-items-center">
              <span class="status-badge status-${transaction.status.toLowerCase()}">${
          transaction.status
        }</span>
              <small class="text-secondary ms-3">ID: ${transaction.id}</small>
            </div>
          </div>
          <div class="text-end">
            <small class="text-muted">${new Date(
              transaction.created_time
            ).toLocaleDateString()}</small>
            <br>
            <small class="text-muted">${new Date(
              transaction.created_time
            ).toLocaleTimeString()}</small>
          </div>
        </div>
      </div>
    `
      )
      .join("");
  }

  /**
   * UTILITY METHODS
   */

  showSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = "block";
      setTimeout(() => section.classList.add("visible"), 100);
    }
  }

  setProcessingState(isProcessing, buttonId = null) {
    this.state.isProcessing = isProcessing;

    if (buttonId) {
      const button = document.getElementById(buttonId);
      if (!button) return;

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
          // Reset button text based on button ID
          switch (buttonId) {
            case "createAgreementBtn":
              buttonText.innerHTML =
                '<i class="fas fa-file-contract me-2"></i>Create Billing Agreement';
              break;
            case "setupCardBtn":
              buttonText.textContent = "Vault Card for Reference Transactions";
              break;
            case "loadCustomersBtn":
              buttonText.innerHTML =
                '<i class="fas fa-sync-alt me-2"></i>Load Customers';
              break;
            case "processTransactionBtn":
              buttonText.innerHTML =
                '<i class="fas fa-credit-card me-2"></i>Process Reference Transaction';
              break;
            case "createRuleBtn":
              buttonText.innerHTML =
                '<i class="fas fa-robot me-2"></i>Create Automation Rule';
              break;
            default:
              buttonText.textContent = "Ready";
          }
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

  animateElements() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    });

    document.querySelectorAll(".fade-in").forEach((element) => {
      observer.observe(element);
    });
  }

  async autoRefreshData() {
    // Auto-refresh admin data every 30 seconds
    if (this.state.selectedCustomerId) {
      this.loadAdminTransactionHistory();
    }

    if (this.state.customerId) {
      this.loadCustomerTransactions();
    }

    this.loadAdminStats();
  }
}

// Global functions for HTML onclick handlers
function selectCustomer(customerId) {
  if (window.vaultReferenceTransactions) {
    window.vaultReferenceTransactions.selectCustomer(customerId);
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.vaultReferenceTransactions = new VaultReferenceTransactions();
});

// Export for module usage if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = VaultReferenceTransactions;
}
