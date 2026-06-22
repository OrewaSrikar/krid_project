from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pydantic import BaseModel, Field
import os
import crud
from database import get_db
import whatsapp_api

# 1. Define the State
# The State is the data structure that gets passed from node to node in our graph.
class GraphState(TypedDict):
    phone_number: str       # Sender's phone number (e.g. '917013886411')
    message_id: str         # WhatsApp message ID (wamid.xxx)
    wa_phone_number_id: str # Business Phone Number ID from webhook metadata
    tenant_id: str
    user_message: str
    inbound_media_url: Optional[str]
    inbound_media_type: Optional[str]
    chat_history: List[Any]
    system_prompt: str
    media_library: Dict[str, str]
    bot_response_text: Optional[str]
    bot_media_type: Optional[str]
    bot_media_url: Optional[str]

# 2. Initialize the LLMs
# Make sure GROQ_API_KEY and GOOGLE_API_KEY are in your .env file
llm = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile")
llm_vision = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0)

# 3. Node Functions

def acknowledge_node(state: GraphState) -> GraphState:
    """
    Step 1: Send an immediate "Just a moment..." message to reduce perceived delay,
    since Twilio doesn't support native typing indicators.
    """
    print(f"--> [Node 1] Acknowledging message from {state['phone_number']}")
    
    # Send an immediate text response to the user so they know the bot is working on it.
    whatsapp_api.send_text_message(
        to_phone_number=state["phone_number"],
        text="Just a moment...",
        phone_number_id=state["wa_phone_number_id"]
    )
    
    return state

def context_retriever_node(state: GraphState) -> GraphState:
    """
    Step 2: Fetch the Tenant's rules and past chat history from MongoDB.
    """
    db = get_db()
    phone_number = state["phone_number"]
    
    print(f"--> [Node 2] Retrieving context for phone: {phone_number}")
    
    # 1. Get or Create Session
    session = crud.get_session(db, phone_number)
    if not session:
        # Default to Tenant A if this is a brand new user
        tenant_id = state.get("tenant_id") or "tenant_a_luxury"
        session_id = crud.create_session(db, phone_number, tenant_id)
        session = {"_id": session_id, "tenant_id": tenant_id}
    else:
        # Update session status
        crud.update_session_status(db, str(session["_id"]), "PENDING_RESPONSE")
        
    state["tenant_id"] = session["tenant_id"]
    
    # 2. Fetch Tenant Rules
    tenant = crud.get_tenant(db, session["tenant_id"])
    if tenant:
        state["system_prompt"] = tenant.get("system_prompt", "You are a helpful assistant.")
        state["media_library"] = tenant.get("media_library", {})
        
    # 3. Fetch Chat History
    recent_messages = crud.get_recent_messages(db, str(session["_id"]), limit=5)
    chat_history = []
    for msg in recent_messages:
        if msg["sender"] == "user":
            chat_history.append(HumanMessage(content=msg.get("text", "")))
        elif msg["sender"] == "bot":
            chat_history.append(AIMessage(content=msg.get("text", "")))
            
    state["chat_history"] = chat_history
    
    # 4. Save the new incoming message to the DB
    crud.add_message(
        db, 
        str(session["_id"]), 
        "user", 
        text=state.get("user_message"),
        media_url=state.get("inbound_media_url"),
        mime_type=state.get("inbound_media_type")
    )
    
    return state

class SendMedia(BaseModel):
    """Trigger this tool if the user explicitly asks for a visual/data asset like a catalog, showroom image, invoice, diagram, or repair image."""
    media_keyword: str = Field(description="The exact keyword of the media requested (e.g., 'catalog', 'sofa', 'showroom', 'invoice', 'diagram', 'repair')")

def llm_reasoning_node(state: GraphState) -> GraphState:
    """
    Step 3: Ask the AI how to respond based on the rules and user message.
    """
    print("--> [Node 3] LLM is thinking...")
    
    llm_with_tools = llm.bind_tools([SendMedia])
    
    messages = [SystemMessage(content=state.get("system_prompt", ""))]
    messages.extend(state.get("chat_history", []))
    messages.append(HumanMessage(content=state["user_message"]))
    
    response = llm_with_tools.invoke(messages)
    
    if response.tool_calls:
        # Tool was triggered
        tool_call = response.tool_calls[0]
        keyword = tool_call["args"].get("media_keyword", "").lower()
        
        media_lib = state.get("media_library", {})
        if keyword in media_lib:
            state["bot_media_url"] = media_lib[keyword]
            state["bot_media_type"] = "document" if ".pdf" in media_lib[keyword] else "image"
            state["bot_response_text"] = f"Here is the {keyword} you requested!"
        else:
            state["bot_response_text"] = f"I'm sorry, I couldn't find the '{keyword}' in our library."
    else:
        # Normal text response
        state["bot_response_text"] = response.content
        
    return state

