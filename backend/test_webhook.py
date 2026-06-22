"""
Test script to simulate an inbound Twilio WhatsApp message hitting the local webhook.
Run with: python test_webhook.py
Make sure the FastAPI server is running first: uvicorn main:app --reload
"""
import requests

url = 'http://127.0.0.1:8000/webhook'

# Twilio sandbox numbers usually start with whatsapp:+
TEST_PHONE_NUMBER = "whatsapp:+917013886411"
TWILIO_PHONE_NUMBER = "whatsapp:+14155238886"

# Twilio sends data as form-urlencoded
payload = {
    "From": TEST_PHONE_NUMBER,
    "To": TWILIO_PHONE_NUMBER,
    "Body": "Hello bot! Tell me about your services.",
    "MessageSid": "SMtest123456789"
}

print(f"Sending test Twilio webhook to: {url}")
print(f"Simulated message from: {TEST_PHONE_NUMBER}")
print("-" * 40)

try:
    # Use data=payload to send as application/x-www-form-urlencoded
    response = requests.post(url, data=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response:    {response.text}")
    if response.status_code == 200:
        print("\n✅ Webhook received OK. Check backend logs for agent processing output.")
    else:
        print("\n❌ Unexpected status code. Is the server running?")
except requests.exceptions.ConnectionError:
    print("\n❌ Connection refused. Start the server first:")
    print("   cd backend && uvicorn main:app --reload")
except requests.exceptions.Timeout:
    print("\n⚠️  Request timed out.")
