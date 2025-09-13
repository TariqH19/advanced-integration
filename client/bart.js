// Dev docs: https://developer.paypal.com/api/limited-release/reference-transactions/v1/
// Sandbox account will need to have reference transactions enabled

document.addEventListener("DOMContentLoaded", () => {
  initializeBillingAgreementFlow();
});

let accessToken;
let baToken;
let redirectURL;
let baId;
let orderResponse;

const characters =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateString(length) {
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function initializeBillingAgreementFlow() {
  // Step 1: Fetch Access Token
  document
    .getElementById("fetchAccessTokenButton")
    .addEventListener("click", () => {
      executeStep(1, getAccessToken);
    });

  // Step 2: Create BA Token
  document
    .getElementById("createBaTokenButton")
    .addEventListener("click", () => {
      executeStep(2, getBaToken);
    });

  // Step 3: Customer Consent (handled via link)
  document.getElementById("buyerLinkBtn").addEventListener("click", () => {
    updateStepStatus(3, "completed");
    enableStep(4);
  });

  // Step 4: Execute Billing Agreement
  document.getElementById("createBaButton").addEventListener("click", () => {
    executeStep(4, getBillingAgreement);
  });

  // Step 5: Execute Reference Transaction
  document
    .getElementById("executeRefTransButton")
    .addEventListener("click", () => {
      executeStep(5, getRefTrans);
    });
}

async function executeStep(stepNumber, stepFunction) {
  const buttonSelectors = {
    1: "#fetchAccessTokenButton",
    2: "#createBaTokenButton",
    4: "#createBaButton",
    5: "#executeRefTransButton",
  };

  const button = document.querySelector(buttonSelectors[stepNumber]);
  const originalHTML = button.innerHTML;

  // Show loading state
  button.innerHTML = '<span class="spinner"></span> Processing...';
  button.disabled = true;
  updateStepStatus(stepNumber, "processing");

  try {
    await stepFunction();
    updateStepStatus(stepNumber, "completed");

    // Enable next step
    if (stepNumber < 5) {
      if (stepNumber === 2) {
        // Special case for step 3 (customer consent)
        showConsentLink();
      } else if (stepNumber !== 3) {
        enableStep(stepNumber + 1);
      }
    }
  } catch (error) {
    console.error(`Step ${stepNumber} error:`, error);
    updateStepStatus(stepNumber, "error");
    showStepResult(stepNumber, error.message, "error");
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
}

function enableStep(stepNumber) {
  const buttonSelectors = {
    2: "#createBaTokenButton",
    4: "#createBaButton",
    5: "#executeRefTransButton",
  };

  const button = document.querySelector(buttonSelectors[stepNumber]);
  if (button) {
    button.disabled = false;
  }
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

function showConsentLink() {
  const link = document.getElementById("buyerLinkBtn");
  link.href = redirectURL;
  link.style.display = "inline-flex";
  updateStepStatus(3, "pending");
}

async function getAccessToken() {
  const response = await fetch(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_GB",
        Authorization:
          "Basic " +
          btoa(
            "AXakS410la2fYSpiyC7A1nNsv_45cgH-_Cih7Gn1ggy_NUvIBZ_MSdWReMU9AqeupbTuo3lUkw5G-HsH" +
              ":EFzfHiNWctBdxGgVTyx6oYfJIanFccRu6RhLw2iJe-BR7Nk8jAx1_FdhvG3L2fOdoYSpqU7i4s6i4j30"
          ),
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;

  showStepResult(1, {
    access_token: data.access_token.substring(0, 20) + "...",
    token_type: data.token_type,
    expires_in: data.expires_in,
  });

  return data;
}

async function getBaToken() {
  const response = await fetch(
    "https://api-m.sandbox.paypal.com/v1/billing-agreements/agreement-tokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        description: "Billing Agreement for Demo Store",
        shipping_address: {
          line1: "StayBridge Suites",
          line2: "Cro12ok Street",
          city: "San Jose",
          state: "CA",
          postal_code: "95112",
          country_code: "US",
        },
        payer: {
          payment_method: "paypal",
        },
        plan: {
          type: "MERCHANT_INITIATED_BILLING",
          merchant_preferences: {
            return_url: "https://example.com/return",
            cancel_url: "https://example.com/cancel",
            accepted_pymt_type: "INSTANT",
            skip_shipping_address: false,
            immutable_shipping_address: true,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  baToken = data.token_id;

  const links = data.links;
  const approvalLink = links.find((link) => link.rel === "approval_url");
  redirectURL = approvalLink ? approvalLink.href : null;

  showStepResult(2, {
    token_id: data.token_id,
    description: data.description,
    approval_url: redirectURL
      ? redirectURL.substring(0, 50) + "..."
      : "Not found",
  });

  return data;
}

async function getBillingAgreement() {
  // Extract the BA token from URL parameters (this would normally come from the return URL)
  const urlParams = new URLSearchParams(window.location.search);
  const returnedBaToken = urlParams.get("ba_token") || baToken;

  const response = await fetch(
    "https://api-m.sandbox.paypal.com/v1/billing-agreements/agreements",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token_id: returnedBaToken,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  baId = data.id;

  showStepResult(4, {
    id: data.id,
    state: data.state,
    description: data.description,
    payer: data.payer,
  });

  return data;
}

async function getRefTrans() {
  const response = await fetch(
    "https://api-m.sandbox.paypal.com/v2/checkout/orders",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PayPal-Request-Id": generateString(9),
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "10.00",
            },
          },
        ],
        payment_source: {
          token: {
            id: baId,
            type: "BILLING_AGREEMENT",
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `HTTP error! status: ${response.status}, details: ${JSON.stringify(
        errorData
      )}`
    );
  }

  const data = await response.json();
  orderResponse = data;

  showStepResult(5, {
    id: data.id,
    status: data.status,
    purchase_units: data.purchase_units,
    payment_source: data.payment_source,
  });

  return data;
}
