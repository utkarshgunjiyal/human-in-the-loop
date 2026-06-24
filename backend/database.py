"""Database connection and shared MongoDB client."""
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]

client = AsyncIOMotorClient(
    mongo_url,
    tlsCAFile=certifi.where(),
)

db = client[os.environ["DB_NAME"]]


async def get_db():
    """FastAPI dependency that returns the shared database handle."""
    return db