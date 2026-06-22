import os
import logging
from fastapi import FastAPI, Request, Response, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables FIRST
load_dotenv()

import whatsapp_api
from agent import app as agent_app
from database import get_db
import crud

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Multi-Tenant WhatsApp Orchestrator")

# Enable CORS for the frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "WhatsApp Agent Orchestrator Running"}


def process_whatsapp_message(payload: dict):
    """
    Background task to process the incoming Twilio message, pass to LangGraph, and send a reply.
    """
    try:
        # 1. Parse the incoming Twilio webhook payload
        raw_phone = payload.get("From", "")
        wa_phone_number_id = payload.get("To", "")
        text_body = payload.get("Body", "")
        message_id = payload.get("MessageSid", "")
        
        num_media = int(payload.get("NumMedia", "0"))
        inbound_media_url = payload.get("MediaUrl0") if num_media > 0 else None
        inbound_media_type = payload.get("MediaContentType0") if num_media > 0 else None

        if not raw_phone or (not text_body and not inbound_media_url):
            logger.info("Empty From or (Body+Media) in Twilio payload — skipping.")
            return

        # Strip 'whatsapp:' and '+' to match DB session formats
        phone_number = raw_phone.replace("whatsapp:", "").replace("+", "")

        logger.info(f"Received message from {phone_number} via [{wa_phone_number_id}]: {text_body}")

        # 2. Pass to LangGraph Agent
        state_input = {
            "phone_number": phone_number,
            "message_id": message_id,
            "wa_phone_number_id": wa_phone_number_id,
            "user_message": text_body,
            "inbound_media_url": inbound_media_url,
            "inbound_media_type": inbound_media_type
        }
        final_state = agent_app.invoke(state_input)
        logger.info(f"Agent finished processing for {phone_number}")

    except Exception as e:
        logger.error(f"Error processing webhook: {str(e)}", exc_info=True)


@app.post("/webhook")
async def webhook_inbound(request: Request, background_tasks: BackgroundTasks):
    """
    Handles inbound messages from Twilio WhatsApp Sandbox.
    We must return 200 OK immediately and process the message in the background.
    """
    try:
        # Twilio sends data as application/x-www-form-urlencoded
        form_data = await request.form()
        payload = dict(form_data)
        
        logger.info("Received POST /webhook payload from Twilio.")
        
        # Dispatch processing to a background thread to return 200 OK instantly
        background_tasks.add_task(process_whatsapp_message, payload)
        
        return Response(content="EVENT_RECEIVED", status_code=200)
    except Exception as e:
        logger.error(f"Error handling inbound webhook: {str(e)}")
        return Response(status_code=500)

# --- DASHBOARD API ROUTES ---

@app.get("/api/tenants")
def get_tenants():
    db = get_db()
    tenants = list(db.tenants.find({}, {"_id": 1, "name": 1}))
    return [{"id": t["_id"], "name": t["name"]} for t in tenants]

@app.get("/api/sessions")
def get_sessions(tenant_id: str = None):
    db = get_db()
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    sessions = list(db.sessions.find(query).sort("updated_at", -1))
    for s in sessions:
        s["_id"] = str(s["_id"])
    return sessions

@app.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    db = get_db()
    messages = list(db.messages.find({"session_id": session_id}).sort("timestamp", 1))
    for m in messages:
        m["_id"] = str(m["_id"])
    return messages
