"""
Flask API — routes for the Boss Rush Study Game.
Matches the contract expected by the Next.js frontend.
"""

import os
import base64
import random
from flask import Flask, request, jsonify
from flask_cors import CORS
from game_engine import create_game, start_run, summon_boss, next_boss, get_session
from gemini_pipeline import _client, _MODEL, _parse_json

app = Flask(__name__)
CORS(app)

_current_session_id = None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "boss-rush-backend"})


# ---------------------------------------------------------------------------
# POST /lobby/upload
# Accepts base64 PDF, extracts knowledge graph, generates all bosses upfront.
# Returns { bossRush, bosses } in the shape the frontend expects.
# ---------------------------------------------------------------------------

@app.route("/lobby/upload", methods=["POST"])
def upload():
    data = request.get_json(silent=True) or {}
    pdf_b64 = data.get("pdf")
    if not pdf_b64:
        return jsonify({"error": "No PDF provided"}), 400

    try:
        pdf_bytes = base64.b64decode(pdf_b64)

        # Phase 1 — extract knowledge graph + create session
        result = create_game(pdf_bytes)
        session_id = result["session_id"]

        global _current_session_id
        _current_session_id = session_id

        # Phase 2 — start run so topics are ready
        start_run(session_id)
        session = get_session(session_id)
        if not session or not session.knowledge_graph:
            return jsonify({"error": "Failed to initialize session"}), 500
        kg = session.knowledge_graph

        boss_rush = []
        bosses = []

        for i, topic in enumerate(kg.topics):
            # Build bossRush cluster entry
            boss_rush.append({
                "clusterId": topic.id,
                "clusterName": topic.name,
                "concepts": [
                    {
                        "id": f"{topic.id}_c{j}",
                        "name": concept,
                        "summary": f"Key concept from {topic.name}",
                        "difficulty": topic.difficulty_tag,
                        "related_concepts": [],
                        "has_diagram": topic.has_diagrams,
                    }
                    for j, concept in enumerate(topic.key_concepts)
                ],
            })

            # Generate boss for this topic
            summon_boss(session_id)
            boss = session.current_run.current_boss

            # taunts is stored as dict {concept: line} — convert to list for frontend
            taunts_list = list(boss.taunts.values()) if isinstance(boss.taunts, dict) else ["You dare challenge me?"]

            bosses.append({
                "clusterId": topic.id,
                "name": boss.name,
                "personality": boss.personality,
                "backstory": boss.backstory,
                "opening_monologue": boss.opening_monologue,
                "taunts": taunts_list,
                "sprite_category": boss.sprite_category,
                "max_hp": boss.max_hp,
            })

            # Advance to next topic unless this was the last one
            if i < len(kg.topics) - 1:
                next_boss(session_id)

        return jsonify({"bossRush": boss_rush, "bosses": bosses})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# POST /battle/question
# Receives the full frontend game state, generates the next question.
# ---------------------------------------------------------------------------

