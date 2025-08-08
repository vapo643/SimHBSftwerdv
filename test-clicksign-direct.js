// Test ClickSign V3 API directly
async function testClickSign() {
  console.log("🧪 Testing ClickSign Integration...\n");

  const apiToken = process.env.CLICKSIGN_API_TOKEN;
  if (!apiToken) {
    console.error("❌ CLICKSIGN_API_TOKEN not set");
    return;
  }

  const apiUrl = "https://sandbox.clicksign.com/api/v3";
  console.log("Testing with token:", apiToken.substring(0, 10) + "...");

  // Test creating a signer
  try {
    const signerResponse = await fetch(`${apiUrl}/signers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        signer: {
          name: "Test User",
          email: "test@example.com",
          phone: "11999999999",
          documentation: "00000000000",
        },
      }),
    });

    const result = await signerResponse.json();
    console.log("API Response:", JSON.stringify(result, null, 2));

    if (signerResponse.ok && result.data) {
      console.log("\n✅ Success! Signer created");
      console.log("Request Signature Key:", result.data.request_signature_key);
      console.log(
        "Sign URL would be:",
        `https://sandbox.clicksign.com/sign/${result.data.request_signature_key}`
      );
    } else {
      console.log("\n❌ Failed:", result.errors || result.message || "Unknown error");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testClickSign();
