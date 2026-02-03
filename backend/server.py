FILE: backend/server.py
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
# CORRECTION IMPORT: 'date' est nécessaire pour éviter le crash json_serial
from datetime import datetime, timezone, timedelta, date
import os
import uuid
import re
import io
import pdfplumber
import json
import logging
from passlib.context import CryptContext
from jose import JWTError, jwt
# Ajout pour gérer les ObjectId si nécessaire
from bson import ObjectId

# --- NOUVEAUX IMPORTS POUR LE RATE LIMITING (SÉCURITÉ) ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# --- IMPORTS POUR SENDGRID ---
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# --- NOUVEAUX IMPORTS POUR MFA (TOTP) ---
import pyotp
import qrcode
import base64
# --- FIN DES NOUVEAUX IMPORTS ---

# Configuration Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==============================================================================
# CORRECTIF SÉRIALISATION JSON (POUR STOPPER LE BUG DE FAUSSE ERREUR ROUGE)
# ==============================================================================
def json_serial(obj):
    """Handler pour les types non sérialisables par défaut."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError(f"Type {type(obj)} non sérialisable")

class UnifiedJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
            default=json_serial,
        ).encode("utf-8")

# --- Configuration de la Sécurité ---

# Initialisation du Limiter (identifie par adresse IP)
limiter = Limiter(key_func=get_remote_address)

# Contexte de hachage pour les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Clé secrète pour les JWT (JSON Web Tokens)
SECRET_KEY = os.getenv("SECRET_KEY", "u8!l$058fy+bhkeg7z$73=n8m=keb!tp9ys7si2)4$a0i&6%9l")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 jours

# Token de vérification (24h)
VERIFICATION_TOKEN_EXPIRE_MINUTES = 60 * 24

# Token MFA temporaire (5 min)
MFA_TOKEN_EXPIRE_MINUTES = 5

# Token de réinitialisation de mot de passe (15 min)
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 15

# Schéma OAuth2 pour la récupération du token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# --- Initialisation de FastAPI ---
# On injecte ici notre UnifiedJSONResponse pour tout le serveur
app = FastAPI(default_response_class=UnifiedJSONResponse)

# Configuration du Rate Limiter dans l'état de l'application
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORRECTION DU BUG DE CONNEXION (CORS) ---
origins = [
    "https://budget-1-fbg6.onrender.com",
    "http://localhost:3000",
    # Ajout dynamique de l'URL frontend si définie dans les env
    os.getenv("FRONTEND_URL", "http://localhost:3000")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connexion MongoDB - RETOUR A LA VERSION ORIGINALE QUI MARCHAIT
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/budget_tracker")
client = AsyncIOMotorClient(MONGO_URL)
db = client.budget_tracker

# Collections
users_collection = db.users
transactions_collection = db.transactions
categories_collection = db.categories
subcategories_collection = db.subcategories
recurring_transactions_collection = db.recurring_transactions
budgets_collection = db.budgets
savings_goals_collection = db.savings_goals

# --- NOUVEAUTÉ : INITIALISATION DES INDEX (PERFORMANCE) ---
@app.on_event("startup")
async def startup_db_client():
    """Crée les index nécessaires au démarrage pour garantir les performances."""
    try:
        await transactions_collection.create_index([("user_id", 1), ("date", -1)])
        await categories_collection.create_index([("user_id", 1)])
        await budgets_collection.create_index([("user_id", 1), ("category_id", 1)], unique=True)
        await savings_goals_collection.create_index([("user_id", 1)])
        print("Index MongoDB synchronisés.")
    except Exception as e:
        print(f"Indexation Warning: {e}")

# --- Modèles Pydantic ---

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserPublic(BaseModel):
    id: str
    email: EmailStr
    mfa_enabled: bool = False
    currency: str = "EUR"

class UserInDB(UserPublic):
    hashed_password: str
    is_verified: Optional[bool] = None
    mfa_secret: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_token: Optional[str] = None 

class Token(BaseModel):
    access_token: str
    token_type: str
    
class TokenData(BaseModel):
    email: Optional[str] = None
    scope: str = "access" 

# Modèles MFA
class MfaSetupResponse(BaseModel):
    secret_key: str
    qr_code_data_uri: str
class MfaVerifyRequest(BaseModel):
    mfa_code: str
class MfaLoginRequest(BaseModel):
    mfa_token: str
    mfa_code: str
class MfaDisableRequest(BaseModel):
    password: str
    mfa_code: str

# Modèles pour le mot de passe oublié
class ForgotPasswordRequest(BaseModel):
    email: EmailStr
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

# Modèles de données métier
class Category(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    created_at: datetime

class SubCategory(BaseModel):
    id: str
    user_id: str
    category_id: str
    name: str
    created_at: datetime

class Transaction(BaseModel):
    id: str
    user_id: str
    date: datetime
    amount: float
    type: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    created_at: datetime

class RecurringTransaction(BaseModel):
    id: str
    user_id: str
    amount: float
    type: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    frequency: str
    day_of_month: int
    created_at: datetime

class Budget(BaseModel):
    id: str
    user_id: str
    category_id: str
    amount: float = Field(..., gt=0)
    created_at: datetime

class BudgetCreate(BaseModel):
    category_id: str
    amount: float = Field(..., gt=0)

class BudgetUpdate(BaseModel):
    amount: float = Field(..., gt=0)

class SavingsGoal(BaseModel):
    id: str
    user_id: str
    name: str
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(default=0, ge=0)
    created_at: datetime

class SavingsGoalCreate(BaseModel):
    name: str
    target_amount: float = Field(..., gt=0)

class SavingsGoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = Field(None, gt=0)

class SavingsGoalAdjust(BaseModel):
    amount: float = Field(..., gt=0)
    action: str 

# Modèles pour la Revue Mensuelle
class BiggestExpense(BaseModel):
    description: Optional[str]
    amount: float
    date: datetime

class BudgetReviewDetail(BaseModel):
    category_name: str
    amount_budgeted: float
    amount_spent: float
    difference: float

class MonthlyReviewResponse(BaseModel):
    display_period: str
    total_income: float
    total_expense: float
    total_saved: float
    savings_rate: float
    biggest_expense: Optional[BiggestExpense]
    respected_budgets: List[BudgetReviewDetail]
    exceeded_budgets: List[BudgetReviewDetail]

# Modèles de Requête CRUD
class CategoryCreate(BaseModel):
    name: str
    type: str
class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
class SubCategoryCreate(BaseModel):
    category_id: str
    name: str
class SubCategoryUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
class TransactionCreate(BaseModel):
    date: datetime
    amount: float
    type: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
class RecurringTransactionCreate(BaseModel):
    amount: float
    type: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    frequency: str
    day_of_month: int
class RecurringTransactionUpdate(BaseModel):
    amount: Optional[float] = None
    type: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    frequency: Optional[str] = None
    day_of_month: Optional[int] = None
class TransactionBulk(BaseModel):
    transactions: List[TransactionCreate]
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
class CurrencyUpdateRequest(BaseModel):
    currency: str

# --- Utilitaires de Sécurité ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_verification_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_TOKEN_EXPIRE_MINUTES)
    to_encode = { "sub": email, "exp": expires, "scope": "email_verification" }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_email_from_verification_token(token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid verification token",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "email_verification": raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        return email
    except JWTError: 
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token expired or invalid",
        )

def create_mfa_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=MFA_TOKEN_EXPIRE_MINUTES)
    to_encode = { "sub": email, "exp": expires, "scope": "mfa_login" }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_email_from_mfa_token(token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired MFA session. Please log in again.",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "mfa_login": raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        return email
    except JWTError:
        raise credentials_exception

def create_password_reset_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = { "sub": email, "exp": expires, "scope": "password_reset" }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_email_from_password_reset_token(token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired password reset token.",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "password_reset": raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        return email
    except JWTError: 
        raise credentials_exception

# --- Fonctions TOTP ---
def verify_mfa_code(secret_key: str, mfa_code: str) -> bool:
    totp = pyotp.TOTP(secret_key)
    return totp.verify(mfa_code)

def generate_qr_code_data_uri(email: str, secret_key: str) -> str:
    provisioning_uri = pyotp.totp.TOTP(secret_key).provisioning_uri(
        name=email, issuer_name="Budget Tracker"
    )
    img = qrcode.make(provisioning_uri)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"

# --- Fonctions d'envoi d'e-mail ---
def send_verification_email(email: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL")
    sender_email = os.getenv("SENDER_EMAIL")
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")

    # LOGGING POUR DEBUGGER LE PROBLEME DU MAIL
    if not frontend_url: print("DEBUG: FRONTEND_URL manquant")
    if not sender_email: print("DEBUG: SENDER_EMAIL manquant")
    if not sendgrid_api_key: print("DEBUG: SENDGRID_API_KEY manquant")

    if not all([frontend_url, sender_email, sendgrid_api_key]):
        print("ERREUR: Variables SendGrid manquantes")
        raise HTTPException(status_code=500, detail="Email service is not configured.")

    verification_link = f"{frontend_url}/verify-email?token={token}"
    
    message = Mail(
        from_email=sender_email,
        to_emails=email,
        subject='Budget Tracker - Vérifiez votre adresse e-mail',
        html_content=f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #333;">Bienvenue sur Budget Tracker !</h2>
                <p>Merci de vous être inscrit. Pour finaliser la création de votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
                <p style="text-align: center; margin: 25px 0;">
                    <a href="{verification_link}" 
                        style="background-color: #0d6efd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Vérifier mon compte
                    </a>
                </p>
                <p>Ce lien est valide pendant 24 heures.</p>
                <p style="font-size: 0.9em; color: #777;">Si vous n'avez pas créé ce compte, vous pouvez ignorer cet e-mail en toute sécurité.</p>
            </div>
        """
    )
    try:
        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        print(f"SendGrid status: {response.status_code}") # Log le succès
    except Exception as e:
        print(f"Erreur critique lors de l'envoi de l'e-mail: {e}")
        # Si c'est une erreur HTTP spécifique SendGrid, on essaie de voir le body
        if hasattr(e, 'body'):
            print(f"SendGrid Error Body: {e.body}")
        raise HTTPException(status_code=500, detail="Failed to send verification email.")

