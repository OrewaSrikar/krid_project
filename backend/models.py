from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime

class Tenant(BaseModel):
    id: str = Field(alias="_id")
    name: str
    system_prompt: str
    media_library: Dict[str, str]

class ChatSession(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    phone_number: str
    tenant_id: str
    status: str = "WAITING_FOR_BOT"  # WAITING_FOR_BOT, AGENT_RESPONDING, RESOLVED, NEEDS_HUMAN
    context_variables: Dict[str, Any] = {}
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MessageLog(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sender: str  # "user" or "bot"
    text: Optional[str] = None
    media_url: Optional[str] = None
    mime_type: Optional[str] = None
