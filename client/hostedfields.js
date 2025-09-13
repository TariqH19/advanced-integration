document.addEventListener("DOMContentLoaded", () => {
  initializeHostedFieldsWorkflow();
});

let clientInstance;
let hostedFieldsInstance;
let threeDSecure;
let editor;
let paymentNonce = null;

function initializeHostedFieldsWorkflow() {
  // Step 1: Configure button
  document.getElementById("configureButton").addEventListener("click", () => {
    executeStep(1, configurePayment);
  });

  // Enable 3DS checkbox handler
  const enable3DS = document.getElementById("enable3DS");
  enable3DS.addEventListener("change", function () {
    const jsonEditorContainer = document.getElementById("jsonEditorContainer");
    if (enable3DS.checked) {
      jsonEditorContainer.classList.add("show");
      if (!editor) {
        initializeJsonEditor();
      }
    } else {
      jsonEditorContainer.classList.remove("show");
    }
  });

  // Initialize client token
  getClientToken();
}

function initializeJsonEditor() {
  const container = document.getElementById("jsoneditor");
  const options = {
    mode: "code",
    modes: ["code", "tree", "view"],
    onChange: function () {
      // Handle changes if needed
    },
  };

  editor = new JSONEditor(container, options);

  // Set default 3DS configuration with correct format
  editor.set({
    amount: "100.00",
    email: "test@example.com",
    mobilePhoneNumber: "1234567890",
    billingAddress: {
      givenName: "John",
      surname: "Doe",
      phoneNumber: "1234567890",
      streetAddress: "123 Main St",
      locality: "Chicago",
      region: "IL",
      postalCode: "60622",
      countryCodeAlpha2: "US",
    },
    additionalInformation: {
      workPhoneNumber: "1234567890",
      shippingGivenName: "John",
      shippingSurname: "Doe",
      shippingAddress: {
        streetAddress: "123 Main St",
        locality: "Chicago",
        region: "IL",
        postalCode: "60622",
        countryCodeAlpha2: "US",
      },
    },
  });
}

async function getClientToken() {
  try {
    updateStepStatus(1, "processing");

    const response = await fetch("./clientToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error("Unable to fetch client token");
    }

    const data = await response.json();
    await loadBraintree(data.clientToken);

    updateStepStatus(1, "pending");
    showStepResult(1, {
      message: "Client token fetched successfully",
      token_preview: data.clientToken.clientToken.substring(0, 50) + "...",
    });

    console.log("Client token:", data.clientToken);
  } catch (error) {
    console.error("Error fetching client token:", error);
    updateStepStatus(1, "error");
    showStepResult(1, `Error fetching client token: ${error.message}`, "error");
  }
}

async function loadBraintree(clientToken) {
  try {
    // Create Braintree client
    clientInstance = await braintree.client.create({
      authorization: clientToken.clientToken,
    });

    // Create hosted fields
    hostedFieldsInstance = await braintree.hostedFields.create({
      client: clientInstance,
      styles: {
        input: {
          color: "#282c37",
          "font-size": "16px",
          transition: "color 0.1s",
          "line-height": "3",
        },
        "input.invalid": {
          color: "#E53A40",
        },
        "::-webkit-input-placeholder": {
          color: "rgba(0,0,0,0.6)",
        },
        ":-moz-placeholder": {
          color: "rgba(0,0,0,0.6)",
        },
        "::-moz-placeholder": {
          color: "rgba(0,0,0,0.6)",
        },
        ":-ms-input-placeholder": {
          color: "rgba(0,0,0,0.6)",
        },
      },
      fields: {
        number: {
          selector: "#card-number",
          placeholder: "1111 1111 1111 1111",
        },
        cvv: {
          selector: "#cvv",
          placeholder: "123",
        },
        expirationDate: {
          selector: "#expiration-date",
          placeholder: "MM/YY",
        },
      },
    });

    setupHostedFieldsEvents();
  } catch (error) {
    console.error("Error setting up Braintree:", error);
    throw error;
  }
}

