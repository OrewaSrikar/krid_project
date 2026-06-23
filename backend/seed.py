from database import get_db

def seed_database():
    db = get_db()
    
    print("Clearing existing tenants...")
    db.tenants.delete_many({})
    
    tenant_a = {
        "_id": "tenant_a_luxury",
        "name": "Luxury Furniture Store",
        "system_prompt": "You are a helpful sales agent for a Luxury Furniture Store. You assist customers in finding luxury items. If the user asks for catalogs or showrooms, use your tools to provide the appropriate PDF or PNG assets. Always be polite and high-end in your tone.",
        "media_library": {
            "catalog": "/uploads/Catalog-furniture.pdf",  # real PDF
            "sofa": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e", # placeholder image
            "showroom": "https://images.unsplash.com/photo-1618220179428-22790b46a0eb"
        }
    }
    
    tenant_b = {
        "_id": "tenant_b_auto",
        "name": "Automotive Care",
        "system_prompt": "You are a service assistant for Automotive Care. You help users schedule appointments and provide invoice sheets or repair diagrams when requested. Be professional, direct, and helpful.",
        "media_library": {
            "invoice": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "diagram": "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98", # engine image
            "repair": "https://images.unsplash.com/photo-1625047509168-a7026f36de04"
        }
    }
    
    db.tenants.insert_many([tenant_a, tenant_b])
    print("Seeded Tenant A and Tenant B successfully.")
    
    print("Clearing existing sessions and messages...")
    db.sessions.delete_many({})
    db.messages.delete_many({})
    
    # Add a mock session for Tenant A
    import crud
    session_id_a = crud.create_session(db, "+1234567890", "tenant_a_luxury")
    crud.add_message(db, session_id_a, "user", text="Hi, I'm looking for a new sofa.")
    crud.add_message(db, session_id_a, "bot", text="Welcome to Luxury Furniture! We have an exquisite collection. Would you like to see our catalog?", media_url=None)
    crud.add_message(db, session_id_a, "user", text="Yes, please show me the catalog.")
    crud.add_message(db, session_id_a, "bot", text="Here is our latest catalog featuring premium Italian leather sofas.", media_url="/uploads/Catalog-furniture.pdf")
    
    # Add a mock session for Tenant B
    session_id_b = crud.create_session(db, "+0987654321", "tenant_b_auto")
    crud.add_message(db, session_id_b, "user", text="My car is making a weird noise. Can I see a repair diagram?")
    crud.add_message(db, session_id_b, "bot", text="Hello! I can certainly help with that. Here is a common engine repair diagram.", media_url="https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98")
    crud.add_message(db, session_id_b, "bot", text="Would you like to schedule an appointment with our mechanics?")
    
    print("Seeded mock sessions and messages successfully.")

if __name__ == "__main__":
    seed_database()
