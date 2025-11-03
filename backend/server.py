from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import uuid
from passlib.context import CryptContext
from jose import JWTError, jwt

# --- Configuration de la Sécurité (Nouveau) ---

# Contexte de hachage pour les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Clé secrète pour les JWT (JSON Web Tokens)
# !! IMPORTANT : À définir dans vos variables d'environnement (ex: sur Render) !!
SECRET_KEY = os.getenv("SECRET_KEY", "u8!l$058fy+bhkeg7z$73=n8m=keb!tp9ys7si2)4$a0i&6%9l")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 jours

# Schéma OAuth2 pour la récupération du token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# --- Initialisation de FastAPI ---
app = FastAPI()

# Configuration CORS (Identique)
origins = [
    "https://budget-1-fbg6.onrender.com",
    "http://localhost:3000"
]

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

# Collections (Ajout de 'users')
users_collection = db.users
transactions_collection = db.transactions
categories_collection = db.categories
subcategories_collection = db.subcategories
recurring_transactions_collection = db.recurring_transactions

# --- Modèles Pydantic (Mis à jour) ---

# Nouveaux modèles pour l'authentification
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserPublic(UserBase):
    id: str

class UserInDB(UserPublic):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Modèles de données existants (Mis à jour avec user_id)
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

# ---
# --- DÉBUT DE LA MODIFICATION (Ajout Modèle) ---
# ---
class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
# ---
# --- FIN DE LA MODIFICATION ---
# ---


# --- Utilitaires de Sécurité (Nouveau) ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Vérifie un mot de passe haché"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hache un mot de passe"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crée un token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_user(email: str) -> Optional[UserInDB]:
    """Récupère un utilisateur depuis la DB par email"""
    user = await users_collection.find_one({"email": email})
    if user:
        return UserInDB(**user)
    return None

async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserInDB:
    """Décode le token JWT et retourne l'utilisateur actuel"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except JWTError:
        raise credentials_exception
    
    user = await get_user(token_data.email)
    if user is None:
        raise credentials_exception
    return user

# --- Gestion des Catégories par Défaut (Mis à jour) ---

DEFAULT_CATEGORIES = [
    {"name": "Salaire", "type": "Revenu"},
    {"name": "Aide Papa", "type": "Revenu"},
    {"name": "Autres revenu", "type": "Revenu"},
    {"name": "Logement", "type": "Dépense"},
    {"name": "Alimentation", "type": "Dépense"},
    {"name": "Transport", "type": "Dépense"},
    {"name": "Santé", "type": "Dépense"},
    {"name": "Loisirs", "type": "Dépense"},
    {"name": "Abonnements", "type": "Dépense"},
    {"name": "Shopping", "type": "Dépense"},
    {"name": "Autre dépense", "type": "Dépense"},
    {"name": "Cadeaux", "type": "Dépense"},
    {"name": "Coiffeur", "type": "Dépense"},
    {"name": "Prêt", "type": "Dépense"},
    {"name": "Restaurant", "type": "Dépense"},
    {"name": "Investissement", "type": "Dépense"},
    {"name": "Etudes", "type": "Dépense"},
    {"name": "Vacances", "type": "Dépense"},
]

async def initialize_default_categories(user_id: str):
    """Crée les catégories par défaut pour un NOUVEL utilisateur"""
    existing_count = await categories_collection.count_documents({"user_id": user_id})
    if existing_count == 0:
        for cat in DEFAULT_CATEGORIES:
            category_id = str(uuid.uuid4())
            await categories_collection.insert_one({
                "id": category_id,
                "user_id": user_id, # Ajouté
                "name": cat["name"],
                "type": cat["type"],
                "created_at": datetime.now(timezone.utc)
            })

# --- Routes d'Authentification (Nouveau) ---

@app.post("/api/auth/register", response_model=UserPublic)
async def register_user(user: UserCreate):
    """Crée un nouvel utilisateur"""
    existing_user = await get_user(user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    user_id = str(uuid.uuid4())
    
    new_user_data = {
        "id": user_id,
        "email": user.email,
        "hashed_password": hashed_password
    }
    
    await users_collection.insert_one(new_user_data)
    
    # --- Logique de Migration / Initialisation ---
    # Compte le nombre total d'utilisateurs *après* l'insertion
    user_count = await users_collection.count_documents({})
    
    if user_count == 1:
        # C'est le PREMIER utilisateur. On lui attribue toutes les données orphelines.
        await transactions_collection.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": user_id}}
        )
        await categories_collection.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": user_id}}
        )
        await subcategories_collection.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": user_id}}
        )
        await recurring_transactions_collection.update_many(
            {"user_id": {"$exists": False}},
            {"$set": {"user_id": user_id}}
        )
    else:
        # C'est un utilisateur suivant. On crée juste ses catégories par défaut.
        await initialize_default_categories(user_id)
        
    return UserPublic(id=user_id, email=user.email)


@app.post("/api/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Fournit un token d'accès"""
    user = await get_user(form_data.username) # form_data.username est l'email
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/users/me", response_model=UserPublic)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    """Retourne les informations de l'utilisateur connecté"""
    return UserPublic(id=current_user.id, email=current_user.email)

