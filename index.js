const express = require('express');
const QRCode = require('qrcode');
const generatePayload = require('promptpay-qr')

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Generate QR Code endpoint
app.post('/generate-qr', async (req, res) => {
  try {
    const {
      type = 'mobile',
      identifier,
      amount,
      merchantName,
      merchantCity,
      qrOptions = {}
    } = req.body;

    // Validate required fields
    if (!identifier) {
      return res.status(400).json({
        error: 'Identifier is required (mobile number, national ID, or e-wallet ID)'
      });
    }

    // Validate and format identifier for each type
    let formattedIdentifier = identifier;
    if (type === 'national_id') {
      // National ID must be 13 digits
      formattedIdentifier = String(identifier).replace(/\D/g, '').padStart(13, '0').slice(0, 13);
      if (formattedIdentifier.length !== 13) {
        return res.status(400).json({ error: 'National ID must be 13 digits' });
      }
    } else if (type === 'ewallet') {
      // E-Wallet must be 15 digits
      formattedIdentifier = String(identifier).replace(/\D/g, '').padStart(15, '0').slice(0, 15);
      if (formattedIdentifier.length !== 15) {
        return res.status(400).json({ error: 'E-Wallet ID must be 15 digits' });
      }
    }

    // Generate PromptPay payload using promptpay-qr
    let payload;
    if (type === 'mobile' || type === 'national_id' || type === 'ewallet') {
      payload = generatePayload(formattedIdentifier, { amount });
    } else {
      return res.status(400).json({ error: 'Invalid PromptPay type' });
    }

    // QR Code generation options
    const defaultQROptions = {
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      ...qrOptions
    };

    // Generate QR code as base64
    const qrCodeDataURL = await QRCode.toDataURL(payload, defaultQROptions);
    const base64Image = qrCodeDataURL.split(',')[1];

    res.json({
      success: true,
      data: {
        payload,
        qrCodeBase64: base64Image,
        qrCodeDataURL,
        paymentInfo: {
          type,
          identifier,
          amount: amount || null,
          merchantName: merchantName || null,
          merchantCity: merchantCity || null
        }
      }
    });

  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({
      error: 'Failed to generate QR code',
      message: error.message
    });
  }
});

// Serve HTML UI
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'PromptPay QR Generator' });
});

// Example usage endpoint
app.get('/examples', (req, res) => {
  res.json({
    examples: [
      {
        description: 'Generate QR for mobile number',
        method: 'POST',
        endpoint: '/generate-qr',
        body: {
          type: 'mobile',
          identifier: '0812345678',
          amount: 100.50,
          merchantName: 'John Doe',
          merchantCity: 'Bangkok'
        }
      },
      {
        description: 'Generate QR for National ID',
        method: 'POST',
        endpoint: '/generate-qr',
        body: {
          type: 'national_id',
          identifier: '1234567890123',
          amount: 250.00
        }
      },
      {
        description: 'Generate QR for e-Wallet',
        method: 'POST',
        endpoint: '/generate-qr',
        body: {
          type: 'ewallet',
          identifier: '1234567890',
          merchantName: 'Shop ABC'
        }
      }
    ]
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PromptPay QR Generator server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Examples: http://localhost:${PORT}/examples`);
});

module.exports = app;