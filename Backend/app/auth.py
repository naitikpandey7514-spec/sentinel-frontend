from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
import secrets

from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    select,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
)


# ============================================================
# AUTH DATABASE
# ============================================================

class AuthBase(DeclarativeBase):
    pass


role_permission_table = Table(
    "auth_role_permissions",
    AuthBase.metadata,
    Column(
        "role_id",
        ForeignKey("auth_roles.id"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        ForeignKey("auth_permissions.id"),
        primary_key=True,
    ),
)


class Role(AuthBase):
    __tablename__ = "auth_roles"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
    )

    description: Mapped[str] = mapped_column(
        String(250),
        default="",
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="role",
    )

    permissions: Mapped[list["Permission"]] = relationship(
        secondary=role_permission_table,
        back_populates="roles",
    )


class Permission(AuthBase):
    __tablename__ = "auth_permissions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
    )

    description: Mapped[str] = mapped_column(
        String(250),
        default="",
    )

    roles: Mapped[list["Role"]] = relationship(
        secondary=role_permission_table,
        back_populates="permissions",
    )


class User(AuthBase):
    __tablename__ = "auth_users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    username: Mapped[str] = mapped_column(
        String(80),
        unique=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(160),
        unique=True,
        index=True,
    )

    full_name: Mapped[str] = mapped_column(
        String(160),
        default="",
    )

    password_hash: Mapped[str] = mapped_column(
        String(500),
    )

    role_id: Mapped[int] = mapped_column(
        ForeignKey("auth_roles.id"),
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    role: Mapped["Role"] = relationship(
        back_populates="users",
    )


class AuthSession(AuthBase):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("auth_users.id"),
        index=True,
    )

    token_hash: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        index=True,
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class AuditLog(AuthBase):
    __tablename__ = "auth_audit_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("auth_users.id"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(100),
    )

    target_type: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    target_id: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    details: Mapped[str] = mapped_column(
        String(1000),
        default="",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )


# ============================================================
# SECURITY CONFIG
# ============================================================

PASSWORD_HASHER = PasswordHasher()

AUTH_COOKIE_NAME = "sentinel_session"

SESSION_DAYS = int(
    os.getenv("SENTINEL_SESSION_DAYS", "8")
)

SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60

AUTH_COOKIE_SECURE = (
    os.getenv(
        "AUTH_COOKIE_SECURE",
        "false",
    )
    .strip()
    .lower()
    in {"1", "true", "yes"}
)


# ============================================================
# ROLES + PERMISSIONS
# ============================================================

ROLE_PERMISSIONS = {
    "SUPER_ADMIN": {
        "dashboard.view",
        "cameras.view",
        "cameras.manage",
        "alerts.view",
        "alerts.manage",
        "vehicles.view",
        "watchlist.view",
        "watchlist.manage",
        "investigation.view",
        "investigation.manage",
        "integrations.view",
        "integrations.manage",
        "users.view",
        "users.manage",
        "settings.view",
        "settings.manage",
        "audit.view",
    },

    "SECURITY_ADMIN": {
        "dashboard.view",
        "cameras.view",
        "cameras.manage",
        "alerts.view",
        "alerts.manage",
        "vehicles.view",
        "watchlist.view",
        "watchlist.manage",
        "investigation.view",
        "investigation.manage",
        "integrations.view",
        "integrations.manage",
        "settings.view",
        "audit.view",
    },

    "OPERATOR": {
        "dashboard.view",
        "cameras.view",
        "alerts.view",
        "alerts.manage",
        "vehicles.view",
        "watchlist.view",
        "investigation.view",
        "investigation.manage",
    },

    "VIEWER": {
        "dashboard.view",
        "cameras.view",
        "alerts.view",
        "vehicles.view",
        "watchlist.view",
    },
}


ROLE_DESCRIPTIONS = {
    "SUPER_ADMIN": (
        "Full Sentinel-X administration and security access"
    ),
    "SECURITY_ADMIN": (
        "Security operations and system management"
    ),
    "OPERATOR": (
        "Live monitoring, alerts and investigations"
    ),
    "VIEWER": (
        "Read-only operational access"
    ),
}


PERMISSION_DESCRIPTIONS = {
    "dashboard.view":
        "View the command dashboard",

    "cameras.view":
        "View camera registry and live cameras",

    "cameras.manage":
        "Manage camera configuration",

    "alerts.view":
        "View security alerts",

    "alerts.manage":
        "Acknowledge and resolve alerts",

    "vehicles.view":
        "Search vehicle detections",

    "watchlist.view":
        "View watchlist entries",

    "watchlist.manage":
        "Create and manage watchlist entries",

    "investigation.view":
        "View investigation workspaces",

    "investigation.manage":
        "Manage investigation workflows",

    "integrations.view":
        "View integration status",

    "integrations.manage":
        "Manage integration settings",

    "users.view":
        "View Sentinel-X users",

    "users.manage":
        "Create and administer users",

    "settings.view":
        "View system settings",

    "settings.manage":
        "Modify system settings",

    "audit.view":
        "View security audit logs",
}


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================

class LoginIn(BaseModel):
    identifier: str = Field(
        min_length=3,
        max_length=160,
    )

    password: str = Field(
        min_length=1,
        max_length=200,
    )


class UserCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=3, max_length=320)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=256)
    role: str = Field(default="VIEWER", min_length=3, max_length=32)


class RoleUpdateIn(BaseModel):
    role: str = Field(
        min_length=3,
        max_length=50,
    )


class UserStatusIn(BaseModel):
    is_active: bool


class PasswordResetIn(BaseModel):
    password: str = Field(
        min_length=10,
        max_length=200,
    )


# ============================================================
# HELPERS
# ============================================================

def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    try:
        return PASSWORD_HASHER.verify(
            password_hash,
            password,
        )
    except Exception:
        return False


def get_user_permissions(user: User) -> set[str]:
    if not user.role:
        return set()

    return {
        permission.name
        for permission in user.role.permissions
    }


def public_user(user: User) -> dict:
    permissions = sorted(
        get_user_permissions(user)
    )

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "role": user.role.name if user.role else None,
        "role_description": (
            user.role.description
            if user.role
            else ""
        ),
        "permissions": permissions,
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
    }


def create_session(
    db: Session,
    user_id: int,
) -> str:
    raw_token = secrets.token_urlsafe(48)

    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    session = AuthSession(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=(
            utc_now()
            + timedelta(days=SESSION_DAYS)
        ),
    )

    db.add(session)

    return raw_token


def revoke_session(
    db: Session,
    raw_token: str | None,
) -> None:
    if not raw_token:
        return

    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
        )
    )

    if session:
        session.revoked_at = utc_now()


def resolve_user_from_request(
    request: Request,
    db: Session,
) -> User | None:
    raw_token = request.cookies.get(
        AUTH_COOKIE_NAME
    )

    if not raw_token:
        return None

    token_hash = hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()

    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
        )
    )

    if not session:
        return None

    if session.expires_at <= utc_now():
        return None

    user = db.get(
        User,
        session.user_id,
    )

    if not user or not user.is_active:
        return None

    return user


def require_permission(
    permission_name: str,
):
    def permission_dependency(
        request: Request,
    ):
        user = getattr(
            request.state,
            "user",
            None,
        )

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Authentication required",
            )

        permissions = get_user_permissions(
            user
        )

        if permission_name not in permissions:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Permission required: "
                    f"{permission_name}"
                ),
            )

        return user

    return permission_dependency


def write_audit(
    db: Session,
    actor_user_id: int | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    details: dict | None = None,
) -> None:
    details_text = ""

    if details:
        details_text = json.dumps(
            details,
            default=str,
        )[:1000]

    db.add(
        AuditLog(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details_text,
        )
    )


# ============================================================
# FASTAPI DEPENDENCY
# ============================================================

def get_current_user(
    request: Request,
) -> User:
    user = getattr(
        request.state,
        "user",
        None,
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    return user


# ============================================================
# INITIAL SEED
# ============================================================

def seed_auth(db: Session) -> None:
    permission_objects = {}

    for permission_name, description in (
        PERMISSION_DESCRIPTIONS.items()
    ):
        permission = db.scalar(
            select(Permission).where(
                Permission.name == permission_name
            )
        )

        if not permission:
            permission = Permission(
                name=permission_name,
                description=description,
            )
            db.add(permission)
            db.flush()

        permission_objects[
            permission_name
        ] = permission

    role_objects = {}

    for role_name, permissions in (
        ROLE_PERMISSIONS.items()
    ):
        role = db.scalar(
            select(Role).where(
                Role.name == role_name
            )
        )

        if not role:
            role = Role(
                name=role_name,
                description=ROLE_DESCRIPTIONS[
                    role_name
                ],
            )
            db.add(role)
            db.flush()

        role.description = ROLE_DESCRIPTIONS[
            role_name
        ]

        role.permissions = [
            permission_objects[name]
            for name in permissions
        ]

        role_objects[role_name] = role

    admin_email = os.getenv(
        "SENTINEL_ADMIN_EMAIL",
        "",
    ).strip().lower()

    admin_username = os.getenv(
        "SENTINEL_ADMIN_USERNAME",
        "",
    ).strip().lower()

    admin_name = os.getenv(
        "SENTINEL_ADMIN_NAME",
        "Sentinel-X Administrator",
    ).strip()

    admin_password = os.getenv(
        "SENTINEL_ADMIN_PASSWORD",
        "",
    )

    if not admin_username and admin_email:
        admin_username = (
            admin_email.split("@")[0]
        )

    if (
        admin_email
        and admin_username
        and admin_password
    ):
        existing = db.scalar(
            select(User).where(
                (User.email == admin_email)
                | (
                    User.username
                    == admin_username
                )
            )
        )

        if not existing:
            db.add(
                User(
                    username=admin_username,
                    email=admin_email,
                    full_name=admin_name,
                    password_hash=hash_password(
                        admin_password
                    ),
                    role_id=role_objects[
                        "SUPER_ADMIN"
                    ].id,
                    is_active=True,
                )
            )

            print(
                "Sentinel-X auth: initial "
                "Super Admin created."
            )

    else:
        print(
            "Sentinel-X auth: "
            "SENTINEL_ADMIN_EMAIL, "
            "SENTINEL_ADMIN_USERNAME, "
            "SENTINEL_ADMIN_NAME and "
            "SENTINEL_ADMIN_PASSWORD must "
            "be configured to seed the initial admin."
        )

    db.commit()