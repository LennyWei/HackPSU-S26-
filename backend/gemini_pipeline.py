"""
Gemini Pipeline — the four AI calls that power the Boss Rush Study Game.

Call 1: Extract knowledge graph from PDF
Call 2: Generate a boss for a topic
Call 3: Generate an adaptive question
Call 4: Judge the player's answer
"""

import os
import json
import io
import tempfile
from google import genai
from dotenv import load_dotenv
from models import KnowledgeGraph, Boss, Question, AnswerJudgment

load_dotenv()
_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
_MODEL  = "gemini-2.5-flash-lite"


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _parse_json(text: str) -> dict:
    """Strip markdown code fences and parse JSON from a Gemini response."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())


# ---------------------------------------------------------------------------
# Call 1 — Extract Knowledge Graph from PDF
# ---------------------------------------------------------------------------

def call_1_extract_knowledge(pdf_bytes: bytes) -> KnowledgeGraph:
    """Upload the PDF directly to Gemini and extract a structured knowledge graph."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        uploaded = _client.files.upload(
            file=tmp_path,
            config={"mime_type": "application/pdf"},
        )

        prompt = """You are an expert educator. Analyze this study material and extract a structured knowledge graph.

Return ONLY valid JSON with no markdown fences:
{
    "subject": "Name of the subject or course",
    "document_complexity": "low|medium|high",
    "total_concept_count": <integer>,
    "topics": [
        {
            "id": "short unique id like t1, t2...",
            "name": "Topic Name",
            "description": "2-3 sentence description of this topic",
            "difficulty_tag": "easy|medium|hard",
            "key_concepts": ["concept1", "concept2", "concept3"],
            "has_diagrams": false,
            "subject_category": "science|math|history|literature|other"
        }
    ]
}

Extract 3-5 major topics. Each topic must be a distinct, testable area of the material."""

        response = _client.models.generate_content(
            model=_MODEL,
            contents=[uploaded, prompt],
        )
        _client.files.delete(name=uploaded.name)
        data = _parse_json(response.text)
        return KnowledgeGraph.from_dict(data)
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# Call 2 — Generate a Boss for a Topic
# ---------------------------------------------------------------------------

def call_2_generate_boss(session, topic_ids: list[str], is_final: bool = False) -> Boss:
    """Generate a villain boss themed around the given topic(s)."""
    kg = session.knowledge_graph
    topics = [t for t in kg.topics if t.id in topic_ids]
    topic_names = [t.name for t in topics]
    concepts = [c for t in topics for c in t.key_concepts]
    subject_category = topics[0].subject_category if topics else "generic"
    boss_type = "FINAL BOSS spanning all topics" if is_final else "regular boss"
    max_hp = 400 if is_final else 200

    prompt = f"""You are a game designer creating a villain boss for a study game about {kg.subject}.
This is a {boss_type} for the topic(s): {', '.join(topic_names)}.

Return ONLY valid JSON with no markdown fences:
{{
    "id": "short unique id like b1, b2...",
    "name": "Creative villain name themed around the topic",
    "personality": "one of: aggressive|cunning|arrogant|mysterious|dramatic",
    "backstory": "2 sentence villain backstory themed around the topic",
    "opening_monologue": "In-character opening taunt (2-3 sentences)",
    "taunts": {{
        {chr(10).join(f'        "{c}": "short taunt referencing {c}",' for c in concepts[:5])}
        "default": "Generic taunt the boss uses as fallback"
    }},
    "sprite_category": "{subject_category}",
    "max_hp": {max_hp},
    "topic_ids": {json.dumps(topic_ids)}
}}
"""
    response = _client.models.generate_content(model=_MODEL, contents=prompt)
    data = _parse_json(response.text or "")
    return Boss.from_dict(data, is_final=is_final)


# ---------------------------------------------------------------------------
# Call 3 — Generate an Adaptive Question
# ---------------------------------------------------------------------------

def call_3_generate_question(session, boss) -> Question:
    """Generate the next question, adapting to the player's weak spots and difficulty."""
    run = session.current_run
    kg = session.knowledge_graph
    topics = [t for t in kg.topics if t.id in boss.topic_ids]
    difficulty_tier = run.difficulty.value

    # Build context about what has already been asked
    cache = getattr(session, '_question_cache', {})
    asked_concepts = [cache[qid].concept for qid in run.questions_asked if qid in cache]
    weak_spots = run.weak_spots

    topic_text = "\n".join(
        f"- {t.name}: {t.description} (key concepts: {', '.join(t.key_concepts)})"
        for t in topics
    )

    prompt = f"""You are {boss.name}, a villain boss in a study game. Generate ONE question for the player.

Topics being tested:
{topic_text}

Difficulty tier: {difficulty_tier} out of 5
Player's weak spots — prioritize these if possible: {weak_spots if weak_spots else "none identified yet"}
Concepts already asked — do not repeat: {asked_concepts if asked_concepts else "none yet"}

Return ONLY valid JSON with no markdown fences:
{{
    "id": "short unique id like q1, q2...",
    "topic_id": "{topics[0].id if topics else ''}",
    "concept": "the specific concept this question tests",
    "question_text": "The full question text",
    "question_type": "recall|conceptual|application",
    "options": [
        {{"id": "A", "text": "first option"}},
        {{"id": "B", "text": "second option"}},
        {{"id": "C", "text": "third option"}},
        {{"id": "D", "text": "fourth option"}}
    ],
    "correct_answer": "A",
    "explanation": "Clear explanation of why the correct answer is right",
    "difficulty": <integer 1-10 reflecting how hard this specific question is>,
    "wrong_taunts": [
        {{"answer": "A", "taunt": "in-character taunt mocking the player for choosing A (only include if A is wrong)"}},
        {{"answer": "B", "taunt": "in-character taunt mocking the player for choosing B (only include if B is wrong)"}},
        {{"answer": "C", "taunt": "in-character taunt mocking the player for choosing C (only include if C is wrong)"}},
        {{"answer": "D", "taunt": "in-character taunt mocking the player for choosing D (only include if D is wrong)"}}
    ],
    "difficulty_tier": {difficulty_tier},
    "damage_on_correct": {10 * difficulty_tier + 10},
    "damage_on_wrong": {5 * difficulty_tier + 5}
}}
"""
    response = _client.models.generate_content(model=_MODEL, contents=prompt)
    data = _parse_json(response.text or "")
    return Question.from_dict(data)


# ---------------------------------------------------------------------------
# Call 4 — Judge the Player's Answer
# ---------------------------------------------------------------------------

def call_4_judge_answer(player_answer: str, question: Question, boss, session) -> AnswerJudgment:
    """Judge the player's answer and return the boss's reaction."""
    prompt = f"""You are {boss.name}, a villain boss with a {boss.personality} personality.
Judge the student's answer and react in character.

Question: {question.question_text}
Options given: {question.options}
Correct answer: {question.correct_answer}
Player answered: {player_answer}

Return ONLY valid JSON with no markdown fences:
{{
    "is_correct": true or false,
    "partial_credit": false,
    "boss_dialogue": "Your in-character reaction to the answer (2 sentences, stay in villain persona)",
    "explanation": "Brief factual explanation of the correct answer",
    "concept_mastered": true if the player answered correctly,
    "add_to_weak_spots": true if the player answered incorrectly
}}
"""
    response = _client.models.generate_content(model=_MODEL, contents=prompt)
    data = _parse_json(response.text or "")
    return AnswerJudgment.from_dict(data)