# ---
# --- DÉBUT DE LA MODIFICATION (Ajout Endpoint) ---
# ---
@app.put("/api/users/me/change-password")
async def change_password(
    password_data: PasswordChangeRequest, 
    current_user: UserInDB = Depends(get_current_user)
):
    """Modifie le mot de passe de l'utilisateur connecté"""
    
    # 1. Vérifier si l'ancien mot de passe est correct
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect current password",
        )
        
    # 2. (Optionnel) Validation de la longueur du nouveau mot de passe
    if len(password_data.new_password) < 8:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long",
        )
            
    # 3. Hacher le nouveau mot de passe
    new_hashed_password = get_password_hash(password_data.new_password)
    
    # 4. Mettre à jour le mot de passe dans la base de données
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {"hashed_password": new_hashed_password}}
    )
    
    return {"message": "Password updated successfully"}
# ---
# --- FIN DE LA MODIFICATION ---
# ---


# --- Routes Métier (Sécurisées) ---

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
        "id": category_id,
        "user_id": current_user.id, # Sécurisé
        "name": category.name,
        "type": category.type,
        "created_at": datetime.now(timezone.utc)
    }
    await categories_collection.insert_one(new_category_data.copy())
    return new_category_data

@app.put("/api/categories/{category_id}")
async def update_category(category_id: str, category: CategoryUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await categories_collection.find_one({"id": category_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
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
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Supprime les sous-catégories de l'utilisateur liées
    await subcategories_collection.delete_many({"category_id": category_id, "user_id": current_user.id})
    
    # Met à jour les transactions de l'utilisateur liées
    await transactions_collection.update_many(
        {"category_id": category_id, "user_id": current_user.id},
        {"$set": {"category_id": None, "subcategory_id": None}}
    )
    
    await categories_collection.delete_one({"id": category_id, "user_id": current_user.id})
    return {"message": "Category deleted successfully"}

# SubCategory Routes (Sécurisées)
@app.get("/api/subcategories")
async def get_subcategories(current_user: UserInDB = Depends(get_current_user)):
    subcategories = await subcategories_collection.find({"user_id": current_user.id}).to_list(None)
    return [{"id": sub["id"], "category_id": sub["category_id"], "name": sub["name"], "created_at": sub["created_at"]} for sub in subcategories]

@app.post("/api/subcategories")
async def create_subcategory(subcategory: SubCategoryCreate, current_user: UserInDB = Depends(get_current_user)):
    # Vérifie que la catégorie parente appartient à l'utilisateur
    category = await categories_collection.find_one({"id": subcategory.category_id, "user_id": current_user.id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    subcategory_id = str(uuid.uuid4())
    new_subcategory_data = {
        "id": subcategory_id,
        "user_id": current_user.id, # Sécurisé
        "category_id": subcategory.category_id,
        "name": subcategory.name,
        "created_at": datetime.now(timezone.utc)
    }
    await subcategories_collection.insert_one(new_subcategory_data.copy())
    return new_subcategory_data

@app.put("/api/subcategories/{subcategory_id}")
async def update_subcategory(subcategory_id: str, subcategory: SubCategoryUpdate, current_user: UserInDB = Depends(get_current_user)):
    existing = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="SubCategory not found")
    
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
    if not existing:
        raise HTTPException(status_code=404, detail="SubCategory not found")
    
    # Met à jour les transactions de l'utilisateur liées
    await transactions_collection.update_many(
        {"subcategory_id": subcategory_id, "user_id": current_user.id},
        {"$set": {"subcategory_id": None}}
    )
    
    await subcategories_collection.delete_one({"id": subcategory_id, "user_id": current_user.id})
    return {"message": "SubCategory deleted successfully"}

# Transaction Routes (Sécurisées)
@app.get("/api/transactions")
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_current_user)
):
    query = {"user_id": current_user.id} # Sécurisé
    
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
        "id": t["id"],
        "date": t["date"],
        "amount": t["amount"],
        "type": t["type"],
        "description": t.get("description"),
        "category_id": t.get("category_id"),
        "subcategory_id": t.get("subcategory_id"),
        "created_at": t["created_at"]
    } for t in transactions]

