from datetime import datetime
from bson import ObjectId
from typing import List, Dict, Any, Optional

def get_tenant(db, tenant_id: str) -> Optional[Dict[str, Any]]:
    return db.tenants.find_one({"_id": tenant_id})

def get_tenant_by_name(db, name: str) -> Optional[Dict[str, Any]]:
    return db.tenants.find_one({"name": name})

def get_session(db, phone_number: str) -> Optional[Dict[str, Any]]:
    return db.sessions.find_one({"phone_number": phone_number})

def create_session(db, phone_number: str, tenant_id: str) -> str:
    session = {
        "phone_number": phone_number,
        "tenant_id": tenant_id,
        "status": "WAITING_FOR_BOT",
        "context_variables": {},
        "updated_at": datetime.utcnow()
    }
    result = db.sessions.insert_one(session)
    return str(result.inserted_id)

def update_session_status(db, session_id: str, status: str):
    db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )

def add_message(db, session_id: str, sender: str, text: Optional[str] = None, media_url: Optional[str] = None, mime_type: Optional[str] = None) -> str:
    message = {
        "session_id": session_id,
        "timestamp": datetime.utcnow(),
        "sender": sender,
        "text": text,
        "media_url": media_url,
        "mime_type": mime_type
    }
    result = db.messages.insert_one(message)
    return str(result.inserted_id)

def get_recent_messages(db, session_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    messages = list(db.messages.find({"session_id": session_id}).sort("timestamp", -1).limit(limit))
    return messages[::-1]  # Return in chronological order
