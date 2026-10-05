const express = require('express');
const cors = require('cors');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');

const app = express();

app.use(cors());
app.use(express.json());

// ⚙️ Environment Variable অথবা ডিফল্ট ক্রেডেনশিয়াল
const apiId = Number(process.env.API_ID || 30069169);
const apiHash = process.env.API_HASH || '9817a1c87970dd9f80c8f91c1ad704bb';

// মেমোরি স্টোর
const sessions = {};
const phoneCodeHashStore = {};

// 📩 ১. OTP পাঠানোর এন্ডপয়েন্ট
app.post('/api/send-otp', async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ success: false, error: 'ফোন নম্বর দেওয়া হয়নি।' });
    }

    try {
        const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
            connectionRetries: 5,
        });

        await client.connect();

        const result = await client.sendCode(
            { apiId, apiHash },
            phone
        );

        sessions[phone] = client;
        phoneCodeHashStore[phone] = result.phoneCodeHash;

        res.json({ success: true, message: 'OTP কোড টেলিগ্রাম অ্যাপে পাঠানো হয়েছে।' });
    } catch (error) {
        console.error('OTP Send Error:', error);
        res.status(500).json({ success: false, error: error.message || 'OTP পাঠাতে ব্যর্থ হয়েছে।' });
    }
});

// 🔑 ২. OTP ভেরিফাই ও লগইন এন্ডপয়েন্ট (FIXED)
app.post('/api/verify-otp', async (req, res) => {
    const { phone, code, password } = req.body;

    if (!phone || !code) {
        return res.status(400).json({ success: false, error: 'ফোন নম্বর এবং OTP কোড প্রদান করুন।' });
    }

    const client = sessions[phone];
    const phoneCodeHash = phoneCodeHashStore[phone];

    if (!client || !phoneCodeHash) {
        return res.status(400).json({ success: false, error: 'সেশন খুঁজে পাওয়া যায়নি। আবার OTP পাঠান।' });
    }

    try {
        // GramJS-এর সঠিক সাইন-ইন API কল
        await client.invoke(
            new Api.auth.SignIn({
                phoneNumber: phone,
                phoneCodeHash: phoneCodeHash,
                phoneCode: code,
            })
        );

        const sessionString = client.session.save();

        // ক্লিয়ারআপ
        delete sessions[phone];
        delete phoneCodeHashStore[phone];

        return res.json({ 
            success: true, 
            message: 'লগইন সফল হয়েছে!', 
            session: sessionString 
        });

    } catch (error) {
        console.error('Verify Error:', error);

        // টু-স্টেপ ভেরিফিকেশন পাসওয়ার্ড প্রয়োজন হলে
        if (error.errorMessage === 'SESSION_PASSWORD_NEEDED' || (error.message && error.message.includes('SESSION_PASSWORD_NEEDED'))) {
            if (!password) {
                return res.json({ 
                    success: false, 
                    needPassword: true, 
                    error: 'আপনার অ্যাকাউন্টে 2-Step Verification অন করা আছে। পাসওয়ার্ড দিন।' 
                });
            }

            try {
                // ২-স্টেপ পাসওয়ার্ড দিয়ে চেষ্টা
                await client.checkPassword(password);
                const sessionString = client.session.save();

                delete sessions[phone];
                delete phoneCodeHashStore[phone];

                return res.json({ 
                    success: true, 
                    message: 'পাসওয়ার্ডসহ লগইন সফল হয়েছে!', 
                    session: sessionString 
                });
            } catch (pwdErr) {
                return res.status(400).json({ success: false, error: 'ভুল ২-স্টেপ পাসওয়ার্ড দেওয়া হয়েছে!' });
            }
        }

        return res.status(500).json({ success: false, error: error.errorMessage || error.message || 'OTP ভেরিফিকেশন ব্যর্থ হয়েছে।' });
    }
});

// 🟢 হেলথ চেক এন্ডপয়েন্ট
app.get('/', (req, res) => {
    res.send('🚀 Telegram Backend Server is Active!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
