from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "postgresql://neondb_owner:npg_MTVCntKD8O2z@ep-raspy-math-a2qmxohl-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
engine = create_engine(DATABASE_URL, echo=True)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
