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

// 💬 ৩. আনলিমিটেড চ্যাট ও চ্যানেল লোড করা (সকল চ্যাট/চ্যানেল ফেচ হবে)
app.post('/api/get-dialogs', async (req, res) => {
    const { session } = req.body;
    try {
        const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();
        
        // limit: undefined দিলে অ্যাকাউন্টের ৫০০+ বা সব চ্যাট একসাথে লোড হবে
        const dialogs = await client.getDialogs({ limit: undefined });
        
        const chatList = dialogs.map(d => {
            let chatType = 'user';
            let isReadOnly = false;

            if (d.isChannel) {
                chatType = 'channel';
                // চ্যানেল অ্যাডমিন না হলে মেসেজ দেওয়া যাবে না
                if (!d.entity || !d.entity.adminRights) isReadOnly = true;
            } else if (d.isGroup) {
                chatType = 'group';
            } else if (d.entity && d.entity.bot) {
                chatType = 'bot';
            }

            return {
                id: d.id.toString(),
                name: d.title || d.name || 'Unknown',
                type: chatType,
                isReadOnly: isReadOnly,
                lastMessage: d.message ? d.message.message : '',
                date: d.message ? new Date(d.message.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
            };
        });

        res.json({ success: true, chats: chatList });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🖼 ৪. প্রোফাইল লোগো ফেচ করা
app.post('/api/get-avatar', async (req, res) => {
    const { session, chatId } = req.body;
    try {
        const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();

        const buffer = await client.downloadProfilePhoto(chatId, { isBig: false });
        if (buffer && buffer.length > 0) {
            const base64 = buffer.toString('base64');
            res.json({ success: true, avatar: `data:image/jpeg;base64,${base64}` });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        res.json({ success: false });
    }
});

// 📜 ৫. মেসেজ হিস্ট্রি লোড
app.post('/api/get-messages', async (req, res) => {
    const { session, chatId } = req.body;
    try {
        const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();
        
        const messages = await client.getMessages(chatId, { limit: 25 });
        const history = messages.map(m => ({
            id: m.id,
            text: m.message,
            out: m.out,
            date: new Date(m.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })).reverse();

        res.json({ success: true, messages: history });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 📤 ৬. মেসেজ পাঠানো
app.post('/api/send-message', async (req, res) => {
    const { session, to, message } = req.body;
    try {
        const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
        await client.connect();
        await client.sendMessage(to, { message: message });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
