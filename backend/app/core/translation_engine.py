"""Translation engine with dual backends:

1. Helsinki-NLP MarianMT — dedicated per-language-pair models via English pivot
2. Facebook NLLB-200 — single multilingual model as fallback (200 languages, direct translation)

Languages with dedicated MarianMT models use those (better quality for major pairs).
Languages without (e.g. Farsi) use NLLB-200-distilled-600M.
"""

import logging
from typing import Optional

from transformers import MarianMTModel, MarianTokenizer

from app.core.language_registry import SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

# NLLB-200 language codes (BCP-47 style used by facebook/nllb-200-distilled-600M)
NLLB_LANG_CODES: dict[str, str] = {
    "nl": "nld_Latn",
    "en": "eng_Latn",
    "ar": "arb_Arab",
    "tr": "tur_Latn",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "es": "spa_Latn",
    "pl": "pol_Latn",
    "ru": "rus_Cyrl",
    "uk": "ukr_Cyrl",
    "zh": "zho_Hans",
    "it": "ita_Latn",
    "pt": "por_Latn",
    "fa": "pes_Arab",
    "so": "som_Latn",
    "ti": "tir_Ethi",
}

NLLB_MODEL_NAME = "facebook/nllb-200-distilled-600M"


class TranslationError(Exception):
    """Raised when translation fails."""
    pass


