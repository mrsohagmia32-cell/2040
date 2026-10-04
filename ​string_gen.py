from telethon.sync import TelegramClient
from telethon.sessions import StringSession

api_id = 30069169
api_hash = '9817a1c87970dd9f80c8f91c1ad704bb'

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print("\nYOUR_SESSION_STRING:\n")
    print(client.session.save())
