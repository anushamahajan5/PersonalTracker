from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import csv
import uuid
import json
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET") # Get JWT secret from environment variable
    if not secret:
        raise ValueError("JWT_SECRET environment variable not set. Please ensure it's defined in your .env file or environment.")
    return secret

# -------- Password helpers --------
def hash_password(password: str) -> str: # Hash password using bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool: # Verify password against hash
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# -------- JWT helpers --------
def create_access_token(user_id: str, email: str) -> str: # Create an access token
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str: # Create a refresh token
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=7 * 24 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=30 * 24 * 3600, path="/")

# -------- Models --------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)

class LoginIn(BaseModel):
    email: EmailStr # Email field for login
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "user"
    protein_goal: int = 120 # Default protein goal
    created_at: datetime

class TaskIn(BaseModel):
    title: str # Title of the task
    description: Optional[str] = ""
    due_date: Optional[str] = None  # ISO date
    priority: Literal["low", "medium", "high"] = "medium"
    status: Literal["todo", "in_progress", "done"] = "todo"

class TaskPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[Literal["low", "medium", "high"]] = None
    status: Optional[Literal["todo", "in_progress", "done"]] = None

class NoteIn(BaseModel):
    title: str
    content: str = "" # Default empty content
    folder_id: Optional[str] = None
    tags: List[str] = []

class NotePatch(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    folder_id: Optional[str] = None
    tags: Optional[List[str]] = None

class FolderIn(BaseModel):
    name: str

class HabitIn(BaseModel):
    name: str
    emoji: Optional[str] = ""
    color: Optional[str] = "#36B172"

class HabitPatch(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None

class FoodEntryIn(BaseModel):
    name: str
    protein_g: float
    carbs_g: float = 0 # Default to 0 carbs
    fats_g: float = 0
    calories: float = 0

class ProteinGoalIn(BaseModel):
    protein_goal: int = Field(ge=10, le=500)

class AIFoodIn(BaseModel):
    text: str

# -------- App setup --------
app = FastAPI(title="Prototask API")
api = APIRouter(prefix="/api")

# -------- Auth dependency --------
async def get_current_user(request: Request) -> dict: # Dependency to get the current authenticated user
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def user_out(u: dict) -> dict: # Helper to format user data for output
    return {
        "id": u["id"], "email": u["email"], "name": u["name"],
        "role": u.get("role", "user"),
        "protein_goal": u.get("protein_goal", 120),
        "created_at": u["created_at"],
    }

# -------- Auth endpoints --------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}): # Check if email already exists
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "user", "protein_goal": 120,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh) # Set authentication cookies
    return {**user_out(doc), "access_token": access}

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"]) # Create refresh token
    set_auth_cookies(response, access, refresh)
    return {**user_out(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True} # Indicate successful logout

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_out(user)

@api.patch("/auth/me")
async def update_me(body: ProteinGoalIn, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"protein_goal": body.protein_goal}})
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return user_out(u)

# -------- Tasks --------
@api.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user)): # List tasks for the current user
    items = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api.post("/tasks")