def send_password_reset_email(email: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL")
    sender_email = os.getenv("SENDER_EMAIL")
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")

    if not all([frontend_url, sender_email, sendgrid_api_key]):
        print("ERREUR: Variables d'environnement SendGrid manquantes")
        raise HTTPException(status_code=500, detail="Email service is not configured.")

    reset_link = f"{frontend_url}/reset-password?token={token}"
    
    message = Mail(
        from_email=sender_email,
        to_emails=email,
        subject='Budget Tracker - Réinitialisation de votre mot de passe',
        html_content=f"""
            <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #333;">Réinitialisation de mot de passe</h2>
                <p>Vous avez demandé à réinitialiser votre mot de passe pour Budget Tracker. Cliquez sur le bouton ci-dessous pour continuer :</p>
                <p style="text-align: center; margin: 25px 0;">
                    <a href="{reset_link}" style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                        Réinitialiser mon mot de passe
                    </a>
                </p>
                <p>Ce lien est valide pendant {PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
                <p style="font-size: 0.9em; color: #777;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.</p>
            </div>
        """
    )
    try:
        sg = SendGridAPIClient(sendgrid_api_key)
        sg.send(message)
    except Exception as e:
        print(f"Erreur critique lors de l'envoi de l'e-mail de réinitialisation: {e}")
        raise HTTPException(status_code=500, detail="Failed to send password reset email.")

# --- Fonctions de l'Utilisateur ---

async def get_user(email: str) -> Optional[UserInDB]:
    user = await users_collection.find_one({"email": email})
    if user:
        if "currency" not in user:
            user["currency"] = "EUR"
        # S'assurer que _id est converti en str pour le modèle Pydantic
        user["id"] = str(user["_id"])
        return UserInDB(**user)
    return None

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "access": raise credentials_exception
        email: str = payload.get("sub")
        if email is None: raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = await get_user(token_data.email)
    if user is None: raise credentials_exception
    return user

# --- Gestion des Catégories par Défaut ---

DEFAULT_CATEGORIES = [
    {"name": "Salaire", "type": "Revenu"}, {"name": "Aide Papa", "type": "Revenu"},
    {"name": "Autres revenu", "type": "Revenu"}, {"name": "Logement", "type": "Dépense"},
    {"name": "Alimentation", "type": "Dépense"}, {"name": "Transport", "type": "Dépense"},
    {"name": "Santé", "type": "Dépense"}, {"name": "Loisirs", "type": "Dépense"},
    {"name": "Abonnements", "type": "Dépense"}, {"name": "Shopping", "type": "Dépense"},
    {"name": "Autre dépense", "type": "Dépense"}, {"name": "Cadeaux", "type": "Dépense"},
    {"name": "Coiffeur", "type": "Dépense"}, {"name": "Prêt", "type": "Dépense"},
    {"name": "Restaurant", "type": "Dépense"}, {"name": "Investissement", "type": "Dépense"},
    {"name": "Etudes", "type": "Dépense"}, {"name": "Vacances", "type": "Dépense"},
]

async def initialize_default_categories(user_id: str):
    existing_count = await categories_collection.count_documents({"user_id": user_id})
    if existing_count == 0:
        for cat in DEFAULT_CATEGORIES:
            category_id = str(uuid.uuid4())
            await categories_collection.insert_one({
                "id": category_id, "user_id": user_id, "name": cat["name"],
                "type": cat["type"], "created_at": datetime.now(timezone.utc)
            })

# --- FONCTION SMART RECURRING (AMÉLIORÉE) ---
async def internal_generate_recurring(user_id: str):
    """Fonction interne pour générer les abonnements sans API. Utilisée au Login."""
    now = datetime.now(timezone.utc)
    current_month, current_year, current_day = now.month, now.year, now.day
    
    recurring_list = await recurring_transactions_collection.find({"user_id": user_id}).to_list(None)
    generated_count = 0
    
    for recurring in recurring_list:
        # On vérifie si on est au jour ou après le jour de l'abonnement
        if recurring["frequency"] == "Mensuel" and current_day >= recurring["day_of_month"]:
            
            # LOGIQUE SMART : On cherche si une transaction similaire existe déjà ce mois-ci
            # Similaire = Même catégorie ET (Montant proche OU Description qui se ressemble)
            start_of_month = datetime(current_year, current_month, 1, tzinfo=timezone.utc)
            
            # Recherche souple dans MongoDB
            existing = await transactions_collection.find_one({
                "user_id": user_id,
                "category_id": recurring.get("category_id"),
                "date": {"$gte": start_of_month},
                "$or": [
                    {"description": {"$regex": recurring.get("description", ""), "$options": "i"}},
                    {"amount": {"$gte": recurring["amount"] * 0.8, "$lte": recurring["amount"] * 1.2}}
                ]
            })
            
            if not existing:
                transaction_id = str(uuid.uuid4())
                transaction_date = datetime(current_year, current_month, recurring["day_of_month"], tzinfo=timezone.utc)
                await transactions_collection.insert_one({
                    "id": transaction_id, "user_id": user_id, "date": transaction_date,
                    "amount": recurring["amount"], "type": recurring["type"],
                    "description": recurring.get("description"), "category_id": recurring.get("category_id"),
                    "subcategory_id": recurring.get("subcategory_id"), "created_at": datetime.now(timezone.utc)
                })
                generated_count += 1
    return generated_count

# --- Routes d'Authentification (Avec Rate Limiting) ---

@app.post("/api/auth/register", response_model=UserPublic)
@limiter.limit("3/minute")
async def register_user(request: Request, user: UserCreate):
    existing_user = await get_user(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_id = str(uuid.uuid4())
    user_count = await users_collection.count_documents({})
    is_first_user = user_count == 0

    new_user_data = {
        "id": user_id,
        "email": user.email,
        "hashed_password": hashed_password,
        "is_verified": is_first_user,
        "mfa_enabled": False, 
        "mfa_secret": None,
        "currency": "EUR"
    }
    
    if is_first_user:
        await users_collection.insert_one(new_user_data)
        await transactions_collection.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": user_id}})
        await categories_collection.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": user_id}})
        await subcategories_collection.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": user_id}})
        await recurring_transactions_collection.update_many({"user_id": {"$exists": False}}, {"$set": {"user_id": user_id}})
    else:
        try:
            verification_token = create_verification_token(user.email)
            send_verification_email(user.email, verification_token) 
        except HTTPException as he:
            raise he
        except Exception as e:
            print(f"Echec envoi e-mail non géré: {e}")
            raise HTTPException(status_code=500, detail="Impossible d'envoyer l'e-mail de vérification.")
        
        await users_collection.insert_one(new_user_data)
        await initialize_default_categories(user_id)
            
    return UserPublic(**new_user_data)

@app.post("/api/auth/token", response_model=TokenResponse) 
@limiter.limit("5/minute")
async def login_for_access_token(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    user = await get_user(form_data.username)
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.is_verified is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified.",
        )
    
    # AUTOMATISATION : Déclenchement de la génération des abonnements à la connexion
    if not user.mfa_enabled:
        await internal_generate_recurring(user.id)

    if user.mfa_enabled:
        mfa_token = create_mfa_token(user.email)
        return TokenResponse(mfa_required=True, mfa_token=mfa_token)
    else:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "scope": "access"}, 
            expires_delta=access_token_expires
        )
        return TokenResponse(access_token=access_token, token_type="bearer", mfa_required=False)

