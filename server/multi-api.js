const PAYPAL_CLIENT_ID =
  "ARocB5vASgIfpjzqB1o2VqWJmjlrwsWEtq03k5m02Bc148BM5HdgJmR9UOUYdG7Cd-96L8UGWy6oNlWg";
const PAYPAL_CLIENT_SECRET =
  "EKBr7bo6d_kHDan3vk9w3VU5mc8HcJ_SlBkHpdm1zH8-Z2EF-aRgXm_JryLCuIX2awucMyPaGY5zQGer";
const BASE_URL = "https://api-m.sandbox.paypal.com";
const base = `${BASE_URL}`;

export async function generateAccessToken() {
  const auth = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const data = await response.json();
  return data.access_token;
}

export async function createPartnerReferral() {
  const accessToken = await generateAccessToken();

  const referralData = {
    partner_config_override: {
      partner_logo_url: "https://example.com/logo.png",
      return_url: "http://localhost:3000/onboarding-complete",
      action_renewal_url: "https://example.com/review-application",
    },
    operations: [
      {
        operation: "API_INTEGRATION",
        api_integration_preference: {
          rest_api_integration: {
            integration_method: "PAYPAL",
            integration_type: "THIRD_PARTY",
            third_party_details: {
              features: ["PAYMENT", "REFUND"],
            },
          },
        },
      },
    ],
    products: ["PPCP"],
    legal_consents: [
      {
        type: "SHARE_DATA_CONSENT",
        granted: true,
      },
    ],
  };

  try {
    const response = await fetch(`${base}/v2/customer/partner-referrals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(referralData),
    });

    const data = await response.json();
    const approvalUrl = data.links.find(
      (link) => link.rel === "action_url"
    ).href;

    return approvalUrl;
  } catch (error) {
    console.error("Error creating partner referral:", error);
    throw error;
  }
}
