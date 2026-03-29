"""
Data models for the Boss Rush Study Game.
All game state is represented here.
"""
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
import random
import uuid


class Difficulty(Enum):
    """Scales with run number."""
    RECALL = 1        # Run 1: basic recall, definitions, "what is X?"
    CONCEPTUAL = 2    # Run 2: understanding, "why does X happen?"
    APPLICATION = 3   # Run 3: apply knowledge, "solve this using X"
    ANALYSIS = 4      # Run 4: compare, contrast, edge cases
    SYNTHESIS = 5     # Run 5+: combine topics, create, evaluate


def difficulty_for_run(run_number: int) -> Difficulty:
    """Map run number to difficulty tier."""
    clamped = min(run_number, 5)
    return Difficulty(clamped)


@dataclass
class Topic:
    """A single topic extracted from the knowledge graph."""
    id: str
    name: str
    description: str
    difficulty_tag: str          # e.g. "easy", "medium", "hard"
    key_concepts: list[str]      # sub-concepts under this topic
    has_diagrams: bool = False
    subject_category: str = ""

    @staticmethod
    def from_dict(d: dict) -> "Topic":
        return Topic(
            id=d.get("id", str(uuid.uuid4())[:8]),
            name=d["name"],
            description=d.get("description", ""),
            difficulty_tag=d.get("difficulty_tag", "medium"),
            key_concepts=d.get("key_concepts", []),
            has_diagrams=d.get("has_diagrams", False),
            subject_category=d.get("subject_category", ""),
        )


@dataclass
class KnowledgeGraph:
    """Output of Call 1 — full extraction from the review sheet."""
    topics: list[Topic]
    subject: str                 # e.g. "Calculus II"
    document_complexity: str     # "low", "medium", "high"
    total_concept_count: int = 0

    @staticmethod
    def from_dict(d: dict) -> "KnowledgeGraph":
        topics = [Topic.from_dict(t) for t in d.get("topics", [])]
        return KnowledgeGraph(
            topics=topics,
            subject=d.get("subject", "Unknown"),
            document_complexity=d.get("document_complexity", "medium"),
            total_concept_count=d.get("total_concept_count", len(topics)),
        )


@dataclass
class Boss:
    """Output of Call 2 — a boss tied to a topic (or final boss spanning all)."""
    id: str
    name: str
    personality: str
    backstory: str
    opening_monologue: str
    taunts: dict[str, str]       # concept -> taunt line
    sprite_category: str
    max_hp: int
    current_hp: int
    topic_ids: list[str]         # single topic for normal boss, all for final
    is_final: bool = False

    @staticmethod
    def from_dict(d: dict, is_final: bool = False) -> "Boss":
        max_hp = d.get("max_hp", 100)
        return Boss(
            id=d.get("id", str(uuid.uuid4())[:8]),
            name=d["name"],
            personality=d.get("personality", ""),
            backstory=d.get("backstory", ""),
            opening_monologue=d.get("opening_monologue", ""),
            taunts=d.get("taunts", {}),
            sprite_category=d.get("sprite_category", "generic"),
            max_hp=max_hp,
            current_hp=max_hp,
            topic_ids=d.get("topic_ids", []),
            is_final=is_final,
        )

    @property
    def is_alive(self) -> bool:
        return self.current_hp > 0

    def take_damage(self, amount: int):
        self.current_hp = max(0, self.current_hp - amount)


@dataclass
class Question:
    """Output of Call 3 — a single question in combat."""
    id: str
    topic_id: str
    concept: str
    question_text: str
    question_type: str           # "recall", "conceptual", "application", etc.
    options: list[dict]          # [{"id": "A", "text": "..."}, ...]
    correct_answer: str          # option id, e.g. "A"
    explanation: str
    difficulty: int              # 1-10
    wrong_taunts: list[dict]     # [{"answer": "B", "taunt": "..."}, ...] one per wrong option
    difficulty_tier: int         # 1-5 matching Difficulty enum
    damage_on_correct: int       # how much boss HP to remove
    damage_on_wrong: int         # how much player HP to remove

    @staticmethod
    def from_dict(d: dict) -> "Question":
        return Question(
            id=d.get("id", str(uuid.uuid4())[:8]),
            topic_id=d.get("topic_id", ""),
            concept=d.get("concept", ""),
            question_text=d["question_text"],
            question_type=d.get("question_type", "recall"),
            options=d.get("options", []),
            correct_answer=d.get("correct_answer", ""),
            explanation=d.get("explanation", ""),
            difficulty=d.get("difficulty", 5),
            wrong_taunts=d.get("wrong_taunts", []),
            difficulty_tier=d.get("difficulty_tier", 1),
            damage_on_correct=d.get("damage_on_correct", 20),
            damage_on_wrong=d.get("damage_on_wrong", 15),
        )


