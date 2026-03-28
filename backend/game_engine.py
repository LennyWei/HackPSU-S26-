"""
Game Engine — orchestrates the boss rush study game.

Manages the state machine flow:
  Upload → Extract Knowledge → Start Run → Boss Loop → Questions → 
  Judge → Check HP → Next Boss / Final Boss → Run Complete → Next Run / Game Over
"""
import uuid
from dataclasses import asdict
from models import GameSession, Boss, Question, AnswerJudgment, Player
from gemini_pipeline import (
    call_1_extract_knowledge,
    call_2_generate_boss,
    call_3_generate_question,
    call_4_judge_answer,
)


# ---------------------------------------------------------------------------
# In-memory session store (swap for Redis/DB in production)
# ---------------------------------------------------------------------------

_sessions: dict[str, GameSession] = {}


def get_session(session_id: str) -> GameSession | None:
    return _sessions.get(session_id)


def _save_session(session: GameSession):
    _sessions[session.session_id] = session


# ===========================================================================
# Phase 1: Upload & Knowledge Extraction
# ===========================================================================

def create_game(pdf_bytes: bytes) -> dict:
    """
    Player uploads their review sheet. We extract knowledge and return
    the session + topic list so the frontend can show the boss map.
    """
    session_id = str(uuid.uuid4())
    session = GameSession(session_id=session_id)

    # Call 1 — extract topics from PDF
    kg = call_1_extract_knowledge(pdf_bytes)
    session.knowledge_graph = kg
    _save_session(session)

    return {
        "session_id": session_id,
        "subject": kg.subject,
        "document_complexity": kg.document_complexity,
        "total_topics": len(kg.topics),
        "topics": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "difficulty_tag": t.difficulty_tag,
            }
            for t in kg.topics
        ],
    }


# ===========================================================================
# Phase 2: Start a Run
# ===========================================================================

def start_run(session_id: str) -> dict:
    """
    Begin a new run. Shuffles topics, resets player HP, returns the run info.
    """
    session = get_session(session_id)
    if not session:
        return {"error": "Session not found"}
    if not session.knowledge_graph:
        return {"error": "No knowledge graph — upload a document first"}

    run = session.start_new_run()
    _save_session(session)

    return {
        "run_number": run.run_number,
        "difficulty": run.difficulty.name,
        "topic_order": run.topic_order,
        "total_bosses": len(run.topic_order),
        "player_hp": session.player.current_hp,
        "player_max_hp": session.player.max_hp,
    }


# ===========================================================================
# Phase 3: Summon Boss
# ===========================================================================

def summon_boss(session_id: str) -> dict:
    """
    Generate the next boss for the current topic in the run.
    If only 1 topic remains, it becomes the final boss.
    """
    session = get_session(session_id)
    if not session or not session.current_run:
        return {"error": "No active run"}

    run = session.current_run
    topic_id = run.current_topic_id

    if topic_id is None:
        return {"error": "No more topics in this run"}

    # Determine if this is the final boss
    is_final = run.topics_remaining == 1

    if is_final:
        # Final boss spans ALL topics
        all_topic_ids = [t.id for t in session.knowledge_graph.topics]
        boss = call_2_generate_boss(session, all_topic_ids, is_final=True)
        run.is_final_boss = True
    else:
        boss = call_2_generate_boss(session, [topic_id], is_final=False)

    run.current_boss = boss
    _save_session(session)

    return {
        "boss_id": boss.id,
        "boss_name": boss.name,
        "personality": boss.personality,
        "backstory": boss.backstory,
        "opening_monologue": boss.opening_monologue,
        "sprite_category": boss.sprite_category,
        "boss_hp": boss.current_hp,
        "boss_max_hp": boss.max_hp,
        "is_final_boss": boss.is_final,
        "topic_ids": boss.topic_ids,
        "player_hp": session.player.current_hp,
        "player_max_hp": session.player.max_hp,
    }


# ===========================================================================
# Phase 4: Get Next Question
# ===========================================================================

def get_question(session_id: str) -> dict:
    """
    Generate the next adaptive question for the current boss fight.
    """
    session = get_session(session_id)
    if not session or not session.current_run:
        return {"error": "No active run"}

    run = session.current_run
    boss = run.current_boss

    if not boss:
        return {"error": "No active boss — summon one first"}
    if not boss.is_alive:
        return {"error": "Boss is already defeated", "boss_defeated": True}
    if not session.player.is_alive:
        return {"error": "Player is dead", "player_dead": True}

    question = call_3_generate_question(session, boss)
    run.questions_asked.append(question.id)

    # Store the question so we can look it up when judging
    if not hasattr(session, '_question_cache'):
        session._question_cache = {}
    session._question_cache[question.id] = question
    _save_session(session)

    return {
        "question_id": question.id,
        "topic_id": question.topic_id,
        "concept": question.concept,
        "question_text": question.question_text,
        "question_type": question.question_type,
        "options": question.options,
        "difficulty_tier": question.difficulty_tier,
        "time_limit_seconds": question.time_limit_seconds,
        "boss_hp": boss.current_hp,
        "boss_max_hp": boss.max_hp,
        "player_hp": session.player.current_hp,
    }


