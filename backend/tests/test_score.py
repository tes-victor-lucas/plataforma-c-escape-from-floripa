import unittest

from score import calculate_score, damage_points, multi_kill_bonus, time_points


class ScoreTests(unittest.TestCase):
    def test_formula_example_and_breakdown(self):
        result = calculate_score(
            won=True,
            elapsed_time_ms=12_999,
            enemies_defeated=3,
            hits_taken=0,
            multi_kills=[3],
        )
        self.assertEqual(result.victoryPoints, 1_000)
        self.assertEqual(result.timePoints, 5_880)
        self.assertEqual(result.enemyPoints, 300)
        self.assertEqual(result.multiKillPoints, 350)
        self.assertEqual(result.damagePoints, 2_000)
        self.assertEqual(result.total, 9_530)

    def test_time_and_damage_never_become_negative(self):
        self.assertEqual(time_points(999), 6_000)
        self.assertEqual(time_points(900_000), 0)
        self.assertEqual(damage_points(0), 2_000)
        self.assertEqual(damage_points(1), 1_200)
        self.assertEqual(damage_points(2), 600)
        self.assertEqual(damage_points(3), 0)

    def test_multi_kill_starts_at_two(self):
        self.assertEqual(multi_kill_bonus(1), 0)
        self.assertEqual(multi_kill_bonus(2), 250)
        self.assertEqual(multi_kill_bonus(3), 350)


if __name__ == "__main__":
    unittest.main()
