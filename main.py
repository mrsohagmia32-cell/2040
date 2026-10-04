import os
import asyncio
from telethon import TelegramClient, events

# ⚙️ আপনার ক্রেডেনশিয়াল
API_ID = 30069169
API_HASH = '9817a1c87970dd9f80c8f91c1ad704bb'

MAIN_CHANNEL = -1003951625461  # মেইন চ্যানেল আইডি

# 🎯 টার্গেট চ্যানেল/গ্রুপ আইডি এবং ডিলে (সেকেন্ডে)
TARGET_GROUPS = {
    -1003803634086: 0,   # ১ম চ্যানেল (ইনস্ট্যান্ট)
    -1004383383991: 60,  # ২য় চ্যানেল (৬০ সেকেন্ড/১ মিনিট পর)
    -1001234567890: 120  # ৩য় চ্যানেল (১২০ সেকেন্ড/২ মিনিট পর)
}

# Render বা নিজস্ব সেশন স্ট্রিং থাকলে তা লোড করবে
SESSION_STRING = os.environ.get("SESSION_STRING", "user_session")

client = TelegramClient(SESSION_STRING, API_ID, API_HASH)

@client.on(events.NewMessage(chats=MAIN_CHANNEL))
async def handler(event):
    text = event.raw_text or ""

    # 🔍 ফিল্টার: ✅ এবং http লিংক থাকতে হবে
    if '✅' in text and 'http' in text:
        print(f"📩 [New Post] মেইন চ্যানেল থেকে ফিল্টার হওয়া পোস্ট এসেছে (ID: {event.message.id})")

        for target_id, delay in TARGET_GROUPS.items():
            if delay > 0:
                print(f"⏳ চ্যানেল {target_id} এর জন্য {delay} সেকেন্ড অপেক্ষা করা হচ্ছে...")
                await asyncio.sleep(delay)

            try:
                # পোস্ট কপি করে পাঠানো
                await client.send_message(target_id, event.message)
                print(f"✅ সফলভাবে কপি করা হয়েছে চ্যানেল: {target_id}")
            except Exception as e:
                print(f"❌ চ্যানেল {target_id} এ পাঠাতে ব্যর্থ: {e}")

async def main():
    print("🚀 Telethon Userbot is Starting...")
    await client.start()
    print("✅ Userbot successfully logged in and active!")
    await client.run_until_disconnected()

if __name__ == '__main__':
    asyncio.run(main())
