from main import get_database_connection


sample_teachers = [
    ("张老师", "zhang@example.com", "数学", "active", None),
    ("李老师", "li@example.com", "英语", "active", None),
    ("王老师", "wang@example.com", "统计学", "inactive", None),
]


def setup_database():
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS teachers (
                    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    subject TEXT NOT NULL,
                    status TEXT NOT NULL,
                    phone TEXT,
                    created_at TIMESTAMP WITH TIME ZONE
                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT teachers_status_check
                        CHECK (status IN ('active', 'inactive'))
                )
                """
            )

            cursor.execute(
                "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS subject TEXT"
            )
            cursor.execute(
                "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status TEXT"
            )
            cursor.execute(
                "ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone TEXT"
            )
            cursor.execute(
                """
                ALTER TABLE teachers
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE
                    DEFAULT CURRENT_TIMESTAMP
                """
            )

            cursor.execute(
                "UPDATE teachers SET subject = '未设置' WHERE subject IS NULL"
            )
            cursor.execute(
                "UPDATE teachers SET status = 'active' WHERE status IS NULL"
            )
            cursor.execute(
                """
                UPDATE teachers
                SET created_at = CURRENT_TIMESTAMP
                WHERE created_at IS NULL
                """
            )

            cursor.execute(
                "ALTER TABLE teachers ALTER COLUMN subject SET NOT NULL"
            )
            cursor.execute(
                "ALTER TABLE teachers ALTER COLUMN status SET NOT NULL"
            )
            cursor.execute(
                """
                ALTER TABLE teachers
                ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP
                """
            )
            cursor.execute(
                "ALTER TABLE teachers ALTER COLUMN created_at SET NOT NULL"
            )

            cursor.execute(
                """
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'teachers_status_check'
                  AND conrelid = 'teachers'::regclass
                """
            )
            if cursor.fetchone() is None:
                cursor.execute(
                    """
                    ALTER TABLE teachers
                    ADD CONSTRAINT teachers_status_check
                    CHECK (status IN ('active', 'inactive'))
                    """
                )

            cursor.executemany(
                """
                INSERT INTO teachers (name, email, subject, status, phone)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (email) DO NOTHING
                """,
                sample_teachers,
            )

    print("teachers 表和示例数据已经准备完成。")


if __name__ == "__main__":
    setup_database()
