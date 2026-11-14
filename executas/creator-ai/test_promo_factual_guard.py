import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PLUGIN_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PLUGIN_DIR))

import creator_ai_plugin as plugin


class PromoFactualGuardTests(unittest.TestCase):
    def test_promo_uses_deterministic_copy_without_calling_model(self):
        with patch.object(plugin, "ask_anna") as anna:
            result = plugin.generate({
                "topic": "Handmade bags",
                "kind": "promo",
                "tone": "persuasive",
                "business": "",
                "platform": "general",
            })

        self.assertTrue(result["success"])
        content = result["data"]["content"]
        self.assertIn("**Handmade bags**", content)
        self.assertIn("[Add verified product or business details here", content)
        self.assertIn("Hashtags:", content)
        anna.assert_not_called()

    def test_unsupported_promotional_claims_cannot_enter_from_model(self):
        unsafe_model_output = (
            "Durable bags with reinforced stitching and premium materials. "
            "#QualityCraftsmanship #BuiltToLast #HandmadeBags"
        )

        with patch.object(
            plugin, "ask_anna", return_value=unsafe_model_output
        ) as anna:
            result = plugin.generate({
                "topic": "Handmade bags",
                "kind": "promo",
                "business": "",
                "platform": "general",
            })

        content = result["data"]["content"]
        self.assertNotIn("Durable bags", content)
        self.assertNotIn("reinforced stitching", content)
        self.assertNotIn("premium materials", content)
        self.assertNotIn("#QualityCraftsmanship", content)
        self.assertNotIn("#BuiltToLast", content)
        anna.assert_not_called()

    def test_supplied_business_details_are_preserved_verbatim(self):
        details = "Available in black and brown. Price: ₦12,000."
        with patch.object(plugin, "ask_anna") as anna:
            result = plugin.generate({
                "topic": "Handmade bags",
                "kind": "promo",
                "business": details,
                "platform": "general",
            })

        content = result["data"]["content"]
        self.assertIn(details, content)
        self.assertNotIn("[Add verified product", content)
        anna.assert_not_called()

    def test_promo_discards_all_model_hashtags(self):
        content = (
            "A draft.\n\nHashtags:\n"
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
                    "**Handmade bags**",
                    "promo",
                    platform,
                    "Handmade bags",
                    "",
                    "",
                )
                tags = plugin.normalize_hashtags(
                    result.split("Hashtags:", 1)[1], maximum=maximum
                )
                self.assertGreaterEqual(len(tags), minimum)
                self.assertLessEqual(len(tags), maximum)

    def test_topic_hashtags_are_unique_and_topic_derived(self):
        tags = plugin.safe_topic_hashtags("Handmade bags", 5, 8)
        self.assertGreaterEqual(len(tags), 5)
        self.assertLessEqual(len(tags), 8)
        self.assertEqual(len(tags), len({tag.casefold() for tag in tags}))
        self.assertIn("#HandmadeBags", tags)
        self.assertIn("#Handmade", tags)
        self.assertIn("#Bags", tags)

    def test_video_hashtag_repair_keeps_existing_model_path(self):
        with patch.object(
            plugin, "ask_anna",
            return_value="#VideoTopic #VideoDetails #VideoInfo"
        ) as anna:
            result = plugin.enforce_hashtag_section(
                "A video script without hashtags.",
                "video",
                "general",
                "Video topic",
                "",
                "",
            )
        self.assertIn("Hashtags:", result)
        anna.assert_called_once()

    def test_non_promo_content_keeps_editorial_review(self):
        first = "A draft about a topic."
        reviewed = "An edited draft about a topic."
        with patch.object(
            plugin, "ask_anna", side_effect=[first, reviewed]
        ) as anna:
            result = plugin.generate({
                "topic": "A topic",
                "kind": "caption",
                "tone": "friendly",
            })

        self.assertEqual(anna.call_count, 2)
        self.assertEqual(result["data"]["content"], reviewed)


if __name__ == "__main__":
    unittest.main()
