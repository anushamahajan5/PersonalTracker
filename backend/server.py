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

import re # Import for regex
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
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise ValueError("JWT_SECRET environment variable not set")
    return secret


# -------- Password helpers --------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# -------- JWT helpers --------
def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
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
    email: EmailStr
    password: str


class TaskIn(BaseModel):
    title: str
    description: Optional[str] = ""
    due_date: Optional[str] = None
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
    content: str = ""
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
    carbs_g: float = 0
    fats_g: float = 0
    calories: float = 0


class ProteinGoalIn(BaseModel):
    protein_goal: Optional[int] = Field(None, ge=10, le=500) # Make protein_goal optional


class AIFoodIn(BaseModel):
    text: str


# Gym
class GymSetIn(BaseModel):
    weight: float = 0
    reps: int = 0


class GymExerciseIn(BaseModel):
    name: str
    muscle_group: str = ""
    sets: List[GymSetIn] = []
    notes: Optional[str] = ""


class GymSessionIn(BaseModel):
    date: str  # ISO yyyy-mm-dd
    title: Optional[str] = ""
    muscle_group: Optional[str] = ""
    exercises: List[GymExerciseIn] = []
    notes: Optional[str] = ""
    duration_min: Optional[int] = 0
    user_weight: Optional[float] = 0 # New field for user's body weight


class GymSessionPatch(BaseModel):
    date: Optional[str] = None
    title: Optional[str] = None
    muscle_group: Optional[str] = None
    exercises: Optional[List[GymExerciseIn]] = None
    notes: Optional[str] = None
    duration_min: Optional[int] = None
    user_weight: Optional[float] = None # New field for user's body weight


class GymTemplateIn(BaseModel):
    name: str
    muscle_group: Optional[str] = ""
    exercises: List[GymExerciseIn] = []
    notes: Optional[str] = ""


# Shopping
class ShoppingItemIn(BaseModel):
    name: str
    qty: Optional[str] = ""
    category: Optional[str] = "General"
    purchased: bool = False


class ShoppingItemPatch(BaseModel):
    name: Optional[str] = None
    qty: Optional[str] = None
    category: Optional[str] = None
    purchased: Optional[bool] = None


# Expenses
class ExpenseIn(BaseModel):
    amount: float = Field(ge=0)
    category: str
    description: Optional[str] = ""
    date: Optional[str] = None  # iso date


