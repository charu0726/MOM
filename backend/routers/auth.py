import hashlib
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserLogin, UserResponse, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def hash_password(password: str) -> str:
    """Generates SHA-256 hash for user password."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

@router.post("/register", response_model=AuthResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Registers a new user account."""
    clean_username = payload.username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    existing_user = db.query(User).filter(User.username == clean_username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another or sign in.")

    user = User(
        username=clean_username,
        email=payload.email.strip() if payload.email else None,
        full_name=payload.full_name.strip() if payload.full_name else clean_username,
        password_hash=hash_password(payload.password),
        created_at=datetime.datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = f"token_{uuid.uuid4().hex}"
    return AuthResponse(
        user=user,
        token=token,
        message="Registration successful"
    )

@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticates user with username & password."""
    clean_username = payload.username.strip()
    user = db.query(User).filter(User.username == clean_username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if user.password_hash and user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = f"token_{uuid.uuid4().hex}"
    return AuthResponse(
        user=user,
        token=token,
        message="Login successful"
    )

@router.get("/me", response_model=UserResponse)
def get_current_user(username: str, db: Session = Depends(get_db)):
    """Fetches user profile by username."""
    user = db.query(User).filter(User.username == username.strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
