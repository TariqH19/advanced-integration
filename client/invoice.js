// frontend js for the invoice page and to also send values if necessary to the backend
document.addEventListener("DOMContentLoaded", () => {
  const invoiceForm = document.getElementById("invoice-form");
  const sendInvoiceButton = document.getElementById("send-invoice");
  const statusElement = document.getElementById("status");
  const invoiceList = document.getElementById("invoice-list"); // The dropdown for selecting invoices
  let createdInvoiceId = "";

  // Creating an invoice
  invoiceForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const recipientName = document.getElementById("recipient-name").value;
    const recipientEmail = document.getElementById("recipient-email").value;
    const itemName = document.getElementById("item-name").value;
    const itemQuantity = document.getElementById("item-quantity").value;
    const itemPrice = document.getElementById("item-price").value;

    const invoiceData = {
      detail: {
        currency_code: "GBP",
        note: "Thank you for your business!",
        terms: "No refunds after 30 days.",
      },
      invoicer: {
        name: { given_name: "John", surname: "Doe" },
        email_address: "tariqhuk@business.com",
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: recipientName.split(" ")[0],
              surname: recipientName.split(" ")[1] || "",
            },
            email_address: recipientEmail,
          },
        },
      ],
      items: [
        {
          name: itemName,
          quantity: parseInt(itemQuantity, 10),
          unit_amount: { currency_code: "GBP", value: itemPrice },
        },
      ],
    };

    try {
      const response = await fetch("/api/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });
      const result = await response.json();
      if (response.ok) {
        createdInvoiceId = result.id;
        statusElement.textContent = "Invoice created successfully!";
        sendInvoiceButton.disabled = false;
      } else {
        statusElement.textContent = `Failed to create invoice: ${result.error}`;
      }
    } catch (error) {
      console.error("Error:", error);
      statusElement.textContent =
        "An error occurred while creating the invoice.";
    }
  });

  // Sending an invoice when selected from the list
  sendInvoiceButton.addEventListener("click", async () => {
    const selectedInvoiceId = invoiceList.value;

    if (!selectedInvoiceId) {
      statusElement.textContent = "Please select an invoice first.";
      return;
    }

    try {
      const response = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: selectedInvoiceId }),
      });
      const result = await response.json();
      if (response.ok) {
        statusElement.textContent = "Invoice sent successfully!";

        // Extract and display the payer view link
        const payerViewLink = result.href;
        if (payerViewLink) {
          displayPaymentLink(payerViewLink);
        } else {
          statusElement.textContent =
            "Invoice sent, but no payment link found.";
        }
      } else {
        statusElement.textContent = `Failed to send invoice: ${result.error}`;
      }
    } catch (error) {
      console.error("Error:", error);
      statusElement.textContent =
        "An error occurred while sending the invoice.";
    }
  });

  // Function to display the payer view link
  function displayPaymentLink(paymentLink) {
    const linkContainer = document.createElement("div");
    linkContainer.style.marginTop = "20px";
    linkContainer.innerHTML = `
      <p><strong>Payment Link:</strong> <a href="${paymentLink}" target="_blank">${paymentLink}</a></p>
    `;
    document.querySelector(".container").appendChild(linkContainer);
  }

  // Fetching the list of invoices for selection
  async function fetchInvoices() {
    try {
      const response = await fetch("/api/list-invoices");
      const invoices = await response.json();

      if (response.ok) {
        invoices.forEach((invoice) => {
          const option = document.createElement("option");
          option.value = invoice.id;
          option.textContent = `Invoice ${invoice.id} - ${invoice.status}`;
          invoiceList.appendChild(option);
        });
      } else {
        statusElement.textContent = "Failed to fetch invoices.";
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      statusElement.textContent = "An error occurred while fetching invoices.";
    }
  }

  // Call fetchInvoices on page load
  fetchInvoices();
});

document.addEventListener("DOMContentLoaded", () => {
  const refundForm = document.getElementById("refund-form");
  const statusElement = document.getElementById("status");

  // Refund an invoice based on the selected invoice ID
  refundForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const invoiceId = document.getElementById("refund-invoice-id").value;

    try {
      const response = await fetch(`/api/refund-invoice/${invoiceId}`, {
        method: "POST",
      });
      const result = await response.json();
      if (response.ok) {
        statusElement.textContent = "Invoice refunded successfully!";
      } else {
        statusElement.textContent = `Failed to refund invoice: ${result.error}`;
      }
    } catch (error) {
      console.error("Error:", error);
      statusElement.textContent =
        "An error occurred while refunding the invoice.";
    }
  });
});
