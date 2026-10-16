"""Fórmula oficial de pontuação, compartilhada por todos os handlers Lambda."""

from dataclasses import asdict, dataclass
from math import floor

SCORE_VERSION = 1
VICTORY_POINTS = 1_000
ENEMY_KILL_POINTS = 100
MAXIMUM_TIME_BONUS = 6_000
POINTS_LOST_PER_SECOND = 10
DAMAGE_POINTS = (2_000, 1_200, 600)
MULTI_KILL_TWO = 250
MULTI_KILL_EXTRA = 100


@dataclass(frozen=True)
class ScoreBreakdown:
    victoryPoints: int
    timePoints: int
    enemyPoints: int
    multiKillPoints: int
    damagePoints: int
    total: int

    def to_dict(self) -> dict[str, int]:
        return asdict(self)


def time_points(elapsed_time_ms: int) -> int:
    seconds = floor(max(0, elapsed_time_ms) / 1_000)
    return max(0, MAXIMUM_TIME_BONUS - seconds * POINTS_LOST_PER_SECOND)


def damage_points(hits_taken: int) -> int:
    hits = max(0, floor(hits_taken))
    return DAMAGE_POINTS[hits] if hits < len(DAMAGE_POINTS) else 0


def multi_kill_bonus(kills: int) -> int:
    count = max(0, floor(kills))
    if count < 2:
        return 0
    return MULTI_KILL_TWO + (count - 2) * MULTI_KILL_EXTRA


def calculate_score(
    *,
    won: bool,
    elapsed_time_ms: int,
    enemies_defeated: int,
    hits_taken: int,
    multi_kills: list[int],
) -> ScoreBreakdown:
    victory = VICTORY_POINTS if won else 0
    time = time_points(elapsed_time_ms)
    enemies = max(0, floor(enemies_defeated)) * ENEMY_KILL_POINTS
    multi = sum(multi_kill_bonus(kills) for kills in multi_kills)
    damage = damage_points(hits_taken)
    total = max(0, victory + time + enemies + multi + damage)
    return ScoreBreakdown(victory, time, enemies, multi, damage, total)