@app.post("/api/transactions")
async def create_transaction(transaction: TransactionCreate, current_user: UserInDB = Depends(get_current_user)):
    transaction_id = str(uuid.uuid4())
    new_transaction_data = {
        "id": transaction_id,
        "user_id": current_user.id, # Sécurisé
        "date": transaction.date,
        "amount": transaction.amount,
        "type": transaction.type,
        "description": transaction.description,
        "category_id": transaction.category_id,
        "subcategory_id": transaction.subcategory_id,
        "created_at": datetime.now(timezone.utc)
    }
    await transactions_collection.insert_one(new_transaction_data.copy())
    return new_transaction_data

@app.post("/api/transactions/bulk")
async def create_bulk_transactions(data: TransactionBulk, current_user: UserInDB = Depends(get_current_user)):
    new_transactions_data = []
    for transaction in data.transactions:
        transaction_id = str(uuid.uuid4())
        new_transaction_data = {
            "id": transaction_id,
            "user_id": current_user.id, # Sécurisé
            "date": transaction.date,
            "amount": transaction.amount,
            "type": transaction.type,
            "description": transaction.description,
            "category_id": transaction.category_id,
            "subcategory_id": transaction.subcategory_id,
            "created_at": datetime.now(timezone.utc)
        }
        new_transactions_data.append(new_transaction_data)
    
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
    return {
        "id": updated["id"],
        "date": updated["date"],
        "amount": updated["amount"],
        "type": updated["type"],
        "description": updated.get("description"),
        "category_id": updated.get("category_id"),
        "subcategory_id": updated.get("subcategory_id"),
        "created_at": updated["created_at"]
    }

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    await transactions_collection.delete_one({"id": transaction_id, "user_id": current_user.id})
    return {"message": "Transaction deleted successfully"}

# Recurring Transaction Routes (Sécurisées)
@app.get("/api/recurring-transactions")
async def get_recurring_transactions(current_user: UserInDB = Depends(get_current_user)):
    recurring = await recurring_transactions_collection.find({"user_id": current_user.id}).to_list(None)
    return [{
        "id": r["id"],
        "amount": r["amount"],
        "type": r["type"],
        "description": r.get("description"),
        "category_id": r.get("category_id"),
        "subcategory_id": r.get("subcategory_id"),
        "frequency": r["frequency"],
        "day_of_month": r["day_of_month"],
        "created_at": r["created_at"]
    } for r in recurring]