class TranslationEngine:
    """Handles text translation using MarianMT (primary) and NLLB (fallback).

    MarianMT languages pivot through English: source -> en -> target
    NLLB languages translate directly between any pair.
    """

    def __init__(self) -> None:
        # MarianMT models (per language pair)
        self._models: dict[str, Optional[MarianMTModel]] = {}
        self._tokenizers: dict[str, Optional[MarianTokenizer]] = {}
        self._loaded_languages: set[str] = set()

        # NLLB model (shared, lazy-loaded)
        self._nllb_model = None
        self._nllb_tokenizer = None
        self._nllb_loaded: bool = False

    # --- NLLB backend ---

    def load_nllb(self) -> None:
        """Load the NLLB-200-distilled-600M model (once, shared for all NLLB languages)."""
        if self._nllb_loaded:
            return

        try:
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

            logger.info("Loading NLLB model: %s", NLLB_MODEL_NAME)
            try:
                self._nllb_tokenizer = AutoTokenizer.from_pretrained(NLLB_MODEL_NAME, local_files_only=True)
                self._nllb_model = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL_NAME, local_files_only=True)
            except Exception:
                logger.info("Local cache miss for NLLB, downloading...")
                self._nllb_tokenizer = AutoTokenizer.from_pretrained(NLLB_MODEL_NAME)
                self._nllb_model = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL_NAME)
            self._nllb_loaded = True
            logger.info("NLLB model loaded successfully")
        except Exception as e:
            raise TranslationError(f"Failed to load NLLB model: {e}") from e

    def _translate_nllb(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate directly between any two languages using NLLB."""
        if not self._nllb_loaded:
            raise TranslationError("NLLB model not loaded")

        src_code = NLLB_LANG_CODES.get(source_lang)
        tgt_code = NLLB_LANG_CODES.get(target_lang)

        if not src_code:
            raise TranslationError(f"No NLLB code for language: {source_lang}")
        if not tgt_code:
            raise TranslationError(f"No NLLB code for language: {target_lang}")

        try:
            self._nllb_tokenizer.src_lang = src_code
            inputs = self._nllb_tokenizer(text, return_tensors="pt", padding=True, truncation=True)
            forced_bos = self._nllb_tokenizer.convert_tokens_to_ids(tgt_code)
            translated = self._nllb_model.generate(
                **inputs,
                forced_bos_token_id=forced_bos,
                max_length=512,
                num_beams=4,
                no_repeat_ngram_size=3,
            )
            result = self._nllb_tokenizer.decode(translated[0], skip_special_tokens=True)
            logger.debug("NLLB %s->%s: %d chars -> %d chars", source_lang, target_lang, len(text), len(result))
            return result
        except Exception as e:
            raise TranslationError(f"NLLB translation failed ({source_lang}->{target_lang}): {e}") from e

    # --- MarianMT backend ---

    def _model_key(self, lang: str, direction: str) -> str:
        """Create a cache key for a model. direction: 'to_en' or 'from_en'."""
        return f"{lang}_{direction}"

    def load_language(self, lang_code: str) -> None:
        """Load translation models for a language.

        For MarianMT languages: loads both to_en and from_en model pairs.
        For NLLB languages: loads the shared NLLB model (if not already loaded).
        """
        if lang_code in self._loaded_languages:
            return

        info = SUPPORTED_LANGUAGES.get(lang_code)
        if not info:
            raise TranslationError(f"Unknown language: {lang_code}")

        engine = info.get("engine", "marianmt")

        if engine == "nllb":
            self.load_nllb()
            self._loaded_languages.add(lang_code)
            return

        # MarianMT: load both direction models
        models = info["models"]
        for direction in ("to_en", "from_en"):
            model_name = models[direction]
            key = self._model_key(lang_code, direction)

            if key in self._models:
                continue

            try:
                logger.info("Loading model: %s (%s %s)", model_name, lang_code, direction)
                try:
                    tokenizer = MarianTokenizer.from_pretrained(model_name, local_files_only=True)
                    model = MarianMTModel.from_pretrained(model_name, local_files_only=True)
                except Exception:
                    logger.info("Local cache miss for %s, downloading...", model_name)
                    tokenizer = MarianTokenizer.from_pretrained(model_name)
                    model = MarianMTModel.from_pretrained(model_name)
                self._tokenizers[key] = tokenizer
                self._models[key] = model
                logger.info("Loaded: %s", model_name)
            except Exception as e:
                raise TranslationError(
                    f"Failed to load model '{model_name}': {e}"
                ) from e

        self._loaded_languages.add(lang_code)

    def is_language_loaded(self, lang_code: str) -> bool:
        return lang_code in self._loaded_languages

    def _get_engine(self, lang_code: str) -> str:
        """Get which engine a language uses."""
        info = SUPPORTED_LANGUAGES.get(lang_code, {})
        return info.get("engine", "marianmt")

    def _translate_single(self, text: str, lang: str, direction: str) -> str:
        """Translate using a single MarianMT model. direction: 'to_en' or 'from_en'."""
        key = self._model_key(lang, direction)
        tokenizer = self._tokenizers.get(key)
        model = self._models.get(key)

        if tokenizer is None or model is None:
            raise TranslationError(f"Model not loaded: {lang} {direction}")

        try:
            inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
            translated = model.generate(
                **inputs,
                max_length=512,
                num_beams=4,
                no_repeat_ngram_size=3,
            )
            return tokenizer.decode(translated[0], skip_special_tokens=True)
        except Exception as e:
            raise TranslationError(f"Translation failed ({lang} {direction}): {e}") from e

    # --- Main translate method ---

    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text between any two supported languages.

        Routing:
        - If either language uses NLLB → translate directly via NLLB
        - Otherwise → MarianMT English pivot (source -> en -> target)
        """
        if not text or not text.strip():
            return ""

        text = text.strip()

        if source_lang == target_lang:
            return text

        src_engine = self._get_engine(source_lang)
        tgt_engine = self._get_engine(target_lang)

        # If either side uses NLLB, route through NLLB (it can handle any pair directly)
        if src_engine == "nllb" or tgt_engine == "nllb":
            if not self._nllb_loaded:
                raise TranslationError("NLLB model not loaded")
            return self._translate_nllb(text, source_lang, target_lang)

        # Both sides are MarianMT — use English pivot
        # Source -> English
        if source_lang == "en":
            english_text = text
        else:
            if not self.is_language_loaded(source_lang):
                raise TranslationError(f"Language not loaded: {source_lang}")
            english_text = self._translate_single(text, source_lang, "to_en")
            logger.debug("Pivot %s->en: %d chars", source_lang, len(text))

        # English -> Target
        if target_lang == "en":
            return english_text
        else:
            if not self.is_language_loaded(target_lang):
                raise TranslationError(f"Language not loaded: {target_lang}")
            result = self._translate_single(english_text, target_lang, "from_en")
            logger.debug("Pivot en->%s: %d chars", target_lang, len(result))
            return result

    def get_status(self) -> dict[str, str]:
        """Get loading status per language."""
        status = {
            lang: "loaded" if lang in self._loaded_languages else "not_loaded"
            for lang in SUPPORTED_LANGUAGES
        }
        if self._nllb_loaded:
            status["_nllb"] = "loaded"
        return status

    # Backward compatibility
    def load_all_models(self) -> None:
        """Legacy: load default nl/ar languages."""
        self.load_language("nl")
        self.load_language("ar")