@app.post("/api/auth/mfa-login", response_model=Token)
@limiter.limit("5/minute")
async def mfa_login(request: Request, mfa_data: MfaLoginRequest):
    email = await get_email_from_mfa_token(mfa_data.mfa_token)
    user = await get_user(email)
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA is not enabled.")
        
    if not verify_mfa_code(user.mfa_secret, mfa_data.mfa_code):
        raise HTTPException(status_code=401, detail="Invalid MFA code.")
        
    # AUTOMATISATION : Déclenchement de la génération des abonnements après MFA réussi
    await internal_generate_recurring(user.id)

    access_token = create_access_token(data={"sub": user.email, "scope": "access"})
    return Token(access_token=access_token, token_type="bearer")

@app.get("/api/auth/verify-email")
async def verify_email_route(token: str):
    email = await get_email_from_verification_token(token)
    user = await get_user(email)
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified: return {"message": "Email is already verified"}
    await users_collection.update_one({"email": email}, {"$set": {"is_verified": True}})
    return {"message": "Email verified successfully."}

@app.post("/api/auth/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: Request, data: ForgotPasswordRequest):
    user = await get_user(data.email)
    if user:
        try:
            password_reset_token = create_password_reset_token(user.email)
            send_password_reset_email(user.email, password_reset_token)
        except Exception as e:
            print(f"Error sending forgot password email: {e}")
    return {"message": "If an account exists, a reset link has been sent."}

@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    email = await get_email_from_password_reset_token(data.token)
    user = await get_user(email)
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if len(data.new_password) < 8:
         raise HTTPException(status_code=400, detail="Password too short")
            
    new_hashed_password = get_password_hash(data.new_password)
    await users_collection.update_one({"id": user.id}, {"$set": {"hashed_password": new_hashed_password}})
    return {"message": "Password updated successfully."}

@app.get("/api/users/me", response_model=UserPublic)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    return current_user

@app.put("/api/users/me/change-password")
async def change_password(password_data: PasswordChangeRequest, current_user: UserInDB = Depends(get_current_user)):
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect current password")
    if len(password_data.new_password) < 8:
         raise HTTPException(status_code=400, detail="Password too short")
    new_hashed_password = get_password_hash(password_data.new_password)
    await users_collection.update_one({"id": current_user.id}, {"$set": {"hashed_password": new_hashed_password}})
    return {"message": "Password updated successfully"}

@app.put("/api/users/me/currency")
async def update_user_currency(currency_data: CurrencyUpdateRequest, current_user: UserInDB = Depends(get_current_user)):
    new_currency = currency_data.currency.upper()
    await users_collection.update_one({"id": current_user.id}, {"$set": {"currency": new_currency}})
    return {"message": "Currency updated successfully", "currency": new_currency}

# --- Routes MFA ---

@app.get("/api/mfa/setup", response_model=MfaSetupResponse)
async def mfa_setup_generate(current_user: UserInDB = Depends(get_current_user)):
    if current_user.mfa_enabled: raise HTTPException(status_code=400, detail="MFA already enabled.")
    secret_key = pyotp.random_base32()
    qr_code_uri = generate_qr_code_data_uri(current_user.email, secret_key)
    await users_collection.update_one({"id": current_user.id}, {"$set": {"mfa_secret": secret_key, "mfa_enabled": False}})
    return MfaSetupResponse(secret_key=secret_key, qr_code_data_uri=qr_code_uri)

@app.post("/api/mfa/verify")
async def mfa_setup_verify(mfa_data: MfaVerifyRequest, current_user: UserInDB = Depends(get_current_user)):
    if current_user.mfa_enabled: raise HTTPException(status_code=400, detail="MFA already enabled.")
    if not current_user.mfa_secret: raise HTTPException(status_code=400, detail="Setup not initiated.")
    if not verify_mfa_code(current_user.mfa_secret, mfa_data.mfa_code):
        raise HTTPException(status_code=400, detail="Invalid MFA code.")
    await users_collection.update_one({"id": current_user.id}, {"$set": {"mfa_enabled": True}})
    return {"message": "MFA enabled successfully."}

@app.post("/api/mfa/disable")
async def mfa_disable(mfa_data: MfaDisableRequest, current_user: UserInDB = Depends(get_current_user)):
    if not current_user.mfa_enabled: raise HTTPException(status_code=400, detail="MFA not enabled.")
    if not verify_password(mfa_data.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    if not verify_mfa_code(current_user.mfa_secret, mfa_data.mfa_code):
        raise HTTPException(status_code=401, detail="Invalid MFA code.")
    await users_collection.update_one({"id": current_user.id}, {"$set": {"mfa_enabled": False, "mfa_secret": None}})
    return {"message": "MFA disabled successfully."}

# --- DÉBUT DES ROUTES MÉTIER ---

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Category Routes
@app.get("/api/categories")
async def get_categories(current_user: UserInDB = Depends(get_current_user)):
    categories = await categories_collection.find({"user_id": current_user.id}).to_list(None)
    return [{"id": cat["id"], "name": cat["name"], "type": cat["type"], "created_at": cat["created_at"]} for cat in categories]

@app.post("/api/categories")
async def create_category(category: CategoryCreate, current_user: UserInDB = Depends(get_current_user)):
    category_id = str(uuid.uuid4())
    new_category_data = {
        "id": category_id, "user_id": current_user.id, "name": category.name,
        "type": category.type, "created_at": datetime.now(timezone.utc)
    }
    await categories_collection.insert_one(new_category_data.copy())
    return new_category_data

@app.put("/api/categories/{category_id}")
async def update_category(category_id: str, category: CategoryUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await categories_collection.find_one({"id": category_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = {k: v for k, v in category.dict(exclude_unset=True).items()}
    if update_data:
        await categories_collection.update_one({"id": category_id, "user_id": current_user.id}, {"$set": update_data})
    
    updated = await categories_collection.find_one({"id": category_id, "user_id": current_user.id})
    updated.pop("_id", None) # Nettoyage JSON
    return updated

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await categories_collection.find_one({"id": category_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Category not found")
    await subcategories_collection.delete_many({"category_id": category_id, "user_id": current_user.id})
    await transactions_collection.update_many({"category_id": category_id, "user_id": current_user.id}, {"$set": {"category_id": None, "subcategory_id": None}})
    await budgets_collection.delete_many({"category_id": category_id, "user_id": current_user.id})
    await categories_collection.delete_one({"id": category_id, "user_id": current_user.id})
    return {"message": "Category deleted successfully"}

# SubCategory Routes
@app.get("/api/subcategories")
async def get_subcategories(current_user: UserInDB = Depends(get_current_user)):
    subcategories = await subcategories_collection.find({"user_id": current_user.id}).to_list(None)
    return [{"id": sub["id"], "category_id": sub["category_id"], "name": sub["name"], "created_at": sub["created_at"]} for sub in subcategories]

@app.post("/api/subcategories")
async def create_subcategory(subcategory: SubCategoryCreate, current_user: UserInDB = Depends(get_current_user)):
    category = await categories_collection.find_one({"id": subcategory.category_id, "user_id": current_user.id})
    if not category: raise HTTPException(status_code=404, detail="Category not found")
    subcategory_id = str(uuid.uuid4())
    new_subcategory_data = {
        "id": subcategory_id, "user_id": current_user.id, "category_id": subcategory.category_id,
        "name": subcategory.name, "created_at": datetime.now(timezone.utc)
    }
    await subcategories_collection.insert_one(new_subcategory_data.copy())
    return new_subcategory_data

@app.put("/api/subcategories/{subcategory_id}")
async def update_subcategory(subcategory_id: str, subcategory: SubCategoryUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="SubCategory not found")
    update_data = {k: v for k, v in subcategory.dict(exclude_unset=True).items()}
    if update_data:
        await subcategories_collection.update_one({"id": subcategory_id, "user_id": current_user.id}, {"$set": update_data})
    updated = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user.id})
    updated.pop("_id", None)
    return updated

@app.delete("/api/subcategories/{subcategory_id}")
async def delete_subcategory(subcategory_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="SubCategory not found")
    await transactions_collection.update_many({"subcategory_id": subcategory_id, "user_id": current_user.id}, {"$set": {"subcategory_id": None}})
    await subcategories_collection.delete_one({"id": subcategory_id, "user_id": current_user.id})
    return {"message": "SubCategory deleted successfully"}

# --- Transactions ---

@app.get("/api/transactions")
async def get_transactions(
    start_date: Optional[str] = None, end_date: Optional[str] = None,
    category_id: Optional[str] = None, search: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    query = {"user_id": current_user.id} 
    if start_date and end_date:
        query["date"] = {
            "$gte": datetime.fromisoformat(start_date.replace('Z', '+00:00')),
            "$lte": datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        }
    if category_id: query["category_id"] = category_id
    if search: query["description"] = {"$regex": search, "$options": "i"}
    
    transactions = await transactions_collection.find(query).sort("date", -1).to_list(None)
    return [{
        "id": t["id"], "date": t["date"], "amount": t["amount"], "type": t["type"],
        "description": t.get("description"), "category_id": t.get("category_id"),
        "subcategory_id": t.get("subcategory_id"), "created_at": t["created_at"]
    } for t in transactions]

@app.post("/api/transactions")
async def create_transaction(transaction: TransactionCreate, current_user: UserInDB = Depends(get_current_user)):
    transaction_id = str(uuid.uuid4())
    new_transaction_data = {
        "id": transaction_id, "user_id": current_user.id, "date": transaction.date,
        "amount": transaction.amount, "type": transaction.type, "description": transaction.description,
        "category_id": transaction.category_id, "subcategory_id": transaction.subcategory_id,
        "created_at": datetime.now(timezone.utc)
    }
    await transactions_collection.insert_one(new_transaction_data.copy())
    return new_transaction_data

@app.put("/api/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, transaction: TransactionUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {k: v for k, v in transaction.dict(exclude_unset=True).items()}
    if update_data:
        await transactions_collection.update_one({"id": transaction_id, "user_id": current_user.id}, {"$set": update_data})
    
    updated = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    if updated:
        updated.pop("_id", None)
    return updated

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Transaction not found")
    await transactions_collection.delete_one({"id": transaction_id, "user_id": current_user.id})
    return {"message": "Transaction deleted successfully"}

@app.post("/api/transactions/bulk")
async def create_bulk_transactions(data: TransactionBulk, current_user: UserInDB = Depends(get_current_user)):
    new_transactions_data = []
    for transaction in data.transactions:
        transaction_id = str(uuid.uuid4())
        new_transaction_doc = { 
            "id": transaction_id, "user_id": current_user.id, "date": transaction.date,
            "amount": transaction.amount, "type": transaction.type, "description": transaction.description,
            "category_id": transaction.category_id, "subcategory_id": transaction.subcategory_id,
            "created_at": datetime.now(timezone.utc)
        }
        new_transactions_data.append(new_transaction_doc) 
    if not new_transactions_data: raise HTTPException(status_code=400, detail="No transactions.")
    try:
        await transactions_collection.insert_many(new_transactions_data, ordered=False)
        return {"message": f"{len(new_transactions_data)} transactions imported."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ANALYSE PDF ---

@app.post("/api/transactions/parse-pdf")
@limiter.limit("2/minute")
async def parse_pdf_transactions(request: Request, file: UploadFile = File(...), current_user: UserInDB = Depends(get_current_user)):
    """Analyse un relevé bancaire PDF pour en extraire les transactions potentielles."""
    try:
        contents = await file.read()
        pdf_file = io.BytesIO(contents)
        extracted_transactions = []
        
        date_pattern = r'(\d{2}/\d{2}(?:/\d{2,4})?)'
        amount_pattern = r'(-?\d+(?:\s?\d+)*(?:[.,]\d{2}))'

        with pdfplumber.open(pdf_file) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text: continue
                
                lines = text.split('\n')
                for line in lines:
                    date_match = re.search(date_pattern, line)
                    if not date_match: continue
                    amount_matches = re.findall(amount_pattern, line)
                    if not amount_matches: continue
                    
                    raw_date = date_match.group(1)
                    try:
                        if len(raw_date) <= 5:
                            parsed_date = datetime.strptime(f"{raw_date}/{datetime.now().year}", "%d/%m/%Y")
                        elif len(raw_date) <= 8:
                            parsed_date = datetime.strptime(raw_date, "%d/%m/%y")
                        else:
                            parsed_date = datetime.strptime(raw_date, "%d/%m/%Y")
                        parsed_date = parsed_date.replace(tzinfo=timezone.utc)
                    except: continue

                    raw_amount = amount_matches[-1].replace(' ', '').replace(',', '.')
                    amount = float(raw_amount)
                    t_type = "Revenu" if amount > 0 else "Dépense"
                    description = line.replace(raw_date, '').replace(amount_matches[-1], '').strip()
                    
                    extracted_transactions.append({
                        "date": parsed_date.isoformat(),
                        "amount": abs(amount),
                        "type": t_type,
                        "description": description or "Transaction PDF",
                        "category_id": None,
                        "subcategory_id": None
                    })

        return extracted_transactions
    except Exception as e:
        print(f"Erreur lors de l'analyse PDF : {e}")
        raise HTTPException(status_code=500, detail=f"Échec de l'analyse du PDF : {str(e)}")

# --- Recurring Transactions ---

@app.get("/api/recurring-transactions")
async def get_recurring_transactions(current_user: UserInDB = Depends(get_current_user)):
    recurring = await recurring_transactions_collection.find({"user_id": current_user.id}).to_list(None)
    return [{
        "id": r["id"], "amount": r["amount"], "type": r["type"],
        "description": r.get("description"), "category_id": r.get("category_id"),
        "subcategory_id": r.get("subcategory_id"), "frequency": r["frequency"],
        "day_of_month": r["day_of_month"], "created_at": r["created_at"]
    } for r in recurring]

@app.post("/api/recurring-transactions")
async def create_recurring_transaction(recurring: RecurringTransactionCreate, current_user: UserInDB = Depends(get_current_user)):
    recurring_id = str(uuid.uuid4())
    new_recurring_data = {
        "id": recurring_id, "user_id": current_user.id, "amount": recurring.amount,
        "type": recurring.type, "description": recurring.description,
        "category_id": recurring.category_id, "subcategory_id": recurring.subcategory_id,
        "frequency": recurring.frequency, "day_of_month": recurring.day_of_month,
        "created_at": datetime.now(timezone.utc)
    }
    await recurring_transactions_collection.insert_one(new_recurring_data.copy())
    return new_recurring_data

@app.put("/api/recurring-transactions/{recurring_id}")
async def update_recurring_transaction(recurring_id: str, recurring: RecurringTransactionUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Not found")
    update_data = {k: v for k, v in recurring.dict(exclude_unset=True).items()}
    if update_data:
        await recurring_transactions_collection.update_one({"id": recurring_id, "user_id": current_user.id}, {"$set": update_data})
    updated = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user.id})
    if updated: updated.pop("_id", None)
    return updated

@app.delete("/api/recurring-transactions/{recurring_id}")
async def delete_recurring_transaction(recurring_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Not found")
    await recurring_transactions_collection.delete_one({"id": recurring_id, "user_id": current_user.id})
    return {"message": "Recurring transaction deleted successfully"}

@app.post("/api/recurring-transactions/generate")
async def generate_recurring_transactions(current_user: UserInDB = Depends(get_current_user)):
    """Route API manuelle pour générer les abonnements (L'utilisateur peut toujours cliquer)."""
    count = await internal_generate_recurring(current_user.id)
    return {"message": f"{count} transactions générées", "count": count}

# --- Budgets ---

@app.get("/api/budgets")
async def get_budgets(current_user: UserInDB = Depends(get_current_user)):
    budgets = await budgets_collection.find({"user_id": current_user.id}).to_list(None)
    return [{"id": b["id"], "user_id": b["user_id"], "category_id": b["category_id"], "amount": b["amount"], "created_at": b["created_at"]} for b in budgets]

@app.post("/api/budgets")
async def create_budget(budget: BudgetCreate, current_user: UserInDB = Depends(get_current_user)):
    category = await categories_collection.find_one({"id": budget.category_id, "user_id": current_user.id})
    if not category: raise HTTPException(status_code=404, detail="Category not found")
    existing_budget = await budgets_collection.find_one({"user_id": current_user.id, "category_id": budget.category_id})
    if existing_budget: raise HTTPException(status_code=400, detail="Budget already exists.")
    new_budget_data = {
        "id": str(uuid.uuid4()), "user_id": current_user.id, "category_id": budget.category_id,
        "amount": budget.amount, "created_at": datetime.now(timezone.utc)
    }
    await budgets_collection.insert_one(new_budget_data.copy())
    return new_budget_data

@app.put("/api/budgets/{budget_id}")
async def update_budget(budget_id: str, budget: BudgetUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await budgets_collection.find_one({"id": budget_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Budget not found")
    await budgets_collection.update_one({"id": budget_id, "user_id": current_user.id}, {"$set": {"amount": budget.amount}})
    updated = await budgets_collection.find_one({"id": budget_id, "user_id": current_user.id})
    if updated: updated.pop("_id", None)
    return updated

@app.delete("/api/budgets/{budget_id}")
async def delete_budget(budget_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await budgets_collection.find_one({"id": budget_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Budget not found")
    await budgets_collection.delete_one({"id": budget_id, "user_id": current_user.id})
    return {"message": "Budget deleted successfully"}

# --- Objectifs d'Épargne ---

@app.get("/api/savings-goals")
async def get_savings_goals(current_user: UserInDB = Depends(get_current_user)):
    goals_raw = await savings_goals_collection.find({"user_id": current_user.id}).to_list(None)
    goals = []
    for g in goals_raw:
        goals.append({
            "id": g["id"], "user_id": g["user_id"], "name": g["name"],
            "target_amount": g["target_amount"], "current_amount": g["current_amount"],
            "created_at": g["created_at"]
        })
    return goals

@app.post("/api/savings-goals")
async def create_savings_goal(goal: SavingsGoalCreate, current_user: UserInDB = Depends(get_current_user)):
    new_goal_data = {
        "id": str(uuid.uuid4()), "user_id": current_user.id, "name": goal.name,
        "target_amount": goal.target_amount, "current_amount": 0.0, "created_at": datetime.now(timezone.utc)
    }
    await savings_goals_collection.insert_one(new_goal_data.copy())
    return new_goal_data

@app.put("/api/savings-goals/{goal_id}")
async def update_savings_goal(goal_id: str, goal: SavingsGoalUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await savings_goals_collection.find_one({"id": goal_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Not found")
    update_data = {k: v for k, v in goal.dict(exclude_unset=True).items()}
    if update_data:
        await savings_goals_collection.update_one({"id": goal_id, "user_id": current_user.id}, {"$set": update_data})
    
    updated = await savings_goals_collection.find_one({"id": goal_id, "user_id": current_user.id})
    if updated:
        updated.pop("_id", None)
    return updated

@app.post("/api/savings-goals/{goal_id}/adjust")
async def adjust_savings_goal(goal_id: str, adjust: SavingsGoalAdjust, current_user: UserInDB = Depends(get_current_user)):
    existing = await savings_goals_collection.find_one({"id": goal_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Not found")
    current_amount = existing.get("current_amount", 0.0)
    if adjust.action == "add": current_amount += adjust.amount
    elif adjust.action == "remove":
        current_amount -= adjust.amount
        if current_amount < 0: raise HTTPException(status_code=400, detail="Cannot remove more than balance.")
    else: raise HTTPException(status_code=400, detail="Invalid action.")

    await savings_goals_collection.update_one({"id": goal_id, "user_id": current_user.id}, {"$set": {"current_amount": current_amount}})
    
    updated = await savings_goals_collection.find_one({"id": goal_id, "user_id": current_user.id})
    if updated:
        updated.pop("_id", None)
    return updated

@app.delete("/api/savings-goals/{goal_id}")
async def delete_savings_goal(goal_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await savings_goals_collection.find_one({"id": goal_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Not found")
    await savings_goals_collection.delete_one({"id": goal_id, "user_id": current_user.id})
    return {"message": "Goal deleted successfully"}

# --- Dashboard Statistics ---

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(
    start_date_str: Optional[str] = None, 
    end_date_str: Optional[str] = None, 
    current_user: UserInDB = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    global_revenus, global_depenses = 0, 0
    res_rev = await transactions_collection.aggregate([{"$match": {"type": "Revenu", "user_id": current_user.id}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(None)
    if res_rev: global_revenus = res_rev[0]['total']
    res_dep = await transactions_collection.aggregate([{"$match": {"type": "Dépense", "user_id": current_user.id}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(None)
    if res_dep: global_depenses = res_dep[0]['total']
    global_epargne_totale = global_revenus - global_depenses
    
    month_names_full = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    if start_date_str and end_date_str:
        start_date = datetime.fromisoformat(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        temp_end = datetime.fromisoformat(end_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
        end_date = temp_end + timedelta(days=1)
        display_period = f"{start_date.strftime('%d/%m/%Y')} - {temp_end.strftime('%d/%m/%Y')}"
    else:
        start_date = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12: end_date = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else: end_date = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
        display_period = f"{month_names_full[now.month - 1]} {now.year}"
    
    period_transactions = await transactions_collection.find({"date": {"$gte": start_date, "$lt": end_date}, "user_id": current_user.id}).to_list(None)
    revenus = sum(t["amount"] for t in period_transactions if t["type"] == "Revenu")
    depenses = sum(t["amount"] for t in period_transactions if t["type"] == "Dépense")
    epargne = revenus - depenses
    
    expense_breakdown = await transactions_collection.aggregate([
        {"$match": {"date": {"$gte": start_date, "$lt": end_date}, "type": "Dépense", "user_id": current_user.id}},
        {"$group": { "_id": "$category_id", "value": {"$sum": "$amount"} } },
        {"$lookup": { "from": "categories", "localField": "_id", "foreignField": "id", "as": "cat" } },
        {"$unwind": "$cat"},
        {"$project": { "_id": 0, "name": "$cat.name", "value": "$value" } }
    ]).to_list(None)

    monthly_data = []
    month_names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
    for i in range(12):
        m_start = datetime(start_date.year, i + 1, 1, tzinfo=timezone.utc)
        if i == 11: m_end = datetime(start_date.year + 1, 1, 1, tzinfo=timezone.utc)
        else: m_end = datetime(start_date.year, i + 2, 1, tzinfo=timezone.utc)
        m_trans = await transactions_collection.find({"date": {"$gte": m_start, "$lt": m_end}, "user_id": current_user.id}).to_list(None)
        monthly_data.append({"month": month_names[i], "revenus": sum(t["amount"] for t in m_trans if t["type"] == "Revenu"), "depenses": sum(t["amount"] for t in m_trans if t["type"] == "Dépense")})
    
    budget_progress = []
    user_budgets = await budgets_collection.find({"user_id": current_user.id}).to_list(None)
    cats = await categories_collection.find({"user_id": current_user.id}).to_list(None)
    cat_map = {cat["id"]: cat["name"] for cat in cats}
    spending_by_cat = {}
    for t in period_transactions:
        if t["type"] == "Dépense" and t.get("category_id"):
            cid = t["category_id"]
            spending_by_cat[cid] = spending_by_cat.get(cid, 0) + t["amount"]
    for b in user_budgets:
        budget_progress.append({
            "id": b["id"], "category_id": b["category_id"], "category_name": cat_map.get(b["category_id"], "Inconnu"),
            "amount_budgeted": b["amount"], "amount_spent": spending_by_cat.get(b["category_id"], 0),
            "remaining": b["amount"] - spending_by_cat.get(b["category_id"], 0)
        })

    upcoming_list = []
    total_upcoming = 0.0
    all_rec = await recurring_transactions_collection.find({"user_id": current_user.id, "frequency": "Mensuel"}).to_list(None)
    for r in all_rec:
        if r["day_of_month"] > now.day: 
            amt = r["amount"]
            if r["type"] == "Dépense": total_upcoming -= amt
            else: total_upcoming += amt
            upcoming_list.append({"description": r.get("description", "Récurrente"), "amount": amt, "type": r["type"], "day_of_month": r["day_of_month"]})
    upcoming_list.sort(key=lambda x: x["day_of_month"])

    savings_goals_raw = await savings_goals_collection.find({"user_id": current_user.id}).to_list(None)
    savings_goals_progress = [{"id": g["id"], "name": g["name"], "target_amount": g["target_amount"], "current_amount": g["current_amount"]} for g in savings_goals_raw]
    
    return {
        "revenus_total": revenus, "depenses_total": depenses, "epargne_total": epargne,
        "monthly_data": monthly_data, "expense_breakdown": expense_breakdown,
        "display_period": display_period, "global_epargne_totale": global_epargne_totale,
        "budget_progress": budget_progress, "upcoming_transactions_list": upcoming_list,
        "total_upcoming_change": total_upcoming, "estimated_end_of_month_balance": global_epargne_totale + total_upcoming,
        "savings_goals_progress": savings_goals_progress
    }

# --- Revue Mensuelle ---

@app.get("/api/dashboard/monthly-review", response_model=MonthlyReviewResponse)
async def get_monthly_review(month: Optional[int] = None, year: Optional[int] = None, current_user: UserInDB = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    month_names_full = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
    if month is None or year is None:
        today = now.replace(day=1)
        last_day_prev = today - timedelta(days=1)
        start_date = last_day_prev.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_date = today.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12: end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else: end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)

    transactions = await transactions_collection.find({"date": {"$gte": start_date, "$lt": end_date}, "user_id": current_user.id}).to_list(None)
    total_income = sum(t["amount"] for t in transactions if t["type"] == "Revenu")
    total_expense = sum(t["amount"] for t in transactions if t["type"] == "Dépense")
    total_saved = total_income - total_expense
    
    exp_trans = [t for t in transactions if t["type"] == "Dépense"]
    biggest_exp = None
    if exp_trans:
        b = max(exp_trans, key=lambda t: t["amount"])
        biggest_exp = BiggestExpense(description=b.get("description"), amount=b["amount"], date=b["date"])
        
    user_budgets = await budgets_collection.find({"user_id": current_user.id}).to_list(None)
    cats = await categories_collection.find({"user_id": current_user.id}).to_list(None)
    cat_map = {cat["id"]: cat["name"] for cat in cats}
    spent_by_cat = {}
    for t in exp_trans:
        if t.get("category_id"): spent_by_cat[t["category_id"]] = spent_by_cat.get(t["category_id"], 0) + t["amount"]

    respected, exceeded = [], []
    for b in user_budgets:
        spent = spent_by_cat.get(b["category_id"], 0)
        detail = BudgetReviewDetail(category_name=cat_map.get(b["category_id"], "Inconnu"), amount_budgeted=b["amount"], amount_spent=spent, difference=b["amount"] - spent)
        if spent > b["amount"]: exceeded.append(detail)
        else: respected.append(detail)

    return MonthlyReviewResponse(
        display_period=f"{month_names_full[start_date.month - 1]} {start_date.year}",
        total_income=total_income, total_expense=total_expense, total_saved=total_saved,
        savings_rate=(total_saved / total_income) * 100 if total_income > 0 else 0.0,
        biggest_expense=biggest_exp, respected_budgets=respected, exceeded_budgets=exceeded
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)