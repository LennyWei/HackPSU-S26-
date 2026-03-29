"""
Flask API — routes for the Boss Rush Study Game.
Matches the contract expected by the Next.js frontend.
"""

import os
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from game_engine import create_game, start_run, summon_boss, next_boss, get_session
from gemini_pipeline import _model, _parse_json

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
    game = data.get("game", {})

    current_boss    = game.get("currentBoss", {})
    current_cluster = game.get("currentCluster", {})
    difficulty      = game.get("difficulty", "normal")
    weak_spots      = game.get("weakSpots", [])
    concepts        = [c.get("name", "") for c in current_cluster.get("concepts", [])]

    diff_tier = {"easy": 1, "normal": 2, "hard": 3}.get(difficulty, 2)

    prompt = f"""You are {current_boss.get("name", "the Boss")}, a villain in a study game.
Personality: {current_boss.get("personality", "aggressive")}
Topic: {current_cluster.get("clusterName", "Unknown")}
Key concepts: {concepts}
Difficulty tier: {diff_tier}/3
Player weak spots — prioritize these: {weak_spots if weak_spots else "none yet"}

Generate ONE multiple-choice question about this topic.
Return ONLY valid JSON with no markdown fences:
{{
    "id": "q_{os.urandom(4).hex()}",
    "dialogue": "In-character intro before asking the question (1-2 sentences)",
    "question_text": "The full question text",
    "options": [
        {{"id": "A", "text": "first option"}},
        {{"id": "B", "text": "second option"}},
        {{"id": "C", "text": "third option"}},
        {{"id": "D", "text": "fourth option"}}
    ],
    "correct_answer": "A",
    "explanation": "Clear explanation of why the correct answer is right",
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
        response = _model.generate_content(prompt)
        result = _parse_json(response.text)
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
        response = _model.generate_content(prompt)
        result = _parse_json(response.text)
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
