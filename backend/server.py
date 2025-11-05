from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
from passlib.context import CryptContext
from jose import JWTError, jwt

# --- IMPORTS POUR SENDGRID ---
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

# --- NOUVEAUX IMPORTS POUR MFA (TOTP) ---
import pyotp
import qrcode
import io
import base64
# --- FIN DES NOUVEAUX IMPORTS ---

# --- Configuration de la Sécurité (Nouveau) ---

# Contexte de hachage pour les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Clé secrète pour les JWT (JSON Web Tokens)
SECRET_KEY = os.getenv("SECRET_KEY", "u8!l$058fy+bhkeg7z$73=n8m=keb!tp9ys7si2)4$a0i&6%9l")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 jours

# Token de vérification (24h)
VERIFICATION_TOKEN_EXPIRE_MINUTES = 60 * 24

# --- NOUVEAU : Token MFA temporaire (5 min) ---
MFA_TOKEN_EXPIRE_MINUTES = 5

# --- NOUVEAU : Token de réinitialisation de mot de passe (15 min) ---
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 15

# Schéma OAuth2 pour la récupération du token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# --- Initialisation de FastAPI ---
app = FastAPI()

# ---
# --- CORRECTION DU BUG DE CONNEXION (CORS) ---
# ---
origins = [
    "https://budget-1-fbg6.onrender.com", # CORRIGÉ : "https." -> "https://"
    "http://localhost:3000"
]
# --- FIN DE LA CORRECTION ---

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connexion MongoDB (Identique)
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/budget_tracker")
client = AsyncIOMotorClient(MONGO_URL)
db = client.budget_tracker

# --- NOUVEAU : Ajout de la collection Budgets ---
users_collection = db.users
transactions_collection = db.transactions
categories_collection = db.categories
subcategories_collection = db.subcategories
recurring_transactions_collection = db.recurring_transactions
budgets_collection = db.budgets # NOUVELLE COLLECTION

# --- AJOUT OBJECTIFS D'ÉPARGNE ---
savings_goals_collection = db.savings_goals
# --- FIN AJOUT OBJECTIFS D'ÉPARGNE ---


# --- Modèles Pydantic (Mis à jour) ---

# Nouveaux modèles pour l'authentification
class UserBase(BaseModel):
    email: EmailStr
class UserCreate(UserBase):
    password: str

# --- AJOUT DEVISE ---
class UserPublic(BaseModel):
    id: str
    email: EmailStr
    mfa_enabled: bool = False
    currency: str = "EUR" # Ajout de la devise, EUR par défaut
# --- FIN AJOUT DEVISE ---

class UserInDB(UserPublic):
    hashed_password: str
    is_verified: Optional[bool] = None
    mfa_secret: Optional[str] = None
    # 'currency' est hérité de UserPublic

# Modèle de réponse pour la connexion (Identique)
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

# --- Modèles MFA (Identiques) ---
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
# --- FIN DES MODÈLES MFA ---

# --- Modèles pour le mot de passe oublié ---
class ForgotPasswordRequest(BaseModel):
    email: EmailStr
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
# --- FIN NOUVEAUTÉ ---


# Modèles de données existants (Identiques)
class Category(BaseModel):
    id: str
    user_id: str # Ajouté
    name: str
    type: str
    created_at: datetime

class SubCategory(BaseModel):
    id: str
    user_id: str # Ajouté
    category_id: str
    name: str
    created_at: datetime

class Transaction(BaseModel):
    id: str
    user_id: str # Ajouté
    date: datetime
    amount: float
    type: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    created_at: datetime

class RecurringTransaction(BaseModel):
    id: str
    user_id: str # Ajouté
    amount: float
    type: str
    description: Optional[str] = None
    category_id: Optional[str] = None
    subcategory_id: Optional[str] = None
    frequency: str
    day_of_month: int
    created_at: datetime

# --- NOUVEAU : Modèles pour les Budgets ---
class Budget(BaseModel):
    id: str
    user_id: str
    category_id: str
    amount: float = Field(..., gt=0) # Le montant doit être positif
    created_at: datetime

