const brevo = require('@getbrevo/brevo');

const sendEmail = async ({ to, subject, html }) => {
    let apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

    let sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = {
        name: process.env.APP_NAME || 'Ngobrolin App',
        email: process.env.EMAIL_SENDER || 'ngobrolinapp@gmail.com'
    };
    sendSmtpEmail.to = [{ email: to }];

    try {
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        return data;
    } catch (error) {
        console.error('Brevo API Error Details:', error.response ? error.response.body : error.message || error);
        throw error;
    }
};

module.exports = { sendEmail };