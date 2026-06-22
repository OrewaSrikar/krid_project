import os
import logging
from twilio.rest import Client

logger = logging.getLogger(__name__)

# Initialize Twilio Client globally
def get_twilio_client():
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    auth_token = os.getenv('TWILIO_AUTH_TOKEN')
    if not account_sid or not auth_token:
        logger.warning("Twilio credentials not found in env.")
        return None
    return Client(account_sid, auth_token)

def _get_twilio_number() -> str:
    """Returns the configured Twilio WhatsApp number."""
    return os.getenv("TWILIO_WHATSAPP_NUMBER", "")


def mark_message_as_read(message_id: str, phone_number_id: str = None):
    """
    Twilio handles read receipts automatically if enabled in the console.
    No direct REST API endpoint to manually trigger a 'read' event for inbound messages.
    """
    logger.info(f"mark_message_as_read is a no-op for Twilio (handled automatically).")


def toggle_typing_indicator(to_phone_number: str, phone_number_id: str = None):
    """
    Twilio API does not currently support WhatsApp typing indicators.
    """
    logger.info(f"Typing indicator skipped for {to_phone_number} (not supported by Twilio API yet).")


def send_text_message(to_phone_number: str, text: str, phone_number_id: str = None):
    """
    Sends a standard text message via Twilio.
    """
    client = get_twilio_client()
    if not client:
        return
        
    from_number = phone_number_id or _get_twilio_number()
    
    # Ensure to_phone_number is formatted for Twilio WhatsApp (whatsapp:+1234567)
    if not to_phone_number.startswith("whatsapp:"):
        # If it doesn't have a +, add it
        if not to_phone_number.startswith("+"):
            to_phone_number = "+" + to_phone_number
        to_phone_number = "whatsapp:" + to_phone_number
        
    try:
        message = client.messages.create(
            body=text,
            from_=from_number,
            to=to_phone_number
        )
        logger.info(f"Text message sent to {to_phone_number} via Twilio. SID: {message.sid}")
    except Exception as e:
        logger.error(f"Exception in send_text_message: {e}")


def send_media_message(to_phone_number: str, media_type: str, url: str, phone_number_id: str = None):
    """
    Sends a media message (image or document) via Twilio.
    Twilio infers the type from the URL headers/extension.
    """
    client = get_twilio_client()
    if not client:
        return
        
    from_number = phone_number_id or _get_twilio_number()
    
    if not to_phone_number.startswith("whatsapp:"):
        if not to_phone_number.startswith("+"):
            to_phone_number = "+" + to_phone_number
        to_phone_number = "whatsapp:" + to_phone_number
        
    try:
        message = client.messages.create(
            from_=from_number,
            media_url=[url],
            to=to_phone_number
        )
        logger.info(f"Media sent to {to_phone_number} via Twilio. SID: {message.sid}")
    except Exception as e:
        logger.error(f"Exception in send_media_message: {e}")