class BudgetCreate(BaseModel):
    category_id: str
    amount: float = Field(..., gt=0)

class BudgetUpdate(BaseModel):
    amount: float = Field(..., gt=0)
# --- FIN NOUVEAUTÉ ---

# --- NOUVEAU : Modèles pour les Objectifs d'Épargne ---
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
    amount: float = Field(..., gt=0) # L'UI gérera si c'est "ajouter" ou "retirer"
    action: str # "add" or "remove"
# --- FIN NOUVEAUTÉ ---


# Modèles de Requête (Identiques)
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

# --- AJOUT DEVISE ---
class CurrencyUpdateRequest(BaseModel):
    currency: str # Ex: "EUR", "USD", "GBP"
# --- FIN AJOUT DEVISE ---


# --- Utilitaires de Sécurité (Identiques) ---

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

# --- Fonctions pour le token de vérification ---
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

# --- Fonctions pour le token MFA ---
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

# --- Fonctions pour le token de mot de passe oublié ---
def create_password_reset_token(email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": email,
        "exp": expires,
        "scope": "password_reset"
    }
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_email_from_password_reset_token(token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired password reset token.",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("scope") != "password_reset":
            raise credentials_exception
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return email
    except JWTError: 
        raise credentials_exception
# --- FIN NOUVEAUTÉ ---


# --- Fonctions TOTP (Identiques) ---
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


# --- Fonction d'envoi d'e-mail ---
def send_verification_email(email: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL")
    sender_email = os.getenv("SENDER_EMAIL")
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")

    if not all([frontend_url, sender_email, sendgrid_api_key]):
        print("ERREUR: Variables d'environnement manquantes pour l'envoi d'e-mail (SENDGRID_API_KEY, FRONTEND_URL, SENDER_EMAIL)")
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
        if response.status_code >= 300: 
            print(f"Erreur SendGrid: {response.body}")
            raise Exception(f"SendGrid error: {response.body}")
    except Exception as e:
        print(f"Erreur critique lors de l'envoi de l'e-mail: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification email.")

# --- Fonction d'envoi d'e-mail de réinitialisation ---
def send_password_reset_email(email: str, token: str):
    frontend_url = os.getenv("FRONTEND_URL")
    sender_email = os.getenv("SENDER_EMAIL")
    sendgrid_api_key = os.getenv("SENDGRID_API_KEY")

    if not all([frontend_url, sender_email, sendgrid_api_key]):
        print("ERREUR: Variables d'environnement SendGrid manquantes pour le mot de passe oublié.")
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
        response = sg.send(message)
        if response.status_code >= 300:
            print(f"Erreur SendGrid: {response.body}")
            raise Exception(f"SendGrid error: {response.body}")
    except Exception as e:
        print(f"Erreur critique lors de l'envoi de l'e-mail de réinitialisation: {e}")
        raise HTTPException(status_code=500, detail="Failed to send password reset email.")
# --- FIN FONCTIONS EMAIL ---


# --- Fonctions de l'Utilisateur (Identiques) ---

async def get_user(email: str) -> Optional[UserInDB]:
    user = await users_collection.find_one({"email": email})
    if user:
        # --- AJOUT DEVISE : Gère les anciens utilisateurs sans devise ---
        if "currency" not in user:
            user["currency"] = "EUR"
        # --- FIN AJOUT DEVISE ---
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
    if user is None:
        raise credentials_exception
    return user

# --- Gestion des Catégories par Défaut (Identique) ---

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

# --- Routes d'Authentification (Mis à jour) ---

@app.post("/api/auth/register", response_model=UserPublic)
async def register_user(user: UserCreate):
    existing_user = await get_user(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_id = str(uuid.uuid4())
    
    user_count = await users_collection.count_documents({})
    is_first_user = user_count == 0

    # --- AJOUT DEVISE : Ajout de la devise par défaut à la création ---
    new_user_data = {
        "id": user_id,
        "email": user.email,
        "hashed_password": hashed_password,
        "is_verified": is_first_user,
        "mfa_enabled": False, 
        "mfa_secret": None,
        "currency": "EUR" # Devise par défaut
    }
    # --- FIN AJOUT DEVISE ---
    
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
        except Exception as e:
            print(f"Échec de l'envoi de l'e-mail, l'utilisateur n'a PAS été créé: {e}")
            raise HTTPException(status_code=500, detail="Impossible d'envoyer l'e-mail de vérification. Vos identifiants SendGrid sont-ils corrects ?")
        
        await users_collection.insert_one(new_user_data)
        await initialize_default_categories(user_id)
            
    return UserPublic(**new_user_data)


@app.post("/api/auth/token", response_model=TokenResponse) 
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
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
            detail="Email not verified. Please check your inbox for a verification link.",
        )
    
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
async def mfa_login(mfa_data: MfaLoginRequest):
    try:
        email = await get_email_from_mfa_token(mfa_data.mfa_token)
    except HTTPException as e:
        raise e 
        
    user = await get_user(email)
    if not user or not user.mfa_enabled or not user.mfa_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA is not enabled for this user.")
        
    if not verify_mfa_code(user.mfa_secret, mfa_data.mfa_code):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code.")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "scope": "access"}, 
        expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")


@app.get("/api/auth/verify-email")
async def verify_email_route(token: str):
    try:
        email = await get_email_from_verification_token(token)
    except HTTPException as e:
        raise e
    
    user = await get_user(email)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_verified:
        return {"message": "Email is already verified"}
        
    result = await users_collection.update_one(
        {"email": email},
        {"$set": {"is_verified": True}}
    )
    
    if result.modified_count == 1:
        return {"message": "Email verified successfully. You can now log in."}
    else:
        raise HTTPException(status_code=500, detail="Failed to update user verification status")

@app.post("/api/auth/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    user = await get_user(data.email)
    if user:
        try:
            password_reset_token = create_password_reset_token(user.email)
            send_password_reset_email(user.email, password_reset_token)
        except Exception as e:
            print(f"ERREUR CRITIQUE lors de l'envoi de l'e-mail de réinitialisation: {e}")
            pass
    return {"message": "If an account with that email exists, a password reset link has been sent."}

@app.post("/api/auth/reset-password")
async def reset_password(data: ResetPasswordRequest):
    try:
        email = await get_email_from_password_reset_token(data.token)
    except HTTPException as e:
        raise e 
    
    user = await get_user(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(data.new_password) < 8:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )
            
    new_hashed_password = get_password_hash(data.new_password)
    
    await users_collection.update_one(
        {"id": user.id},
        {"$set": {"hashed_password": new_hashed_password}}
    )
    
    return {"message": "Password updated successfully. You can now log in."}


# --- AJOUT DEVISE : Mise à jour de /api/users/me ---
@app.get("/api/users/me", response_model=UserPublic)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur connecté (y compris la devise)"""
    return current_user
# --- FIN AJOUT DEVISE ---

@app.put("/api/users/me/change-password")
async def change_password(
    password_data: PasswordChangeRequest, 
    current_user: UserInDB = Depends(get_current_user)
):
    
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password",
        )
        
    if len(password_data.new_password) < 8:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )
            
    new_hashed_password = get_password_hash(password_data.new_password)
    
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {"hashed_password": new_hashed_password}}
    )
    
    return {"message": "Password updated successfully"}

# --- AJOUT DEVISE : Nouvelle route pour changer la devise ---
@app.put("/api/users/me/currency")
async def update_user_currency(
    currency_data: CurrencyUpdateRequest,
    current_user: UserInDB = Depends(get_current_user)
):
    """Met à jour la devise préférée de l'utilisateur."""
    
    new_currency = currency_data.currency.upper()
    
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {"currency": new_currency}}
    )
    
    return {"message": "Currency updated successfully", "currency": new_currency}
# --- FIN AJOUT DEVISE ---


# --- Routes MFA (Identiques) ---

@app.get("/api/mfa/setup", response_model=MfaSetupResponse)
async def mfa_setup_generate(current_user: UserInDB = Depends(get_current_user)):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled.")
    secret_key = pyotp.random_base32()
    qr_code_uri = generate_qr_code_data_uri(current_user.email, secret_key)
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {"mfa_secret": secret_key, "mfa_enabled": False}} 
    )
    return MfaSetupResponse(secret_key=secret_key, qr_code_data_uri=qr_code_uri)


