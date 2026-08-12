import os
import re
from typing import Literal, Optional

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator


load_dotenv()

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app = FastAPI(
    title="Teacher Management API",
    description="A small FastAPI and PostgreSQL backend for managing teachers.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


class TeacherInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    subject: str = Field(min_length=1, max_length=100)
    status: Literal["active", "inactive"]
    phone: Optional[str] = Field(default=None, max_length=30)

    @field_validator("name", "email", "subject", mode="before")
    @classmethod
    def remove_extra_spaces(cls, value):
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        email_pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
        if not re.match(email_pattern, value):
            raise ValueError("请输入有效的邮箱地址")
        return value.lower()

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value):
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


@app.exception_handler(psycopg.OperationalError)
async def database_unavailable_handler(
    _request: Request,
    _error: psycopg.OperationalError,
):
    return JSONResponse(
        status_code=503,
        content={"detail": "无法连接 PostgreSQL，请确认数据库服务和 .env 配置"},
    )


@app.exception_handler(psycopg.Error)
async def database_error_handler(
    _request: Request,
    _error: psycopg.Error,
):
    return JSONResponse(
        status_code=500,
        content={"detail": "数据库操作失败，请稍后重试"},
    )


def get_database_connection():
    password = os.getenv("DB_PASSWORD")

    if not password:
        raise HTTPException(
            status_code=500,
            detail="服务器缺少 DB_PASSWORD 配置",
        )

    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "teacher_management"),
        user=os.getenv("DB_USER", "postgres"),
        password=password,
        connect_timeout=3,
        row_factory=dict_row,
    )


@app.get("/teachers")
def get_teachers(
    status: Optional[Literal["active", "inactive"]] = None,
    subject: Optional[str] = None,
    search: Optional[str] = None,
):
    query = """
        SELECT id, name, email, subject, status, phone, created_at
        FROM teachers
    """
    conditions = []
    parameters = []

    if status is not None:
        conditions.append("status = %s")
        parameters.append(status)

    if subject is not None and subject.strip():
        conditions.append("LOWER(subject) = LOWER(%s)")
        parameters.append(subject.strip())

    if search is not None and search.strip():
        conditions.append("(name ILIKE %s OR email ILIKE %s)")
        search_pattern = f"%{search.strip()}%"
        parameters.extend([search_pattern, search_pattern])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY id"

    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            return cursor.fetchall()


@app.get("/dashboard")
def get_dashboard():
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_teachers,
                    COUNT(*) FILTER (WHERE status = 'active')
                        AS active_teachers,
                    COUNT(*) FILTER (WHERE status = 'inactive')
                        AS inactive_teachers
                FROM teachers
                """
            )
            totals = cursor.fetchone()

            cursor.execute(
                """
                SELECT subject, COUNT(*) AS teacher_count
                FROM teachers
                GROUP BY subject
                ORDER BY teacher_count DESC, subject
                """
            )
            teachers_by_subject = cursor.fetchall()

            return {
                **totals,
                "teachers_by_subject": teachers_by_subject,
            }


@app.post("/teachers", status_code=201)
def create_teacher(teacher: TeacherInput):
    try:
        with get_database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT 1 FROM teachers WHERE LOWER(email) = LOWER(%s)",
                    (teacher.email,),
                )
                if cursor.fetchone() is not None:
                    raise HTTPException(status_code=409, detail="该邮箱已被使用")

                cursor.execute(
                    """
                    INSERT INTO teachers (name, email, subject, status, phone)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING
                        id, name, email, subject, status, phone, created_at
                    """,
                    (
                        teacher.name,
                        teacher.email,
                        teacher.subject,
                        teacher.status,
                        teacher.phone,
                    ),
                )
                return cursor.fetchone()
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="该邮箱已被使用")


@app.put("/teachers/{id}")
def update_teacher(id: int, teacher: TeacherInput):
    try:
        with get_database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT 1
                    FROM teachers
                    WHERE LOWER(email) = LOWER(%s) AND id <> %s
                    """,
                    (teacher.email, id),
                )
                if cursor.fetchone() is not None:
                    raise HTTPException(status_code=409, detail="该邮箱已被使用")

                cursor.execute(
                    """
                    UPDATE teachers
                    SET
                        name = %s,
                        email = %s,
                        subject = %s,
                        status = %s,
                        phone = %s
                    WHERE id = %s
                    RETURNING
                        id, name, email, subject, status, phone, created_at
                    """,
                    (
                        teacher.name,
                        teacher.email,
                        teacher.subject,
                        teacher.status,
                        teacher.phone,
                        id,
                    ),
                )
                updated_teacher = cursor.fetchone()

                if updated_teacher is None:
                    raise HTTPException(
                        status_code=404,
                        detail="教师不存在",
                    )

                return updated_teacher
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="该邮箱已被使用")


@app.delete("/teachers/{id}")
def delete_teacher(id: int):
    with get_database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM teachers
                WHERE id = %s
                RETURNING
                    id, name, email, subject, status, phone, created_at
                """,
                (id,),
            )
            deleted_teacher = cursor.fetchone()

            if deleted_teacher is None:
                raise HTTPException(
                    status_code=404,
                    detail="教师不存在",
                )

            return {
                "message": "教师删除成功",
                "teacher": deleted_teacher,
            }
