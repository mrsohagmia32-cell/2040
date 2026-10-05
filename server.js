const express = require('express');
const cors = require('cors');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();
app.use(cors());
app.use(express.json());

const apiId = Number(process.env.API_ID || 30069169);
const apiHash = process.env.API_HASH || '9817a1c87970dd9f80c8f91c1ad704bb';

const sessions = {};
const phoneCodeHashStore = {};

// 📩 ১. OTP পাঠানো
app.post('/api/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'ফোন নম্বর দিন।' });

    try {
        const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();
        const result = await client.sendCode({ apiId, apiHash }, phone);

        sessions[phone] = client;
        phoneCodeHashStore[phone] = result.phoneCodeHash;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔑 ২. OTP ভেরিফাই ও লগইন
app.post('/api/verify-otp', async (req, res) => {
    const { phone, code, password } = req.body;
    const client = sessions[phone];
    const phoneCodeHash = phoneCodeHashStore[phone];

    if (!client || !phoneCodeHash) return res.status(400).json({ success: false, error: 'সেশন এক্সপায়ার হয়েছে।' });

    try {
        await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash: phoneCodeHash, phoneCode: code }));
        const sessionString = client.session.save();
        delete sessions[phone];
        delete phoneCodeHashStore[phone];
        res.json({ success: true, session: sessionString });
    } catch (error) {
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED' || (error.message && error.message.includes('SESSION_PASSWORD_NEEDED'))) {
            if (!password) return res.json({ success: false, needPassword: true });
            try {
                await client.checkPassword(password);
                const sessionString = client.session.save();
                delete sessions[phone];
                delete phoneCodeHashStore[phone];
                return res.json({ success: true, session: sessionString });
            } catch (pwdErr) {
                return res.status(400).json({ success: false, error: 'ভুল পাসওয়ার্ড!' });
            }
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// 💬 ৩. চ্যাট লিস্ট আনা
app.post('/api/get-dialogs', async (req, res) => {
    const { session } = req.body;
    try {
        const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();
        const dialogs = await client.getDialogs({ limit: 15 });
        
        const chatList = dialogs.map(d => ({
            id: d.id.toString(),
            name: d.title || d.name || 'Unknown',
            isGroup: d.isGroup,
            isChannel: d.isChannel
        }));

        res.json({ success: true, chats: chatList });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📤 ৪. মেসেজ পাঠানো
app.post('/api/send-message', async (req, res) => {
    const { session, to, message } = req.body;
    try {
        const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();
        await client.sendMessage(to, { message: message });
        res.json({ success: true, message: 'মেসেজ পাঠানো হয়েছে!' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
