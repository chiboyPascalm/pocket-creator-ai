import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PLUGIN_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PLUGIN_DIR))

import creator_ai_plugin as plugin


class PromoFactualGuardTests(unittest.TestCase):
    def test_valid_ai_hook_is_used(self):
        self.assertEqual(
            plugin.safe_promo_hook(
                "Curious about handmade bags?", "Handmade bags"
            ),
            "Curious about handmade bags?",
        )

    def test_unsupported_claim_in_hook_is_replaced(self):
        self.assertEqual(
            plugin.safe_promo_hook(
                "Discover premium handmade bags that last longer?",
                "Handmade bags",
            ),
            "Curious about Handmade bags?",
        )

    def test_hook_without_topic_is_replaced(self):
        self.assertEqual(
            plugin.safe_promo_hook(
                "Curious about stylish accessories?", "Handmade bags"
            ),
            "Curious about Handmade bags?",
        )

    def test_multiline_hook_is_replaced(self):
        self.assertEqual(
            plugin.safe_promo_hook(
                "Curious about handmade bags?\nThey are beautiful.",
                "Handmade bags",
            ),
            "Curious about Handmade bags?",
        )

    def test_business_details_are_inserted_verbatim(self):
        business = (
            "We make handmade bags in different colours and sizes. "
            "Orders are accepted through WhatsApp."
        )
        with patch.object(
            plugin, "ask_anna", return_value="Curious about handmade bags?"
        ) as anna:
            result = plugin.generate({
                "topic": "Handmade bags",
                "kind": "promo",
                "tone": "persuasive",
                "business": business,
                "platform": "instagram",
                "audience": "People interested in handmade bags",
            })

        content = result["data"]["content"]
        self.assertIn("**Curious about handmade bags?**", content)
        self.assertIn(business, content)
        self.assertIn("Want to know more? Request additional information.", content)
        self.assertEqual(content.count(business), 1)
        self.assertEqual(anna.call_count, 1)
        self.assertEqual(result["data"]["provider"], "anna-llm")

    def test_missing_business_details_get_placeholder(self):
        with patch.object(
            plugin, "ask_anna", return_value="Curious about handmade bags?"
        ) as anna:
            result = plugin.generate({
                "topic": "Handmade bags",
                "kind": "promo",
                "business": "",
            })

        content = result["data"]["content"]
        self.assertIn("Curious about handmade bags?", content)
        self.assertIn(
            "[Add verified product or business details here before publishing.]",
            content,
        )
        self.assertEqual(anna.call_count, 1)

    def test_promo_prompt_requests_only_neutral_question(self):
        with patch.object(
            plugin, "ask_anna", return_value="Curious about handmade bags?"
        ) as anna:
            plugin.generate({
                "topic": "Handmade bags",
                "kind": "promo",
                "business": "Available in black and brown.",
                "audience": "People interested in bags",
            })

        prompt = anna.call_args.args[0]
        self.assertIn("question-style hook", prompt)
        self.assertIn("Handmade bags", prompt)
        self.assertNotIn("Available in black and brown.", prompt)
        self.assertNotIn("People interested in bags", prompt)
        anna.assert_called_once()

    def test_promo_discards_model_supplied_hashtags(self):
        content = (
            "A promotional draft.\n\nHashtags:\n"
            "#Luxury #Premium #GuaranteedResults"
        )
        result = plugin.enforce_hashtag_section(
            content, "promo", "general", "Handmade bags", "", ""
        )
        self.assertNotIn("#Luxury", result)
        self.assertNotIn("#Premium", result)
        self.assertNotIn("#GuaranteedResults", result)
        self.assertIn("#HandmadeBags", result)

    def test_promo_hashtag_counts_match_platform_limits(self):
        cases = {
            "tiktok": (3, 5),
            "youtube": (3, 5),
            "instagram": (5, 8),
            "facebook": (3, 5),
            "general": (3, 5),
        }
        for platform, (minimum, maximum) in cases.items():
            with self.subTest(platform=platform):
                result = plugin.enforce_hashtag_section(
                    "A generated promotional draft.",
                    "promo", platform, "Handmade bags", "", "",
                )
                tags = plugin.normalize_hashtags(
                    result.split("Hashtags:", 1)[1], maximum=maximum
                )
                self.assertGreaterEqual(len(tags), minimum)
                self.assertLessEqual(len(tags), maximum)

    def test_topic_hashtags_are_relevant_unique_and_topic_derived(self):
        tags = plugin.safe_topic_hashtags("Handmade bags", 5, 8)
        self.assertGreaterEqual(len(tags), 5)
        self.assertLessEqual(len(tags), 8)
        self.assertEqual(len(tags), len({tag.casefold() for tag in tags}))
        self.assertEqual(
            tags[:5],
            [
                "#HandmadeBags",
                "#Handmade",
                "#Bags",
                "#HandmadeCrafts",
                "#BagStyle",
            ],
        )
        self.assertNotIn("#AboutHandmadeBags", tags)
        self.assertNotIn("#HandmadeBagsInfo", tags)
        self.assertNotIn("#HandmadeBagsDetails", tags)
        self.assertNotIn("#HandmadeBagsTopic", tags)

    def test_unknown_topic_uses_neutral_fallback_only_when_needed(self):
        tags = plugin.safe_topic_hashtags("Astronomy", 3, 5)
        self.assertEqual(tags[0], "#Astronomy")
        self.assertEqual(len(tags), 3)
        self.assertEqual(len(tags), len({tag.casefold() for tag in tags}))

    def test_video_hashtag_repair_keeps_existing_model_path(self):
        with patch.object(
            plugin, "ask_anna",
            return_value="#VideoTopic #VideoDetails #VideoInfo"
        ) as anna:
            result = plugin.enforce_hashtag_section(
                "A video script without hashtags.",
                "video", "general", "Video topic", "", "",
            )
        self.assertIn("Hashtags:", result)
        anna.assert_called_once()

    def test_non_promo_content_keeps_editorial_review(self):
        with patch.object(
            plugin, "ask_anna",
            side_effect=["A draft about a topic.", "An edited draft about a topic."],
        ) as anna:
            result = plugin.generate({
                "topic": "A topic",
                "kind": "caption",
                "tone": "friendly",
            })

        self.assertEqual(anna.call_count, 2)
        self.assertEqual(
            result["data"]["content"], "An edited draft about a topic."
        )


if __name__ == "__main__":
    unittest.main()