function setupHostedFieldsEvents() {
  // Validation change handler
  hostedFieldsInstance.on("validityChange", function (event) {
    const formValid = Object.keys(event.fields).every(function (key) {
      return event.fields[key].isValid;
    });

    const buttonPay = document.getElementById("button-pay");
    if (formValid) {
      buttonPay.classList.add("show-button");
      buttonPay.disabled = false;
    } else {
      buttonPay.classList.remove("show-button");
      buttonPay.disabled = true;
    }
  });

  // Card type change handler
  hostedFieldsInstance.on("cardTypeChange", function (event) {
    if (event.cards.length === 1) {
      const cardType = event.cards[0].type;
      const cardImage = document.querySelector("#card-image");

      // Remove existing card type classes
      cardImage.className = "";
      cardImage.classList.add(cardType);

      // Update CVV placeholder for Amex
      if (event.cards[0].code.size === 4) {
        hostedFieldsInstance.setAttribute({
          field: "cvv",
          attribute: "placeholder",
          value: "1234",
        });
      }
    } else {
      hostedFieldsInstance.setAttribute({
        field: "cvv",
        attribute: "placeholder",
        value: "123",
      });
    }
  });

  // Payment button handler
  document
    .getElementById("button-pay")
    .addEventListener("click", function (event) {
      event.preventDefault();
      executeStep(2, processPayment);
    });
}

async function executeStep(stepNumber, stepFunction) {
  const buttonSelectors = {
    1: "#configureButton",
    2: "#button-pay",
  };

  const button = document.querySelector(buttonSelectors[stepNumber]);
  if (!button) return;

  const originalHTML = button.innerHTML;

  // Show loading state
  button.innerHTML = '<span class="spinner"></span> Processing...';
  button.disabled = true;
  updateStepStatus(stepNumber, "processing");

  try {
    const result = await stepFunction();
    updateStepStatus(stepNumber, "completed");

    // Enable next step
    if (stepNumber < 3) {
      enableStep(stepNumber + 1);
    }

    return result;
  } catch (error) {
    console.error(`Step ${stepNumber} error:`, error);
    updateStepStatus(stepNumber, "error");
    showStepResult(stepNumber, error.message, "error");
    throw error;
  } finally {
    // Restore button
    button.innerHTML = originalHTML;
    button.disabled = false;
  }
}

function updateStepStatus(stepNumber, status) {
  const statusElement = document.getElementById(`step${stepNumber}-status`);
  const statusText = {
    pending: "Pending",
    processing: "Processing...",
    completed: "Completed",
    error: "Error",
  };

  statusElement.textContent = statusText[status];
  statusElement.className = `step-status ${status}`;

  // Update step visual state
  const stepElement = document.getElementById(`step${stepNumber}`);
  if (status === "processing" || status === "completed") {
    stepElement.classList.add("active");
  }
}

function enableStep(stepNumber) {
  const stepElement = document.getElementById(`step${stepNumber}`);
  stepElement.classList.add("active");
}

function showStepResult(stepNumber, content, type = "success") {
  const resultContainer = document.getElementById(`step${stepNumber}-result`);

  let resultTitle = resultContainer.querySelector(".result-title");
  let resultContent = resultContainer.querySelector(".result-content");

  if (!resultTitle) {
    resultTitle = document.createElement("div");
    resultTitle.className = "result-title";
    resultContainer.appendChild(resultTitle);
  }

  if (!resultContent) {
    resultContent = document.createElement("pre");
    resultContent.className = "result-content";
    resultContainer.appendChild(resultContent);
  }

  resultTitle.textContent = type === "error" ? "Error:" : "Response:";
  resultContent.textContent =
    typeof content === "object" ? JSON.stringify(content, null, 2) : content;

  resultContainer.className = `result-container show ${type}`;
}

async function configurePayment() {
  const enable3DS = document.getElementById("enable3DS").checked;

  showStepResult(1, {
    three_d_secure_enabled: enable3DS,
    configuration:
      enable3DS && editor ? editor.get() : "Standard configuration",
    message: "Payment configuration completed successfully",
  });

  return { configured: true, threeDSecure: enable3DS };
}

async function processPayment() {
  try {
    // Tokenize the payment method
    const payload = await hostedFieldsInstance.tokenize();
    paymentNonce = payload.nonce;

    console.log("Tokenization payload:", payload);

    // Show initial tokenization result
    showStepResult(2, {
      nonce: payload.nonce,
      type: payload.type,
      details: payload.details,
      message: "Card tokenized successfully",
    });

    const enable3DS = document.getElementById("enable3DS").checked;

    if (enable3DS) {
      await process3DSecure(payload);
    } else {
      // Complete processing without 3DS
      updateStepStatus(3, "completed");
      showStepResult(3, {
        payment_method_nonce: payload.nonce,
        three_d_secure: "Not enabled",
        status: "Ready for server-side processing",
        message: "Payment processing completed successfully",
      });

      showMakeAnotherPaymentButton();
    }

    return payload;
  } catch (error) {
    console.error("Payment processing error:", error);
    throw new Error(`Payment processing failed: ${error.message}`);
  }
}

