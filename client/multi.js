// public/script.js

document.getElementById("onboard-btn").addEventListener("click", async () => {
  try {
    const response = await fetch("/start-onboarding", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (data.approvalUrl) {
      // Redirect the user to PayPal's approval URL
      window.location.href = data.approvalUrl;
    } else {
      alert("Failed to get approval URL");
    }
  } catch (error) {
    console.error("Error during onboarding:", error);
    alert("Error starting onboarding");
  }
});
