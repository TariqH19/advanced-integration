//app.js
// frontend js for the invoice page and to also send values if necessary to the backend
document.addEventListener("DOMContentLoaded", () => {
  const invoiceForm = document.getElementById("invoice-form");
  const sendInvoiceButton = document.getElementById("send-invoice");
  const statusElement = document.getElementById("status");
  let createdInvoiceId = "";

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

  sendInvoiceButton.addEventListener("click", async () => {
    if (!createdInvoiceId) {
      statusElement.textContent = "Please create an invoice first.";
      return;
    }

    try {
      const response = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: createdInvoiceId }),
      });
      const result = await response.json();
      if (response.ok) {
        statusElement.textContent = "Invoice sent successfully!";
        sendInvoiceButton.disabled = true;
      } else {
        statusElement.textContent = `Failed to send invoice: ${result.error}`;
      }
    } catch (error) {
      console.error("Error:", error);
      statusElement.textContent =
        "An error occurred while sending the invoice.";
    }
  });
});