@app.post("/api/mfa/verify")
async def mfa_setup_verify(
    mfa_data: MfaVerifyRequest, 
    current_user: UserInDB = Depends(get_current_user)
):
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled.")
    if not current_user.mfa_secret:
        raise HTTPException(status_code=400, detail="MFA setup has not been initiated.")
    if not verify_mfa_code(current_user.mfa_secret, mfa_data.mfa_code):
        raise HTTPException(status_code=400, detail="Invalid MFA code.")
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {"mfa_enabled": True}}
    )
    return {"message": "MFA enabled successfully."}


@app.post("/api/mfa/disable")
async def mfa_disable(
    mfa_data: MfaDisableRequest, 
    current_user: UserInDB = Depends(get_current_user)
):
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled.")
    if not verify_password(mfa_data.password, current_user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    if not verify_mfa_code(current_user.mfa_secret, mfa_data.mfa_code):
        raise HTTPException(status_code=401, detail="Invalid MFA code.")
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {"mfa_enabled": False, "mfa_secret": None}}
    )
    return {"message": "MFA disabled successfully."}
# --- FIN DES Routes MFA ---


# ---
# --- DÉBUT DES ROUTES MÉTIER ---
# ---

@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Category Routes (Sécurisées)
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
        await categories_collection.update_one(
            {"id": category_id, "user_id": current_user.id}, 
            {"$set": update_data}
        )
    
    updated = await categories_collection.find_one({"id": category_id, "user_id": current_user.id})
    return {"id": updated["id"], "name": updated["name"], "type": updated["type"], "created_at": updated["created_at"]}

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await categories_collection.find_one({"id": category_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="Category not found")
    
    await subcategories_collection.delete_many({"category_id": category_id, "user_id": current_user.id})
    
    await transactions_collection.update_many(
        {"category_id": category_id, "user_id": current_user.id},
        {"$set": {"category_id": None, "subcategory_id": None}}
    )
    
    await budgets_collection.delete_many({"category_id": category_id, "user_id": current_user.id})
    
    await categories_collection.delete_one({"id": category_id, "user_id": current_user.id})
    return {"message": "Category deleted successfully"}

# SubCategory Routes (Sécurisées)
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
        await subcategories_collection.update_one(
            {"id": subcategory_id, "user_id": current_user.id}, 
            {"$set": update_data}
        )
    
    updated = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user.id})
    return {"id": updated["id"], "category_id": updated["category_id"], "name": updated["name"], "created_at": updated["created_at"]}