# ===========================================================================
# Phase 5: Submit Answer
# ===========================================================================

def submit_answer(session_id: str, question_id: str, player_answer: str,
                  timed_out: bool = False) -> dict:
    """
    Player submits their answer (or times out). Judge it and apply HP changes.
    Returns the judgment, updated HP values, and whether the boss/player is dead.
    """
    session = get_session(session_id)
    if not session or not session.current_run:
        return {"error": "No active run"}

    run = session.current_run
    boss = run.current_boss
    if not boss:
        return {"error": "No active boss"}

    # Retrieve the cached question
    cache = getattr(session, '_question_cache', {})
    question = cache.get(question_id)
    if not question:
        return {"error": "Question not found — it may have expired"}

    # --- Handle timeout ---
    if timed_out:
        player_answer = "[TIMED OUT — no answer given]"

    # Call 4 — judge the answer
    judgment = call_4_judge_answer(player_answer, question, boss, session)

    # --- Apply HP changes ---
    if judgment.is_correct:
        boss.take_damage(question.damage_on_correct)
        run.questions_correct.append(question_id)
        session.total_correct += 1
    else:
        session.player.take_damage(question.damage_on_wrong)
        run.questions_wrong.append(question_id)

    session.total_questions_answered += 1

    # Track weak spots
    if judgment.add_to_weak_spots and question.concept not in run.weak_spots:
        run.weak_spots.append(question.concept)
        if question.concept not in session.all_weak_spots:
            session.all_weak_spots.append(question.concept)

    # Remove from weak spots if mastered
    if judgment.concept_mastered and question.concept in run.weak_spots:
        run.weak_spots.remove(question.concept)

    _save_session(session)

    # --- Determine combat state ---
    boss_defeated = not boss.is_alive
    player_dead = not session.player.is_alive

    result = {
        "is_correct": judgment.is_correct,
        "partial_credit": judgment.partial_credit,
        "boss_dialogue": judgment.boss_dialogue,
        "explanation": judgment.explanation,
        "correct_answer": question.correct_answer,
        "boss_hp": boss.current_hp,
        "boss_max_hp": boss.max_hp,
        "player_hp": session.player.current_hp,
        "player_max_hp": session.player.max_hp,
        "damage_dealt": question.damage_on_correct if judgment.is_correct else 0,
        "damage_taken": 0 if judgment.is_correct else question.damage_on_wrong,
        "boss_defeated": boss_defeated,
        "player_dead": player_dead,
    }

    # If boss is defeated, check if run is over
    if boss_defeated:
        has_next = run.topics_remaining > 1  # more than current one left
        result["run_complete"] = not has_next and run.is_final_boss
        result["has_next_boss"] = has_next or (not run.is_final_boss and run.topics_remaining == 1)

    # If player is dead, attach stats
    if player_dead:
        result["death_stats"] = _build_stats(session)

    return result


# ===========================================================================
# Phase 6: Advance to Next Boss
# ===========================================================================

def next_boss(session_id: str) -> dict:
    """
    After defeating a boss, advance to the next topic.
    Returns info about what's coming next.
    """
    session = get_session(session_id)
    if not session or not session.current_run:
        return {"error": "No active run"}

    has_next = session.advance_to_next_boss()
    _save_session(session)

    if not has_next:
        # Run is complete
        session.record_run_stats()
        _save_session(session)
        return {
            "run_complete": True,
            "stats": _build_stats(session),
            "can_start_next_run": True,
        }

    return {
        "run_complete": False,
        "topics_remaining": session.current_run.topics_remaining,
        "next_topic_id": session.current_run.current_topic_id,
    }


# ===========================================================================
# Stats / Overview
# ===========================================================================

def get_overview(session_id: str) -> dict:
    """Return full stats for the victory/death screen."""
    session = get_session(session_id)
    if not session:
        return {"error": "Session not found"}
    return _build_stats(session)


def _build_stats(session: GameSession) -> dict:
    run = session.current_run
    total = session.total_questions_answered
    correct = session.total_correct
    accuracy = (correct / total * 100) if total > 0 else 0

    return {
        "run_number": run.run_number if run else 0,
        "total_questions": total,
        "total_correct": correct,
        "accuracy": round(accuracy, 1),
        "weak_spots": session.all_weak_spots,
        "run_history": session.run_history,
        "current_run_stats": {
            "questions_asked": len(run.questions_asked) if run else 0,
            "correct": len(run.questions_correct) if run else 0,
            "wrong": len(run.questions_wrong) if run else 0,
            "weak_spots": list(run.weak_spots) if run else [],
        } if run else None,
    }