async function setupApplepay() {
  const applepay = paypal.Applepay();
  const {
    isEligible,
    countryCode,
    currencyCode,
    merchantCapabilities,
    supportedNetworks,
  } = await applepay.config();

  if (!isEligible) {
    throw new Error("applepay is not eligible");
  }

  document.getElementById("applepay-container").innerHTML =
    '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en">';

  document.getElementById("btn-appl").addEventListener("click", onClick);

  async function onClick() {
    console.log({ merchantCapabilities, currencyCode, supportedNetworks });

    const paymentRequest = {
      countryCode,
      currencyCode: "GBP",
      merchantCapabilities,
      supportedNetworks,
      requiredBillingContactFields: ["name", "phone", "email", "postalAddress"],
      requiredShippingContactFields: [],
      total: {
        label: "Demo (Card is not charged)",
        amount: "10.00",
        type: "final",
      },
    };

    // eslint-disable-next-line no-undef
    let session = new ApplePaySession(4, paymentRequest);

    session.onvalidatemerchant = (event) => {
      applepay
        .validateMerchant({
          validationUrl: event.validationURL,
        })
        .then((payload) => {
          session.completeMerchantValidation(payload.merchantSession);
        })
        .catch((err) => {
          console.error(err);
          session.abort();
        });
    };

    session.onpaymentmethodselected = () => {
      session.completePaymentMethodSelection({
        newTotal: paymentRequest.total,
      });
    };

    session.onpaymentauthorized = async (event) => {
      try {
        /* Create Order on the Server Side */
        const orderResponse = await fetch(`/applepay/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!orderResponse.ok) {
          throw new Error("error creating order");
        }

        const { id } = await orderResponse.json();
        console.log({ id });
        /**
         * Confirm Payment
         */
        await applepay.confirmOrder({
          orderId: id,
          token: event.payment.token,
          billingContact: event.payment.billingContact,
          shippingContact: event.payment.shippingContact,
        });

        /*
         * Capture order (must currently be made on server)
         */
        const captureResponse = await fetch(
          `/applepay/api/orders/${id}/capture`,
          {
            method: "POST",
          }
        );

        const captureData = await captureResponse.json();

        session.completePayment({
          status: window.ApplePaySession.STATUS_SUCCESS,
        });

        // Show success message with make another payment option
        showSuccessMessage(captureData);
      } catch (err) {
        console.error(err);
        session.completePayment({
          status: window.ApplePaySession.STATUS_FAILURE,
        });
        showErrorMessage("Payment failed. Please try again.");
      }
    };

    session.oncancel = () => {
      console.log("Apple Pay Cancelled !!");
    };

    session.begin();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // eslint-disable-next-line no-undef
  if (
    ApplePaySession?.supportsVersion(4) &&
    ApplePaySession?.canMakePayments()
  ) {
    setupApplepay().catch(console.error);
  }
});

// Function to show success message with make another payment option
function showSuccessMessage(captureData) {
  const container = document.getElementById("applepay-container");
  const resultMessage = document.getElementById("result-message");

  // Hide Apple Pay button
  container.style.display = "none";

  // Get transaction details
  const transaction = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
  const transactionId = transaction?.id || "N/A";

  // Show success message
  resultMessage.innerHTML = `
    <i class="fas fa-check-circle"></i> Payment Completed Successfully!<br>
    <small>Transaction ID: ${transactionId}</small><br>
    <button class="make-another-payment" onclick="resetApplePayForm()">
      <i class="fas fa-redo"></i> Make Another Payment
    </button>
  `;
  resultMessage.style.background = "#d4edda";
  resultMessage.style.borderColor = "#c3e6cb";
  resultMessage.style.color = "#155724";
}

// Function to show error message
function showErrorMessage(message) {
  const resultMessage = document.getElementById("result-message");

  resultMessage.innerHTML = `
    <i class="fas fa-exclamation-triangle"></i> ${message}
  `;
  resultMessage.style.background = "#f8d7da";
  resultMessage.style.borderColor = "#f5c6cb";
  resultMessage.style.color = "#721c24";
}

// Function to reset the form for another payment
function resetApplePayForm() {
  const container = document.getElementById("applepay-container");
  const resultMessage = document.getElementById("result-message");

  // Show Apple Pay button again
  container.style.display = "flex";

  // Clear result message
  resultMessage.innerHTML = "";

  // Re-setup Apple Pay (in case it needs re-initialization)
  if (
    window.ApplePaySession?.supportsVersion(4) &&
    window.ApplePaySession?.canMakePayments()
  ) {
    setupApplepay().catch(console.error);
  }
}