@app.delete("/api/subcategories/{subcategory_id}")
async def delete_subcategory(subcategory_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user.id})
    if not existing: raise HTTPException(status_code=404, detail="SubCategory not found")
    
    await transactions_collection.update_many(
        {"subcategory_id": subcategory_id, "user_id": current_user.id},
        {"$set": {"subcategory_id": None}}
    )
    
    await subcategories_collection.delete_one({"id": subcategory_id, "user_id": current_user.id})
    return {"message": "SubCategory deleted successfully"}

# Transaction Routes (Corrigées)
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
    
    if category_id:
        query["category_id"] = category_id
    
    if search:
        query["description"] = {"$regex": search, "$options": "i"}
    
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
    
    if not new_transactions_data:
        raise HTTPException(status_code=400, detail="No transactions to import.")

    try:
        await transactions_collection.insert_many(new_transactions_data, ordered=False)
        return {"message": f"{len(new_transactions_data)} transactions imported successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during bulk insert: {e}")

@app.put("/api/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, transaction: TransactionUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {k: v for k, v in transaction.dict(exclude_unset=True).items()}
    if update_data:
        await transactions_collection.update_one(
            {"id": transaction_id, "user_id": current_user.id}, 
            {"$set": update_data}
        )
    
    updated = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    return updated

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    await transactions_collection.delete_one({"id": transaction_id, "user_id": current_user.id})
    return {"message": "Transaction deleted successfully"}

# Recurring Transaction Routes (Corrigées)
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
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    update_data = {k: v for k, v in recurring.dict(exclude_unset=True).items()}
    if update_data:
        await recurring_transactions_collection.update_one(
            {"id": recurring_id, "user_id": current_user.id}, 
            {"$set": update_data}
        )
    
    updated = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user.id})
    return updated

