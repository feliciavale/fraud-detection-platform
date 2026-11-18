import os
import tempfile

# Use a throwaway SQLite file for tests. This runs before api.db is imported.
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