@app.post("/api/recurring-transactions")
async def create_recurring_transaction(recurring: RecurringTransactionCreate, current_user: UserInDB = Depends(get_current_user)):
    recurring_id = str(uuid.uuid4())
    new_recurring_data = {
        "id": recurring_id,
        "user_id": current_user.id, # Sécurisé
        "amount": recurring.amount,
        "type": recurring.type,
        "description": recurring.description,
        "category_id": recurring.category_id,
        "subcategory_id": recurring.subcategory_id,
        "frequency": recurring.frequency,
        "day_of_month": recurring.day_of_month,
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
    return {
        "id": updated["id"],
        "amount": updated["amount"],
        "type": updated["type"],
        "description": updated.get("description"),
        "category_id": updated.get("category_id"),
        "subcategory_id": updated.get("subcategory_id"),
        "frequency": updated["frequency"],
        "day_of_month": updated["day_of_month"],
        "created_at": updated["created_at"]
    }

@app.delete("/api/recurring-transactions/{recurring_id}")
async def delete_recurring_transaction(recurring_id: str, current_user: UserInDB = Depends(get_current_user)):
    existing = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user.id})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    await recurring_transactions_collection.delete_one({"id": recurring_id, "user_id": current_user.id})
    return {"message": "Recurring transaction deleted successfully"}

@app.post("/api/recurring-transactions/generate")
async def generate_recurring_transactions(current_user: UserInDB = Depends(get_current_user)):
    """Génère les transactions récurrentes de l'utilisateur pour le mois actuel"""
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year
    current_day = now.day
    
    recurring_list = await recurring_transactions_collection.find({"user_id": current_user.id}).to_list(None)
    generated_count = 0
    
    for recurring in recurring_list:
        if recurring["frequency"] == "Mensuel" and current_day >= recurring["day_of_month"]:
            # Vérifie si une transaction similaire existe DEJA pour CE MOIS et CET UTILISATEUR
            existing = await transactions_collection.find_one({
                "user_id": current_user.id, # Sécurisé
                "description": recurring.get("description"),
                "amount": recurring["amount"],
                "type": recurring["type"],
                "date": {
                    "$gte": datetime(current_year, current_month, 1, tzinfo=timezone.utc),
                    "$lt": datetime(current_year, current_month + 1 if current_month < 12 else 1, 1, tzinfo=timezone.utc)
                }
            })
            
            if not existing:
                transaction_id = str(uuid.uuid4())
                transaction_date = datetime(current_year, current_month, recurring["day_of_month"], tzinfo=timezone.utc)
                await transactions_collection.insert_one({
                    "id": transaction_id,
                    "user_id": current_user.id, # Sécurisé
                    "date": transaction_date,
                    "amount": recurring["amount"],
                    "type": recurring["type"],
                    "description": recurring.get("description"),
                    "category_id": recurring.get("category_id"),
                    "subcategory_id": recurring.get("subcategory_id"),
                    "created_at": datetime.now(timezone.utc)
                })
                generated_count += 1
    
    return {"message": f"{generated_count} transactions generated", "count": generated_count}

# ---
# --- DÉBUT DE LA MODIFICATION (Dashboard) ---
# ---

