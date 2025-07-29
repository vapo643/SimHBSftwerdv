#!/bin/bash

# Test Inter Bank OAuth with properly formatted certificates

echo "Testing Inter Bank OAuth with formatted certificates..."

# Certificate and key files
CERT_FILE="inter-cert-formatted.pem"
KEY_FILE="inter-key-formatted.pem"

# Get formatted certificates from Node.js
node -e "
const formatCertificate = (cert) => {
  if (cert.includes('-----BEGIN CERTIFICATE-----') && !cert.includes('\\n')) {
    const match = cert.match(/-----BEGIN CERTIFICATE-----(.*?)-----END CERTIFICATE-----/);
    if (match && match[1]) {
      const base64Content = match[1].trim();
      const formattedContent = base64Content.match(/.{1,64}/g)?.join('\\n') || base64Content;
      return \`-----BEGIN CERTIFICATE-----\\n\${formattedContent}\\n-----END CERTIFICATE-----\`;
    }
  }
  return cert;
};

const formatKey = (key) => {
  if (key.includes('-----BEGIN') && key.includes('KEY-----') && !key.includes('\\n')) {
    const keyMatch = key.match(/-----BEGIN (.+?)-----(.*?)-----END (.+?)-----/);
    if (keyMatch && keyMatch[2]) {
      const keyType = keyMatch[1];
      const base64Content = keyMatch[2].trim();
      const formattedContent = base64Content.match(/.{1,64}/g)?.join('\\n') || base64Content;
      return \`-----BEGIN \${keyType}-----\\n\${formattedContent}\\n-----END \${keyType}-----\`;
    }
  }
  return key;
};

const cert = formatCertificate(process.env.INTER_CERTIFICATE || '');
const key = formatKey(process.env.INTER_PRIVATE_KEY || '');

const fs = require('fs');
fs.writeFileSync('$CERT_FILE', cert);
fs.writeFileSync('$KEY_FILE', key);
console.log('Certificates saved');
"

# OAuth endpoint
URL="https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token"

# Form data - following official documentation
DATA="client_id=385d7748-a537-4e0b-8c81-b8b28b2c231e&client_secret=9f2f3521-19d8-4638-b61f-da79a04e3563&grant_type=client_credentials&scope=cobv.write+cobv.read"

# Make request with curl
echo "Making OAuth request to $URL..."
echo "Using certificates: $CERT_FILE and $KEY_FILE"
echo ""

curl -v \
  --cert "$CERT_FILE" \
  --key "$KEY_FILE" \
  --tlsv1.2 \
  --insecure \
  -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  -d "$DATA" \
  "$URL" 2>&1

# Clean up
rm -f "$CERT_FILE" "$KEY_FILE" formatted-certs.txt