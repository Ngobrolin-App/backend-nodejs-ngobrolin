const sendEmail = async ({ to, subject, html }) => {
    const payload = {
        sender: {
            name: process.env.APP_NAME || 'Ngobrolin App',
            email: process.env.EMAIL_SENDER || 'ngobrolinapp@gmail.com'
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
    };

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Brevo API Error: ${JSON.stringify(data)}`);
        }

        return data;
    } catch (error) {
        console.error('Brevo API Request Error:', error.message || error);
        throw error;
    }
};

module.exports = { sendEmail };