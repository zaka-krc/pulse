from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration chargée depuis les variables d'environnement préfixées par PULSE_."""

    model_config = SettingsConfigDict(env_prefix="PULSE_", env_file=".env", extra="ignore")

    app_name: str = "Pulse Tracker"
    environment: str = "development"
    database_url: str = "sqlite:///./tickets.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8080"]
    seed_demo: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