@app.delete("/api/recurring-transactions/{recurring_id}")
async def delete_recurring_transaction(recurring_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    await recurring_transactions_collection.delete_one({"id": recurring_id, "user_id": current_user.id})
    return {"message": "Recurring transaction deleted successfully"}

@app.post("/api/recurring-transactions/generate")
async def generate_recurring_transactions(current_user: UserInDB = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    current_month, current_year, current_day = now.month, now.year, now.day
    
    recurring_list = await recurring_transactions_collection.find({"user_id": current_user.id}).to_list(None)
    generated_count = 0
    
    for recurring in recurring_list:
        if recurring["frequency"] == "Mensuel" and current_day >= recurring["day_of_month"]:
            existing = await transactions_collection.find_one({
                "user_id": current_user.id, "description": recurring.get("description"),
                "amount": recurring["amount"], "type": recurring["type"],
                "date": {
                    "$gte": datetime(current_year, current_month, 1, tzinfo=timezone.utc),
                    "$lt": datetime(current_year, current_month + 1 if current_month < 12 else 1, 1, tzinfo=timezone.utc)
                }
            })
            
            if not existing:
                transaction_id = str(uuid.uuid4())
                transaction_date = datetime(current_year, current_month, recurring["day_of_month"], tzinfo=timezone.utc)
                await transactions_collection.insert_one({
                    "id": transaction_id, "user_id": current_user.id, "date": transaction_date,
                    "amount": recurring["amount"], "type": recurring["type"],
                    "description": recurring.get("description"), "category_id": recurring.get("category_id"),
                    "subcategory_id": recurring.get("subcategory_id"), "created_at": datetime.now(timezone.utc)
                })
                generated_count += 1
    
    return {"message": f"{generated_count} transactions generated", "count": generated_count}

# --- Routes pour les Budgets ---

@app.get("/api/budgets")
async def get_budgets(current_user: UserInDB = Depends(get_current_user)):
    budgets = await budgets_collection.find({"user_id": current_user.id}).to_list(None)
    return [{
        "id": b["id"], "user_id": b["user_id"], "category_id": b["category_id"],
        "amount": b["amount"], "created_at": b["created_at"]
    } for b in budgets]

@app.post("/api/budgets")
async def create_budget(budget: BudgetCreate, current_user: UserInDB = Depends(get_current_user)):
    
    category = await categories_collection.find_one({
        "id": budget.category_id, 
        "user_id": current_user.id
    })
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    existing_budget = await budgets_collection.find_one({
        "user_id": current_user.id,
        "category_id": budget.category_id
    })
    if existing_budget:
        raise HTTPException(status_code=400, detail="A budget for this category already exists. Please update the existing one.")

    budget_id = str(uuid.uuid4())
    new_budget_data = {
        "id": budget_id,
        "user_id": current_user.id,
        "category_id": budget.category_id,
        "amount": budget.amount,
        "created_at": datetime.now(timezone.utc)
    }
    await budgets_collection.insert_one(new_budget_data.copy())
    return new_budget_data

@app.put("/api/budgets/{budget_id}")
async def update_budget(budget_id: str, budget: BudgetUpdate, current_user: UserInDB = Depends(get_current_user)):
    
    existing = await budgets_collection.find_one({
        "id": budget_id, 
        "user_id": current_user.id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    update_data = {"amount": budget.amount}
    await budgets_collection.update_one(
        {"id": budget_id, "user_id": current_user.id},
        {"$set": update_data}
    )
    
    updated = await budgets_collection.find_one({"id": budget_id, "user_id": current_user.id})
    return updated

@app.delete("/api/budgets/{budget_id}")
async def delete_budget(budget_id: str, current_user: UserInDB = Depends(get_current_user)):
    
    existing = await budgets_collection.find_one({
        "id": budget_id, 
        "user_id": current_user.id
    })
    if not existing:
        raise HTTPException(status_code=404, detail="Budget not found")
        
    await budgets_collection.delete_one({"id": budget_id, "user_id": current_user.id})
    
    return {"message": "Budget deleted successfully"}

# --- FIN Routes Budgets ---


# ---
# --- MISE À JOUR MAJEURE : Dashboard Statistics ---
# ---
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(
    start_date_str: Optional[str] = None, 
    end_date_str: Optional[str] = None, 
    current_user: UserInDB = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    # --- 1. Calcul de l'épargne globale (identique) ---
    global_revenus = 0
    global_depenses = 0
    pipeline_revenus = [
        {"$match": {"type": "Revenu", "user_id": current_user.id}}, 
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenus_result = await transactions_collection.aggregate(pipeline_revenus).to_list(None)
    if revenus_result: global_revenus = revenus_result[0]['total']
    pipeline_depenses = [
        {"$match": {"type": "Dépense", "user_id": current_user.id}}, 
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    depenses_result = await transactions_collection.aggregate(pipeline_depenses).to_list(None)
    if depenses_result: global_depenses = depenses_result[0]['total']
    global_epargne_totale = global_revenus - global_depenses
    
    # --- 2. Définition de la période (identique) ---
    start_date, end_date, display_period = None, None, ""
    month_names_full = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

    if start_date_str and end_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            temp_end_date_display = datetime.fromisoformat(end_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            end_date = temp_end_date_display + timedelta(days=1)
            display_period = f"{start_date.strftime('%d/%m/%Y')} - {temp_end_date_display.strftime('%d/%m/%Y')}"
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")
    else:
        start_date = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12: end_date = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else: end_date = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
        display_period = f"{month_names_full[now.month - 1]} {now.year}"
    
    target_year = start_date.year
    
    # --- 3. Calculs des stats de la période (identique) ---
    period_transactions = await transactions_collection.find({
        "date": {"$gte": start_date, "$lt": end_date},
        "user_id": current_user.id
    }).to_list(None)
    
    revenus = sum(t["amount"] for t in period_transactions if t["type"] == "Revenu")
    depenses = sum(t["amount"] for t in period_transactions if t["type"] == "Dépense")
    epargne = revenus - depenses
    
    # --- 4. Camembert Dépenses (identique) ---
    pipeline = [
        {"$match": {"date": {"$gte": start_date, "$lt": end_date}, "type": "Dépense", "user_id": current_user.id}},
        {"$group": { "_id": "$category_id", "value": {"$sum": "$amount"} } },
        {"$lookup": { "from": "categories", "localField": "_id", "foreignField": "id", "as": "category_details" } },
        {"$unwind": "$category_details"},
        {"$project": { "_id": 0, "name": "$category_details.name", "value": "$value" } }
    ]
    expense_breakdown = await transactions_collection.aggregate(pipeline).to_list(None)

    # --- 5. Graphique Barres (identique) ---
    monthly_data = []
    month_names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
    
    for i in range(12):
        month_num = i + 1
        month_start = datetime(target_year, month_num, 1, tzinfo=timezone.utc)
        if month_num == 12: month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else: month_end = datetime(target_year, month_num + 1, 1, tzinfo=timezone.utc)
        
        month_transactions = await transactions_collection.find({
            "date": {"$gte": month_start, "$lt": month_end}, "user_id": current_user.id
        }).to_list(None)
        
        month_revenus = sum(t["amount"] for t in month_transactions if t["type"] == "Revenu")
        month_depenses = sum(t["amount"] for t in month_transactions if t["type"] == "Dépense")
        
        monthly_data.append({
            "month": month_names[i], "revenus": month_revenus, "depenses": month_depenses
        })
    
    # --- 6. Calcul de la progression des budgets ---
    budget_progress = []
    
    user_budgets = await budgets_collection.find({"user_id": current_user.id}).to_list(None)
    
    user_categories = await categories_collection.find({"user_id": current_user.id}).to_list(None)
    category_name_map = {cat["id"]: cat["name"] for cat in user_categories}
    
    spending_by_category = {}
    for t in period_transactions:
        if t["type"] == "Dépense" and t.get("category_id"):
            cat_id = t["category_id"]
            spending_by_category[cat_id] = spending_by_category.get(cat_id, 0) + t["amount"]
            
    for budget in user_budgets:
        cat_id = budget["category_id"]
        amount_budgeted = budget["amount"]
        amount_spent = spending_by_category.get(cat_id, 0)
        
        budget_progress.append({
            "id": budget["id"],
            "category_id": cat_id,
            "category_name": category_name_map.get(cat_id, "Catégorie inconnue"),
            "amount_budgeted": amount_budgeted,
            "amount_spent": amount_spent,
            "remaining": amount_budgeted - amount_spent
        })
    # --- FIN NOUVEAUTÉ ---

    # --- 7. NOUVEAU : Calcul des prévisions de fin de mois ---
    current_day = now.day
    
    # Initialiser les valeurs de prévision
    total_upcoming_change = 0.0
    upcoming_transactions_list = []
    
    # Récupérer toutes les transactions récurrentes mensuelles
    all_recurring = await recurring_transactions_collection.find({
        "user_id": current_user.id,
        "frequency": "Mensuel"
    }).to_list(None)

    # Gère le cas où il n'y a pas de transactions récurrentes (votre remarque)
    if all_recurring:
        for trans in all_recurring:
            # On ne compte que les transactions qui n'ont pas encore eu lieu ce mois-ci
            if trans["day_of_month"] > current_day: # Changé de >= à >
                amount = trans["amount"]
                if trans["type"] == "Dépense":
                    total_upcoming_change -= amount
                elif trans["type"] == "Revenu":
                    total_upcoming_change += amount
                
                # Ajouter à la liste pour l'affichage sur le dashboard
                upcoming_transactions_list.append({
                    "description": trans.get("description", "Transaction récurrente"),
                    "amount": amount,
                    "type": trans["type"],
                    "day_of_month": trans["day_of_month"]
                })

    # Trier la liste par date pour l'affichage
    upcoming_transactions_list.sort(key=lambda x: x["day_of_month"])

    # Le solde estimé est le solde global ACTUEL + tous les changements à venir
    estimated_end_of_month_balance = global_epargne_totale + total_upcoming_change
    # --- FIN NOUVEAU CALCUL ---
    
    
    # --- 8. Retourner la réponse complète (avec la nouvelle clé) ---
    return {
        "revenus_total": revenus,
        "depenses_total": depenses,
        "epargne_total": epargne,
        "monthly_data": monthly_data,
        "expense_breakdown": expense_breakdown,
        "display_period": display_period,
        "global_epargne_totale": global_epargne_totale,
        "budget_progress": budget_progress,
        
        # --- AJOUT PRÉVISIONS ---
        "upcoming_transactions_list": upcoming_transactions_list,
        "total_upcoming_change": total_upcoming_change,
        "estimated_end_of_month_balance": estimated_end_of_month_balance
        # --- FIN AJOUT PRÉVISIONS ---
    }


# Lancement du serveur (Identique)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)