import os
import tempfile

# Tests use a throwaway SQLite file, unless TEST_DATABASE_URL points at an empty test database
# (for example a local PostgreSQL). This runs before api.db is imported.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