async function process3DSecure(payload) {
  try {
    updateStepStatus(3, "processing");

    // Base 3DS parameters that are required
    const baseParameters = {
      nonce: payload.nonce,
      bin: payload.details.bin,
      onLookupComplete: function (data, next) {
        console.log("3DS lookup complete:", data);

        showStepResult(3, {
          lookup_status: "completed",
          liability_shifted: data.liabilityShifted,
          liability_shift_possible: data.liabilityShiftPossible,
          lookup_data: data,
        });

        next();
      },
    };

    // Get additional parameters from JSON editor if available
    let additionalParameters = {};
    if (editor) {
      try {
        additionalParameters = editor.get();
        // Validate that amount is present and is a string
        if (
          additionalParameters.amount &&
          typeof additionalParameters.amount !== "string"
        ) {
          additionalParameters.amount = additionalParameters.amount.toString();
        }
        // Ensure amount is present
        if (!additionalParameters.amount) {
          additionalParameters.amount = "100.00";
        }
      } catch (editorError) {
        console.warn("Error reading JSON editor, using defaults:", editorError);
        additionalParameters = {
          amount: "100.00",
          email: "test@example.com",
        };
      }
    } else {
      // Default parameters if no editor
      additionalParameters = {
        amount: "100.00",
        email: "test@example.com",
      };
    }

    // Merge parameters
    const threeDSecureParameters = {
      ...baseParameters,
      ...additionalParameters,
    };

    console.log("3DS parameters:", threeDSecureParameters);

    // Create 3D Secure instance
    const threeDSecureInstance = await braintree.threeDSecure.create({
      client: clientInstance,
      version: "2",
    });

    // Verify card with 3DS
    const response = await threeDSecureInstance.verifyCard(
      threeDSecureParameters
    );

    console.log("3DS verification response:", response);

    updateStepStatus(3, "completed");
    showStepResult(3, {
      payment_method_nonce: response.nonce,
      liability_shifted: response.liabilityShifted,
      liability_shift_possible: response.liabilityShiftPossible,
      three_d_secure_info: response.threeDSecureInfo,
      status: "3D Secure authentication completed",
      message: "Payment ready for server-side processing",
    });

    paymentNonce = response.nonce;
    showMakeAnotherPaymentButton();

    return response;
  } catch (error) {
    console.error("3D Secure error:", error);
    updateStepStatus(3, "error");

    // Provide more specific error message
    let errorMessage = "3D Secure authentication failed";
    if (error.message && error.message.includes("validation checks")) {
      errorMessage +=
        ": Invalid parameters. Please check amount, email, and address fields.";
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}

function showMakeAnotherPaymentButton() {
  const button = document.getElementById("makeAnotherPaymentButton");
  button.style.display = "inline-flex";

  button.addEventListener("click", resetPaymentForm);
}

function resetPaymentForm() {
  // Reset all steps
  for (let i = 1; i <= 3; i++) {
    updateStepStatus(i, "pending");
    const resultContainer = document.getElementById(`step${i}-result`);
    resultContainer.className = "result-container";

    const stepElement = document.getElementById(`step${i}`);
    stepElement.classList.remove("active");
  }

  // Activate first step
  document.getElementById("step1").classList.add("active");

  // Reset form state
  if (hostedFieldsInstance) {
    hostedFieldsInstance.teardown(() => {
      console.log("Hosted fields torn down");
      getClientToken(); // Reinitialize
    });
  }

  // Reset other elements
  document.getElementById("enable3DS").checked = false;
  document.getElementById("jsonEditorContainer").classList.remove("show");
  document.getElementById("button-pay").disabled = true;
  document.getElementById("button-pay").classList.remove("show-button");
  document.getElementById("makeAnotherPaymentButton").style.display = "none";

  paymentNonce = null;

  console.log("Payment form reset completed");
}
