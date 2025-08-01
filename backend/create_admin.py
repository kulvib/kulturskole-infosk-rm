from sqlmodel import Session
from .db import engine
from .models import User
from .auth import get_password_hash

def create_admin_user():
    with Session(engine) as session:
        user = session.exec(
            User.select().where(User.username == "admin")
        ).first()
        if user:
            print("Admin already exists")
            return
        admin = User(
            username="admin",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        )
        session.add(admin)
        session.commit()
        print("Admin user created!")

if __name__ == "__main__":
    create_admin_user()