# Dashboard Statistics (Sécurisé)
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(
    # Remplacement de 'year' et 'month' par des dates en string (format YYYY-MM-DD)
    start_date_str: Optional[str] = None, 
    end_date_str: Optional[str] = None, 
    current_user: UserInDB = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    
    # --- Épargne globale (pour l'utilisateur) ---
    # (Logique inchangée)
    global_revenus = 0
    global_depenses = 0
    
    pipeline_revenus = [
        {"$match": {"type": "Revenu", "user_id": current_user.id}}, # Sécurisé
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenus_result = await transactions_collection.aggregate(pipeline_revenus).to_list(None)
    if revenus_result:
        global_revenus = revenus_result[0]['total']

    pipeline_depenses = [
        {"$match": {"type": "Dépense", "user_id": current_user.id}}, # Sécurisé
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    depenses_result = await transactions_collection.aggregate(pipeline_depenses).to_list(None)
    if depenses_result:
        global_depenses = depenses_result[0]['total']

    global_epargne_totale = global_revenus - global_depenses
    # --- Fin Épargne globale ---

    # --- NOUVELLE Logique de Période ---
    start_date = None
    end_date = None
    display_period = ""
    month_names_full = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

    if start_date_str and end_date_str:
        try:
            # start_date est le début du jour (00:00:00)
            start_date = datetime.fromisoformat(start_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            
            # Date de fin (inclusive) pour l'affichage
            temp_end_date_display = datetime.fromisoformat(end_date_str).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
            
            # end_date pour la requête est le *début* du jour *suivant* (pour une requête $lt)
            end_date = temp_end_date_display + timedelta(days=1)
            
            # Formatage de la période d'affichage en français
            display_period = f"{start_date.strftime('%d/%m/%Y')} - {temp_end_date_display.strftime('%d/%m/%Y')}"
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Please use YYYY-MM-DD.")
    else:
        # Défaut: Si aucune date n'est fournie, afficher le mois actuel
        start_date = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12:
            end_date = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end_date = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
        
        display_period = f"{month_names_full[now.month - 1]} {now.year}"
    
    # L'année cible pour le graphique en barres sera l'année de la date de DÉBUT
    target_year = start_date.year
    # --- FIN NOUVELLE Logique de Période ---

    # 1. Stats Période (utilise les nouvelles start_date/end_date)
    period_transactions = await transactions_collection.find({
        "date": {"$gte": start_date, "$lt": end_date},
        "user_id": current_user.id # Sécurisé
    }).to_list(None)
    
    revenus = sum(t["amount"] for t in period_transactions if t["type"] == "Revenu")
    depenses = sum(t["amount"] for t in period_transactions if t["type"] == "Dépense")
    epargne = revenus - depenses
    
    # 2. Camembert Dépenses (utilise les nouvelles start_date/end_date)
    pipeline = [
        {
            "$match": {
                "date": {"$gte": start_date, "$lt": end_date},
                "type": "Dépense",
                "user_id": current_user.id # Sécurisé
            }
        },
        {
            "$group": {
                "_id": "$category_id",
                "value": {"$sum": "$amount"}
            }
        },
        {
            "$lookup": {
                "from": "categories",
                "localField": "_id",
                "foreignField": "id",
                "as": "category_details"
            }
        },
        {
            "$unwind": "$category_details"
        },
        {
            "$project": {
                "_id": 0,
                "name": "$category_details.name",
                "value": "$value"
            }
        }
    ]
    expense_breakdown_cursor = transactions_collection.aggregate(pipeline)
    expense_breakdown = await expense_breakdown_cursor.to_list(None)

    # 3. Graphique Barres (utilise target_year, logique inchangée)
    # Affiche toujours les 12 mois de l'année de la date de début
    monthly_data = []
    month_names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
    
    for i in range(12):
        month_num = i + 1
        month_start = datetime(target_year, month_num, 1, tzinfo=timezone.utc)
        if month_num == 12:
            month_end = datetime(target_year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(target_year, month_num + 1, 1, tzinfo=timezone.utc)
        
        month_transactions = await transactions_collection.find({
            "date": {"$gte": month_start, "$lt": month_end},
            "user_id": current_user.id # Sécurisé
        }).to_list(None)
        
        month_revenus = sum(t["amount"] for t in month_transactions if t["type"] == "Revenu")
        month_depenses = sum(t["amount"] for t in month_transactions if t["type"] == "Dépense")
        
        monthly_data.append({
            "month": month_names[i],
            "revenus": month_revenus,
            "depenses": month_depenses
        })
    
    return {
        "revenus_total": revenus,
        "depenses_total": depenses,
        "epargne_total": epargne,
        "monthly_data": monthly_data,
        "expense_breakdown": expense_breakdown,
        "display_period": display_period,
        "global_epargne_totale": global_epargne_totale
    }
# ---
# --- FIN DE LA MODIFICATION (Dashboard) ---
# ---


# Lancement du serveur (Identique)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)