class ExpensePatch(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None


# Hobbies
class HobbyEntryIn(BaseModel):
    name: str
    date: Optional[str] = None
    duration_min: Optional[int] = 0
    notes: Optional[str] = ""


class HobbyEntryPatch(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    duration_min: Optional[int] = None
    notes: Optional[str] = None


# -------- App setup --------
app = FastAPI(title="Prototask API")
api = APIRouter(prefix="/api")


# -------- Auth dependency --------
async def get_current_user(request: Request) -> dict:
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


def user_out(u: dict) -> dict:
    return {
        "id": u["id"], "email": u["email"], "name": u["name"],
        "role": u.get("role", "user"),
        "protein_goal": u.get("protein_goal", 120),
        "created_at": u["created_at"],
    }


def _today_str() -> str:
    return date.today().isoformat()


# -------- Auth endpoints --------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid, "email": email, "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "user", # Remove default protein_goal for new users
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {**user_out(doc), "access_token": access}


@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], email)
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {**user_out(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, _: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_out(user)


@api.patch("/auth/me")
async def update_me(body: ProteinGoalIn, user: dict = Depends(get_current_user)):
    update_field = {}
    if body.protein_goal is not None:
        update_field["protein_goal"] = body.protein_goal
        await db.users.update_one({"id": user["id"]}, {"$set": update_field})
    else:
        # If protein_goal is None, unset the field in the database
        await db.users.update_one({"id": user["id"]}, {"$unset": {"protein_goal": ""}})

    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return user_out(u)


# -------- Tasks --------
@api.get("/tasks")
async def list_tasks(user: dict = Depends(get_current_user)):
    return await db.tasks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/tasks")
async def create_task(body: TaskIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/tasks/{tid}")
async def update_task(tid: str, body: TaskPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.tasks.update_one({"id": tid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    res = await db.tasks.delete_one({"id": tid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


# -------- Folders & Notes --------
@api.get("/folders")
async def list_folders(user: dict = Depends(get_current_user)):
    return await db.folders.find({"user_id": user["id"]}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/folders")
async def create_folder(body: FolderIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": body.name.strip(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.folders.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/folders/{fid}")
async def delete_folder(fid: str, user: dict = Depends(get_current_user)):
    await db.folders.delete_one({"id": fid, "user_id": user["id"]})
    await db.notes.update_many({"folder_id": fid, "user_id": user["id"]}, {"$set": {"folder_id": None}})
    return {"ok": True}


@api.get("/notes")
async def list_notes(user: dict = Depends(get_current_user), q: Optional[str] = None,
                     folder_id: Optional[str] = None, tag: Optional[str] = None):
    query = {"user_id": user["id"]}
    if folder_id:
        query["folder_id"] = folder_id
    if tag:
        query["tags"] = tag
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}},
                        {"content": {"$regex": q, "$options": "i"}}]
    return await db.notes.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)


@api.post("/notes")
async def create_note(body: NoteIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": now, "updated_at": now}
    await db.notes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/notes/{nid}")
async def update_note(nid: str, body: NotePatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.notes.update_one({"id": nid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return await db.notes.find_one({"id": nid}, {"_id": 0})


@api.delete("/notes/{nid}")
async def delete_note(nid: str, user: dict = Depends(get_current_user)):
    res = await db.notes.delete_one({"id": nid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"ok": True}


# -------- Habits --------
async def _streak_for(user_id: str, habit_id: str) -> int:
    logs = await db.habit_logs.find({"user_id": user_id, "habit_id": habit_id},
                                    {"_id": 0, "date": 1}).to_list(5000)
    dates = {l["date"] for l in logs}
    streak = 0
    cur = date.today()
    while cur.isoformat() in dates:
        streak += 1
        cur -= timedelta(days=1)
    return streak


@api.get("/habits")
async def list_habits(user: dict = Depends(get_current_user), name: Optional[str] = None): # Added name filter
    query = {"user_id": user["id"]}
    if name:
        query["name"] = {"$regex": name, "$options": "i"} # Case-insensitive search
    habits = await db.habits.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
    today = _today_str()
    logs = await db.habit_logs.find({"user_id": user["id"], "date": today}, {"_id": 0}).to_list(1000)
    done_today = {l["habit_id"] for l in logs}
    for h in habits:
        h["done_today"] = h["id"] in done_today
        h["streak"] = await _streak_for(user["id"], h["id"])
    return habits


@api.post("/habits")
async def create_habit(body: HabitIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.habits.insert_one(doc)
    doc.pop("_id", None)
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
    return {"ok": True}


@api.post("/habits/{hid}/toggle")
async def toggle_habit(hid: str, user: dict = Depends(get_current_user)):
    habit = await db.habits.find_one({"id": hid, "user_id": user["id"]}, {"_id": 0})
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    today = _today_str()
    existing = await db.habit_logs.find_one({"habit_id": hid, "user_id": user["id"], "date": today})
    if existing:
        await db.habit_logs.delete_one({"_id": existing["_id"]})
        done = False
    else:
        await db.habit_logs.insert_one({"id": str(uuid.uuid4()), "user_id": user["id"],
                                        "habit_id": hid, "date": today,
                                        "created_at": datetime.now(timezone.utc).isoformat()})
        done = True
    streak = await _streak_for(user["id"], hid)
    return {"done_today": done, "streak": streak}


@api.get("/habits/heatmap") # New endpoint for heatmap data
async def get_habit_heatmap(user: dict = Depends(get_current_user), days: int = 140, month: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        # Calculate start and end dates for the given month
        year, mon = map(int, month.split('-'))
        start_date = date(year, mon, 1)
        # Calculate the last day of the month
        next_month = date(year, mon, 1) + timedelta(days=32) # Go beyond to ensure we get last day
        end_date = date(next_month.year, next_month.month, 1) - timedelta(days=1)
        
        query["date"] = {"$gte": start_date.isoformat(), "$lte": end_date.isoformat()}
    else:
        # Default to last 'days' days
        start_date = date.today() - timedelta(days=days - 1)
        end_date = date.today()
        query["date"] = {"$gte": start_date.isoformat()}

    logs = await db.habit_logs.find(query, {"_id": 0, "date": 1}).to_list(5000)
    
    # Create a dictionary to count check-ins per day
    daily_counts = {}
    for log in logs:
        daily_counts[log["date"]] = daily_counts.get(log["date"], 0) + 1

    # Generate the heatmap data for the requested period
    heatmap_data = []
    current_date = start_date
    while current_date <= end_date:
        heatmap_data.append({"date": current_date.isoformat(), "count": daily_counts.get(current_date.isoformat(), 0)})
        current_date += timedelta(days=1)
    
    return heatmap_data


# -------- Protein / Food --------
@api.get("/protein/entries")
async def list_entries(user: dict = Depends(get_current_user), date_str: Optional[str] = None):
    day = date_str or _today_str()
    return await db.food_entries.find({"user_id": user["id"], "date": day},
                                      {"_id": 0}).sort("time", -1).to_list(500)


@api.post("/protein/entries")
async def add_entry(body: FoodEntryIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "date": now.date().isoformat(), "time": now.isoformat()}
    await db.food_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/protein/entries/{eid}")
async def delete_entry(eid: str, user: dict = Depends(get_current_user)):
    await db.food_entries.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/protein/history")
async def protein_history(user: dict = Depends(get_current_user), days: int = 14):
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    entries = await db.food_entries.find({"user_id": user["id"], "date": {"$gte": start}},
                                         {"_id": 0}).to_list(5000)
    by_day = {}
    for e in entries:
        d = e["date"]
        by_day.setdefault(d, {"date": d, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "calories": 0})
        by_day[d]["protein_g"] += e.get("protein_g", 0)
        by_day[d]["carbs_g"] += e.get("carbs_g", 0)
        by_day[d]["fats_g"] += e.get("fats_g", 0)
        by_day[d]["calories"] += e.get("calories", 0)
    out = []
    for i in range(days):
        d = (date.today() - timedelta(days=days - 1 - i)).isoformat()
        out.append(by_day.get(d, {"date": d, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "calories": 0}))
    return out


@api.post("/protein/ai-parse")
async def ai_parse(body: AIFoodIn, user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI not configured")
    sys_msg = ("You are a nutrition expert. Given a short description of food, respond ONLY with valid JSON "
               'in this exact schema: {"food_name": str, "protein_g": number, "carbs_g": number, "fats_g": number, "calories": number}. '
               "Estimate realistic values. No prose, no markdown fences.")
    chat = LlmChat(api_key=api_key, session_id=f"ai-food-{user['id']}",
                   system_message=sys_msg).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        reply = await chat.send_message(UserMessage(text=body.text))
        text = reply.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        s, e = text.find("{"), text.rfind("}")
        if s == -1 or e == -1:
            raise ValueError("No JSON in LLM response")
        data = json.loads(text[s:e + 1])
        return {
            "food_name": str(data.get("food_name", body.text))[:120],
            "protein_g": float(data.get("protein_g", 0) or 0),
            "carbs_g": float(data.get("carbs_g", 0) or 0),
            "fats_g": float(data.get("fats_g", 0) or 0),
            "calories": float(data.get("calories", 0) or 0),
        }
    except Exception as e:
        logging.exception("AI parse failed")
        raise HTTPException(status_code=502, detail=f"AI parse failed: {e}")


# -------- Gym --------
@api.get("/gym/sessions")
async def list_gym_sessions(user: dict = Depends(get_current_user), month: Optional[str] = None, muscle_group: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    if muscle_group:
        query["muscle_group"] = muscle_group
    return await db.gym_sessions.find(query, {"_id": 0}).sort("date", -1).to_list(2000)


@api.post("/gym/sessions")
async def create_gym_session(body: GymSessionIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.gym_sessions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/gym/sessions/{sid}")
async def update_gym_session(sid: str, body: GymSessionPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.gym_sessions.update_one({"id": sid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return await db.gym_sessions.find_one({"id": sid}, {"_id": 0})


@api.delete("/gym/sessions/{sid}")
async def delete_gym_session(sid: str, user: dict = Depends(get_current_user)):
    await db.gym_sessions.delete_one({"id": sid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/gym/templates")
async def list_gym_templates(user: dict = Depends(get_current_user)):
    return await db.gym_templates.find({"user_id": user["id"]}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/gym/templates")
async def create_gym_template(body: GymTemplateIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.gym_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/gym/templates/{tid}")
async def delete_gym_template(tid: str, user: dict = Depends(get_current_user)):
    await db.gym_templates.delete_one({"id": tid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/gym/stats") # Added month filter for stats
async def gym_stats(user: dict = Depends(get_current_user), days: int = 30, month: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    else:
        start = (date.today() - timedelta(days=days - 1)).isoformat()
        query["date"] = {"$gte": start}

    sessions = await db.gym_sessions.find(query, {"_id": 0}).to_list(2000)
    total_volume = 0.0
    by_muscle: dict = {}
    for s in sessions:
        for ex in s.get("exercises", []):
            mg = ex.get("muscle_group") or s.get("muscle_group", "Other")
            for st in ex.get("sets", []):
                vol = float(st.get("weight", 0) or 0) * float(st.get("reps", 0) or 0) # type: ignore
                total_volume += vol # type: ignore
                by_muscle[mg] = by_muscle.get(mg, 0) + vol
    return {
        "sessions": len(sessions),
        "total_volume_kg": round(total_volume, 1),
        "by_muscle": [{"muscle": k, "volume": round(v, 1)} for k, v in
                      sorted(by_muscle.items(), key=lambda x: -x[1])],
    }


# -------- Shopping --------
@api.get("/shopping")
async def list_shopping(user: dict = Depends(get_current_user), category: Optional[str] = None, purchased: Optional[bool] = None):
    query = {"user_id": user["id"]}
    if category:
        query["category"] = category
    if purchased is not None:
        query["purchased"] = purchased

    return await db.shopping_items.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/shopping")
async def create_shopping(body: ShoppingItemIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.shopping_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/shopping/{iid}")
async def update_shopping(iid: str, body: ShoppingItemPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.shopping_items.update_one({"id": iid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return await db.shopping_items.find_one({"id": iid}, {"_id": 0})


@api.delete("/shopping/{iid}")
async def delete_shopping(iid: str, user: dict = Depends(get_current_user)):
    await db.shopping_items.delete_one({"id": iid, "user_id": user["id"]})
    return {"ok": True}


@api.post("/shopping/clear-purchased")
async def clear_purchased(user: dict = Depends(get_current_user)):
    res = await db.shopping_items.delete_many({"user_id": user["id"], "purchased": True})
    return {"deleted": res.deleted_count}


# -------- Expenses --------
EXPENSE_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Entertainment", "Health", "Other"]


@api.get("/expenses/categories")
async def expense_categories(_: dict = Depends(get_current_user)):
    return EXPENSE_CATEGORIES


@api.get("/expenses")
async def list_expenses(user: dict = Depends(get_current_user), month: Optional[str] = None, category: Optional[str] = None):
    """month in YYYY-MM, default current month"""
    today = date.today()
    m = month or f"{today.year:04d}-{today.month:02d}"
    query = {"user_id": user["id"], "date": {"$regex": f"^{m}"}}
    if category:
        query["category"] = category
    items = await db.expenses.find(
        query, {"_id": 0}).sort("date", -1).to_list(2000)
    total = round(sum(float(i.get("amount", 0)) for i in items), 2)
    by_cat: dict = {}
    for i in items:
        c = i.get("category", "Other")
        by_cat[c] = by_cat.get(c, 0) + float(i.get("amount", 0))
    return {
        "month": m,
        "items": items,
        "total": total,
        "by_category": [{"category": k, "amount": round(v, 2)} for k, v in
                        sorted(by_cat.items(), key=lambda x: -x[1])],
    }


@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(get_current_user)):
    if body.category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    if not doc.get("date"):
        doc["date"] = _today_str()
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/expenses/{eid}")
async def update_expense(eid: str, body: ExpensePatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "category" in upd and upd["category"] not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.expenses.update_one({"id": eid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return await db.expenses.find_one({"id": eid}, {"_id": 0})


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(get_current_user)):
    await db.expenses.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}


# -------- Hobbies --------
@api.get("/hobbies")
async def list_hobbies(user: dict = Depends(get_current_user), month: Optional[str] = None, name: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    if name:
        query["name"] = name
    return await db.hobby_entries.find(query, {"_id": 0}).sort("date", -1).to_list(2000)


@api.post("/hobbies")
async def create_hobby(body: HobbyEntryIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    if not doc.get("date"):
        doc["date"] = _today_str()
    await db.hobby_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/hobbies/{hid}")
async def update_hobby(hid: str, body: HobbyEntryPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.hobby_entries.update_one({"id": hid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hobby entry not found")
    return await db.hobby_entries.find_one({"id": hid}, {"_id": 0})


@api.delete("/hobbies/{hid}")
async def delete_hobby(hid: str, user: dict = Depends(get_current_user)):
    await db.hobby_entries.delete_one({"id": hid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/hobbies/stats") # Added month filter for stats
async def hobby_stats(user: dict = Depends(get_current_user), days: int = 30, month: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    else:
        start = (date.today() - timedelta(days=days - 1)).isoformat()
        query["date"] = {"$gte": start}
    items = await db.hobby_entries.find(query, {"_id": 0}).to_list(5000)
    by_hobby: dict = {}
    for i in items:
        n = i.get("name", "Other")
        by_hobby[n] = by_hobby.get(n, 0) + int(i.get("duration_min", 0) or 0)
    total = sum(by_hobby.values())
    return {
        "total_min": total,
        "entries": len(items),
        "by_hobby": [{"name": k, "minutes": v} for k, v in
                     sorted(by_hobby.items(), key=lambda x: -x[1])],
    }


# -------- Dashboard --------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    today = _today_str()
    tasks = await db.tasks.find({"user_id": user["id"], "status": {"$ne": "done"}},
                                {"_id": 0}).sort("created_at", -1).to_list(100)
    due_today = [t for t in tasks if t.get("due_date") == today]

    habits = await db.habits.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    today_logs = await db.habit_logs.find({"user_id": user["id"], "date": today},
                                          {"_id": 0}).to_list(1000)
    done_today = {l["habit_id"] for l in today_logs}
    habits_summary = {"total": len(habits),
                      "completed": sum(1 for h in habits if h["id"] in done_today)}

    entries = await db.food_entries.find({"user_id": user["id"], "date": today},
                                         {"_id": 0}).to_list(500)
    protein_today = sum(e.get("protein_g", 0) for e in entries)
    calories_today = sum(e.get("calories", 0) for e in entries)

    overall_streak = 0
    if habits:
        cur = date.today()
        while True:
            d = cur.isoformat()
            has = await db.habit_logs.find_one({"user_id": user["id"], "date": d})
            if not has:
                break
            overall_streak += 1
            cur -= timedelta(days=1)

    total_tasks = await db.tasks.count_documents({"user_id": user["id"]})
    done_tasks = await db.tasks.count_documents({"user_id": user["id"], "status": "done"})
    completion_pct = int((done_tasks / total_tasks * 100)) if total_tasks else 0

    # Quick stats for new tabs
    today_month = today[:7]
    month_expenses = await db.expenses.find(
        {"user_id": user["id"], "date": {"$regex": f"^{today_month}"}}, {"_id": 0}).to_list(2000)
    expense_total = round(sum(float(i.get("amount", 0)) for i in month_expenses), 2)

    pending_shopping = await db.shopping_items.count_documents(
        {"user_id": user["id"], "purchased": False})
    last_gym = await db.gym_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).limit(1).to_list(1)
    last_gym_doc = last_gym[0] if last_gym else None

    return {
        "tasks_due_today": due_today,
        "task_stats": {"total": total_tasks, "done": done_tasks, "completion_pct": completion_pct},
        "habits": habits_summary,
        "protein": {
            "goal": user.get("protein_goal", 120),
            "consumed": round(protein_today, 1),
            "calories": round(calories_today, 1),
            "pct": min(100, int((protein_today / max(user.get("protein_goal", 120), 1)) * 100)),
        },
        "overall_streak": overall_streak,
        "expenses_month_total": expense_total,
        "pending_shopping": pending_shopping,
        "last_gym": last_gym_doc,
    }


@api.get("/insights/weekly")
async def insights(user: dict = Depends(get_current_user)):
    start = (date.today() - timedelta(days=6)).isoformat()
    end = _today_str()
    tasks_done = await db.tasks.count_documents({"user_id": user["id"], "status": "done"})
    logs = await db.habit_logs.find({"user_id": user["id"], "date": {"$gte": start, "$lte": end}},
                                    {"_id": 0}).to_list(5000)
    by_day = {}
    for l in logs:
        by_day[l["date"]] = by_day.get(l["date"], 0) + 1
    entries = await db.food_entries.find({"user_id": user["id"], "date": {"$gte": start, "$lte": end}},
                                         {"_id": 0}).to_list(5000)
    protein_by_day = {}
    for e in entries:
        protein_by_day[e["date"]] = protein_by_day.get(e["date"], 0) + e.get("protein_g", 0)
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
                         "count": by_day.get((date.today() - timedelta(days=6 - i)).isoformat(), 0)}
                        for i in range(7)],
        "protein_daily": [{"date": (date.today() - timedelta(days=6 - i)).isoformat(),
                           "protein_g": round(protein_by_day.get(
                               (date.today() - timedelta(days=6 - i)).isoformat(), 0), 1)}
                          for i in range(7)],
    }


@api.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
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
    await db.gym_sessions.create_index([("user_id", 1), ("date", -1)])
    await db.gym_templates.create_index("user_id")
    await db.shopping_items.create_index("user_id")
    await db.expenses.create_index([("user_id", 1), ("date", -1)])
    await db.hobby_entries.create_index([("user_id", 1), ("date", -1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email, "name": "Admin",
            "password_hash": hash_password(admin_pw),
            "role": "admin", # Remove default protein_goal for seeded admin
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_pw)}})
    if not await db.users.find_one({"email": "user@example.com"}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": "user@example.com", "name": "Test User",
            "password_hash": hash_password("user123"),
            "role": "user", # Remove default protein_goal for seeded test user
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
    return {"done_today": done, "streak": streak}


# -------- Protein / Food --------
@api.get("/protein/entries")
async def list_entries(user: dict = Depends(get_current_user), date_str: Optional[str] = None):
    day = date_str or _today_str()
    return await db.food_entries.find({"user_id": user["id"], "date": day},
                                      {"_id": 0}).sort("time", -1).to_list(500)


@api.post("/protein/entries")
async def add_entry(body: FoodEntryIn, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "date": now.date().isoformat(), "time": now.isoformat()}
    await db.food_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/protein/entries/{eid}")
async def delete_entry(eid: str, user: dict = Depends(get_current_user)):
    await db.food_entries.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/protein/history")
async def protein_history(user: dict = Depends(get_current_user), days: int = 14):
    start = (date.today() - timedelta(days=days - 1)).isoformat()
    entries = await db.food_entries.find({"user_id": user["id"], "date": {"$gte": start}},
                                         {"_id": 0}).to_list(5000)
    by_day = {}
    for e in entries:
        d = e["date"]
        by_day.setdefault(d, {"date": d, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "calories": 0})
        by_day[d]["protein_g"] += e.get("protein_g", 0)
        by_day[d]["carbs_g"] += e.get("carbs_g", 0)
        by_day[d]["fats_g"] += e.get("fats_g", 0)
        by_day[d]["calories"] += e.get("calories", 0)
    out = []
    for i in range(days):
        d = (date.today() - timedelta(days=days - 1 - i)).isoformat()
        out.append(by_day.get(d, {"date": d, "protein_g": 0, "carbs_g": 0, "fats_g": 0, "calories": 0}))
    return out


@api.post("/protein/ai-parse")
async def ai_parse(body: AIFoodIn, user: dict = Depends(get_current_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI not configured")
    sys_msg = ("You are a nutrition expert. Given a short description of food, respond ONLY with valid JSON "
               'in this exact schema: {"food_name": str, "protein_g": number, "carbs_g": number, "fats_g": number, "calories": number}. '
               "Estimate realistic values. No prose, no markdown fences.")
    chat = LlmChat(api_key=api_key, session_id=f"ai-food-{user['id']}",
                   system_message=sys_msg).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        reply = await chat.send_message(UserMessage(text=body.text))
        text = reply.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
        s, e = text.find("{"), text.rfind("}")
        if s == -1 or e == -1:
            raise ValueError("No JSON in LLM response")
        data = json.loads(text[s:e + 1])
        return {
            "food_name": str(data.get("food_name", body.text))[:120],
            "protein_g": float(data.get("protein_g", 0) or 0),
            "carbs_g": float(data.get("carbs_g", 0) or 0),
            "fats_g": float(data.get("fats_g", 0) or 0),
            "calories": float(data.get("calories", 0) or 0),
        }
    except Exception as e:
        logging.exception("AI parse failed")
        raise HTTPException(status_code=502, detail=f"AI parse failed: {e}")


# -------- Gym --------
@api.get("/gym/sessions")
async def list_gym_sessions(user: dict = Depends(get_current_user), month: Optional[str] = None, muscle_group: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    if muscle_group:
        query["muscle_group"] = muscle_group
    return await db.gym_sessions.find(query, {"_id": 0}).sort("date", -1).to_list(2000)


@api.post("/gym/sessions")
async def create_gym_session(body: GymSessionIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.gym_sessions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/gym/sessions/{sid}")
async def update_gym_session(sid: str, body: GymSessionPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.gym_sessions.update_one({"id": sid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return await db.gym_sessions.find_one({"id": sid}, {"_id": 0})


@api.delete("/gym/sessions/{sid}")
async def delete_gym_session(sid: str, user: dict = Depends(get_current_user)):
    await db.gym_sessions.delete_one({"id": sid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/gym/templates")
async def list_gym_templates(user: dict = Depends(get_current_user)):
    return await db.gym_templates.find({"user_id": user["id"]}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/gym/templates")
async def create_gym_template(body: GymTemplateIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.gym_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/gym/templates/{tid}")
async def delete_gym_template(tid: str, user: dict = Depends(get_current_user)):
    await db.gym_templates.delete_one({"id": tid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/gym/stats") # Added month filter for stats
async def gym_stats(user: dict = Depends(get_current_user), days: int = 30, month: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    else:
        start = (date.today() - timedelta(days=days - 1)).isoformat()
        query["date"] = {"$gte": start}

    sessions = await db.gym_sessions.find(query, {"_id": 0}).to_list(2000)
    total_volume = 0.0
    by_muscle: dict = {}
    for s in sessions:
        for ex in s.get("exercises", []):
            mg = ex.get("muscle_group") or s.get("muscle_group", "Other")
            for st in ex.get("sets", []):
                vol = float(st.get("weight", 0) or 0) * float(st.get("reps", 0) or 0) # type: ignore
                total_volume += vol # type: ignore
                by_muscle[mg] = by_muscle.get(mg, 0) + vol
    return {
        "sessions": len(sessions),
        "total_volume_kg": round(total_volume, 1),
        "by_muscle": [{"muscle": k, "volume": round(v, 1)} for k, v in
                      sorted(by_muscle.items(), key=lambda x: -x[1])],
    }


# -------- Shopping --------
@api.get("/shopping")
async def list_shopping(user: dict = Depends(get_current_user), category: Optional[str] = None, purchased: Optional[bool] = None):
    query = {"user_id": user["id"]}
    if category:
        query["category"] = category
    if purchased is not None:
        query["purchased"] = purchased

    return await db.shopping_items.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/shopping")
async def create_shopping(body: ShoppingItemIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.shopping_items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/shopping/{iid}")
async def update_shopping(iid: str, body: ShoppingItemPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.shopping_items.update_one({"id": iid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return await db.shopping_items.find_one({"id": iid}, {"_id": 0})


@api.delete("/shopping/{iid}")
async def delete_shopping(iid: str, user: dict = Depends(get_current_user)):
    await db.shopping_items.delete_one({"id": iid, "user_id": user["id"]})
    return {"ok": True}


@api.post("/shopping/clear-purchased")
async def clear_purchased(user: dict = Depends(get_current_user)):
    res = await db.shopping_items.delete_many({"user_id": user["id"], "purchased": True})
    return {"deleted": res.deleted_count}


# -------- Expenses --------
EXPENSE_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Entertainment", "Health", "Other"]


@api.get("/expenses/categories")
async def expense_categories(_: dict = Depends(get_current_user)):
    return EXPENSE_CATEGORIES


@api.get("/expenses")
async def list_expenses(user: dict = Depends(get_current_user), month: Optional[str] = None, category: Optional[str] = None):
    """month in YYYY-MM, default current month"""
    today = date.today()
    m = month or f"{today.year:04d}-{today.month:02d}"
    query = {"user_id": user["id"], "date": {"$regex": f"^{m}"}}
    if category:
        query["category"] = category
    items = await db.expenses.find(
        query, {"_id": 0}).sort("date", -1).to_list(2000)
    total = round(sum(float(i.get("amount", 0)) for i in items), 2)
    by_cat: dict = {}
    for i in items:
        c = i.get("category", "Other")
        by_cat[c] = by_cat.get(c, 0) + float(i.get("amount", 0))
    return {
        "month": m,
        "items": items,
        "total": total,
        "by_category": [{"category": k, "amount": round(v, 2)} for k, v in
                        sorted(by_cat.items(), key=lambda x: -x[1])],
    }


@api.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(get_current_user)):
    if body.category not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    if not doc.get("date"):
        doc["date"] = _today_str()
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/expenses/{eid}")
async def update_expense(eid: str, body: ExpensePatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if "category" in upd and upd["category"] not in EXPENSE_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.expenses.update_one({"id": eid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return await db.expenses.find_one({"id": eid}, {"_id": 0})


@api.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(get_current_user)):
    await db.expenses.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}


# -------- Hobbies --------
@api.get("/hobbies")
async def list_hobbies(user: dict = Depends(get_current_user), month: Optional[str] = None, name: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    if name:
        query["name"] = name
    return await db.hobby_entries.find(query, {"_id": 0}).sort("date", -1).to_list(2000)


@api.post("/hobbies")
async def create_hobby(body: HobbyEntryIn, user: dict = Depends(get_current_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], **body.model_dump(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    if not doc.get("date"):
        doc["date"] = _today_str()
    await db.hobby_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/hobbies/{hid}")
async def update_hobby(hid: str, body: HobbyEntryPatch, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.hobby_entries.update_one({"id": hid, "user_id": user["id"]}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Hobby entry not found")
    return await db.hobby_entries.find_one({"id": hid}, {"_id": 0})


@api.delete("/hobbies/{hid}")
async def delete_hobby(hid: str, user: dict = Depends(get_current_user)):
    await db.hobby_entries.delete_one({"id": hid, "user_id": user["id"]})
    return {"ok": True}


@api.get("/hobbies/stats") # Added month filter for stats
async def hobby_stats(user: dict = Depends(get_current_user), days: int = 30, month: Optional[str] = None):
    query = {"user_id": user["id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    else:
        start = (date.today() - timedelta(days=days - 1)).isoformat()
        query["date"] = {"$gte": start}
    items = await db.hobby_entries.find(query, {"_id": 0}).to_list(5000)
    by_hobby: dict = {}
    for i in items:
        n = i.get("name", "Other")
        by_hobby[n] = by_hobby.get(n, 0) + int(i.get("duration_min", 0) or 0)
    total = sum(by_hobby.values())
    return {
        "total_min": total,
        "entries": len(items),
        "by_hobby": [{"name": k, "minutes": v} for k, v in
                     sorted(by_hobby.items(), key=lambda x: -x[1])],
    }


# -------- Dashboard --------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    today = _today_str()
    tasks = await db.tasks.find({"user_id": user["id"], "status": {"$ne": "done"}},
                                {"_id": 0}).sort("created_at", -1).to_list(100)
    due_today = [t for t in tasks if t.get("due_date") == today]

    habits = await db.habits.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    today_logs = await db.habit_logs.find({"user_id": user["id"], "date": today},
                                          {"_id": 0}).to_list(1000)
    done_today = {l["habit_id"] for l in today_logs}
    habits_summary = {"total": len(habits),
                      "completed": sum(1 for h in habits if h["id"] in done_today)}

    entries = await db.food_entries.find({"user_id": user["id"], "date": today},
                                         {"_id": 0}).to_list(500)
    protein_today = sum(e.get("protein_g", 0) for e in entries)
    calories_today = sum(e.get("calories", 0) for e in entries)

    overall_streak = 0
    if habits:
        cur = date.today()
        while True:
            d = cur.isoformat()
            has = await db.habit_logs.find_one({"user_id": user["id"], "date": d})
            if not has:
                break
            overall_streak += 1
            cur -= timedelta(days=1)

    total_tasks = await db.tasks.count_documents({"user_id": user["id"]})
    done_tasks = await db.tasks.count_documents({"user_id": user["id"], "status": "done"})
    completion_pct = int((done_tasks / total_tasks * 100)) if total_tasks else 0

    # Quick stats for new tabs
    today_month = today[:7]
    month_expenses = await db.expenses.find(
        {"user_id": user["id"], "date": {"$regex": f"^{today_month}"}}, {"_id": 0}).to_list(2000)
    expense_total = round(sum(float(i.get("amount", 0)) for i in month_expenses), 2)

    pending_shopping = await db.shopping_items.count_documents(
        {"user_id": user["id"], "purchased": False})
    last_gym = await db.gym_sessions.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).limit(1).to_list(1)
    last_gym_doc = last_gym[0] if last_gym else None

    return {
        "tasks_due_today": due_today,
        "task_stats": {"total": total_tasks, "done": done_tasks, "completion_pct": completion_pct},
        "habits": habits_summary,
        "protein": {
            "goal": user.get("protein_goal", 120),
            "consumed": round(protein_today, 1),
            "calories": round(calories_today, 1),
            "pct": min(100, int((protein_today / max(user.get("protein_goal", 120), 1)) * 100)),
        },
        "overall_streak": overall_streak,
        "expenses_month_total": expense_total,
        "pending_shopping": pending_shopping,
        "last_gym": last_gym_doc,
    }


@api.get("/insights/weekly")
async def insights(user: dict = Depends(get_current_user)):
    start = (date.today() - timedelta(days=6)).isoformat()
    end = _today_str()
    tasks_done = await db.tasks.count_documents({"user_id": user["id"], "status": "done"})
    logs = await db.habit_logs.find({"user_id": user["id"], "date": {"$gte": start, "$lte": end}},
                                    {"_id": 0}).to_list(5000)
    by_day = {}
    for l in logs:
        by_day[l["date"]] = by_day.get(l["date"], 0) + 1
    entries = await db.food_entries.find({"user_id": user["id"], "date": {"$gte": start, "$lte": end}},
                                         {"_id": 0}).to_list(5000)
    protein_by_day = {}
    for e in entries:
        protein_by_day[e["date"]] = protein_by_day.get(e["date"], 0) + e.get("protein_g", 0)
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
                         "count": by_day.get((date.today() - timedelta(days=6 - i)).isoformat(), 0)}
                        for i in range(7)],
        "protein_daily": [{"date": (date.today() - timedelta(days=6 - i)).isoformat(),
                           "protein_g": round(protein_by_day.get(
                               (date.today() - timedelta(days=6 - i)).isoformat(), 0), 1)}
                          for i in range(7)],
    }


@api.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(api)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
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
    await db.gym_sessions.create_index([("user_id", 1), ("date", -1)])
    await db.gym_templates.create_index("user_id")
    await db.shopping_items.create_index("user_id")
    await db.expenses.create_index([("user_id", 1), ("date", -1)])
    await db.hobby_entries.create_index([("user_id", 1), ("date", -1)])

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
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_pw)}})
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