@app.route("/battle/question", methods=["POST"])
def battle_question():
    data = request.get_json(silent=True) or {}
    game          = data.get("game", {})
    question_mode = data.get("question_mode", "mcq")   # 'mcq' | 'frq' | 'both'

    current_cluster = game.get("currentCluster", {})
    difficulty      = game.get("difficulty", "normal")
    weak_spots      = game.get("weakSpots", [])
    concepts        = [c.get("name", "") for c in current_cluster.get("concepts", [])]

    diff_tier = {"easy": 1, "normal": 2, "hard": 3}.get(difficulty, 2)

    # Resolve 'both' to a concrete type
    if question_mode == "both":
        use_frq = random.random() < 0.5
    else:
        use_frq = question_mode == "frq"

    topic     = current_cluster.get("clusterName", "Unknown")
    weak_text = str(weak_spots) if weak_spots else "none yet"

    if use_frq:
        prompt = f"""Generate a free-response study question for a student.
Topic: {topic}
Key concepts: {concepts}
Difficulty tier: {diff_tier}/3
Player weak spots — prioritize these: {weak_text}

Return ONLY valid JSON with no markdown fences:
{{
    "id": "q_{os.urandom(4).hex()}",
    "question_type": "free_response",
    "dialogue": "In-character villain intro before posing the question (1-2 sentences)",
    "question_text": "The full open-ended question (requires a written answer)",
    "options": [],
    "correct_answer": "A complete model answer covering all key points a correct response must include",
    "explanation": "What makes a strong answer to this question",
    "concept": "the specific concept being tested",
    "difficulty": <integer 1-10>,
    "wrong_taunts": []
}}"""
    else:
        prompt = f"""Generate a study question for a student.
Topic: {topic}
Key concepts: {concepts}
Difficulty tier: {diff_tier}/3
Player weak spots — prioritize these: {weak_text}

Generate ONE multiple-choice question about this topic.
Answer options must be as short as the answer naturally allows. If the answer is a name, term, or single fact, the option text should be just that — no descriptions or explanations attached. Only use longer option text if the question itself requires a multi-part answer (e.g. a definition or process). Match the length of all four options to each other.
Return ONLY valid JSON with no markdown fences:
{{
    "id": "q_{os.urandom(4).hex()}",
    "question_type": "mcq",
    "dialogue": "In-character intro before asking the question (1-2 sentences)",
    "question_text": "The full question text",
    "options": [
        {{"id": "A", "text": "first option"}},
        {{"id": "B", "text": "second option"}},
        {{"id": "C", "text": "third option"}},
        {{"id": "D", "text": "fourth option"}}
    ],
    "correct_answer": "the id of whichever option (A/B/C/D) is correct - vary this",
    "explanation": {{
        "A": "Explanation of why A is correct or incorrect",
        "B": "Explanation of why B is correct or incorrect",
        "C": "Explanation of why C is correct or incorrect",
        "D": "Explanation of why D is correct or incorrect"
    }},
    "concept": "the specific concept being tested",
    "difficulty": <integer 1-10 reflecting how hard this specific question is>,
    "wrong_taunts": [
        {{"answer": "A", "taunt": "in-character taunt mocking the player for choosing A (only include if A is wrong)"}},
        {{"answer": "B", "taunt": "in-character taunt mocking the player for choosing B (only include if B is wrong)"}},
        {{"answer": "C", "taunt": "in-character taunt mocking the player for choosing C (only include if C is wrong)"}},
        {{"answer": "D", "taunt": "in-character taunt mocking the player for choosing D (only include if D is wrong)"}}
    ]
}}"""

    try:
        response = _client.models.generate_content(model=_MODEL, contents=prompt)
        result = _parse_json(response.text or "")
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# POST /battle/answer
# Receives the player's answer + question + game state, returns the verdict.
# ---------------------------------------------------------------------------

@app.route("/battle/answer", methods=["POST"])
def battle_answer():
    data = request.get_json(silent=True) or {}
    answer       = data.get("answer", "")
    question     = data.get("question", "")
    game         = data.get("game", {})
    current_boss = game.get("currentBoss", {})

    prompt = f"""You are {current_boss.get("name", "the Boss")}, a villain with a {current_boss.get("personality", "aggressive")} personality.
Judge the student's answer and react in character.

Question: {question}
Player answered: {answer}

Return ONLY valid JSON with no markdown fences:
{{
    "dialogue": "Your in-character reaction (2 sentences, stay in villain persona)",
    "verdict": {{
        "correct": true or false,
        "explanation": "Brief factual explanation of the correct answer",
        "conceptName": "the concept being tested",
        "damage": 30,
        "playerDamage": 0,
        "scoreGained": 100
    }}
}}

Rules:
- If correct:   damage=30, playerDamage=0,  scoreGained=100
- If incorrect: damage=0,  playerDamage=20, scoreGained=0"""

    try:
        response = _client.models.generate_content(model=_MODEL, contents=prompt)
        result = _parse_json(response.text or "")
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# POST /battle/judge
# Judges a free-response answer with Gemini acting as teacher.
# ---------------------------------------------------------------------------

@app.route("/battle/judge", methods=["POST"])
def battle_judge():
    data          = request.get_json(silent=True) or {}
    player_answer = data.get("player_answer", "")
    question_text = data.get("question_text", "")
    model_answer  = data.get("model_answer", "")
    game          = data.get("game", {})
    current_boss  = game.get("currentBoss", {})

    prompt = f"""You are {current_boss.get("name", "the Boss")}, a villain with a {current_boss.get("personality", "aggressive")} personality.
Evaluate the student's free-response answer and react in character.

Question: {question_text}
Model answer (key points that must be covered): {model_answer}
Player's answer: {player_answer}

Grading criteria:
- is_correct: true if the student demonstrates understanding of the core concept, even partially
- Accept answers that capture the main idea, even if incomplete, imprecise, or informally worded
- Only mark false if the answer is factually wrong, contradicts the concept, or is completely off-topic
- When in doubt, lean toward marking it correct

Return ONLY valid JSON with no markdown fences:
{{
    "is_correct": true or false,
    "explanation": "What was right/wrong and what the ideal answer covers (2-3 sentences)",
    "boss_dialogue": "Your in-character reaction to the answer (2 sentences, stay in villain persona)"
}}"""

    try:
        response = _client.models.generate_content(model=_MODEL, contents=prompt)
        result = _parse_json(response.text or "")
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# GET /result  /  GET /shop
# ---------------------------------------------------------------------------

@app.route("/result", methods=["GET"])
def result():
    return jsonify({"status": "complete"})


@app.route("/shop", methods=["GET"])
def shop():
    return jsonify({"items": []})


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
