from fastapi import FastAPI, HTTPException, Depends, Cookie, Response, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Annotated
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import os
import httpx
import uuid

app = FastAPI()

# CORS Configuration
# Spécifier explicitement les origines autorisées pour permettre l'envoi de credentials (cookies)
# allow_origins=["*"] n'est pas compatible avec allow_credentials=True
origins = [
    "https://budget-frontend.onrender.com",
    "http://localhost:3000"  # Pour les tests locaux
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB Connection
MONGO_URL = os.getenv("MONGO_URL", "mongodb://mongodb:27017/budget_tracker")
client = AsyncIOMotorClient(MONGO_URL)
db = client.budget_tracker

# Collections
users_collection = db.users
sessions_collection = db.sessions
transactions_collection = db.transactions
categories_collection = db.categories
subcategories_collection = db.subcategories
recurring_transactions_collection = db.recurring_transactions

# Models
class User(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class Session(BaseModel):
    session_token: str
    user_id: str
    expires_at: datetime

class Category(BaseModel):
    id: str
    user_id: str
    name: str
    type: str  # "Revenu" or "Dépense"
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
    type: str  # "Revenu" or "Dépense"
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
    frequency: str  # "Mensuel", "Annuel"
    day_of_month: int
    created_at: datetime

# Request Models
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

# Authentication Helper
async def get_current_user(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    token = session_token
    if not token and authorization:
        token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await sessions_collection.find_one({"session_token": token})
    if not session or session["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await users_collection.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

# Default Categories
DEFAULT_CATEGORIES = [
    {"name": "Salaire", "type": "Revenu"},
    {"name": "Prime", "type": "Revenu"},
    {"name": "Autre revenu", "type": "Revenu"},
    {"name": "Logement", "type": "Dépense"},
    {"name": "Alimentation", "type": "Dépense"},
    {"name": "Transport", "type": "Dépense"},
    {"name": "Santé", "type": "Dépense"},
    {"name": "Loisirs", "type": "Dépense"},
    {"name": "Abonnements", "type": "Dépense"},
    {"name": "Shopping", "type": "Dépense"},
    {"name": "Autre dépense", "type": "Dépense"},
]

async def create_default_categories(user_id: str):
    """Create default categories for a new user"""
    for cat in DEFAULT_CATEGORIES:
        category_id = str(uuid.uuid4())
        await categories_collection.insert_one({
            "id": category_id,
            "user_id": user_id,
            "name": cat["name"],
            "type": cat["type"],
            "created_at": datetime.now(timezone.utc)
        })

# Routes
@app.get("/api/health")
async def health():
    return {"status": "ok"}

# Authentication Routes
@app.get("/api/auth/session")
async def get_session(
    x_session_id: Annotated[str, Header()],
    response: Response
):
    """Exchange session_id for session_token and user data"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id}
            )
            resp.raise_for_status()
            user_data = resp.json()
        
        # Check if user exists
        existing_user = await users_collection.find_one({"email": user_data["email"]})
        
        if not existing_user:
            # Create new user
            user_id = str(uuid.uuid4())
            await users_collection.insert_one({
                "id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture"),
                "created_at": datetime.now(timezone.utc)
            })
            # Create default categories
            await create_default_categories(user_id)
        else:
            user_id = existing_user["id"]
        
        # Create session
        session_token = user_data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await sessions_collection.insert_one({
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": expires_at
        })
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        return {
            "user": {
                "id": user_id,
                "email": user_data["email"],
                "name": user_data["name"],
                "picture": user_data.get("picture")
            },
            "session_token": session_token
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "picture": current_user.get("picture")
    }

@app.post("/api/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    if session_token:
        await sessions_collection.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

# Category Routes
@app.get("/api/categories")
async def get_categories(current_user: dict = Depends(get_current_user)):
    categories = await categories_collection.find({"user_id": current_user["id"]}).to_list(None)
    return [{"id": cat["id"], "name": cat["name"], "type": cat["type"], "created_at": cat["created_at"]} for cat in categories]

@app.post("/api/categories")
async def create_category(category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    category_id = str(uuid.uuid4())
    new_category = {
        "id": category_id,
        "user_id": current_user["id"],
        "name": category.name,
        "type": category.type,
        "created_at": datetime.now(timezone.utc)
    }
    await categories_collection.insert_one(new_category)
    return new_category

@app.put("/api/categories/{category_id}")
async def update_category(category_id: str, category: CategoryUpdate, current_user: dict = Depends(get_current_user)):
    existing = await categories_collection.find_one({"id": category_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = {k: v for k, v in category.dict(exclude_unset=True).items()}
    if update_data:
        await categories_collection.update_one({"id": category_id}, {"$set": update_data})
    
    updated = await categories_collection.find_one({"id": category_id})
    return {"id": updated["id"], "name": updated["name"], "type": updated["type"], "created_at": updated["created_at"]}

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(get_current_user)):
    existing = await categories_collection.find_one({"id": category_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Delete associated subcategories
    await subcategories_collection.delete_many({"category_id": category_id})
    
    # Remove category from transactions (set to None)
    await transactions_collection.update_many(
        {"category_id": category_id},
        {"$set": {"category_id": None, "subcategory_id": None}}
    )
    
    await categories_collection.delete_one({"id": category_id})
    return {"message": "Category deleted successfully"}

# SubCategory Routes
@app.get("/api/subcategories")
async def get_subcategories(current_user: dict = Depends(get_current_user)):
    subcategories = await subcategories_collection.find({"user_id": current_user["id"]}).to_list(None)
    return [{"id": sub["id"], "category_id": sub["category_id"], "name": sub["name"], "created_at": sub["created_at"]} for sub in subcategories]

@app.post("/api/subcategories")
async def create_subcategory(subcategory: SubCategoryCreate, current_user: dict = Depends(get_current_user)):
    # Verify category exists
    category = await categories_collection.find_one({"id": subcategory.category_id, "user_id": current_user["id"]})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    subcategory_id = str(uuid.uuid4())
    new_subcategory = {
        "id": subcategory_id,
        "user_id": current_user["id"],
        "category_id": subcategory.category_id,
        "name": subcategory.name,
        "created_at": datetime.now(timezone.utc)
    }
    await subcategories_collection.insert_one(new_subcategory)
    return new_subcategory

@app.put("/api/subcategories/{subcategory_id}")
async def update_subcategory(subcategory_id: str, subcategory: SubCategoryUpdate, current_user: dict = Depends(get_current_user)):
    existing = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="SubCategory not found")
    
    update_data = {k: v for k, v in subcategory.dict(exclude_unset=True).items()}
    if update_data:
        await subcategories_collection.update_one({"id": subcategory_id}, {"$set": update_data})
    
    updated = await subcategories_collection.find_one({"id": subcategory_id})
    return {"id": updated["id"], "category_id": updated["category_id"], "name": updated["name"], "created_at": updated["created_at"]}

@app.delete("/api/subcategories/{subcategory_id}")
async def delete_subcategory(subcategory_id: str, current_user: dict = Depends(get_current_user)):
    existing = await subcategories_collection.find_one({"id": subcategory_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="SubCategory not found")
    
    # Remove subcategory from transactions
    await transactions_collection.update_many(
        {"subcategory_id": subcategory_id},
        {"$set": {"subcategory_id": None}}
    )
    
    await subcategories_collection.delete_one({"id": subcategory_id})
    return {"message": "SubCategory deleted successfully"}

# Transaction Routes
@app.get("/api/transactions")
async def get_transactions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
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
async def create_transaction(transaction: TransactionCreate, current_user: dict = Depends(get_current_user)):
    transaction_id = str(uuid.uuid4())
    new_transaction = {
        "id": transaction_id,
        "user_id": current_user["id"],
        "date": transaction.date,
        "amount": transaction.amount,
        "type": transaction.type,
        "description": transaction.description,
        "category_id": transaction.category_id,
        "subcategory_id": transaction.subcategory_id,
        "created_at": datetime.now(timezone.utc)
    }
    await transactions_collection.insert_one(new_transaction)
    return new_transaction

@app.put("/api/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, transaction: TransactionUpdate, current_user: dict = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    update_data = {k: v for k, v in transaction.dict(exclude_unset=True).items()}
    if update_data:
        await transactions_collection.update_one({"id": transaction_id}, {"$set": update_data})
    
    updated = await transactions_collection.find_one({"id": transaction_id})
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
async def delete_transaction(transaction_id: str, current_user: dict = Depends(get_current_user)):
    existing = await transactions_collection.find_one({"id": transaction_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    await transactions_collection.delete_one({"id": transaction_id})
    return {"message": "Transaction deleted successfully"}

# Recurring Transaction Routes
@app.get("/api/recurring-transactions")
async def get_recurring_transactions(current_user: dict = Depends(get_current_user)):
    recurring = await recurring_transactions_collection.find({"user_id": current_user["id"]}).to_list(None)
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
async def create_recurring_transaction(recurring: RecurringTransactionCreate, current_user: dict = Depends(get_current_user)):
    recurring_id = str(uuid.uuid4())
    new_recurring = {
        "id": recurring_id,
        "user_id": current_user["id"],
        "amount": recurring.amount,
        "type": recurring.type,
        "description": recurring.description,
        "category_id": recurring.category_id,
        "subcategory_id": recurring.subcategory_id,
        "frequency": recurring.frequency,
        "day_of_month": recurring.day_of_month,
        "created_at": datetime.now(timezone.utc)
    }
    await recurring_transactions_collection.insert_one(new_recurring)
    return new_recurring

@app.put("/api/recurring-transactions/{recurring_id}")
async def update_recurring_transaction(recurring_id: str, recurring: RecurringTransactionUpdate, current_user: dict = Depends(get_current_user)):
    existing = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    update_data = {k: v for k, v in recurring.dict(exclude_unset=True).items()}
    if update_data:
        await recurring_transactions_collection.update_one({"id": recurring_id}, {"$set": update_data})
    
    updated = await recurring_transactions_collection.find_one({"id": recurring_id})
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
async def delete_recurring_transaction(recurring_id: str, current_user: dict = Depends(get_current_user)):
    existing = await recurring_transactions_collection.find_one({"id": recurring_id, "user_id": current_user["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    
    await recurring_transactions_collection.delete_one({"id": recurring_id})
    return {"message": "Recurring transaction deleted successfully"}

@app.post("/api/recurring-transactions/generate")
async def generate_recurring_transactions(current_user: dict = Depends(get_current_user)):
    """Manually generate recurring transactions for the current month"""
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year
    current_day = now.day
    
    recurring_list = await recurring_transactions_collection.find({"user_id": current_user["id"]}).to_list(None)
    generated_count = 0
    
    for recurring in recurring_list:
        if recurring["frequency"] == "Mensuel" and current_day >= recurring["day_of_month"]:
            # Check if already generated for this month
            existing = await transactions_collection.find_one({
                "user_id": current_user["id"],
                "description": recurring.get("description"),
                "amount": recurring["amount"],
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
                    "user_id": current_user["id"],
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

# Dashboard Statistics
@app.get("/api/dashboard/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    current_month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
    
    # Current month transactions
    current_month_transactions = await transactions_collection.find({
        "user_id": current_user["id"],
        "date": {"$gte": current_month_start, "$lt": next_month_start}
    }).to_list(None)
    
    revenus = sum(t["amount"] for t in current_month_transactions if t["type"] == "Revenu")
    depenses = sum(t["amount"] for t in current_month_transactions if t["type"] == "Dépense")
    epargne = revenus - depenses
    
    # Last 12 months data
    twelve_months_ago = datetime(now.year if now.month > 1 else now.year - 1, 
                                  now.month - 1 if now.month > 1 else 12, 
                                  1, tzinfo=timezone.utc)
    
    monthly_data = []
    for i in range(12):
        if now.month - i > 0:
            month = now.month - i
            year = now.year
        else:
            month = 12 + (now.month - i)
            year = now.year - 1
        
        month_start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            month_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            month_end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        
        month_transactions = await transactions_collection.find({
            "user_id": current_user["id"],
            "date": {"$gte": month_start, "$lt": month_end}
        }).to_list(None)
        
        month_revenus = sum(t["amount"] for t in month_transactions if t["type"] == "Revenu")
        month_depenses = sum(t["amount"] for t in month_transactions if t["type"] == "Dépense")
        
        month_names = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]
        monthly_data.insert(0, {
            "month": month_names[month - 1],
            "revenus": month_revenus,
            "depenses": month_depenses
        })
    
    return {
        "revenus_ce_mois": revenus,
        "depenses_ce_mois": depenses,
        "epargne_du_mois": epargne,
        "monthly_data": monthly_data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)