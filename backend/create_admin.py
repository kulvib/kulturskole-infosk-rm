from sqlmodel import Session, select
from .db import engine
from .models import User
from .auth import get_password_hash

def create_admin():
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == "admin")).first()
        if user:
            print("Admin user already exists.")
            return
        admin = User(
            username="admin",
            hashed_password=get_password_hash("KulVib2025info"),
            role="admin",
            is_active=True
        )
        session.add(admin)
        session.commit()
        print("Admin user created!")

if __name__ == "__main__":
    create_admin()