@dataclass
class AnswerJudgment:
    """Output of Call 4 — the boss's reaction to the player's answer."""
    is_correct: bool
    partial_credit: bool
    boss_dialogue: str
    explanation: str             # per-option reasoning
    concept_mastered: bool       # if True, concept won't be revisited aggressively
    add_to_weak_spots: bool

    @staticmethod
    def from_dict(d: dict) -> "AnswerJudgment":
        return AnswerJudgment(
            is_correct=d.get("is_correct", False),
            partial_credit=d.get("partial_credit", False),
            boss_dialogue=d.get("boss_dialogue", ""),
            explanation=d.get("explanation", ""),
            concept_mastered=d.get("concept_mastered", False),
            add_to_weak_spots=d.get("add_to_weak_spots", False),
        )


@dataclass
class Player:
    """Player state across the entire session."""
    max_hp: int = 100
    current_hp: int = 100
    # items: list = field(default_factory=list)  # future: shop items

    @property
    def is_alive(self) -> bool:
        return self.current_hp > 0

    def take_damage(self, amount: int):
        self.current_hp = max(0, self.current_hp - amount)

    def heal(self, amount: int):
        self.current_hp = min(self.max_hp, self.current_hp + amount)

    def reset_for_run(self):
        """Full heal at the start of each run."""
        self.current_hp = self.max_hp


@dataclass
class RunState:
    """State for a single run (one pass through all topics)."""
    run_number: int
    difficulty: Difficulty
    topic_order: list[str]           # topic IDs in random order
    current_topic_index: int = 0
    current_boss: Optional[Boss] = None
    questions_asked: list[str] = field(default_factory=list)    # question IDs
    questions_correct: list[str] = field(default_factory=list)
    questions_wrong: list[str] = field(default_factory=list)
    weak_spots: list[str] = field(default_factory=list)         # concept names
    is_final_boss: bool = False

    @property
    def current_topic_id(self) -> Optional[str]:
        if self.current_topic_index < len(self.topic_order):
            return self.topic_order[self.current_topic_index]
        return None

    @property
    def topics_remaining(self) -> int:
        return len(self.topic_order) - self.current_topic_index

    @property
    def is_on_final_boss(self) -> bool:
        # Final boss triggers when only 1 topic left
        return self.topics_remaining == 1 and not self.is_final_boss


@dataclass
class GameSession:
    """Top-level game state for a player's entire session."""
    session_id: str
    knowledge_graph: Optional[KnowledgeGraph] = None
    player: Player = field(default_factory=Player)
    current_run: Optional[RunState] = None
    run_history: list[dict] = field(default_factory=list)  # stats per completed run
    total_questions_answered: int = 0
    total_correct: int = 0
    all_weak_spots: list[str] = field(default_factory=list)

    def start_new_run(self) -> RunState:
        """Initialize a new run with shuffled topics."""
        run_num = (self.current_run.run_number + 1) if self.current_run else 1
        self.player.reset_for_run()

        topic_ids = [t.id for t in self.knowledge_graph.topics]
        random.shuffle(topic_ids)

        self.current_run = RunState(
            run_number=run_num,
            difficulty=difficulty_for_run(run_num),
            topic_order=topic_ids,
        )
        return self.current_run

    def advance_to_next_boss(self):
        """Move to next topic in the run. Returns True if there's a next boss."""
        if self.current_run is None:
            return False
        self.current_run.current_topic_index += 1
        self.current_run.current_boss = None
        return self.current_run.current_topic_id is not None

    def record_run_stats(self):
        """Snapshot current run stats into history."""
        if self.current_run:
            self.run_history.append({
                "run_number": self.current_run.run_number,
                "questions_asked": len(self.current_run.questions_asked),
                "correct": len(self.current_run.questions_correct),
                "wrong": len(self.current_run.questions_wrong),
                "weak_spots": list(self.current_run.weak_spots),
                "difficulty": self.current_run.difficulty.name,
            })