async def create_task(body: TaskIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(doc)
    doc.pop("_id", None) # Remove internal MongoDB ID
    return doc

@api.patch("/tasks/{tid}")
async def update_task(tid: str, body: TaskPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd: # No fields to update
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.tasks.update_one({"id": tid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    doc = await db.tasks.find_one({"id": tid}, {"_id": 0}) # Return updated document
    return doc

@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    res = await db.tasks.delete_one({"id": tid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True} # Indicate successful deletion

# -------- Folders --------
@api.get("/folders")
async def list_folders(user: dict = Depends(get_current_user)):
    items = await db.folders.find({"user_id": user["id"]}, {"_id": 0}).sort("name", 1).to_list(500)
    return items

@api.post("/folders")
async def create_folder(body: FolderIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": body.name.strip(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.folders.insert_one(doc)
    doc.pop("_id", None) # Remove internal MongoDB ID
    return doc

@api.delete("/folders/{fid}")
async def delete_folder(fid: str, user: dict = Depends(get_current_user)):
    await db.folders.delete_one({"id": fid, "user_id": user["id"]})
    await db.notes.update_many({"folder_id": fid, "user_id": user["id"]}, {"$set": {"folder_id": None}})
    return {"ok": True}
 # Set folder_id to None for notes in the deleted folder
# -------- Notes --------
@api.get("/notes") # List notes for the current user, with optional filters
async def list_notes(user: dict = Depends(get_current_user), q: Optional[str] = None,
                     folder_id: Optional[str] = None, tag: Optional[str] = None):
    query = {"user_id": user["id"]}
    if folder_id: # Filter by folder ID if provided
        query["folder_id"] = folder_id
    if tag:
        query["tags"] = tag
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                        {"content": {"$regex": q, "$options": "i"}}]
    items = await db.notes.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    return items

@api.post("/notes")
async def create_note(body: NoteIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"],
           **body.model_dump(), "created_at": now, "updated_at": now}
    await db.notes.insert_one(doc)
    doc.pop("_id", None) # Remove internal MongoDB ID
    return doc

@api.patch("/notes/{nid}")
async def update_note(nid: str, body: NotePatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.notes.update_one({"id": nid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    doc = await db.notes.find_one({"id": nid}, {"_id": 0}) # Return updated document
    return doc

@api.delete("/notes/{nid}")
async def delete_note(nid: str, user: dict = Depends(get_current_user)):
    res = await db.notes.delete_one({"id": nid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True} # Indicate successful deletion

# -------- Habits --------
def _today_str() -> str: # Get today's date as an ISO formatted string
    return date.today().isoformat()

@api.get("/habits")
async def list_habits(user: dict = Depends(get_current_user)):
    habits = await db.habits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    today = _today_str()
    logs = await db.habit_logs.find({"user_id": user["id"], "date": today}, {"_id": 0}).to_list(1000)
    done_today = {l["habit_id"] for l in logs}
    for h in habits:
        h["done_today"] = h["id"] in done_today # Mark if habit was done today
        h["streak"] = await _streak_for(user["id"], h["id"])
    return habits

async def _streak_for(user_id: str, habit_id: str) -> int: # Calculate the current streak for a habit
    logs = await db.habit_logs.find({"user_id": user_id, "habit_id": habit_id}, {"_id": 0, "date": 1}).to_list(5000)
    dates = {l["date"] for l in logs}
    streak = 0
    cur = date.today()
    while cur.isoformat() in dates:
        streak += 1
        cur -= timedelta(days=1) # Move to the previous day
    return streak

@api.post("/habits")
async def create_habit(body: HabitIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.habits.insert_one(doc)
    doc.pop("_id", None) # Remove internal MongoDB ID
    doc["done_today"] = False
    doc["streak"] = 0
    return doc

@api.patch("/habits/{hid}")
async def update_habit(hid: str, body: HabitPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.habits.update_one({"id": hid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Habit not found")
    return await db.habits.find_one({"id": hid}, {"_id": 0})

@api.delete("/habits/{hid}")
async def delete_habit(hid: str, user: dict = Depends(get_current_user)):
    await db.habits.delete_one({"id": hid, "user_id": user["id"]})
    await db.habit_logs.delete_many({"habit_id": hid, "user_id": user["id"]})
    return {"ok": True} # Indicate successful deletion

@api.post("/habits/{hid}/toggle")
async def toggle_habit(hid: str, user: dict = Depends(get_current_user)):
    habit = await db.habits.find_one({"id": hid, "user_id": user["id"]}, {"_id": 0})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    today = _today_str()
    existing = await db.habit_logs.find_one({"habit_id": hid, "user_id": user["id"], "date": today})
    if existing: # If log exists, delete it (un-toggle)
        await db.habit_logs.delete_one({"_id": existing["_id"]})
        done = False
    else: # If no log, create one (toggle)
        await db.habit_logs.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"],
                                        "habit_id": hid, "date": today,
                                        "created_at": datetime.now(timezone.utc).isoformat()})
        done = True
    streak = await _streak_for(user["id"], hid)
    return {"done_today": done, "streak": streak}

@api.get("/habits/heatmap")
async def habit_heatmap(user: dict = Depends(get_current_user), days: int = 140):
    today = date.today()
    start = today - timedelta(days=days - 1)
    logs = await db.habit_logs.find({"user_id": user["id"],
                                     "date": {"$gte": start.isoformat()}},
                                    {"_id": 0, "date": 1}).to_list(20000)
    counts = {}
    for l in logs:
        counts[l["date"]] = counts.get(l["date"], 0) + 1
    out = [] # Prepare output list
    for i in range(days):
        d = (start + timedelta(days=i)).isoformat()
        out.append({"date": d, "count": counts.get(d, 0)})
    return out

# -------- Protein / Food --------
@api.get("/protein/entries")
async def list_entries(user: dict = Depends(get_current_user), date_str: Optional[str] = None):
    day = date_str or _today_str()
    items = await db.food_entries.find({"user_id": user["id"], "date": day}, # Find entries for the specified day
                                       {"_id": 0}).sort("time", -1).to_list(500)
    return items

@api.post("/protein/entries")
async def add_entry(body: FoodEntryIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"],
           **body.model_dump(),
           "date": now.date().isoformat(),
           "time": now.isoformat()}
    await db.food_entries.insert_one(doc)
    doc.pop("_id", None) # Remove internal MongoDB ID
    return doc

@api.delete("/protein/entries/{eid}")
async def delete_entry(eid: str, user: dict = Depends(get_current_user)):
    await db.food_entries.delete_one({"id": eid, "user_id": user["id"]}) # Delete food entry
    return {"ok": True}

@api.get("/protein/history")
async def protein_history(user: dict = Depends(get_current_user), days: int = 14):
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    entries = await db.food_entries.find({"user_id": user["id"], "date": {"$gte": start}},
                                         {"_id": 0}).to_list(5000)
    by_day = {}
    for e in entries:
        d = e["date"] # Group entries by date
        by_day.setdefault(d, {"date": d, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "calories": 0})
        by_day[d]["protein_g"] += e.get("protein_g", 0)
        by_day[d]["carbs_g"] += e.get("carbs_g", 0)
        by_day[d]["fats_g"] += e.get("fats_g", 0)
        by_day[d]["calories"] += e.get("calories", 0)
    out = []
    for i in range(days):
        d = (date.today() - timedelta(days=days - 1 - i)).isoformat()
        out.append(by_day.get(d, {"date": d, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "calories": 0})) # Append daily summary
    return out

@api.post("/protein/ai-parse")
async def ai_parse(body: AIFoodIn, user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI not configured")
    sys_msg = ("You are a nutrition expert. Given a short description of food "
               "(e.g. '2 eggs and a slice of toast'), respond ONLY with valid JSON " # System message for the AI
               "in this exact schema: "
               '{"food_name": str, "protein_g": number, "carbs_g": number, "fats_g": number, "calories": number}. '
               "Estimate realistic values. No prose, no markdown fences.")
    chat = LlmChat(api_key=api_key, session_id=f"ai-food-{user['id']}",
                   system_message=sys_msg).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        reply = await chat.send_message(UserMessage(text=body.text)) # Send user message to AI
        text = reply.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:] # Remove "json" prefix if present
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise ValueError("No JSON in LLM response")
        data = json.loads(text[start:end + 1])
        return {
            "food_name": str(data.get("food_name", body.text))[:120],
            "protein_g": float(data.get("protein_g", 0) or 0),
            "carbs_g": float(data.get("carbs_g", 0) or 0),
            "fats_g": float(data.get("fats_g", 0) or 0),
            "calories": float(data.get("calories", 0) or 0),
        }
    except Exception as e:
        logging.exception("AI parse failed") # Log the exception
        raise HTTPException(status_code=502, detail=f"AI parse failed: {e}")

# -------- Dashboard --------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    today = _today_str()
    # Today's tasks
    tasks = await db.tasks.find({"user_id": user["id"], "status": {"$ne": "done"}},
                                {"_id": 0}).sort("created_at", -1).to_list(100) # Get up to 100 tasks not done
    due_today = [t for t in tasks if t.get("due_date") == today] # Filter tasks due today

    # Habits
    habits = await db.habits.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    today_logs = await db.habit_logs.find({"user_id": user["id"], "date": today},
                                          {"_id": 0}).to_list(1000)
    done_today = {l["habit_id"] for l in today_logs} # Set of habit IDs completed today
    habits_summary = {
        "total": len(habits),
        "completed": sum(1 for h in habits if h["id"] in done_today),
    }

    # Protein today
    entries = await db.food_entries.find({"user_id": user["id"], "date": today},
                                         {"_id": 0}).to_list(500)
    protein_today = sum(e.get("protein_g", 0) for e in entries) # Sum protein for today
    calories_today = sum(e.get("calories", 0) for e in entries) # Sum calories for today

    # Overall streak (consecutive days with at least one habit completed)
    overall_streak = 0
    if habits:
        cur = date.today()
        while True:
            d = cur.isoformat()
            has = await db.habit_logs.find_one({"user_id": user["id"], "date": d}) # Check for any habit log on this date
            if not has:
                break
            overall_streak += 1
            cur -= timedelta(days=1)

    total_tasks = await db.tasks.count_documents({"user_id": user["id"]})
    done_tasks = await db.tasks.count_documents({"user_id": user["id"], "status": "done"})
    completion_pct = int((done_tasks / total_tasks * 100)) if total_tasks else 0 # Calculate completion percentage

    return {
        "tasks_due_today": due_today,
        "task_stats": {"total": total_tasks, "done": done_tasks, "completion_pct": completion_pct},
        "habits": habits_summary,
        "protein": {
            "goal": user.get("protein_goal", 120),
            "consumed": round(protein_today, 1),
            "calories": round(calories_today, 1),
            "pct": min(100, int((protein_today / max(user.get("protein_goal", 120), 1)) * 100)),
        }, # Protein summary
        "overall_streak": overall_streak,
    }

# -------- Weekly insights --------
@api.get("/insights/weekly")
async def insights(user: dict = Depends(get_current_user)):
    start = (date.today() - timedelta(days=6)).isoformat()
    end = _today_str()
    # Tasks done this week
    tasks_done = await db.tasks.count_documents(
        {"user_id": user["id"], "status": "done"} # Count tasks marked as done
    )
    # Habit logs last 7 days
    logs = await db.habit_logs.find({"user_id": user["id"], "date": {"$gte": start, "$lte": end}},
                                    {"_id": 0}).to_list(5000)
    by_day = {}
    for l in logs:
        by_day[l["date"]] = by_day.get(l["date"], 0) + 1 # Count habit check-ins per day
    # Protein entries last 7 days
    entries = await db.food_entries.find({"user_id": user["id"], "date": {"$gte": start, "$lte": end}},
                                         {"_id": 0}).to_list(5000)
    protein_by_day = {}
    for e in entries:
        protein_by_day[e["date"]] = protein_by_day.get(e["date"], 0) + e.get("protein_g", 0) # Sum protein per day
    avg_protein = round(sum(protein_by_day.values()) / 7, 1) if protein_by_day else 0
    goal = user.get("protein_goal", 120)
    days_hit = sum(1 for v in protein_by_day.values() if v >= goal)
    habit_check_ins = sum(by_day.values())

    return {
        "tasks_done_total": tasks_done,
        "habit_check_ins": habit_check_ins,
        "avg_protein_g": avg_protein,
        "protein_goal": goal,
        "days_protein_goal_hit": days_hit,
        "habit_daily": [{"date": (date.today() - timedelta(days=6 - i)).isoformat(),
                         "count": by_day.get((date.today() - timedelta(days=6 - i)).isoformat(), 0)} # Habit check-ins for each of the last 7 days
                        for i in range(7)],
        "protein_daily": [{"date": (date.today() - timedelta(days=6 - i)).isoformat(),
                           "protein_g": round(protein_by_day.get(
                               (date.today() - timedelta(days=6 - i)).isoformat(), 0), 1)}
                          for i in range(7)],
    }

# -------- CSV Export --------
@api.get("/export/{kind}")
async def export_csv(kind: str, user: dict = Depends(get_current_user)):
    buf = io.StringIO()
    w = csv.writer(buf)
    if kind == "tasks":
        rows = await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)
        w.writerow(["id", "title", "description", "priority", "status", "due_date", "created_at"])
        for r in rows:
            w.writerow([r.get("id"), r.get("title"), r.get("description", ""), r.get("priority"),
                        r.get("status"), r.get("due_date", ""), r.get("created_at")])
    elif kind == "notes":
        rows = await db.notes.find({"user_id": user["id"]}, {"_id": 0}).to_list(5000)
        w.writerow(["id", "title", "content", "tags", "folder_id", "updated_at"])
        for r in rows:
            w.writerow([r.get("id"), r.get("title"), r.get("content", "").replace("n", " "),
                        ",".join(r.get("tags", [])), r.get("folder_id", ""), r.get("updated_at")])
    elif kind == "nutrition":
        rows = await db.food_entries.find({"user_id": user["id"]}, {"_id": 0}).to_list(10000)
        w.writerow(["id", "date", "name", "protein_g", "carbs_g", "fats_g", "calories", "time"])
        for r in rows:
            w.writerow([r.get("id"), r.get("date"), r.get("name"), r.get("protein_g", 0),
                        r.get("carbs_g", 0), r.get("fats_g", 0), r.get("calories", 0), r.get("time")])
    elif kind == "habits":
        rows = await db.habit_logs.find({"user_id": user["id"]}, {"_id": 0}).to_list(20000)
        habits = {h["id"]: h["name"] for h in await db.habits.find({"user_id": user["id"]},
                                                                    {"_id": 0}).to_list(1000)}
        w.writerow(["habit_id", "habit_name", "date"])
        for r in rows:
            w.writerow([r.get("habit_id"), habits.get(r.get("habit_id"), ""), r.get("date")])
    else:
        raise HTTPException(status_code=400, detail="Unknown export kind")
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'})

@api.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(api)

# CORS
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000") # Get frontend URL from environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.tasks.create_index([("user_id", 1), ("status", 1)])
    await db.notes.create_index([("user_id", 1), ("folder_id", 1)])
    await db.habits.create_index("user_id")
    await db.habit_logs.create_index([("user_id", 1), ("habit_id", 1), ("date", 1)])
    await db.food_entries.create_index([("user_id", 1), ("date", 1)])
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email, "name": "Admin",
            "password_hash": hash_password(admin_pw),
            "role": "admin", "protein_goal": 120,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    # Seed test user
    if not await db.users.find_one({"email": "user@example.com"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "user@example.com", "name": "Test User",
            "password_hash": hash_password("user123"),
            "role": "user", "protein_goal": 120,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
