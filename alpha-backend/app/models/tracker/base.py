from sqlalchemy import MetaData
from sqlmodel import SQLModel

# Tracker models must not share metadata with auth models.
tracker_metadata = MetaData()


class TrackerSQLModel(SQLModel):
    """Base class for Candidate Tracker SQLModel tables (isolated metadata)."""

    __abstract__ = True
    metadata = tracker_metadata