def gemini_vision_node(state: GraphState) -> GraphState:
    """
    Step 3 (Alternate): Ask Gemini to analyze the image and respond.
    """
    print("--> [Node 3 - Vision] Gemini is analyzing media...")
    
    llm_with_tools = llm_vision.bind_tools([SendMedia])
    
    media_url = state.get("inbound_media_url")
    user_msg_text = state.get("user_message", "")
    
    content = []
    if user_msg_text:
        content.append({"type": "text", "text": user_msg_text})
    if media_url:
        content.append({"type": "image_url", "image_url": {"url": media_url}})
        
    messages = [SystemMessage(content=f"{state.get('system_prompt', '')}\\nYou have access to this media library: {list(state.get('media_library', {}).keys())}. If the user is asking for an item similar to the image, trigger SendMedia with the exact keyword.")]
    messages.extend(state.get("chat_history", []))
    messages.append(HumanMessage(content=content))
    
    response = llm_with_tools.invoke(messages)
    
    if response.tool_calls:
        # Tool was triggered
        tool_call = response.tool_calls[0]
        keyword = tool_call["args"].get("media_keyword", "").lower()
        
        media_lib = state.get("media_library", {})
        if keyword in media_lib:
            state["bot_media_url"] = media_lib[keyword]
            state["bot_media_type"] = "document" if ".pdf" in media_lib[keyword] else "image"
            state["bot_response_text"] = f"Here is the {keyword} you requested!"
        else:
            state["bot_response_text"] = f"I'm sorry, I couldn't find the '{keyword}' in our library."
    else:
        # Normal text response
        state["bot_response_text"] = response.content
        
    return state

def route_message(state: GraphState) -> str:
    if state.get("inbound_media_url"):
        return "gemini_vision"
    return "llm_reasoning"

def dispatcher_node(state: GraphState) -> GraphState:
    """
    Step 4: Send the final response to WhatsApp using the Phone Number ID
    extracted from the incoming webhook metadata.
    """
    print(f"--> [Node 4] Dispatching message via Phone Number ID: {state['wa_phone_number_id']}")
    phone_number = state["phone_number"]
    pid = state["wa_phone_number_id"]

    # Send media if it exists
    if state.get("bot_media_url"):
        whatsapp_api.send_media_message(
            phone_number,
            state["bot_media_type"],
            state["bot_media_url"],
            phone_number_id=pid
        )

    # Send text response
    if state.get("bot_response_text"):
        whatsapp_api.send_text_message(
            phone_number,
            state["bot_response_text"],
            phone_number_id=pid
        )

    # Save bot response to DB
    db = get_db()
    session = crud.get_session(db, phone_number)
    if session:
        crud.add_message(db, str(session["_id"]), "bot", text=state.get("bot_response_text"), media_url=state.get("bot_media_url"))
        crud.update_session_status(db, str(session["_id"]), "WAITING_FOR_USER")

    return state

# 4. Build the Graph
workflow = StateGraph(GraphState)

# Add our nodes
workflow.add_node("acknowledge", acknowledge_node)
workflow.add_node("context_retriever", context_retriever_node)
workflow.add_node("llm_reasoning", llm_reasoning_node)
workflow.add_node("gemini_vision", gemini_vision_node)
workflow.add_node("dispatcher", dispatcher_node)

# Define the flow (edges)
workflow.set_entry_point("acknowledge")
workflow.add_edge("acknowledge", "context_retriever")

workflow.add_conditional_edges("context_retriever", route_message, {
    "gemini_vision": "gemini_vision",
    "llm_reasoning": "llm_reasoning"
})

workflow.add_edge("llm_reasoning", "dispatcher")
workflow.add_edge("gemini_vision", "dispatcher")
workflow.add_edge("dispatcher", END)

# Compile it into an executable app!
app = workflow.compile()
