const functions = require('firebase-functions');

const scriptUrl = functions.config().gsheets?.url || process.env.GSHEETS_URL;

exports.gsheetsSync = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (!scriptUrl) {
    return res.status(500).json({ status: 'error', message: 'No Apps Script URL configured' });
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (err) {
      json = null;
    }

    if (!response.ok) {
      return res.status(502).json({ status: 'error', message: 'Apps Script returned HTTP ' + response.status, body: text });
    }

    if (json) {
      return res.status(200).json(json);
    }

    return res.status(200).json({ status: 'success', body: text });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
});
